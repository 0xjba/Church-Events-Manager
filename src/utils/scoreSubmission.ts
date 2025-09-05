// Simple network-aware score submission utility
interface PendingScore {
  id: string;
  eventId: string;
  participantId?: string;
  groupId?: string;
  criteriaId: string;
  judgeId: string;
  score: number;
  timestamp: number;
}

class ScoreSubmissionService {
  private pendingScores: PendingScore[] = [];
  private isOnline: boolean = navigator.onLine;

  constructor() {
    // Listen for network changes
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncPendingScores();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  async submitScore(scoreData: Omit<PendingScore, 'id' | 'timestamp'>): Promise<void> {
    const score: PendingScore = {
      ...scoreData,
      id: `score_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };

    if (this.isOnline) {
      try {
        await this.submitToSupabase(score);
      } catch (error) {
        // If submission fails, add to pending
        this.pendingScores.push(score);
        throw error;
      }
    } else {
      // If offline, add to pending
      this.pendingScores.push(score);
      throw new Error('Network unavailable. Score will be submitted when connection is restored.');
    }
  }

  private async submitToSupabase(score: PendingScore): Promise<void> {
    const { supabase } = await import('@/integrations/supabase/client');
    
    const { error } = await supabase
      .from('scores')
      .insert({
        event_id: score.eventId,
        participant_id: score.participantId,
        group_id: score.groupId,
        criteria_id: score.criteriaId,
        judge_id: score.judgeId,
        score: score.score,
        is_locked: true
      });

    if (error) {
      throw error;
    }
  }

  private async syncPendingScores(): Promise<void> {
    if (!this.isOnline || this.pendingScores.length === 0) {
      return;
    }

    const scoresToSync = [...this.pendingScores];
    this.pendingScores = [];

    for (const score of scoresToSync) {
      try {
        await this.submitToSupabase(score);
      } catch (error) {
        // If sync fails, put back in pending
        this.pendingScores.push(score);
        console.error('Failed to sync pending score:', error);
      }
    }
  }

  getPendingCount(): number {
    return this.pendingScores.length;
  }

  isNetworkOnline(): boolean {
    return this.isOnline;
  }
}

export const scoreSubmissionService = new ScoreSubmissionService();
