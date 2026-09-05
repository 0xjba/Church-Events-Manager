import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useEventLevel } from '@/hooks/useEventLevel';

export interface AdminStats {
  totalParticipants: number;
  activeEvents: number;
  totalJudges: number;
  completedEvents: number;
  totalEvents: number;
  totalScores: number;
  averageScore: number;
}

export const useAdminStats = () => {
  // Counts belong to the event level being worked in; judges are the exception,
  // since a judge account is not tied to one.
  const { levelId } = useEventLevel();
  const [stats, setStats] = useState<AdminStats>({
    totalParticipants: 0,
    activeEvents: 0,
    totalJudges: 0,
    completedEvents: 0,
    totalEvents: 0,
    totalScores: 0,
    averageScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    // The level arrives a moment after mount; filtering on an empty id would
    // fail every count and flash an error the first retry then cleared.
    if (!levelId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch total participants
      const { count: participantsCount, error: participantsError } = await supabase
        .from('participants')
        .select('*', { count: 'exact', head: true })
        .eq('level_id', levelId);

      if (participantsError) throw participantsError;

      // Judges belong to a level exactly as participants do, so an unscoped
      // count here reported every judge in the database against whichever
      // level happened to be selected.
      const { count: judgesCount, error: judgesError } = await supabase
        .from('judges')
        .select('*', { count: 'exact', head: true })
        .eq('level_id', levelId);

      if (judgesError) throw judgesError;

      // Fetch active events (status not 'completed')
      const { count: activeEventsCount, error: activeEventsError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('level_id', levelId)
        .neq('status', 'completed');

      if (activeEventsError) throw activeEventsError;

      // Fetch completed events
      const { count: completedEventsCount, error: completedEventsError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('level_id', levelId)
        .eq('status', 'completed');

      if (completedEventsError) throw completedEventsError;

      // Fetch total events
      const { count: totalEventsCount, error: totalEventsError } = await supabase
        .from('events')
        .select('*', { count: 'exact', head: true })
        .eq('level_id', levelId);

      if (totalEventsError) throw totalEventsError;

      // Scores reach a level only through their event, and they were counted
      // across every level too. With no events there is nothing to ask for,
      // and an empty `in` list would match everything.
      const { data: levelEvents, error: levelEventsError } = await supabase
        .from('events')
        .select('id')
        .eq('level_id', levelId);

      if (levelEventsError) throw levelEventsError;

      const eventIds = (levelEvents ?? []).map((event) => event.id);

      let scoresData: { score: number }[] = [];
      if (eventIds.length > 0) {
        const { data, error: scoresError } = await supabase
          .from('scores')
          .select('score')
          .in('event_id', eventIds);

        if (scoresError) throw scoresError;
        scoresData = data ?? [];
      }

      const totalScores = scoresData.length;
      const averageScore = scoresData.length > 0
        ? scoresData.reduce((sum, item) => sum + item.score, 0) / scoresData.length
        : 0;

      setStats({
        totalParticipants: participantsCount || 0,
        activeEvents: activeEventsCount || 0,
        totalJudges: judgesCount || 0,
        completedEvents: completedEventsCount || 0,
        totalEvents: totalEventsCount || 0,
        totalScores: totalScores,
        averageScore: Math.round(averageScore * 100) / 100, // Round to 2 decimal places
      });
    } catch (err) {
      console.error('Error fetching admin stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // Set up real-time subscriptions for live updates
    const participantsSubscription = supabase
      .channel('participants_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => {
        fetchStats();
      })
      .subscribe();

    const eventsSubscription = supabase
      .channel('events_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => {
        fetchStats();
      })
      .subscribe();

    const judgesSubscription = supabase
      .channel('judges_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'judges' }, () => {
        fetchStats();
      })
      .subscribe();

    const scoresSubscription = supabase
      .channel('scores_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => {
        fetchStats();
      })
      .subscribe();

    // Cleanup subscriptions
    return () => {
      participantsSubscription.unsubscribe();
      eventsSubscription.unsubscribe();
      judgesSubscription.unsubscribe();
      scoresSubscription.unsubscribe();
    };
  }, [levelId]);

  return { stats, loading, error, refetch: fetchStats };
};
