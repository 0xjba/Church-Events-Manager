import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { offlineStorageService } from '@/utils/offlineStorage';
import { notificationService } from '@/utils/notifications';
import { message } from 'antd';

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [unsyncedCount, setUnsyncedCount] = useState(0);

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
        message.success("Back Online - Syncing offline data...");
      } else {
        message.info("Offline Mode - Scores will be saved locally and synced when online");
      }
    });

    return cleanup;
  }, []);

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
        message.success(`Sync Complete - Synced ${unsyncedScores.length} offline scores`);
      }
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus('error');
      message.error("Sync Failed - Some data couldn't be synced. Will retry automatically.");
    }
  }, [isOnline, syncStatus, updateUnsyncedCount]);

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
      
      message.success(isOnline 
        ? "Score Saved - Will be synced automatically" 
        : "Score Saved Offline - Will sync when online");

      // Try to sync immediately if online
      if (isOnline) {
        setTimeout(syncOfflineData, 1000);
      }

      return scoreId;
    } catch (error) {
      console.error('Failed to save offline score:', error);
      message.error("Save Failed - Failed to save score offline");
      throw error;
    }
  }, [isOnline, syncOfflineData, updateUnsyncedCount]);

  return {
    isOnline,
    syncStatus,
    unsyncedCount,
    syncOfflineData,
    saveScoreOffline,
    updateUnsyncedCount
  };
}
