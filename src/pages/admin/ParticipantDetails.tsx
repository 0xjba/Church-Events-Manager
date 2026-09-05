import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Modal, message } from 'antd';
import { ArrowLeft, CalendarBlank, Trash, Trophy } from '@phosphor-icons/react';
import { supabase } from '@/integrations/supabase/client';
import { AppShell } from '@/components/shell/AppShell';
import { DataTable } from '@/components/admin/DataTable';
import { formatScore } from '@/lib/utils';
import {
  Button,
  Card,
  CardHeader,
  Skeleton,
  StatTile,
  StatusPill,
  statusTone,
} from '@/components/ui/primitives';

interface Participant {
  id: string;
  full_name: string;
  age_category: string;
  chest_number: string;
  church: string;
  district: string;
  username: string;
  created_at: string;
}

interface EventRecord {
  id: string;
  name: string;
  type: string;
  status: string;
  age_category: string | null;
  created_at: string;
}

interface EventParticipant {
  id: string;
  event_id: string;
  participant_id: string;
  registered_at: string;
  event: EventRecord;
}

interface Result {
  id: string;
  event_id: string;
  participant_id: string;
  rank: number | null;
  total_score: number;
  average_score: number;
  calculated_at: string;
}

const ParticipantDetails = () => {
  const { participantId } = useParams<{ participantId: string }>();
  const navigate = useNavigate();

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [eventParticipants, setEventParticipants] = useState<EventParticipant[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchParticipantDetails = useCallback(async () => {
    try {
      setLoading(true);

      const { data: participantData, error: participantError } = await supabase
        .from('participants')
        .select('*')
        .eq('id', participantId)
        .single();

      if (participantError) throw participantError;
      setParticipant(participantData as Participant);

      const { data: eventsData, error: eventsError } = await supabase
        .from('event_participants')
        .select(`*, event:events ( id, name, type, status, age_category, created_at )`)
        .eq('participant_id', participantId)
        .order('registered_at', { ascending: false });

      if (eventsError) throw eventsError;
      setEventParticipants((eventsData || []) as unknown as EventParticipant[]);

      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('participant_id', participantId);

      if (resultsError) throw resultsError;
      setResults((resultsData || []) as Result[]);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : 'Failed to fetch participant details',
      );
      navigate('/admin/participants');
    } finally {
      setLoading(false);
    }
  }, [participantId, navigate]);

  useEffect(() => {
    if (participantId) fetchParticipantDetails();
  }, [participantId, fetchParticipantDetails]);

  const removeFromEvent = (eventId: string, eventName: string) => {
    Modal.confirm({
      title: `Remove from ${eventName}?`,
      content: 'Scores already recorded for this event are removed as well.',
      okText: 'Remove',
      okType: 'danger',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('event_participants')
            .delete()
            .eq('event_id', eventId)
            .eq('participant_id', participantId);

          if (error) throw error;
          message.success(`Removed from ${eventName}`);
          fetchParticipantDetails();
        } catch (error) {
          message.error(error instanceof Error ? error.message : 'Failed to remove participant');
        }
      },
    });
  };

  const bestRank = results.reduce<number | null>(
    (best, result) =>
      result.rank === null ? best : best === null ? result.rank : Math.min(best, result.rank),
    null,
  );

  const columns = [
    {
      title: 'Event',
      dataIndex: ['event', 'name'],
      key: 'event',
      render: (_: unknown, record: EventParticipant) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{record.event?.name}</div>
          <div className="truncate text-caption capitalize text-muted-foreground">
            {record.event?.age_category || 'All categories'} · {record.event?.type}
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: ['event', 'status'],
      key: 'status',
      width: 130,
      render: (_: unknown, record: EventParticipant) => (
        <StatusPill tone={statusTone(record.event?.status)} dot>
          {record.event?.status}
        </StatusPill>
      ),
    },
    {
      title: 'Result',
      key: 'result',
      width: 160,
      render: (_: unknown, record: EventParticipant) => {
        const result = results.find((candidate) => candidate.event_id === record.event_id);
        if (!result) return <span className="text-muted-foreground">Not published</span>;
        return (
          <div className="tnum">
            <span className="font-semibold text-foreground">
              {result.rank ? `Rank ${result.rank}` : '—'}
            </span>
            <span className="ml-2 text-caption text-muted-foreground">{formatScore(result.total_score)} pts</span>
          </div>
        );
      },
    },
    {
      title: 'Registered',
      dataIndex: 'registered_at',
      key: 'registered_at',
      width: 130,
      render: (date: string) => (
        <span className="text-muted-foreground">{new Date(date).toLocaleDateString()}</span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      fixed: 'right' as const,
      render: (_: unknown, record: EventParticipant) => (
        <button
          type="button"
          aria-label="Remove from event"
          title="Remove from event"
          onClick={() => removeFromEvent(record.event_id, record.event?.name)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
        >
          <Trash size={15} />
        </button>
      ),
    },
  ];

  return (
    <AppShell
      variant="admin"
      title={participant?.full_name ?? 'Participant'}
      subtitle={participant ? `#${participant.chest_number} · ${participant.church}` : undefined}
      maxWidth="wide"
      actions={
        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowLeft size={15} />}
          onClick={() => navigate('/admin/participants')}
        >
          <span className="hidden sm:inline">All participants</span>
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        participant && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label="Events"
                value={eventParticipants.length}
                hint="Registered"
                icon={<CalendarBlank size={15} />}
                tone="primary"
              />
              <StatTile
                label="Results"
                value={results.length}
                hint="Published"
                icon={<Trophy size={15} />}
                tone="success"
              />
              <StatTile label="Best rank" value={bestRank ?? '—'} hint="Across events" />
              <StatTile
                label="Age category"
                value={<span className="text-title">{participant.age_category}</span>}
                hint={participant.district}
              />
            </div>

            <Card className="mb-4">
              <CardHeader title="Details" subtitle="Registration record" />
              <dl className="grid gap-x-8 gap-y-3 px-4 pb-5 pt-1 md:grid-cols-3 md:px-5">
                <Detail label="Full name" value={participant.full_name} />
                <Detail label="Chest number" value={`#${participant.chest_number}`} />
                <Detail label="Username" value={participant.username} />
                <Detail label="Church" value={participant.church} />
                <Detail label="District" value={participant.district} />
                <Detail
                  label="Registered"
                  value={new Date(participant.created_at).toLocaleDateString()}
                />
              </dl>
            </Card>

            <DataTable
              columns={columns}
              dataSource={eventParticipants}
              rowKey="id"
              scrollX={720}
              toolbar={
                <span className="text-caption text-muted-foreground">
                  Events this participant is entered in
                </span>
              }
              emptyIcon={<CalendarBlank size={22} />}
              emptyTitle="Not entered in any events"
              emptyDescription="Add this participant to an event from the event's page."
            />
          </>
        )
      )}
    </AppShell>
  );
};

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <dt className="text-caption text-muted-foreground">{label}</dt>
    <dd className="truncate text-body font-medium text-foreground">{value}</dd>
  </div>
);

export default ParticipantDetails;
