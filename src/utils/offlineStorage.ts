// Offline storage utilities using IndexedDB
interface OfflineScore {
  id?: number;
  eventId: string;
  participantId: string;
  judgeId: string;
  scores: Record<string, number>;
  timestamp: number;
  synced: boolean;
}

interface OfflineEvent {
  id: string;
  name: string;
  description: string;
  start_time: string;
  end_time: string;
  status: string;
  criteria: any[];
}

class OfflineStorageService {
  private db: IDBDatabase | null = null;
  private dbName = 'DevotionalEventsDB';
  private version = 1;

  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create offline scores store
        if (!db.objectStoreNames.contains('offline_scores')) {
          const scoresStore = db.createObjectStore('offline_scores', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          scoresStore.createIndex('eventId', 'eventId', { unique: false });
          scoresStore.createIndex('timestamp', 'timestamp', { unique: false });
          scoresStore.createIndex('synced', 'synced', { unique: false });
        }

        // Create offline events store
        if (!db.objectStoreNames.contains('offline_events')) {
          const eventsStore = db.createObjectStore('offline_events', { 
            keyPath: 'id' 
          });
          eventsStore.createIndex('status', 'status', { unique: false });
        }

        // Create offline participants store
        if (!db.objectStoreNames.contains('offline_participants')) {
          const participantsStore = db.createObjectStore('offline_participants', { 
            keyPath: 'id' 
          });
        }
      };
    });
  }

  // Score management
  async saveOfflineScore(score: Omit<OfflineScore, 'id' | 'synced'>): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_scores'], 'readwrite');
      const store = transaction.objectStore('offline_scores');
      
      const scoreData: Omit<OfflineScore, 'id'> = {
        ...score,
        synced: false
      };
      
      const request = store.add(scoreData);
      
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async getOfflineScores(eventId?: string): Promise<OfflineScore[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_scores'], 'readonly');
      const store = transaction.objectStore('offline_scores');
      
      let request: IDBRequest;
      
      if (eventId) {
        const index = store.index('eventId');
        request = index.getAll(eventId);
      } else {
        request = store.getAll();
      }
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedScores(): Promise<OfflineScore[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_scores'], 'readonly');
      const store = transaction.objectStore('offline_scores');
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        const allScores = request.result;
        const unsyncedScores = allScores.filter(score => !score.synced);
        resolve(unsyncedScores);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async markScoreSynced(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_scores'], 'readwrite');
      const store = transaction.objectStore('offline_scores');
      
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const score = getRequest.result;
        if (score) {
          score.synced = true;
          const updateRequest = store.put(score);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteOfflineScore(id: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_scores'], 'readwrite');
      const store = transaction.objectStore('offline_scores');
      
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Event caching for offline access
  async cacheEvent(event: OfflineEvent): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_events'], 'readwrite');
      const store = transaction.objectStore('offline_events');
      
      const request = store.put(event);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedEvents(): Promise<OfflineEvent[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_events'], 'readonly');
      const store = transaction.objectStore('offline_events');
      
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedEvent(id: string): Promise<OfflineEvent | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['offline_events'], 'readonly');
      const store = transaction.objectStore('offline_events');
      
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Network status helpers
  isOnline(): boolean {
    return navigator.onLine;
  }

  onNetworkChange(callback: (isOnline: boolean) => void) {
    const handleOnline = () => callback(true);
    const handleOffline = () => callback(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }
}

export const offlineStorageService = new OfflineStorageService();