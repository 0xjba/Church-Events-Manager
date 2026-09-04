// Score submission with an offline queue.
//
// The queue lives in IndexedDB: it used to be an in-memory array, so a refresh
// or a closed tab silently discarded every score the judge had been told was
// "cached offline".

import { supabase } from '@/integrations/supabase/client';

export interface CriterionScore {
  criteria_id: string;
  score: number;
}

export interface Scoresheet {
  eventId: string;
  participantId?: string;
  groupId?: string;
  scores: CriterionScore[];
}

interface QueuedScoresheet extends Scoresheet {
  id: string;
  queuedAt: number;
}

const DB_NAME = 'devotional-events';
const DB_VERSION = 1;
const STORE = 'pending-scoresheets';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = fn(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

class ScoreSubmissionService {
  private isOnline: boolean = navigator.onLine;
  private listeners = new Set<(count: number) => void>();

  constructor() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      void this.syncPending();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
    // Anything left over from a previous session goes out on startup.
    void this.syncPending();
  }

  onPendingChange(listener: (count: number) => void): () => void {
    this.listeners.add(listener);
    void this.getPendingCount().then(listener);
    return () => this.listeners.delete(listener);
  }

  private async notify(): Promise<void> {
    const count = await this.getPendingCount();
    this.listeners.forEach((listener) => listener(count));
  }

  async getPendingCount(): Promise<number> {
    try {
      return await withStore('readonly', (store) => store.count());
    } catch {
      return 0;
    }
  }

  isNetworkOnline(): boolean {
    return this.isOnline;
  }

  // Submits a complete scoresheet. Returns true when it reached the server and
  // false when it was queued for later.
  async submitScoresheet(sheet: Scoresheet): Promise<boolean> {
    if (!this.isOnline) {
      await this.enqueue(sheet);
      return false;
    }

    try {
      await this.send(sheet);
      return true;
    } catch (error) {
      // Network failures are worth retrying; a rejection from the server
      // (already scored, validation) is not, so it surfaces to the judge.
      if (isNetworkError(error)) {
        await this.enqueue(sheet);
        return false;
      }
      throw error;
    }
  }

  private async enqueue(sheet: Scoresheet): Promise<void> {
    const queued: QueuedScoresheet = {
      ...sheet,
      id: crypto.randomUUID(),
      queuedAt: Date.now(),
    };
    await withStore('readwrite', (store) => store.add(queued));
    await this.notify();
  }

  private async send(sheet: Scoresheet): Promise<void> {
    const token = localStorage.getItem('participant_token');
    if (!token) throw new Error('Your session has expired. Please sign in again.');

    const { data, error } = await supabase.functions.invoke('scores/submit', {
      body: {
        event_id: sheet.eventId,
        participant_id: sheet.participantId ?? null,
        group_id: sheet.groupId ?? null,
        scores: sheet.scores,
      },
      headers: { Authorization: `Bearer ${token}` },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);
  }

  async syncPending(): Promise<void> {
    if (!this.isOnline) return;

    let queued: QueuedScoresheet[] = [];
    try {
      queued = await withStore<QueuedScoresheet[]>('readonly', (store) => store.getAll());
    } catch {
      return;
    }

    for (const sheet of queued) {
      try {
        await this.send(sheet);
        await withStore('readwrite', (store) => store.delete(sheet.id));
      } catch (error) {
        if (!isNetworkError(error)) {
          // The server refused it outright; retrying forever would never help.
          console.error('Dropping unsendable scoresheet:', error);
          await withStore('readwrite', (store) => store.delete(sheet.id));
        }
      }
    }

    await this.notify();
  }
}

function isNetworkError(error: unknown): boolean {
  if (!navigator.onLine) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /network|fetch|timeout|failed to send/i.test(message);
}

export const scoreSubmissionService = new ScoreSubmissionService();
