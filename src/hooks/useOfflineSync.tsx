import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { offlineStorageService } from '@/utils/offlineStorage';
import { notificationService } from '@/utils/notifications';
import { useToast } from '@/hooks/use-toast';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const { toast } = useToast();

  // Initialize offline storage and check for unsynced data
  useEffect(() => {
    const init = async () => {
      try {
        await offlineStorageService.init();
        await updateUnsyncedCount();
      } catch (error) {
        console.error('Failed to initialize offline storage:', error);
      }
    };

    init();
  }, []);

  // Monitor network status
  useEffect(() => {
    const cleanup = offlineStorageService.onNetworkChange((online) => {
      setIsOnline(online);
      if (online) {
        // Auto-sync when coming back online
        syncOfflineData();
        toast({
          title: "Back Online",
          description: "Syncing offline data...",
        });
      } else {
        toast({
          title: "Offline Mode",
          description: "Scores will be saved locally and synced when online",
        });
      }
    });

    return cleanup;
  }, [toast]);

  const updateUnsyncedCount = useCallback(async () => {
    try {
      const unsyncedScores = await offlineStorageService.getUnsyncedScores();
      setUnsyncedCount(unsyncedScores.length);
    } catch (error) {
      console.error('Failed to update unsynced count:', error);
    }
  }, []);

  const syncOfflineData = useCallback(async () => {
    if (!isOnline || syncStatus === 'syncing') return;

    setSyncStatus('syncing');
    
    try {
      const unsyncedScores = await offlineStorageService.getUnsyncedScores();
      
      for (const score of unsyncedScores) {
        try {
          // Submit score to Supabase - submit individual criteria scores
          const criteriaScores = Object.entries(score.scores).map(([criteriaId, scoreValue]) => ({
            event_id: score.eventId,
            participant_id: score.participantId,
            judge_id: score.judgeId,
            criteria_id: criteriaId,
            score: scoreValue
          }));

          const { error } = await supabase
            .from('scores')
            .insert(criteriaScores);

          if (error) throw error;

          // Mark as synced or delete from offline storage
          if (score.id) {
            await offlineStorageService.deleteOfflineScore(score.id);
          }
        } catch (error) {
          console.error('Failed to sync score:', error);
          // Keep the score in offline storage for retry
        }
      }

      await updateUnsyncedCount();
      setSyncStatus('idle');
      
      if (unsyncedScores.length > 0) {
        toast({
          title: "Sync Complete",
          description: `Synced ${unsyncedScores.length} offline scores`,
        });
      }
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus('error');
      toast({
        title: "Sync Failed",
        description: "Some data couldn't be synced. Will retry automatically.",
        variant: "destructive"
      });
    }
  }, [isOnline, syncStatus, toast, updateUnsyncedCount]);

  const saveScoreOffline = useCallback(async (
    eventId: string,
    participantId: string,
    judgeId: string,
    scores: Record<string, number>
  ) => {
    try {
      const scoreId = await offlineStorageService.saveOfflineScore({
        eventId,
        participantId,
        judgeId,
        scores,
        timestamp: Date.now()
      });

      await updateUnsyncedCount();
      
      toast({
        title: isOnline ? "Score Saved" : "Score Saved Offline",
        description: isOnline 
          ? "Score saved and will be synced automatically" 
          : "Score saved locally and will sync when online",
      });

      // Try to sync immediately if online
      if (isOnline) {
        setTimeout(syncOfflineData, 1000);
      }

      return scoreId;
    } catch (error) {
      console.error('Failed to save offline score:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save score offline",
        variant: "destructive"
      });
      throw error;
    }
  }, [isOnline, syncOfflineData, toast, updateUnsyncedCount]);

  return {
    isOnline,
    syncStatus,
    unsyncedCount,
    syncOfflineData,
    saveScoreOffline,
    updateUnsyncedCount
  };
}
