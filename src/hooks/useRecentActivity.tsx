import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEventLevel } from '@/hooks/useEventLevel';

export interface RecentActivity {
  id: string;
  type: 'event' | 'participant' | 'judge' | 'score';
  title: string;
  description: string;
  timestamp: string;
  action: string;
}

export const useRecentActivity = () => {
  const { levelId } = useEventLevel();
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecentActivity = async () => {
    // Every screen reports on the level chosen in the top bar, and this feed
    // read the whole database: it only looked right while the newest rows
    // happened to belong to the selected level.
    if (!levelId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const allActivities: RecentActivity[] = [];

      // Fetch recent events
      const { data: recentEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, name, created_at, status')
        .eq('level_id', levelId)
        .order('created_at', { ascending: false })
        .limit(3);

      if (eventsError) throw eventsError;

      recentEvents?.forEach(event => {
        allActivities.push({
          id: event.id,
          type: 'event',
          title: event.name,
          description: `Event ${event.status}`,
          timestamp: event.created_at,
          action: event.status === 'completed' ? 'completed' : 'created',
        });
      });

      // Fetch recent participants
      const { data: recentParticipants, error: participantsError } = await supabase
        .from('participants')
        .select('id, full_name, created_at')
        .eq('level_id', levelId)
        .order('created_at', { ascending: false })
        .limit(2);

      if (participantsError) throw participantsError;

      recentParticipants?.forEach(participant => {
        allActivities.push({
          id: participant.id,
          type: 'participant',
          title: participant.full_name,
          description: 'New participant registered',
          timestamp: participant.created_at,
          action: 'registered',
        });
      });

      // Scores belong to a level only through their event. An empty `in` list
      // matches every row, so with no events there is nothing to ask for.
      const { data: levelEvents, error: levelEventsError } = await supabase
        .from('events')
        .select('id')
        .eq('level_id', levelId);

      if (levelEventsError) throw levelEventsError;

      const eventIds = (levelEvents ?? []).map((event) => event.id);
      let recentScores: { id: string; created_at: string; score: number }[] = [];

      if (eventIds.length > 0) {
        const { data, error: scoresError } = await supabase
          .from('scores')
          .select('id, created_at, score')
          .in('event_id', eventIds)
          .order('created_at', { ascending: false })
          .limit(2);

        if (scoresError) throw scoresError;
        recentScores = data ?? [];
      }

      recentScores?.forEach(score => {
        allActivities.push({
          id: score.id,
          type: 'score',
          title: `Score: ${score.score}`,
          description: 'New score submitted',
          timestamp: score.created_at,
          action: 'submitted',
        });
      });

      // Sort all activities by timestamp and take the most recent 5
      const sortedActivities = allActivities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);

      setActivities(sortedActivities);
    } catch (err) {
      console.error('Error fetching recent activity:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch recent activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentActivity();

    // Set up real-time subscriptions for live updates
    const eventsSubscription = supabase
      .channel('recent_events_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        fetchRecentActivity();
      })
      .subscribe();

    const participantsSubscription = supabase
      .channel('recent_participants_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
        fetchRecentActivity();
      })
      .subscribe();

    const scoresSubscription = supabase
      .channel('recent_scores_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
        fetchRecentActivity();
      })
      .subscribe();

    // Cleanup subscriptions
    return () => {
      eventsSubscription.unsubscribe();
      participantsSubscription.unsubscribe();
      scoresSubscription.unsubscribe();
    };
  }, [levelId]);

  return { activities, loading, error, refetch: fetchRecentActivity };
};
