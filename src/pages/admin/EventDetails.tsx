import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Checkbox, Form, InputNumber, Modal, message } from 'antd';
import { ArrowLeft, CheckCircle, Gavel, PencilSimple, Plus, Pulse, Target, Trash, UsersThree, XCircle } from '@phosphor-icons/react';
import { supabase } from '@/integrations/supabase/client';
import { AppShell } from '@/components/shell/AppShell';
import { DataTable } from '@/components/admin/DataTable';
import { Toolbar } from '@/components/admin/Toolbar';
import {
  Button,
  Card,
  CardHeader,
  ProgressBar,
  Skeleton,
  StatTile,
  StatusPill,
  statusTone,
} from '@/components/ui/primitives';
import { SearchInput, SegmentedControl } from '@/components/ui/inputs';
import { Sheet } from '@/components/ui/Sheet';

interface EventRecord {
  id: string;
  name: string;
  type: string;
  event_type: string;
  age_category: string | null;
  rules: string | null;
  time_limit: number | null;
  max_participants: number | null;
  status: string;
  event_order: number | null;
  results_published: boolean;
  level?: { id: string; name: string };
}

interface Participant {
  id: string;
  full_name: string;
  chest_number: string;
  age_category: string;
  church: string;
  district: string;
}

interface EventParticipant {
  id: string;
  event_id: string;
  participant_id: string;
  participant: Participant;
}

interface GroupMember {
  id: string;
  participant_id: string;
  participant: { full_name: string; chest_number: string; church: string };
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  members?: GroupMember[];
}

interface EventGroup {
  id: string;
  event_id: string;
  group_id: string;
  group: Group;
}

interface EventJudge {
  id: string;
  event_id: string;
  judge_id: string;
  judge: { id: string; full_name: string; church: string };
}

interface Criteria {
  id: string;
  name: string;
  max_score: number;
  weight: number;
}

interface Score {
  id: string;
  participant_id: string | null;
  group_id: string | null;
  judge_id: string;
  criteria_id: string;
  score: number;
}

type Tab = 'entrants' | 'judges' | 'criteria';

const EventDetails = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventRecord | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [eventParticipants, setEventParticipants] = useState<EventParticipant[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [eventGroups, setEventGroups] = useState<EventGroup[]>([]);
  const [judges, setJudges] = useState<Array<{ id: string; full_name: string; church: string }>>([]);
  const [eventJudges, setEventJudges] = useState<EventJudge[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [scores, setScores] = useState<Score[]>([]);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [tab, setTab] = useState<Tab>('entrants');

  const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isJudgeModalOpen, setIsJudgeModalOpen] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedJudges, setSelectedJudges] = useState<string[]>([]);
  const [pickerSearch, setPickerSearch] = useState('');

  const [selectedEventParticipantKeys, setSelectedEventParticipantKeys] = useState<React.Key[]>([]);
  const [batchDeletingParticipants, setBatchDeletingParticipants] = useState(false);

  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [scoringParticipant, setScoringParticipant] = useState<Participant | null>(null);
  const [scoreForm] = Form.useForm();
  const [savingScores, setSavingScores] = useState(false);

  /* ---------------------------------------------------------- fetch */

  const fetchEventDetails = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`*, level:event_levels(id, name)`)
        .eq('id', eventId)
        .single();

      if (error) throw error;
      setEvent(data as unknown as EventRecord);
    } catch {
      message.error('Failed to load event details');
      navigate('/admin/events');
    } finally {
      setLoading(false);
    }
  }, [eventId, navigate]);

  const fetchAllParticipants = useCallback(async () => {
    try {
      let query = supabase.from('participants').select('*').eq('is_active', true);

      // Participants are registered per event level, and chest numbers restart
      // in each, so only this level's entrants may be added.
      if (event?.level?.id) {
        query = query.eq('level_id', event.level.id);
      }

      // Only entrants of the event's own age category can be added.
      if (event?.age_category) {
        query = query.eq(
          'age_category',
          event.age_category as 'Sub Juniors' | 'Juniors' | 'Intermediates' | 'Seniors',
        );
      }

      const { data, error } = await query.order('full_name');
      if (error) throw error;
      setParticipants((data || []) as Participant[]);
    } catch {
      message.error('Failed to load participants');
    }
  }, [event?.age_category, event?.level?.id]);

  const fetchEventParticipants = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('event_participants')
        .select(`*, participant:participants(*)`)
        .eq('event_id', eventId);

      if (error) throw error;
      setEventParticipants((data || []) as unknown as EventParticipant[]);
    } catch {
      message.error('Failed to load event participants');
    }
  }, [eventId]);

  const fetchEventCriteria = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('event_criteria')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at');

      if (error) throw error;
      setCriteria((data || []) as Criteria[]);
    } catch {
      message.error('Failed to load event criteria');
    }
  }, [eventId]);

  const fetchGroups = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select(
          `*, members:group_members( id, participant_id, participant:participants( full_name, chest_number, church ) )`,
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGroups((data || []) as unknown as Group[]);
    } catch {
      message.error('Failed to load groups');
    }
  }, []);

  const fetchEventGroups = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('event_groups')
        .select(
          `*, group:groups( *, members:group_members( id, participant_id, participant:participants( full_name, chest_number, church ) ) )`,
        )
        .eq('event_id', eventId);

      if (error) throw error;
      setEventGroups((data || []) as unknown as EventGroup[]);
    } catch {
      message.error('Failed to load event groups');
    }
  }, [eventId]);

  const fetchEventJudges = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('event_judges')
        .select(`*, judge:judges( id, full_name, church )`)
        .eq('event_id', eventId);

      if (error) throw error;
      setEventJudges((data || []) as unknown as EventJudge[]);
    } catch {
      message.error('Failed to load event judges');
    }
  }, [eventId]);

  const fetchJudges = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('judges')
        .select('id, full_name, church')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setJudges(data || []);
    } catch {
      message.error('Failed to load judges');
    }
  }, []);

  const fetchScores = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('scores').select('*').eq('event_id', eventId);
      if (error) throw error;
      setScores((data || []) as Score[]);
    } catch {
      message.error('Failed to load scores');
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    fetchEventDetails();
    fetchEventParticipants();
    fetchEventCriteria();
    fetchGroups();
    fetchEventGroups();
    fetchEventJudges();
    fetchJudges();
    fetchScores();
  }, [
    eventId,
    fetchEventDetails,
    fetchEventParticipants,
    fetchEventCriteria,
    fetchGroups,
    fetchEventGroups,
    fetchEventJudges,
    fetchJudges,
    fetchScores,
  ]);

  useEffect(() => {
    fetchAllParticipants();
  }, [fetchAllParticipants]);

  /* -------------------------------------------------------- helpers */

  const isParticipantRegistered = (participantId: string) =>
    eventParticipants.some((entry) => entry.participant_id === participantId);

  const isGroupRegistered = (groupId: string) =>
    eventGroups.some((entry) => entry.group_id === groupId);

  const hasScoresSubmitted = (participantId: string) =>
    scores.some((score) => score.participant_id === participantId);

  const registeredParticipants = eventParticipants
    .map((entry) => entry.participant)
    .filter(Boolean) as Participant[];

  const expectedScores =
    (event?.event_type === 'group' ? eventGroups.length : eventParticipants.length) *
    criteria.length *
    eventJudges.length;
  const scoringProgress =
    expectedScores === 0 ? 0 : Math.round((scores.length / expectedScores) * 100);

  /* -------------------------------------------------------- actions */

  const addParticipantsToEvent = async () => {
    if (selectedParticipants.length === 0) return;

    try {
      setWorking(true);
      const existing = eventParticipants.map((entry) => entry.participant_id);
      const toAdd = selectedParticipants.filter((id) => !existing.includes(id));

      if (toAdd.length === 0) {
        message.info('Those participants are already in this event');
        return;
      }

      const { error } = await supabase
        .from('event_participants')
        .insert(toAdd.map((participantId) => ({ event_id: eventId, participant_id: participantId })));

      if (error) throw error;

      message.success(`Added ${toAdd.length} participant(s)`);
      setSelectedParticipants([]);
      setIsParticipantModalOpen(false);
      fetchEventParticipants();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to add participants');
    } finally {
      setWorking(false);
    }
  };

  const removeParticipantFromEvent = async (participantId: string) => {
    try {
      const { error } = await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', eventId)
        .eq('participant_id', participantId);

      if (error) throw error;
      message.success('Participant removed');
      fetchEventParticipants();
    } catch {
      message.error('Failed to remove participant');
    }
  };

  const handleBatchDeleteParticipants = () => {
    if (selectedEventParticipantKeys.length === 0) return;

    Modal.confirm({
      title: `Remove ${selectedEventParticipantKeys.length} participant(s)?`,
      content: 'They stay registered in the system, just not in this event.',
      okText: 'Remove',
      okType: 'danger',
      onOk: async () => {
        try {
          setBatchDeletingParticipants(true);
          const { error } = await supabase
            .from('event_participants')
            .delete()
            .eq('event_id', eventId)
            .in('participant_id', selectedEventParticipantKeys.map(String));

          if (error) throw error;
          message.success(`Removed ${selectedEventParticipantKeys.length} participant(s)`);
          setSelectedEventParticipantKeys([]);
          fetchEventParticipants();
        } catch (error) {
          message.error(error instanceof Error ? error.message : 'Failed to remove participants');
        } finally {
          setBatchDeletingParticipants(false);
        }
      },
    });
  };

  const addGroupsToEvent = async () => {
    if (selectedGroups.length === 0) return;

    try {
      setWorking(true);
      const existing = eventGroups.map((entry) => entry.group_id);
      const toAdd = selectedGroups.filter((id) => !existing.includes(id));

      if (toAdd.length === 0) {
        message.info('Those groups are already in this event');
        return;
      }

      const { error } = await supabase
        .from('event_groups')
        .insert(toAdd.map((groupId) => ({ event_id: eventId, group_id: groupId })));

      if (error) throw error;

      message.success(`Added ${toAdd.length} group(s)`);
      setSelectedGroups([]);
      setIsGroupModalOpen(false);
      fetchEventGroups();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to add groups');
    } finally {
      setWorking(false);
    }
  };

  const removeGroupFromEvent = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('event_groups')
        .delete()
        .eq('event_id', eventId)
        .eq('group_id', groupId);

      if (error) throw error;
      message.success('Group removed');
      fetchEventGroups();
    } catch {
      message.error('Failed to remove group');
    }
  };

  const addJudgesToEvent = async () => {
    if (selectedJudges.length === 0) return;

    try {
      setWorking(true);
      const existing = eventJudges.map((entry) => entry.judge_id);
      const toAdd = selectedJudges.filter((id) => !existing.includes(id));

      if (toAdd.length === 0) {
        message.info('Those judges are already assigned');
        return;
      }

      const { error } = await supabase
        .from('event_judges')
        .insert(toAdd.map((judgeId) => ({ event_id: eventId, judge_id: judgeId })));

      if (error) throw error;

      message.success(`Assigned ${toAdd.length} judge(s)`);
      setSelectedJudges([]);
      setIsJudgeModalOpen(false);
      fetchEventJudges();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to assign judges');
    } finally {
      setWorking(false);
    }
  };

  const removeJudgeFromEvent = async (judgeId: string) => {
    try {
      const { error } = await supabase
        .from('event_judges')
        .delete()
        .eq('event_id', eventId)
        .eq('judge_id', judgeId);

      if (error) throw error;
      message.success('Judge removed');
      fetchEventJudges();
    } catch {
      message.error('Failed to remove judge');
    }
  };

  const openScoreModal = (participant: Participant) => {
    setScoringParticipant(participant);

    const values: Record<string, number> = {};
    scores
      .filter((score) => score.participant_id === participant.id)
      .forEach((score) => {
        values[`${score.judge_id}_${score.criteria_id}`] = score.score;
      });

    scoreForm.setFieldsValue(values);
    setIsScoreModalOpen(true);
  };

  const closeScoreModal = () => {
    setIsScoreModalOpen(false);
    setScoringParticipant(null);
    scoreForm.resetFields();
  };

  const saveScores = async (values: Record<string, number>) => {
    if (!scoringParticipant || !eventId) return;

    try {
      setSavingScores(true);
      const assignedJudgeIds = eventJudges.map((entry) => entry.judge_id);

      const entries = Object.entries(values)
        .filter(([, score]) => score !== undefined && score !== null)
        .map(([key, score]) => {
          const [judgeId, criteriaId] = key.split('_');
          return { judgeId, criteriaId, score: Number(score) };
        })
        .filter((entry) => assignedJudgeIds.includes(entry.judgeId))
        .map((entry) => ({
          event_id: eventId,
          participant_id: scoringParticipant.id,
          judge_id: entry.judgeId,
          criteria_id: entry.criteriaId,
          score: entry.score,
          is_locked: true,
        }));

      if (entries.length === 0) {
        message.warning('No scores to save');
        return;
      }

      const { error: deleteError } = await supabase
        .from('scores')
        .delete()
        .eq('event_id', eventId)
        .eq('participant_id', scoringParticipant.id);

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase.from('scores').insert(entries);
      if (insertError) throw insertError;

      message.success('Scores saved');
      closeScoreModal();
      await fetchScores();
    } catch (error) {
      console.error('Error saving scores:', error);
      message.error('Failed to save scores');
    } finally {
      setSavingScores(false);
    }
  };

  /* --------------------------------------------------------- tables */

  const participantColumns = [
    {
      title: 'Entrant',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (name: string, record: Participant) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{name}</div>
          <div className="truncate text-caption text-muted-foreground">
            #{record.chest_number} · {record.church}
          </div>
        </div>
      ),
    },
    { title: 'District', dataIndex: 'district', key: 'district', width: 160, ellipsis: true },
    {
      title: 'Scores',
      key: 'scores',
      width: 190,
      render: (_: unknown, record: Participant) => {
        const submitted = hasScoresSubmitted(record.id);
        return (
          <div className="flex items-center gap-2">
            <StatusPill tone={submitted ? 'success' : 'neutral'}>
              {submitted ? <CheckCircle size={12} /> : <XCircle size={12} />}
              {submitted ? 'Submitted' : 'Awaiting'}
            </StatusPill>
            <button
              type="button"
              aria-label="Edit scores"
              title="Edit scores"
              onClick={() => openScoreModal(record)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-sunken hover:text-foreground"
            >
              <PencilSimple size={14} />
            </button>
          </div>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      fixed: 'right' as const,
      render: (_: unknown, record: Participant) => (
        <button
          type="button"
          aria-label="Remove from event"
          title="Remove from event"
          onClick={() => removeParticipantFromEvent(record.id)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
        >
          <Trash size={15} />
        </button>
      ),
    },
  ];

  const groupColumns = [
    {
      title: 'Group',
      dataIndex: ['group', 'name'],
      key: 'name',
      render: (_: unknown, record: EventGroup) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{record.group?.name}</div>
          <div className="truncate text-caption text-muted-foreground">
            {record.group?.members?.length || 0} members
          </div>
        </div>
      ),
    },
    {
      title: 'Members',
      key: 'members',
      ellipsis: true,
      render: (_: unknown, record: EventGroup) => (
        <span className="text-caption text-muted-foreground">
          {(record.group?.members ?? [])
            .map((member) => member.participant?.full_name)
            .filter(Boolean)
            .join(', ') || '—'}
        </span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      fixed: 'right' as const,
      render: (_: unknown, record: EventGroup) => (
        <button
          type="button"
          aria-label="Remove group"
          title="Remove group"
          onClick={() => removeGroupFromEvent(record.group_id)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
        >
          <Trash size={15} />
        </button>
      ),
    },
  ];

  const judgeColumns = [
    {
      title: 'Judge',
      dataIndex: ['judge', 'full_name'],
      key: 'judge',
      render: (_: unknown, record: EventJudge) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{record.judge?.full_name}</div>
          <div className="truncate text-caption text-muted-foreground">{record.judge?.church}</div>
        </div>
      ),
    },
    {
      title: 'Scores filed',
      key: 'filed',
      width: 160,
      render: (_: unknown, record: EventJudge) => {
        const filed = scores.filter((score) => score.judge_id === record.judge_id).length;
        const expectedForJudge =
          (event?.event_type === 'group' ? eventGroups.length : eventParticipants.length) *
          criteria.length;
        return (
          <span className="tnum text-foreground">
            {filed}
            <span className="text-muted-foreground"> / {expectedForJudge}</span>
          </span>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      fixed: 'right' as const,
      render: (_: unknown, record: EventJudge) => (
        <button
          type="button"
          aria-label="Remove judge"
          title="Remove judge"
          onClick={() => removeJudgeFromEvent(record.judge_id)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
        >
          <Trash size={15} />
        </button>
      ),
    },
  ];

  const pickerParticipants = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (!query) return participants;
    return participants.filter((participant) =>
      `${participant.chest_number} ${participant.full_name} ${participant.church}`
        .toLowerCase()
        .includes(query),
    );
  }, [participants, pickerSearch]);

  const isGroupEvent = event?.event_type === 'group';

  return (
    <AppShell
      variant="admin"
      title={event?.name ?? 'Event'}
      subtitle={
        event
          ? `${event.level?.name ?? 'No level'} · ${event.age_category || 'All categories'} · ${event.type}`
          : undefined
      }
      maxWidth="wide"
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            icon={<ArrowLeft size={15} />}
            onClick={() => navigate('/admin/events')}
          >
            <span className="hidden sm:inline">Events</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Pulse size={15} />}
            onClick={() => navigate(`/admin/scoreboard/${eventId}`)}
          >
            <span className="hidden sm:inline">Live scores</span>
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        event && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile
                label={isGroupEvent ? 'Groups' : 'Entrants'}
                value={isGroupEvent ? eventGroups.length : eventParticipants.length}
                hint={event.max_participants ? `max ${event.max_participants}` : 'Registered'}
                icon={<UsersThree size={15} />}
                tone="primary"
              />
              <StatTile
                label="Judges"
                value={eventJudges.length}
                hint="Assigned"
                icon={<Gavel size={15} />}
                tone="info"
              />
              <StatTile
                label="Criteria"
                value={criteria.length}
                hint={`${criteria.reduce((total, criterion) => total + criterion.max_score * criterion.weight, 0)} max points`}
                icon={<Target size={15} />}
              />
              <StatTile
                label="Status"
                value={
                  <StatusPill tone={statusTone(event.status)} dot className="text-body">
                    {event.status}
                  </StatusPill>
                }
                hint={event.results_published ? 'Results published' : 'Results not published'}
              />
            </div>

            <Card className="mb-4">
              <CardHeader
                title="Scoring progress"
                subtitle={`${scores.length} of ${expectedScores} possible scores recorded`}
              />
              <div className="px-4 pb-5 pt-2 md:px-5">
                <ProgressBar
                  value={scoringProgress}
                  tone={scoringProgress === 100 ? 'success' : 'primary'}
                />
                <div className="mt-3 grid gap-x-8 gap-y-2 text-caption sm:grid-cols-3">
                  <Info label="Format" value={`${event.type} · ${event.event_type}`} />
                  <Info
                    label="Time limit"
                    value={event.time_limit ? `${event.time_limit} minutes` : 'None'}
                  />
                  <Info
                    label="Running order"
                    value={event.event_order !== null ? `#${event.event_order}` : 'Unset'}
                  />
                </div>
                {event.rules && (
                  <p className="mt-3 rounded-lg bg-surface-sunken p-3 text-caption text-muted-foreground">
                    {event.rules}
                  </p>
                )}
              </div>
            </Card>

            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SegmentedControl
                value={tab}
                onChange={(value) => setTab(value as Tab)}
                className="max-w-md flex-1"
                options={[
                  {
                    value: 'entrants',
                    label: isGroupEvent ? 'Groups' : 'Entrants',
                    count: isGroupEvent ? eventGroups.length : eventParticipants.length,
                  },
                  { value: 'judges', label: 'Judges', count: eventJudges.length },
                  { value: 'criteria', label: 'Criteria', count: criteria.length },
                ]}
              />

              {tab === 'entrants' && (
                <Button
                  size="sm"
                  icon={<Plus size={15} />}
                  onClick={() => {
                    setPickerSearch('');
                    if (isGroupEvent) setIsGroupModalOpen(true);
                    else setIsParticipantModalOpen(true);
                  }}
                >
                  Add {isGroupEvent ? 'groups' : 'participants'}
                </Button>
              )}
              {tab === 'judges' && (
                <Button size="sm" icon={<Plus size={15} />} onClick={() => setIsJudgeModalOpen(true)}>
                  Assign judges
                </Button>
              )}
            </div>

            {tab === 'entrants' &&
              (isGroupEvent ? (
                <DataTable
                  columns={groupColumns}
                  dataSource={eventGroups}
                  rowKey="id"
                  scrollX={640}
                  emptyIcon={<UsersThree size={22} />}
                  emptyTitle="No groups in this event"
                  emptyDescription="Add groups so judges have something to score."
                />
              ) : (
                <DataTable
                  columns={participantColumns}
                  dataSource={registeredParticipants}
                  rowKey="id"
                  scrollX={720}
                  rowSelection={{
                    selectedRowKeys: selectedEventParticipantKeys,
                    onChange: setSelectedEventParticipantKeys,
                  }}
                  toolbar={
                    <Toolbar
                      selectionCount={selectedEventParticipantKeys.length}
                      selectionActions={
                        <>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={<Trash size={14} />}
                            loading={batchDeletingParticipants}
                            onClick={handleBatchDeleteParticipants}
                          >
                            Remove from event
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEventParticipantKeys([])}
                          >
                            Clear
                          </Button>
                        </>
                      }
                    >
                      <span className="text-caption text-muted-foreground">
                        Entrants registered for this event
                      </span>
                    </Toolbar>
                  }
                  emptyIcon={<UsersThree size={22} />}
                  emptyTitle="No entrants yet"
                  emptyDescription="Add participants so judges have someone to score."
                />
              ))}

            {tab === 'judges' && (
              <DataTable
                columns={judgeColumns}
                dataSource={eventJudges}
                rowKey="id"
                scrollX={560}
                emptyIcon={<Gavel size={22} />}
                emptyTitle="No judges assigned"
                emptyDescription="Assign judges before the event starts; only assigned judges can score."
              />
            )}

            {tab === 'criteria' && (
              <Card>
                <CardHeader
                  title="Scoring criteria"
                  subtitle="Edit these from the event form on the events page"
                />
                <div className="px-4 pb-5 md:px-5">
                  {criteria.length === 0 ? (
                    <p className="py-6 text-center text-body text-muted-foreground">
                      No criteria yet — judges cannot score this event.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {criteria.map((criterion) => (
                        <li key={criterion.id} className="flex items-center justify-between py-3">
                          <span className="text-body text-foreground">{criterion.name}</span>
                          <span className="tnum text-caption text-muted-foreground">
                            max {criterion.max_score} · weight ×{criterion.weight}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            )}

            {/* --------------------------------------- entrant picker */}
            <Sheet
              open={isParticipantModalOpen}
              onClose={() => setIsParticipantModalOpen(false)}
              dismissable={!working}
              size="lg"
              title="Add participants"
              description={
                event.age_category
                  ? `Only ${event.age_category} participants from this event level can enter.`
                  : 'Participants registered in this event level.'
              }
              footer={
                <Button
                  size="lg"
                  block
                  loading={working}
                  disabled={selectedParticipants.length === 0}
                  onClick={addParticipantsToEvent}
                >
                  Add {selectedParticipants.length || ''} entrant
                  {selectedParticipants.length === 1 ? '' : 's'}
                </Button>
              }
            >
              <SearchInput
                value={pickerSearch}
                onChange={setPickerSearch}
                placeholder="Search chest number or name"
                className="mb-2"
              />
              <PickerList
                items={pickerParticipants.map((participant) => ({
                  id: participant.id,
                  title: participant.full_name,
                  subtitle: `#${participant.chest_number} · ${participant.church}`,
                  disabled: isParticipantRegistered(participant.id),
                  disabledLabel: 'Already in',
                }))}
                selected={selectedParticipants}
                onToggle={(id, checked) =>
                  setSelectedParticipants((current) =>
                    checked ? [...current, id] : current.filter((value) => value !== id),
                  )
                }
              />
            </Sheet>

            {/* ----------------------------------------- group picker */}
            <Sheet
              open={isGroupModalOpen}
              onClose={() => setIsGroupModalOpen(false)}
              dismissable={!working}
              size="lg"
              title="Add groups"
              description="Groups are scored as one entrant."
              footer={
                <Button
                  size="lg"
                  block
                  loading={working}
                  disabled={selectedGroups.length === 0}
                  onClick={addGroupsToEvent}
                >
                  Add {selectedGroups.length || ''} group{selectedGroups.length === 1 ? '' : 's'}
                </Button>
              }
            >
              <PickerList
                items={groups.map((group) => ({
                  id: group.id,
                  title: group.name,
                  subtitle: `${group.members?.length || 0} members`,
                  disabled: isGroupRegistered(group.id),
                  disabledLabel: 'Already in',
                }))}
                selected={selectedGroups}
                onToggle={(id, checked) =>
                  setSelectedGroups((current) =>
                    checked ? [...current, id] : current.filter((value) => value !== id),
                  )
                }
              />
            </Sheet>

            {/* ----------------------------------------- judge picker */}
            <Sheet
              open={isJudgeModalOpen}
              onClose={() => setIsJudgeModalOpen(false)}
              dismissable={!working}
              size="lg"
              title="Assign judges"
              description="Only assigned judges can submit scores for this event."
              footer={
                <Button
                  size="lg"
                  block
                  loading={working}
                  disabled={selectedJudges.length === 0}
                  onClick={addJudgesToEvent}
                >
                  Assign {selectedJudges.length || ''} judge{selectedJudges.length === 1 ? '' : 's'}
                </Button>
              }
            >
              <PickerList
                items={judges.map((judge) => ({
                  id: judge.id,
                  title: judge.full_name,
                  subtitle: judge.church,
                  disabled: eventJudges.some((entry) => entry.judge_id === judge.id),
                  disabledLabel: 'Assigned',
                }))}
                selected={selectedJudges}
                onToggle={(id, checked) =>
                  setSelectedJudges((current) =>
                    checked ? [...current, id] : current.filter((value) => value !== id),
                  )
                }
              />
            </Sheet>

            {/* ------------------------------------------ score editor */}
            <Sheet
              open={isScoreModalOpen}
              onClose={closeScoreModal}
              dismissable={!savingScores}
              size="lg"
              title={`Edit scores — ${scoringParticipant?.full_name ?? ''}`}
              description={
                scoringParticipant
                  ? `#${scoringParticipant.chest_number} · ${scoringParticipant.age_category}`
                  : undefined
              }
              footer={
                <div className="space-y-2">
                  <p className="text-caption text-muted-foreground">
                    Saving replaces every score this entrant has in this event.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="lg"
                      onClick={closeScoreModal}
                      disabled={savingScores}
                    >
                      Cancel
                    </Button>
                    <Button size="lg" block loading={savingScores} onClick={() => scoreForm.submit()}>
                      Save scores
                    </Button>
                  </div>
                </div>
              }
            >
              {eventJudges.length === 0 || criteria.length === 0 ? (
                <p className="py-6 text-center text-body text-muted-foreground">
                  Assign judges and add criteria before entering scores.
                </p>
              ) : (
                <Form form={scoreForm} layout="vertical" onFinish={saveScores} requiredMark={false}>
                  {eventJudges.map((eventJudge) => (
                    <div key={eventJudge.judge_id} className="mb-4">
                      <div className="mb-2 rounded-lg bg-surface-sunken px-3 py-2">
                        <p className="text-body font-medium text-foreground">
                          {eventJudge.judge?.full_name}
                        </p>
                        <p className="text-caption text-muted-foreground">
                          {eventJudge.judge?.church}
                        </p>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {criteria.map((criterion) => (
                          <Form.Item
                            key={`${eventJudge.judge_id}_${criterion.id}`}
                            name={`${eventJudge.judge_id}_${criterion.id}`}
                            label={
                              <span className="flex w-full items-baseline justify-between gap-2">
                                <span>{criterion.name}</span>
                                <span className="text-caption text-muted-foreground">
                                  max {criterion.max_score}
                                </span>
                              </span>
                            }
                            rules={[
                              {
                                validator: (_, value) => {
                                  if (value === undefined || value === null || value === '') {
                                    return Promise.resolve();
                                  }
                                  if (value < 0) return Promise.reject('Score cannot be negative');
                                  if (value > criterion.max_score) {
                                    return Promise.reject(`Max is ${criterion.max_score}`);
                                  }
                                  return Promise.resolve();
                                },
                              },
                            ]}
                          >
                            <InputNumber
                              className="w-full"
                              min={0}
                              max={criterion.max_score}
                              step={0.1}
                              precision={1}
                              placeholder={`0 – ${criterion.max_score}`}
                            />
                          </Form.Item>
                        ))}
                      </div>
                    </div>
                  ))}
                </Form>
              )}
            </Sheet>
          </>
        )
      )}
    </AppShell>
  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div className="min-w-0">
    <span className="block text-muted-foreground">{label}</span>
    <span className="block truncate font-medium capitalize text-foreground">{value}</span>
  </div>
);

const PickerList = ({
  items,
  selected,
  onToggle,
}: {
  items: Array<{
    id: string;
    title: string;
    subtitle: string;
    disabled?: boolean;
    disabledLabel?: string;
  }>;
  selected: string[];
  onToggle: (id: string, checked: boolean) => void;
}) => (
  <div className="scrollbar-thin max-h-[55vh] overflow-y-auto rounded-xl border border-border">
    {items.length === 0 ? (
      <p className="px-3 py-8 text-center text-caption text-muted-foreground">Nothing to show</p>
    ) : (
      items.map((item) => (
        <label
          key={item.id}
          className={`flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 ${
            item.disabled ? 'opacity-50' : 'cursor-pointer hover:bg-surface-sunken'
          }`}
        >
          <Checkbox
            disabled={item.disabled}
            checked={selected.includes(item.id)}
            onChange={(changeEvent) => onToggle(item.id, changeEvent.target.checked)}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body text-foreground">{item.title}</span>
            <span className="block truncate text-caption text-muted-foreground">{item.subtitle}</span>
          </span>
          {item.disabled && item.disabledLabel && (
            <StatusPill tone="neutral">{item.disabledLabel}</StatusPill>
          )}
        </label>
      ))
    )}
  </div>
);

export default EventDetails;
