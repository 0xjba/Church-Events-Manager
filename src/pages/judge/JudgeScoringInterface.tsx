import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { message } from 'antd';
import { ArrowCounterClockwise, ArrowLeft, CaretRight, CheckCircle, CloudSlash, DownloadSimple, Pause, Play, Timer, UsersThree, WifiSlash } from '@phosphor-icons/react';
import { supabase } from '@/integrations/supabase/client';
import type { FormValues } from '@/lib/types';
import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import { scoreSubmissionService } from '@/utils/scoreSubmission';
import { usePWA } from '@/hooks/usePWA';
import { AppShell } from '@/components/shell/AppShell';
import {
  Button,
  Card,
  EmptyState,
  ProgressBar,
  Skeleton,
  StatusPill,
} from '@/components/ui/primitives';
import { SearchInput, SegmentedControl } from '@/components/ui/inputs';
import { Sheet } from '@/components/ui/Sheet';
import { ScoreInput } from '@/components/ui/ScoreInput';
import { cn } from '@/lib/utils';

interface EventRecord {
  id: string;
  name: string;
  type: string;
  event_type: string;
  time_limit: number | null;
  status: string;
  age_category: string | null;
}

interface Criteria {
  id: string;
  name: string;
  max_score: number;
  weight: number;
}

interface ExistingScore {
  id: string;
  participant_id?: string;
  group_id?: string;
  criteria_id: string;
  score: number;
  is_locked: boolean;
}

/** Participants and groups are scored identically, so the UI works on one shape. */
interface Entrant {
  id: string;
  kind: 'participant' | 'group';
  title: string;
  subtitle: string;
  /** Chest number for participants, member count for groups. */
  marker: string;
  searchText: string;
  members?: string[];
}

type Filter = 'todo' | 'done' | 'all';

const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

const JudgeScoringInterface = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { participant } = useParticipantAuth();
  const { isInstallable, installApp } = usePWA();

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [entrants, setEntrants] = useState<Entrant[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [existingScores, setExistingScores] = useState<ExistingScore[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('todo');

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  const judgeId = participant?.role === 'judge' ? participant.id : null;

  useEffect(() => {
    if (participant && participant.role !== 'judge') {
      message.error('Access denied. Judges only.');
      navigate('/judge');
    }
  }, [participant, navigate]);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      message.success('Back online — queued scores are being sent');
    };
    const goOffline = () => {
      setIsOnline(false);
      message.info('Offline — scores are saved on this device until you reconnect');
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const unsubscribe = scoreSubmissionService.onPendingChange(setPendingCount);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      unsubscribe();
    };
  }, []);

  const fetchEventData = useCallback(async () => {
    if (!eventId || !judgeId) return;

    try {
      setLoading(true);

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData as EventRecord);

      if (eventData.event_type === 'individual') {
        const { data, error } = await supabase
          .from('event_participants')
          .select('participant:participants( id, full_name, chest_number, church )')
          .eq('event_id', eventId);

        if (error) throw error;

        setEntrants(
          (data ?? [])
            .map((row: FormValues) => row.participant)
            .filter(Boolean)
            .map((p: FormValues) => ({
              id: p.id,
              kind: 'participant' as const,
              title: p.full_name,
              subtitle: p.church,
              marker: p.chest_number,
              searchText: `${p.chest_number} ${p.full_name} ${p.church}`.toLowerCase(),
            })),
        );
      } else {
        const { data, error } = await supabase
          .from('event_groups')
          .select(
            `group:groups(
              id, name, description,
              members:group_members( participant:participants( full_name, chest_number, church ) )
            )`,
          )
          .eq('event_id', eventId);

        if (error) throw error;

        setEntrants(
          (data ?? [])
            .map((row: FormValues) => row.group)
            .filter(Boolean)
            .map((g: FormValues) => {
              const members: string[] = (g.members ?? [])
                .map((m: FormValues) => m.participant)
                .filter(Boolean)
                .map((p: FormValues) => `#${p.chest_number} ${p.full_name}`);

              return {
                id: g.id,
                kind: 'group' as const,
                title: g.name,
                subtitle: g.description || `${members.length} members`,
                marker: String(members.length),
                searchText: `${g.name} ${members.join(' ')}`.toLowerCase(),
                members,
              };
            }),
        );
      }

      const { data: criteriaData, error: criteriaError } = await supabase
        .from('event_criteria')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at');

      if (criteriaError) throw criteriaError;
      setCriteria(criteriaData ?? []);

      // The scores table is closed to clients; the edge function checks the
      // judge's token and returns only that judge's rows.
      const token = localStorage.getItem('participant_token');
      const { data: mine, error: scoresError } = await supabase.functions.invoke('scores/mine', {
        body: { event_id: eventId },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (scoresError) throw scoresError;
      if (mine?.error) throw new Error(mine.error);
      setExistingScores(mine?.scores ?? []);
    } catch (error) {
      message.error(
        `Failed to load event data: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    } finally {
      setLoading(false);
    }
  }, [eventId, judgeId]);

  useEffect(() => {
    fetchEventData();
  }, [fetchEventData]);

  useEffect(() => {
    if (!timerRunning || timer <= 0) return;

    const interval = setInterval(() => {
      setTimer((previous) => {
        if (previous <= 1) {
          setTimerRunning(false);
          message.warning('Time is up');
          return 0;
        }
        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerRunning, timer]);

  const scoredIds = useMemo(() => {
    if (criteria.length === 0) return new Set<string>();

    const byEntrant = new Map<string, Set<string>>();
    for (const score of existingScores) {
      const key = score.participant_id ?? score.group_id;
      if (!key) continue;
      if (!byEntrant.has(key)) byEntrant.set(key, new Set());
      byEntrant.get(key)!.add(score.criteria_id);
    }

    const complete = new Set<string>();
    byEntrant.forEach((criteriaIds, entrantId) => {
      if (criteria.every((criterion) => criteriaIds.has(criterion.id))) complete.add(entrantId);
    });
    return complete;
  }, [existingScores, criteria]);

  const todo = entrants.filter((entrant) => !scoredIds.has(entrant.id));
  const done = entrants.filter((entrant) => scoredIds.has(entrant.id));

  const visible = useMemo(() => {
    const base = filter === 'all' ? entrants : filter === 'done' ? done : todo;
    const query = search.trim().toLowerCase();
    return query ? base.filter((entrant) => entrant.searchText.includes(query)) : base;
  }, [filter, entrants, done, todo, search]);

  const active = entrants.find((entrant) => entrant.id === activeId) ?? null;
  const draftCount = criteria.filter((criterion) => draft[criterion.id] !== undefined).length;
  const complete = criteria.length > 0 && draftCount === criteria.length;

  const runningTotal = criteria.reduce(
    (total, criterion) => total + (draft[criterion.id] ?? 0) * criterion.weight,
    0,
  );
  const maxTotal = criteria.reduce(
    (total, criterion) => total + criterion.max_score * criterion.weight,
    0,
  );

  const openEntrant = (entrant: Entrant) => {
    if (scoredIds.has(entrant.id)) {
      message.info('You have already scored this entrant');
      return;
    }
    setActiveId(entrant.id);
    setDraft({});
    if (event?.time_limit) {
      setTimer(event.time_limit * 60);
      setTimerRunning(true);
    }
  };

  const closeEntrant = () => {
    setActiveId(null);
    setDraft({});
    setTimerRunning(false);
    setTimer(0);
  };

  const submitScores = async () => {
    if (!active || !eventId) return;

    try {
      setSubmitting(true);

      const delivered = await scoreSubmissionService.submitScoresheet({
        eventId,
        participantId: active.kind === 'participant' ? active.id : undefined,
        groupId: active.kind === 'group' ? active.id : undefined,
        scores: criteria.map((criterion) => ({
          criteria_id: criterion.id,
          score: draft[criterion.id],
        })),
      });

      message.success(
        delivered
          ? `Scores submitted for ${active.title}`
          : 'Saved on this device — will submit when you are back online',
      );

      setConfirmOpen(false);
      closeEntrant();
      await fetchEventData();
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : 'Failed to submit scores. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const progress = entrants.length === 0 ? 0 : Math.round((done.length / entrants.length) * 100);

  return (
    <AppShell
      title={event?.name ?? 'Scoring'}
      subtitle={
        event ? `${event.age_category || 'All categories'} · ${event.event_type} event` : undefined
      }
      actions={
        <div className="flex items-center gap-1.5">
          {!isOnline && (
            <StatusPill tone="warning">
              <WifiSlash size={12} />
              Offline
            </StatusPill>
          )}
          {pendingCount > 0 && (
            <StatusPill tone="info">
              <CloudSlash size={12} />
              {pendingCount} queued
            </StatusPill>
          )}
        </div>
      }
    >
      <button
        type="button"
        onClick={() => navigate('/judge')}
        className="mb-3 -ml-1 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-caption font-medium text-muted-foreground hover:bg-muted"
      >
        <ArrowLeft size={16} />
        All events
      </button>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <>
          <Card className="mb-4">
            <div className="p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-body font-medium text-foreground">Your progress</span>
                <span className="tnum text-caption text-muted-foreground">
                  {done.length} of {entrants.length} scored
                </span>
              </div>
              <ProgressBar value={progress} tone={progress === 100 ? 'success' : 'primary'} />
              <p className="mt-2 text-caption text-muted-foreground">
                {criteria.length} criteria per entrant · scores lock once submitted
              </p>
            </div>
          </Card>

          {criteria.length === 0 ? (
            <EmptyState
              icon={<UsersThree size={22} />}
              title="No scoring criteria yet"
              description="An administrator needs to add criteria to this event before it can be scored."
            />
          ) : (
            <>
              <div className="sticky top-header z-20 -mx-4 space-y-2 bg-background/95 px-4 pb-3 pt-1 backdrop-blur">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder={
                    event?.event_type === 'individual' ? 'Search chest number or name' : 'Search groups'
                  }
                />
                <SegmentedControl
                  value={filter}
                  onChange={(value) => setFilter(value as Filter)}
                  options={[
                    { value: 'todo', label: 'To score', count: todo.length },
                    { value: 'done', label: 'Scored', count: done.length },
                    { value: 'all', label: 'All', count: entrants.length },
                  ]}
                />
              </div>

              {visible.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle size={22} />}
                  title={search ? 'No matches' : filter === 'todo' ? 'Everyone is scored' : 'Nothing here'}
                  description={
                    search
                      ? 'Try a different chest number or name.'
                      : filter === 'todo'
                        ? 'You have scored every entrant in this event.'
                        : undefined
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {visible.map((entrant) => {
                    const isScored = scoredIds.has(entrant.id);
                    return (
                      <li key={entrant.id}>
                        <button
                          type="button"
                          onClick={() => openEntrant(entrant)}
                          disabled={isScored}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-xl border bg-surface p-3 text-left shadow-card transition-colors',
                            isScored
                              ? 'border-border opacity-70'
                              : 'border-border hover:border-primary/40 active:bg-surface-sunken',
                          )}
                        >
                          <span
                            className={cn(
                              'tnum flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-body font-semibold',
                              isScored
                                ? 'bg-success-soft text-success'
                                : 'bg-primary-soft text-primary-strong',
                            )}
                          >
                            {entrant.kind === 'participant' ? entrant.marker : <UsersThree size={18} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body font-medium text-foreground">
                              {entrant.title}
                            </span>
                            <span className="block truncate text-caption text-muted-foreground">
                              {entrant.subtitle}
                            </span>
                          </span>
                          {isScored ? (
                            <StatusPill tone="success">
                              <CheckCircle size={12} />
                              Scored
                            </StatusPill>
                          ) : (
                            <CaretRight size={18} className="shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {isInstallable && (
            <button
              type="button"
              onClick={installApp}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-caption font-medium text-muted-foreground hover:bg-surface-sunken"
            >
              <DownloadSimple size={14} />
              Install this app for offline scoring
            </button>
          )}
        </>
      )}

      {/* Scoring sheet: one entrant at a time, actions within thumb reach. */}
      <Sheet
        open={Boolean(active)}
        onClose={closeEntrant}
        dismissable={!submitting}
        size="lg"
        title={active?.title}
        description={
          active
            ? active.kind === 'participant'
              ? `#${active.marker} · ${active.subtitle}`
              : active.subtitle
            : undefined
        }
        footer={
          <div className="space-y-2">
            <div className="flex items-center justify-between text-caption">
              <span className={complete ? 'text-success' : 'text-muted-foreground'}>
                {draftCount} of {criteria.length} criteria scored
              </span>
              <span className="tnum font-medium text-foreground">
                Total {runningTotal.toFixed(1)} / {maxTotal.toFixed(1)}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="lg" onClick={closeEntrant} disabled={submitting}>
                Cancel
              </Button>
              <Button
                size="lg"
                block
                disabled={!complete || submitting}
                onClick={() => setConfirmOpen(true)}
              >
                {complete ? 'Review and submit' : `Score all ${criteria.length} criteria`}
              </Button>
            </div>
          </div>
        }
      >
        {active && (
          <div className="space-y-3 pb-2">
            {active.members && active.members.length > 0 && (
              <div className="rounded-xl bg-surface-sunken p-3">
                <p className="mb-1 text-caption font-medium text-foreground">Members</p>
                <p className="text-caption text-muted-foreground">{active.members.join(' · ')}</p>
              </div>
            )}

            {event?.time_limit && (
              <div
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-3',
                  timer <= 60 && timer > 0
                    ? 'border-warning/40 bg-warning-soft'
                    : 'border-border bg-surface-sunken',
                )}
              >
                <Timer
                  size={18}
                  className={timer <= 60 && timer > 0 ? 'text-warning' : 'text-muted-foreground'}
                />
                <div className="flex-1">
                  <p className="tnum text-title font-semibold text-foreground">
                    {formatClock(timer)}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {timer === 0 ? 'Time is up' : timerRunning ? 'Running' : 'Paused'}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={timerRunning ? <Pause size={14} /> : <Play size={14} />}
                  onClick={() => setTimerRunning((running) => !running)}
                >
                  {timerRunning ? 'Pause' : 'Start'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Reset timer"
                  icon={<ArrowCounterClockwise size={14} />}
                  onClick={() => {
                    setTimerRunning(false);
                    setTimer((event.time_limit ?? 0) * 60);
                  }}
                />
              </div>
            )}

            {criteria.map((criterion) => (
              <ScoreInput
                key={criterion.id}
                label={criterion.name}
                max={criterion.max_score}
                value={draft[criterion.id] ?? null}
                disabled={submitting}
                onChange={(value) =>
                  setDraft((previous) => ({ ...previous, [criterion.id]: value }))
                }
              />
            ))}
          </div>
        )}
      </Sheet>

      {/* Submission is final, so the numbers get one last read-through. */}
      <Sheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        dismissable={!submitting}
        title="Submit these scores?"
        description={active ? `${active.title} · scores cannot be changed afterwards` : undefined}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Back
            </Button>
            <Button size="lg" block loading={submitting} onClick={submitScores}>
              Submit scores
            </Button>
          </div>
        }
      >
        <ul className="divide-y divide-border">
          {criteria.map((criterion) => (
            <li key={criterion.id} className="flex items-center justify-between py-2.5">
              <span className="text-body text-foreground">{criterion.name}</span>
              <span className="tnum text-body font-semibold text-foreground">
                {draft[criterion.id]} / {criterion.max_score}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between py-3">
            <span className="text-body font-medium text-foreground">Weighted total</span>
            <span className="tnum text-title font-semibold text-primary">
              {runningTotal.toFixed(1)} / {maxTotal.toFixed(1)}
            </span>
          </li>
        </ul>
        {!isOnline && (
          <p className="mb-2 rounded-lg bg-warning-soft p-3 text-caption text-warning">
            You are offline. These scores are saved on this device and sent automatically when you
            reconnect.
          </p>
        )}
      </Sheet>
    </AppShell>
  );
};

export default JudgeScoringInterface;
