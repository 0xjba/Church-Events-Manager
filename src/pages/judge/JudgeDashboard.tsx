import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { message } from 'antd';
import { ArrowsClockwise, CaretRight, Clock, Gavel, UsersThree } from '@phosphor-icons/react';
import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import { supabase } from '@/integrations/supabase/client';
import type { FormValues } from '@/lib/types';
import { AppShell } from '@/components/shell/AppShell';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import {
  Card,
  EmptyState,
  ProgressBar,
  Skeleton,
  StatusPill,
  statusTone,
} from '@/components/ui/primitives';
import { SegmentedControl } from '@/components/ui/inputs';

interface AssignedEvent {
  id: string;
  name: string;
  type: string;
  status: string;
  time_limit: number | null;
  event_order: number | null;
  participants_count: number;
  my_scores_count: number;
  total_criteria: number;
  level_id: string;
  age_category: string | null;
  event_levels?: { id: string; name: string; is_active: boolean };
}

type Filter = 'todo' | 'done' | 'all';

const JudgeDashboard = () => {
  const { participant } = useParticipantAuth();
  const [assignedEvents, setAssignedEvents] = useState<AssignedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('todo');

  const fetchJudgeData = useCallback(async () => {
    if (!participant?.id) {
      setLoading(false);
      return;
    }

    try {
      // Which levels are still running; anything else is put away.
      const { data: activeLevels, error: levelsError } = await supabase
        .from('event_levels')
        .select('id')
        .eq('is_active', true);

      if (levelsError) throw levelsError;
      const runningLevels = new Set((activeLevels ?? []).map((level) => level.id));

      const { data: eventsData, error: eventsError } = await supabase
        .from('event_judges')
        .select(
          `events (
            id, name, type, status, time_limit, event_order, level_id, age_category,
            event_levels ( id, name, is_active )
          )`,
        )
        .eq('judge_id', participant.id);

      if (eventsError) throw eventsError;

      // Score counts come from the edge function: the scores table is closed to
      // clients, and the judge is identified by their token.
      const token = localStorage.getItem('participant_token');
      const { data: summary } = await supabase.functions.invoke('scores/summary', {
        body: {},
        headers: { Authorization: `Bearer ${token}` },
      });
      const scoreCounts: Record<string, number> = summary?.counts ?? {};

      // Events under a level that has been put away are not the judge's concern.
      const assignments = (eventsData ?? []).filter((eventJudge: FormValues) =>
        runningLevels.has(eventJudge.events?.level_id),
      );

      const enrichedEvents = await Promise.all(
        assignments.map(async (eventJudge: FormValues) => {
          const event = eventJudge.events;

          const [{ count: participantCount }, { count: criteriaCount }] = await Promise.all([
            supabase
              .from('event_participants')
              .select('*', { count: 'exact', head: true })
              .eq('event_id', event.id),
            supabase
              .from('event_criteria')
              .select('*', { count: 'exact', head: true })
              .eq('event_id', event.id),
          ]);

          return {
            ...event,
            participants_count: participantCount || 0,
            my_scores_count: scoreCounts[event.id] ?? 0,
            total_criteria: criteriaCount || 0,
          } as AssignedEvent;
        }),
      );

      enrichedEvents.sort((a, b) => {
        if (a.event_order === null && b.event_order === null) return 0;
        if (a.event_order === null) return 1;
        if (b.event_order === null) return -1;
        return a.event_order - b.event_order;
      });

      setAssignedEvents(enrichedEvents);
    } catch {
      message.error('Failed to load assigned events');
    } finally {
      setLoading(false);
    }
  }, [participant?.id]);

  useEffect(() => {
    fetchJudgeData();
  }, [fetchJudgeData]);

  // Live updates when an admin assigns an event or flips its status.
  useEffect(() => {
    if (!participant?.id) return;

    const channel = supabase
      .channel(`judge-dashboard-${participant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_judges',
          filter: `judge_id=eq.${participant.id}`,
        },
        () => fetchJudgeData(),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () =>
        fetchJudgeData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [participant?.id, fetchJudgeData]);

  const progressOf = (event: AssignedEvent) => {
    const expected = event.participants_count * event.total_criteria;
    if (expected === 0) return 0;
    return Math.round((event.my_scores_count / expected) * 100);
  };

  const isComplete = (event: AssignedEvent) => progressOf(event) === 100;
  const done = assignedEvents.filter(isComplete);
  const todo = assignedEvents.filter((event) => !isComplete(event));
  const visible = filter === 'all' ? assignedEvents : filter === 'done' ? done : todo;

  return (
    <AppShell title="My events" subtitle={participant?.full_name ?? 'Judge'}>
      <PWAInstallPrompt />
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : (
        <>
          <SegmentedControl
            value={filter}
            onChange={(value) => setFilter(value as Filter)}
            className="mb-4"
            options={[
              { value: 'todo', label: 'To score', count: todo.length },
              { value: 'done', label: 'Done', count: done.length },
              { value: 'all', label: 'All', count: assignedEvents.length },
            ]}
          />

          {visible.length === 0 ? (
            <EmptyState
              icon={<Gavel size={22} />}
              title={
                assignedEvents.length === 0
                  ? 'No events assigned yet'
                  : filter === 'done'
                    ? 'Nothing finished yet'
                    : 'All caught up'
              }
              description={
                assignedEvents.length === 0
                  ? 'An administrator will assign you to events before the competition starts.'
                  : filter === 'done'
                    ? 'Events you finish scoring will be listed here.'
                    : 'Every event assigned to you has been fully scored.'
              }
            />
          ) : (
            <div className="space-y-3">
              {visible.map((event) => {
                const progress = progressOf(event);
                const complete = isComplete(event);
                const scorable = event.status === 'active' && !complete;
                const expected = event.participants_count * event.total_criteria;

                const body = (
                  <Card className={scorable ? 'border-primary/40' : undefined}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {event.event_order !== null && (
                              <span className="tnum rounded-md bg-muted px-1.5 py-0.5 text-caption font-semibold text-muted-foreground">
                                #{event.event_order}
                              </span>
                            )}
                            <h2 className="truncate text-title font-semibold text-foreground">
                              {event.name}
                            </h2>
                          </div>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
                            <span className="capitalize">
                              {event.age_category || 'All categories'}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <UsersThree size={12} /> {event.participants_count}
                            </span>
                            {event.time_limit && (
                              <span className="inline-flex items-center gap-1">
                                <Clock size={12} /> {event.time_limit} min
                              </span>
                            )}
                          </div>
                        </div>
                        <StatusPill tone={complete ? 'success' : statusTone(event.status)} dot>
                          {complete ? 'Scored' : event.status}
                        </StatusPill>
                      </div>

                      <div className="mt-4">
                        <div className="mb-1.5 flex items-center justify-between text-caption">
                          <span className="font-medium text-foreground">
                            {complete ? 'Scoring complete' : 'Your progress'}
                          </span>
                          <span className="tnum text-muted-foreground">
                            {event.my_scores_count}/{expected}
                          </span>
                        </div>
                        <ProgressBar value={progress} tone={complete ? 'success' : 'primary'} />
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-caption text-muted-foreground">
                          {complete
                            ? 'No entrants left to score'
                            : event.status === 'active'
                                ? progress > 0
                                  ? 'Continue where you left off'
                                  : 'Ready to score'
                                : event.status === 'upcoming'
                                  ? 'Opens when the event starts'
                                  : 'Not available'}
                        </span>
                        {scorable && (
                          <span className="inline-flex items-center gap-1 text-body font-semibold text-primary">
                            {progress > 0 ? 'Continue' : 'Start'}
                            <CaretRight size={16} />
                          </span>
                        )}
                      </div>
                    </div>
                  </Card>
                );

                // The whole card is the tap target when the event is scorable.
                return scorable ? (
                  <Link key={event.id} to={`/judge/score/${event.id}`} className="block">
                    {body}
                  </Link>
                ) : (
                  <div key={event.id}>{body}</div>
                );
              })}
            </div>
          )}

          {assignedEvents.length > 0 && (
            <p className="mt-5 flex items-center justify-center gap-1.5 text-caption text-muted-foreground">
              <ArrowsClockwise size={13} />
              Updates automatically as events change
            </p>
          )}
        </>
      )}
    </AppShell>
  );
};

export default JudgeDashboard;
