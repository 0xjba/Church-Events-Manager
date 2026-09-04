import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { message } from 'antd';
import { ArrowLeft, ArrowsClockwise, Lock, LockOpen, Pulse } from '@phosphor-icons/react';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeScores } from '@/hooks/useRealtimeScores';
import { AppShell } from '@/components/shell/AppShell';
import { DataTable } from '@/components/admin/DataTable';
import { Button, StatTile, StatusPill } from '@/components/ui/primitives';

interface EventRecord {
  id: string;
  name: string;
  status: string;
  age_category: string | null;
}

interface ScoreRow {
  id: string;
  participant_id: string;
  judge_id: string;
  criteria_id: string;
  score: number;
  is_locked: boolean;
  created_at: string;
}

const RealtimeScoreboard = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const { scores, loading: scoresLoading, refetch } = useRealtimeScores({ eventId });

  const fetchEvent = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, status, age_category')
        .eq('id', eventId)
        .single();

      if (error) throw error;
      setEvent(data as EventRecord);
    } catch {
      message.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) fetchEvent();
  }, [eventId, fetchEvent]);

  const judgeCount = new Set(scores.map((score) => score.judge_id)).size;
  const entrantCount = new Set(scores.map((score) => score.participant_id)).size;
  const average =
    scores.length === 0
      ? 0
      : Math.round((scores.reduce((total, score) => total + score.score, 0) / scores.length) * 10) /
        10;

  const columns = [
    {
      title: 'Recorded',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      defaultSortOrder: 'descend' as const,
      sorter: (a: ScoreRow, b: ScoreRow) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (date: string) => (
        <span className="tnum text-muted-foreground">
          {new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      ),
    },
    {
      title: 'Entrant',
      dataIndex: 'participant_id',
      key: 'participant_id',
      ellipsis: true,
      render: (id: string) => <span className="font-mono text-caption">{id.slice(0, 8)}</span>,
    },
    {
      title: 'Judge',
      dataIndex: 'judge_id',
      key: 'judge_id',
      ellipsis: true,
      render: (id: string) => <span className="font-mono text-caption">{id.slice(0, 8)}</span>,
    },
    {
      title: 'Criterion',
      dataIndex: 'criteria_id',
      key: 'criteria_id',
      ellipsis: true,
      render: (id: string) => <span className="font-mono text-caption">{id.slice(0, 8)}</span>,
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: 90,
      align: 'right' as const,
      sorter: (a: ScoreRow, b: ScoreRow) => a.score - b.score,
      render: (score: number) => (
        <span className="tnum font-semibold text-foreground">{score}</span>
      ),
    },
    {
      title: 'State',
      dataIndex: 'is_locked',
      key: 'is_locked',
      width: 110,
      render: (locked: boolean) => (
        <StatusPill tone={locked ? 'neutral' : 'warning'}>
          {locked ? <Lock size={12} /> : <LockOpen size={12} />}
          {locked ? 'Locked' : 'Open'}
        </StatusPill>
      ),
    },
  ];

  return (
    <AppShell
      variant="admin"
      title="Live scoreboard"
      subtitle={event?.name}
      maxWidth="wide"
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowLeft size={15} />}
            onClick={() => navigate(`/admin/events/${eventId}`)}
          >
            <span className="hidden sm:inline">Event</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowsClockwise size={15} />}
            loading={scoresLoading}
            onClick={refetch}
          >
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Scores in"
          value={scores.length}
          hint="Live"
          icon={<Pulse size={15} />}
          tone="info"
        />
        <StatTile label="Judges scoring" value={judgeCount} hint="Distinct" />
        <StatTile label="Entrants scored" value={entrantCount} hint="Distinct" />
        <StatTile label="Average score" value={average} hint="All criteria" />
      </div>

      <DataTable
        columns={columns}
        dataSource={scores as ScoreRow[]}
        rowKey="id"
        loading={loading || scoresLoading}
        scrollX={780}
        toolbar={
          <span className="flex items-center gap-2 text-caption text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-info opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-info" />
            </span>
            Updating live as judges submit
          </span>
        }
        emptyIcon={<Pulse size={22} />}
        emptyTitle="No scores yet"
        emptyDescription="Scores appear here the moment judges submit them."
      />
    </AppShell>
  );
};

export default RealtimeScoreboard;
