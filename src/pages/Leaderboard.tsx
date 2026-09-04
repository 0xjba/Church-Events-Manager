import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { ArrowsClockwise, Certificate, Medal, Trophy } from '@phosphor-icons/react';
import { supabase } from '@/integrations/supabase/client';
import { ResultsCalculator } from '@/utils/resultsCalculator';
import { AppShell } from '@/components/shell/AppShell';
import {
  Button,
  Card,
  EmptyState,
  Skeleton,
  StatusPill,
} from '@/components/ui/primitives';
import { SegmentedControl } from '@/components/ui/inputs';
import { cn, formatScore } from '@/lib/utils';

interface EventSummary {
  id: string;
  name: string;
  type: string;
  status: string;
  age_category: string | null;
  results_published: boolean;
}

interface EventResult {
  id: string;
  participant_id: string;
  total_score: number;
  average_score: number;
  rank: number;
  tie_breaker_reason: string | null;
  participants: {
    id: string;
    full_name: string;
    chest_number: string;
    church: string;
    district: string;
  } | null;
}

interface ChampionshipStanding {
  participant: { full_name: string; chest_number: string; church: string } | null;
  events_participated: number;
  total_championship_points: number;
  average_score: number;
  rank: number;
}

const rankStyles = (rank: number) => {
  if (rank === 1) return 'bg-gold/15 text-gold border-gold/30';
  if (rank === 2) return 'bg-silver/15 text-silver border-silver/30';
  if (rank === 3) return 'bg-bronze/15 text-bronze border-bronze/30';
  return 'bg-muted text-muted-foreground border-transparent';
};

const RankBadge = ({ rank }: { rank: number }) => (
  <span
    className={cn(
      'tnum flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-body font-semibold',
      rankStyles(rank),
    )}
  >
    {rank === 1 ? <Trophy size={18} /> : rank === 2 ? <Medal size={18} /> : rank === 3 ? <Certificate size={18} /> : rank}
  </span>
);

const Leaderboard = () => {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [eventResults, setEventResults] = useState<EventResult[]>([]);
  const [championship, setChampionship] = useState<{
    participants: ChampionshipStanding[];
    events_count: number;
  } | null>(null);
  const [view, setView] = useState<'event' | 'championship'>('event');
  const [loading, setLoading] = useState(true);
  const [loadingResults, setLoadingResults] = useState(false);

  const fetchPublishedEvents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, type, status, age_category, results_published')
        .eq('results_published', true)
        .order('event_order', { ascending: true, nullsFirst: false });

      if (error) throw error;

      setEvents(data ?? []);
      if (data && data.length > 0) setSelectedEvent((current) => current || data[0].id);
    } catch {
      message.error('Failed to load published events');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEventResults = useCallback(async (eventId: string) => {
    try {
      setLoadingResults(true);
      const { data, error } = await supabase
        .from('results')
        .select(
          `*, participants ( id, full_name, chest_number, church, district )`,
        )
        .eq('event_id', eventId)
        .order('rank', { ascending: true });

      if (error) throw error;
      setEventResults((data ?? []) as unknown as EventResult[]);
    } catch {
      message.error('Failed to load event results');
    } finally {
      setLoadingResults(false);
    }
  }, []);

  useEffect(() => {
    fetchPublishedEvents();
  }, [fetchPublishedEvents]);

  useEffect(() => {
    if (selectedEvent) fetchEventResults(selectedEvent);
  }, [selectedEvent, fetchEventResults]);

  const loadChampionship = async () => {
    try {
      setLoadingResults(true);
      const standings = await ResultsCalculator.getChampionshipStandings(events.map((e) => e.id));
      setChampionship(standings as unknown as { participants: ChampionshipStanding[]; events_count: number });
    } catch {
      message.error('Failed to load championship standings');
    } finally {
      setLoadingResults(false);
    }
  };

  const switchView = (next: 'event' | 'championship') => {
    setView(next);
    if (next === 'championship' && !championship) loadChampionship();
  };

  const refresh = () => {
    if (view === 'championship') loadChampionship();
    else if (selectedEvent) fetchEventResults(selectedEvent);
  };

  const activeEvent = events.find((event) => event.id === selectedEvent);

  return (
    <AppShell
      variant="mobile"
      title="Leaderboard"
      subtitle="Published results"
      actions={
        <button
          type="button"
          onClick={refresh}
          aria-label="Refresh"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <ArrowsClockwise size={16} className={loadingResults ? 'animate-spin' : undefined} />
        </button>
      }
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Trophy size={22} />}
          title="No published results yet"
          description="Results appear here once administrators publish them."
        />
      ) : (
        <>
          <SegmentedControl
            value={view}
            onChange={switchView}
            className="mb-3"
            options={[
              { value: 'event', label: 'By event' },
              { value: 'championship', label: 'Championship' },
            ]}
          />

          {view === 'event' && (
            <>
              {/* Horizontal event chips beat a select on a phone: one tap, no overlay. */}
              <div className="scrollbar-thin -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
                {events.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEvent(event.id)}
                    className={cn(
                      'shrink-0 rounded-full border px-3.5 py-2 text-caption font-medium transition-colors',
                      event.id === selectedEvent
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-surface text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {event.name}
                  </button>
                ))}
              </div>

              {activeEvent && (
                <p className="mb-3 text-caption capitalize text-muted-foreground">
                  {activeEvent.age_category || 'All categories'} · {activeEvent.type}
                </p>
              )}

              {loadingResults ? (
                <div className="space-y-2">
                  <Skeleton className="h-[76px] w-full" />
                  <Skeleton className="h-[76px] w-full" />
                  <Skeleton className="h-[76px] w-full" />
                </div>
              ) : eventResults.length === 0 ? (
                <EmptyState
                  icon={<Trophy size={22} />}
                  title="No results for this event"
                  description="Nothing has been published for this event yet."
                />
              ) : (
                <ol className="space-y-2">
                  {eventResults.map((result) => (
                    <li key={result.id}>
                      <Card className={result.rank <= 3 ? 'border-border-strong' : undefined}>
                        <div className="flex items-center gap-3 p-3">
                          <RankBadge rank={result.rank} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-body font-medium text-foreground">
                                {result.participants?.full_name ?? 'Unknown'}
                              </p>
                              {result.tie_breaker_reason && <StatusPill tone="warning">Tie</StatusPill>}
                            </div>
                            <p className="truncate text-caption text-muted-foreground">
                              {result.participants?.chest_number
                                ? `#${result.participants.chest_number} · `
                                : ''}
                              {result.participants?.church}
                              {result.participants?.district ? ` · ${result.participants.district}` : ''}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="tnum text-title font-semibold text-foreground">
                              {formatScore(result.total_score)}
                            </p>
                            <p className="tnum text-caption text-muted-foreground">
                              avg {formatScore(result.average_score)}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}

          {view === 'championship' && (
            <>
              {loadingResults ? (
                <div className="space-y-2">
                  <Skeleton className="h-[76px] w-full" />
                  <Skeleton className="h-[76px] w-full" />
                </div>
              ) : !championship || championship.participants.length === 0 ? (
                <EmptyState
                  icon={<Trophy size={22} />}
                  title="No championship standings"
                  description="Standings appear once results are published for at least one event."
                />
              ) : (
                <>
                  <p className="mb-3 text-caption text-muted-foreground">
                    Overall rankings across {championship.events_count} published events
                  </p>
                  <ol className="space-y-2">
                    {championship.participants.map((standing) => (
                      <li key={`${standing.rank}-${standing.participant?.chest_number}`}>
                        <Card>
                          <div className="flex items-center gap-3 p-3">
                            <RankBadge rank={standing.rank} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-body font-medium text-foreground">
                                {standing.participant?.full_name ?? 'Unknown'}
                              </p>
                              <p className="truncate text-caption text-muted-foreground">
                                {standing.participant?.chest_number
                                  ? `#${standing.participant.chest_number} · `
                                  : ''}
                                {standing.events_participated} events
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="tnum text-title font-semibold text-foreground">
                                {standing.total_championship_points}
                              </p>
                              <p className="text-caption text-muted-foreground">points</p>
                            </div>
                          </div>
                        </Card>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          )}
        </>
      )}
    </AppShell>
  );
};

export default Leaderboard;
