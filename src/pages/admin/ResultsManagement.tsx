import { useEffect, useState } from 'react';
import { message } from 'antd';
import { Calculator, DownloadSimple, Eye, EyeSlash, Medal, Trophy } from '@phosphor-icons/react';
import { supabase } from '@/integrations/supabase/client';
import type { FormValues, SupabaseRow } from '@/lib/types';
import { ResultsCalculator } from '@/utils/resultsCalculator';
import { ExportUtils, WinnersExportData } from '@/utils/exportUtils';
import { AppShell } from '@/components/shell/AppShell';
import { DataTable } from '@/components/admin/DataTable';
import {
  Button,
  Card,
  CardHeader,
  Skeleton,
  StatusPill,
  statusTone,
} from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/Sheet';
import { cn, formatScore } from '@/lib/utils';

interface EventRecord {
  id: string;
  name: string;
  type: string;
  event_type: string;
  status: string;
  age_category: string | null;
  results_published: boolean;
  event_order: number | null;
}

interface JudgeScore {
  judgeName: string;
  judgeChurch: string;
  score: number;
}

interface CriteriaScore {
  id: string;
  name: string;
  max_score: number;
  weight: number;
  judgeScores: JudgeScore[];
  averageScore: number;
}

interface DetailedResult {
  id: string;
  rank: number | null;
  total_score: number;
  average_score: number;
  tie_breaker_reason: string | null;
  participant?: {
    full_name: string;
    chest_number: string;
    age_category: string;
    church: string;
  } | null;
  group?: { name: string; description: string | null } | null;
  criteriaScores: CriteriaScore[];
  maxPossibleScore: number;
}

interface ChampionEntry {
  participant: { full_name: string; chest_number: string; church: string };
  totalPoints: number;
}

interface Champion {
  champions: ChampionEntry[];
  maxPoints: number;
  isTie: boolean;
  totalParticipants: number;
}

// Winners are grouped by age category, then by the running order the
// organisers use on the day.
const AGE_ORDER: Record<string, number> = {
  'Sub Juniors': 1,
  Juniors: 2,
  Intermediates: 3,
  Seniors: 4,
};

const EVENT_ORDER: Record<string, number> = {
  'Solo Song': 1,
  'Action Song': 2,
  'Story Telling': 3,
  'Solo Song Male': 1,
  'Solo Song Female': 2,
  Speech: 3,
  Essay: 4,
  Story: 5,
  Verses: 6,
  'Bible Quiz': 7,
};

const rankTone = (rank: number) =>
  rank === 1
    ? 'bg-gold/15 text-gold'
    : rank === 2
      ? 'bg-silver/20 text-silver'
      : rank === 3
        ? 'bg-bronze/15 text-bronze'
        : 'bg-muted text-muted-foreground';

const ResultsManagement = () => {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState<string | null>(null);

  const [viewingResults, setViewingResults] = useState<string | null>(null);
  const [resultsData, setResultsData] = useState<DetailedResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [viewingEventType, setViewingEventType] = useState<string>('individual');

  const [exportingWinners, setExportingWinners] = useState(false);
  const [viewingWinners, setViewingWinners] = useState(false);
  const [winnersData, setWinnersData] = useState<WinnersExportData | null>(null);
  const [showScoresForEvent, setShowScoresForEvent] = useState<Record<string, boolean>>({});
  const [individualChampion, setIndividualChampion] = useState<Champion | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_order', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setEvents((data || []) as EventRecord[]);
    } catch {
      message.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const calculateResults = async (eventId: string) => {
    try {
      setCalculating(eventId);
      message.loading('Calculating results...', 0);

      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('event_type')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;

      if (eventData.event_type === 'individual') {
        const { data: entrants, error: entrantsError } = await supabase
          .from('event_participants')
          .select('participant_id')
          .eq('event_id', eventId);

        if (entrantsError) throw entrantsError;
        if (!entrants || entrants.length === 0) {
          message.destroy();
          message.warning('No participants in this event');
          return;
        }
      } else {
        const { data: entrantGroups, error: groupsError } = await supabase
          .from('event_groups')
          .select('group_id')
          .eq('event_id', eventId);

        if (groupsError) throw groupsError;
        if (!entrantGroups || entrantGroups.length === 0) {
          message.destroy();
          message.warning('No groups in this event');
          return;
        }
      }

      const { data: lockedScores, error: scoresError } = await supabase
        .from('scores')
        .select('id')
        .eq('event_id', eventId)
        .eq('is_locked', true);

      if (scoresError) throw scoresError;
      if (!lockedScores || lockedScores.length === 0) {
        message.destroy();
        message.warning('No locked scores for this event');
        return;
      }

      const results = await ResultsCalculator.calculateEventResults(eventId);

      const resultsToInsert = results.results.map((result) => ({
        event_id: eventId,
        total_score: result.total_score,
        average_score: result.average_score,
        rank: result.rank,
        tie_breaker_reason: result.tie_breaker_reason,
        calculated_at: new Date().toISOString(),
        ...(eventData.event_type === 'individual'
          ? { participant_id: result.participant_id }
          : { group_id: result.group_id }),
      }));

      const { error: deleteError } = await supabase
        .from('results')
        .delete()
        .eq('event_id', eventId);
      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase.from('results').insert(resultsToInsert);
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('events')
        .update({ results_published: true })
        .eq('id', eventId);
      if (updateError) throw updateError;

      message.destroy();
      message.success(
        `Results published for ${results.results.length} ${
          eventData.event_type === 'individual' ? 'participants' : 'groups'
        }`,
      );

      await fetchEvents();
    } catch (error) {
      message.destroy();
      console.error('Error calculating results:', error);
      message.error('Failed to calculate results');
    } finally {
      setCalculating(null);
    }
  };

  const fetchResults = async (eventId: string, eventType: string) => {
    try {
      setResultsLoading(true);
      setViewingResults(eventId);
      setViewingEventType(eventType);

      const resultsQuery =
        eventType === 'individual'
          ? supabase
              .from('results')
              .select(
                `*, participant:participants( full_name, chest_number, age_category, church )`,
              )
              .eq('event_id', eventId)
              .not('participant_id', 'is', null)
              .order('rank', { ascending: true })
          : supabase
              .from('results')
              .select(`*, group:groups( name, description )`)
              .eq('event_id', eventId)
              .not('group_id', 'is', null)
              .order('rank', { ascending: true });

      const { data: results, error: resultsError } = await resultsQuery;
      if (resultsError) throw resultsError;

      const { data: criteria, error: criteriaError } = await supabase
        .from('event_criteria')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at');
      if (criteriaError) throw criteriaError;

      const scoresQuery = supabase
        .from('scores')
        .select(`*, judge:judges( full_name, church )`)
        .eq('event_id', eventId)
        .eq('is_locked', true);

      const { data: scores, error: scoresError } = await (eventType === 'individual'
        ? scoresQuery.not('participant_id', 'is', null)
        : scoresQuery.not('group_id', 'is', null));

      if (scoresError) throw scoresError;

      const detailed = (results ?? []).map((result: FormValues) => {
        const entityScores = (scores ?? []).filter((score: FormValues) =>
          eventType === 'individual'
            ? score.participant_id === result.participant_id
            : score.group_id === result.group_id,
        );

        const criteriaScores = (criteria ?? []).map((criterion) => {
          const forCriterion = entityScores.filter(
            (score: FormValues) => score.criteria_id === criterion.id,
          );

          return {
            ...criterion,
            judgeScores: forCriterion.map((score: FormValues) => ({
              judgeName: score.judge?.full_name || 'Unknown judge',
              judgeChurch: score.judge?.church || '',
              score: score.score,
            })),
            averageScore:
              forCriterion.length > 0
                ? forCriterion.reduce(
                    (total: number, score: FormValues) => total + score.score,
                    0,
                  ) / forCriterion.length
                : 0,
          };
        });

        return {
          ...result,
          criteriaScores,
          maxPossibleScore: (criteria ?? []).reduce(
            (total, criterion) => total + criterion.max_score,
            0,
          ),
        } as unknown as DetailedResult;
      });

      setResultsData(detailed);
    } catch (error) {
      console.error('Error fetching results:', error);
      message.error('Failed to fetch results');
    } finally {
      setResultsLoading(false);
    }
  };

  const eventSortKey = (ageCategory: string | null, eventName: string) =>
    (AGE_ORDER[ageCategory ?? ''] ?? 999) * 1000 + (EVENT_ORDER[eventName] ?? 999);

  const calculateIndividualChampion = (
    winnerEvents: WinnersExportData['events'],
  ): Champion | null => {
    const points: Record<string, ChampionEntry> = {};

    winnerEvents.forEach((event) => {
      event.winners.forEach((winner) => {
        const key = winner.participant.full_name;
        if (!points[key]) points[key] = { participant: winner.participant, totalPoints: 0 };
        if (winner.rank === 1) points[key].totalPoints += 5;
        else if (winner.rank === 2) points[key].totalPoints += 3;
      });
    });

    const entries = Object.values(points);
    if (entries.length === 0) return null;

    const maxPoints = Math.max(...entries.map((entry) => entry.totalPoints));
    const champions = entries.filter((entry) => entry.totalPoints === maxPoints);

    return {
      champions,
      maxPoints,
      isTie: champions.length > 1,
      totalParticipants: entries.length,
    };
  };

  const fetchWinners = async () => {
    try {
      setExportingWinners(true);
      message.loading('Loading winners...', 0);

      const { data: completedEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'completed')
        .eq('results_published', true)
        .order('event_order', { ascending: true, nullsFirst: false });

      if (eventsError) throw eventsError;

      if (!completedEvents || completedEvents.length === 0) {
        message.destroy();
        message.warning('No completed events with published results');
        return;
      }

      const sortedEvents = [...completedEvents].sort(
        (a, b) =>
          eventSortKey(a.age_category, a.name) - eventSortKey(b.age_category, b.name),
      );

      const winners: WinnersExportData = { events: [], generated_at: new Date().toISOString() };

      for (const event of sortedEvents) {
        const { data: eventResults, error: resultsError } = await supabase
          .from('results')
          .select(`*, participant:participants( full_name, chest_number, church, district )`)
          .eq('event_id', event.id)
          .not('participant_id', 'is', null)
          .order('rank', { ascending: true })
          .limit(3);

        if (resultsError) throw resultsError;

        if (eventResults && eventResults.length > 0) {
          winners.events.push({
            event_id: event.id,
            event_name: event.name,
            event_type: event.event_type,
            age_category: event.age_category,
            winners: eventResults.map((result: FormValues) => ({
              rank: result.rank || 0,
              total_score: result.total_score,
              average_score: result.average_score,
              tie_breaker_reason: result.tie_breaker_reason,
              participant: {
                full_name: result.participant?.full_name || 'Unknown',
                chest_number: result.participant?.chest_number || 'N/A',
                church: result.participant?.church || 'Unknown',
                district: result.participant?.district || 'Unknown',
              },
            })),
          });
        }
      }

      message.destroy();

      if (winners.events.length === 0) {
        message.warning('No winners found');
        return;
      }

      setWinnersData(winners);
      setIndividualChampion(calculateIndividualChampion(winners.events));
      setShowScoresForEvent({});
      setViewingWinners(true);
    } catch (error) {
      message.destroy();
      console.error('Error fetching winners:', error);
      message.error('Failed to fetch winners');
    } finally {
      setExportingWinners(false);
    }
  };

  const exportWinners = () => {
    if (!winnersData) return;
    ExportUtils.downloadWinnersCSV(winnersData);
    message.success(`Exported winners for ${winnersData.events.length} events`);
  };

  const columns = [
    {
      title: 'Event',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: EventRecord) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {record.event_order !== null && (
              <span className="tnum rounded bg-muted px-1.5 text-caption font-semibold text-muted-foreground">
                #{record.event_order}
              </span>
            )}
            <span className="truncate font-medium text-foreground">{name}</span>
          </div>
          <div className="truncate text-caption capitalize text-muted-foreground">
            {record.age_category || 'All categories'} · {record.event_type}
          </div>
        </div>
      ),
    },
    {
      title: 'Event status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status: string) => (
        <StatusPill tone={statusTone(status)} dot>
          {status}
        </StatusPill>
      ),
    },
    {
      title: 'Results',
      dataIndex: 'results_published',
      key: 'results_published',
      width: 140,
      render: (published: boolean) => (
        <StatusPill tone={published ? 'success' : 'warning'}>
          {published ? 'Published' : 'Not published'}
        </StatusPill>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 190,
      fixed: 'right' as const,
      render: (_: unknown, record: EventRecord) =>
        record.results_published ? (
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              icon={<Eye size={14} />}
              onClick={() => fetchResults(record.id, record.event_type)}
            >
              View results
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button
              size="sm"
              icon={<Calculator size={14} />}
              loading={calculating === record.id}
              disabled={calculating !== null || record.status !== 'completed'}
              title={
                record.status !== 'completed'
                  ? 'Mark the event completed before calculating'
                  : 'Calculate and publish results'
              }
              onClick={() => calculateResults(record.id)}
            >
              Calculate
            </Button>
          </div>
        ),
    },
  ];

  const published = events.filter((event) => event.results_published).length;

  return (
    <AppShell
      variant="admin"
      title="Results"
      subtitle={`${published} of ${events.length} events published`}
      maxWidth="wide"
      actions={
        <Button
          size="sm"
          icon={<Trophy size={15} />}
          loading={exportingWinners}
          onClick={fetchWinners}
        >
          <span className="hidden sm:inline">Winners</span>
        </Button>
      }
    >
      <DataTable
        columns={columns}
        dataSource={events}
        rowKey="id"
        loading={loading}
        scrollX={820}
        toolbar={
          <span className="text-caption text-muted-foreground">
            Calculating publishes results and makes them public on the leaderboard
          </span>
        }
        emptyIcon={<Trophy size={22} />}
        emptyTitle="No events yet"
        emptyDescription="Create events and score them before results can be calculated."
      />

      {/* ------------------------------------------- results detail */}
      <Sheet
        open={Boolean(viewingResults)}
        onClose={() => {
          setViewingResults(null);
          setResultsData([]);
        }}
        size="lg"
        title="Event results"
        description="Rankings with each judge's scores"
      >
        {resultsLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : resultsData.length === 0 ? (
          <p className="py-8 text-center text-body text-muted-foreground">
            No results recorded for this event.
          </p>
        ) : (
          <ol className="space-y-3 pb-2">
            {resultsData.map((result) => (
              <li key={result.id} className="overflow-hidden rounded-xl border border-border">
                <div className="flex items-center gap-3 bg-surface-sunken px-3 py-2.5">
                  <span
                    className={cn(
                      'tnum flex h-9 w-9 items-center justify-center rounded-lg font-semibold',
                      rankTone(result.rank ?? 0),
                    )}
                  >
                    {result.rank ?? '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium text-foreground">
                      {viewingEventType === 'individual'
                        ? result.participant?.full_name
                        : result.group?.name}
                    </p>
                    <p className="truncate text-caption text-muted-foreground">
                      {viewingEventType === 'individual'
                        ? `#${result.participant?.chest_number} · ${result.participant?.church}`
                        : result.group?.description || 'Group'}
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

                <div className="divide-y divide-border">
                  {result.criteriaScores.map((criterion) => (
                    <div key={criterion.id} className="px-3 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-caption font-medium text-foreground">
                          {criterion.name}
                        </span>
                        <span className="tnum text-caption text-muted-foreground">
                          avg {criterion.averageScore.toFixed(1)} / {criterion.max_score}
                        </span>
                      </div>
                      {criterion.judgeScores.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {criterion.judgeScores.map((judgeScore, index) => (
                            <span
                              key={`${judgeScore.judgeName}-${index}`}
                              className="tnum rounded-md bg-surface-sunken px-2 py-0.5 text-caption text-muted-foreground"
                            >
                              {judgeScore.judgeName}: {judgeScore.score}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {result.tie_breaker_reason && (
                  <p className="bg-warning-soft px-3 py-1.5 text-caption text-warning">
                    {result.tie_breaker_reason}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Sheet>

      {/* -------------------------------------------------- winners */}
      <Sheet
        open={viewingWinners}
        onClose={() => setViewingWinners(false)}
        size="lg"
        title="Winners"
        description={
          winnersData ? `${winnersData.events.length} events with published results` : undefined
        }
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" onClick={() => setViewingWinners(false)}>
              Close
            </Button>
            <Button size="lg" block icon={<DownloadSimple size={15} />} onClick={exportWinners}>
              Export CSV
            </Button>
          </div>
        }
      >
        {winnersData && (
          <div className="space-y-4 pb-2">
            {individualChampion && individualChampion.champions.length > 0 && (
              <Card className="border-primary/30 bg-primary-soft/40">
                <CardHeader
                  title={
                    individualChampion.isTie
                      ? `Individual champions (tie) — ${individualChampion.maxPoints} points`
                      : 'Individual champion'
                  }
                  subtitle={`${individualChampion.totalParticipants} participants placed across all events`}
                />
                <ul className="divide-y divide-border px-4 pb-4 md:px-5">
                  {individualChampion.champions.map((champion) => (
                    <li
                      key={champion.participant.full_name}
                      className="flex items-center gap-3 py-2.5"
                    >
                      <Medal size={16} className="shrink-0 text-gold" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-medium text-foreground">
                          {champion.participant.full_name}
                        </span>
                        <span className="block truncate text-caption text-muted-foreground">
                          #{champion.participant.chest_number} · {champion.participant.church}
                        </span>
                      </span>
                      <span className="tnum shrink-0 text-body font-semibold text-primary">
                        {individualChampion.maxPoints} pts
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {winnersData.events.map((event, index) => {
              const previous = winnersData.events[index - 1];
              const newCategory = index === 0 || previous.age_category !== event.age_category;
              const showScores = showScoresForEvent[event.event_id];

              return (
                <div key={event.event_id}>
                  {newCategory && (
                    <h3 className="mb-2 mt-4 rounded-lg bg-foreground px-3 py-2 text-center text-body font-semibold text-background first:mt-0">
                      {event.age_category || 'All categories'}
                    </h3>
                  )}

                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="flex items-center justify-between gap-2 bg-surface-sunken px-3 py-2">
                      <p className="min-w-0 truncate text-body font-medium text-foreground">
                        {event.event_name}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setShowScoresForEvent((current) => ({
                            ...current,
                            [event.event_id]: !current[event.event_id],
                          }))
                        }
                        className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-caption text-muted-foreground hover:bg-surface hover:text-foreground"
                      >
                        {showScores ? <EyeSlash size={14} /> : <Eye size={14} />}
                        {showScores ? 'Hide scores' : 'Show scores'}
                      </button>
                    </div>

                    <ul className="divide-y divide-border">
                      {event.winners.map((winner) => (
                        <li
                          key={`${event.event_id}-${winner.participant.chest_number}-${winner.rank}`}
                          className="flex items-center gap-3 px-3 py-2.5"
                        >
                          <span
                            className={cn(
                              'tnum flex h-8 w-8 items-center justify-center rounded-lg text-caption font-bold',
                              rankTone(winner.rank),
                            )}
                          >
                            {winner.rank}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body font-medium text-foreground">
                              {winner.participant.full_name}
                            </span>
                            <span className="block truncate text-caption text-muted-foreground">
                              #{winner.participant.chest_number} · {winner.participant.church} ·{' '}
                              {winner.participant.district}
                            </span>
                          </span>
                          <span className="tnum shrink-0 text-body font-semibold text-foreground">
                            {showScores ? formatScore(winner.total_score) : '•••'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Sheet>
    </AppShell>
  );
};

export default ResultsManagement;
