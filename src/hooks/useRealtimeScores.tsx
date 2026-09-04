import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Score {
  id: string;
  event_id: string;
  judge_id: string;
  participant_id: string;
  criteria_id: string;
  score: number;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

interface UseRealtimeScoresProps {
  eventId?: string;
  onScoreUpdate?: (score: Score) => void;
}

export const useRealtimeScores = ({ eventId, onScoreUpdate }: UseRealtimeScoresProps = {}) => {
  const [scores, setScores] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);

  // Held in a ref so an inline callback from the caller does not tear down and
  // rebuild the subscription on every render.
  const onScoreUpdateRef = useRef(onScoreUpdate);
  useEffect(() => {
    onScoreUpdateRef.current = onScoreUpdate;
  }, [onScoreUpdate]);

  const fetchScores = useCallback(async () => {
    if (!eventId) return;

    try {
      const { data, error } = await supabase
        .from('scores')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setScores(data || []);
    } catch (error) {
      console.error('Error fetching scores:', error);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    // Initial fetch
    if (eventId) {
      fetchScores();
    }

    // Set up real-time subscription
    const channel = supabase
      .channel(`scores-changes-${eventId ?? 'all'}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
          ...(eventId && { filter: `event_id=eq.${eventId}` })
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newScore = payload.new as Score;
            setScores(prev => [...prev, newScore]);
            onScoreUpdateRef.current?.(newScore);
          } else if (payload.eventType === 'UPDATE') {
            const updatedScore = payload.new as Score;
            setScores(prev => 
              prev.map(score => score.id === updatedScore.id ? updatedScore : score)
            );
            onScoreUpdateRef.current?.(updatedScore);
          } else if (payload.eventType === 'DELETE') {
            const deletedScore = payload.old as Score;
            setScores(prev => prev.filter(score => score.id !== deletedScore.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, fetchScores]);

  return {
    scores,
    loading,
    refetch: fetchScores
  };
};