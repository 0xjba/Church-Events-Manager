import { useEffect, useState } from 'react';
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

  useEffect(() => {
    // Initial fetch
    if (eventId) {
      fetchScores();
    }

    // Set up real-time subscription
    const channel = supabase
      .channel('scores-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scores',
          ...(eventId && { filter: `event_id=eq.${eventId}` })
        },
        (payload) => {
          console.log('Score change received:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newScore = payload.new as Score;
            setScores(prev => [...prev, newScore]);
            onScoreUpdate?.(newScore);
          } else if (payload.eventType === 'UPDATE') {
            const updatedScore = payload.new as Score;
            setScores(prev => 
              prev.map(score => score.id === updatedScore.id ? updatedScore : score)
            );
            onScoreUpdate?.(updatedScore);
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
  }, [eventId, onScoreUpdate]);

  const fetchScores = async () => {
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
  };

  return {
    scores,
    loading,
    refetch: fetchScores
  };
};