import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import { Layout, Card, Button, Checkbox, Table, message, Spin, Space, Typography, Badge, Divider, Modal, Input, InputNumber, Form } from 'antd';
import { ArrowLeft, Users, Plus, Minus, Search, Trash2, Edit3, CheckCircle, XCircle } from 'lucide-react';

const { Content } = Layout;
const { Title, Text } = Typography;

interface Event {
  id: string;
  name: string;
  type: string;
  event_type: string;
  status: string;
  age_category?: string | null;
  rules?: string;
  time_limit?: number;
  max_participants?: number;
  event_order?: number;
  season?: {
    id: string;
    name: string;
  };
  created_at: string;
}

interface Participant {
  id: string;
  full_name: string;
  age_category: string;
  chest_number: string;
  church: string;
  district: string;
  username: string;
}

interface EventParticipant {
  id: string;
  participant_id: string;
  registered_at: string;
  participant: Participant;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  members?: Array<{
    id: string;
    participant_id: string;
    participant: {
      full_name: string;
      chest_number: string;
      church: string;
    };
  }>;
}

interface EventGroup {
  id: string;
  group_id: string;
  registered_at: string;
  group: Group;
}

interface EventJudge {
  id: string;
  judge_id: string;
  assigned_at: string;
  judge: {
    id: string;
    full_name: string;
    church: string;
  };
}

interface Criteria {
  id: string;
  name: string;
  max_score: number;
  weight: number;
}

interface Score {
  id: string;
  event_id: string;
  participant_id: string;
  judge_id: string;
  criteria_id: string;
  score: number;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  judge?: {
    id: string;
    full_name: string;
    church: string;
  };
  criteria?: {
    id: string;
    name: string;
    max_score: number;
    weight: number;
  };
}

const EventDetails = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  
  console.log('EventDetails component rendered with eventId:', eventId);
  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [eventParticipants, setEventParticipants] = useState<EventParticipant[]>([]);
  const [eventGroups, setEventGroups] = useState<EventGroup[]>([]);
  const [eventJudges, setEventJudges] = useState<EventJudge[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [loading, setLoading] = useState(true);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  
  // Batch selection state for event participants
  const [selectedEventParticipantKeys, setSelectedEventParticipantKeys] = useState<React.Key[]>([]);
  const [batchDeletingParticipants, setBatchDeletingParticipants] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [judges, setJudges] = useState<Array<{ id: string; full_name: string; church: string }>>([]);
  
  // Modal states
  const [isParticipantModalOpen, setIsParticipantModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isJudgeModalOpen, setIsJudgeModalOpen] = useState(false);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [selectedJudges, setSelectedJudges] = useState<string[]>([]);
  
  // Score management states
  const [scores, setScores] = useState<Score[]>([]);
  const [selectedParticipantForScoring, setSelectedParticipantForScoring] = useState<Participant | null>(null);
  const [scoreForm] = Form.useForm();
  const [savingScores, setSavingScores] = useState(false);

  // Filtered lists for search
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [filteredJudges, setFilteredJudges] = useState<Array<{ id: string; full_name: string; church: string }>>([]);

  const fetchEventDetails = useCallback(async () => {
    try {
      console.log('Fetching event details for ID:', eventId);
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          level:event_levels(id, name)
        `)
        .eq('id', eventId)
        .single();

      if (error) throw error;
      console.log('Event details loaded:', data);
      setEvent(data);
    } catch (error: unknown) {
      console.error('Error fetching event details:', error);
      message.error('Failed to load event details');
      navigate('/admin/events');
    } finally {
      setLoading(false);
    }
  }, [eventId, navigate]);

  const fetchAllParticipants = useCallback(async () => {
    try {
      let query = supabase
        .from('participants')
        .select('*')
        .eq('is_active', true);

      // Filter by event's age category if it exists
      if (event?.age_category) {
        query = query.eq('age_category', event.age_category as 'Sub Juniors' | 'Juniors' | 'Intermediates' | 'Seniors');
      }

      const { data, error } = await query.order('full_name');

      if (error) throw error;
      setParticipants(data || []);
    } catch (error: unknown) {
      message.error('Failed to load participants');
    }
  }, [event?.age_category]);

  const fetchEventParticipants = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('event_participants')
        .select(`
          *,
          participant:participants(*)
        `)
        .eq('event_id', eventId);

      if (error) throw error;
      
      // Debug: Log the data to see what we're getting
      console.log('Event participants data:', data);
      
      setEventParticipants(data || []);
    } catch (error: unknown) {
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
      setCriteria(data || []);
    } catch (error: unknown) {
      message.error('Failed to load event criteria');
    }
  }, [eventId]);

  const fetchGroups = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          members:group_members(
            id,
            participant_id,
            participant:participants(
              full_name,
              chest_number,
              church
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGroups(data || []);
    } catch (error: unknown) {
      message.error('Failed to load groups');
    }
  }, []);

  const fetchEventGroups = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('event_groups')
        .select(`
          *,
          group:groups(
            *,
            members:group_members(
              id,
              participant_id,
              participant:participants(
                full_name,
                chest_number,
                church
              )
            )
          )
        `)
        .eq('event_id', eventId);

      if (error) throw error;
      setEventGroups(data || []);
    } catch (error: unknown) {
      message.error('Failed to load event groups');
    }
  }, [eventId]);

  const fetchEventJudges = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('event_judges')
        .select(`
          *,
          judge:judges(
            id,
            full_name,
            church
          )
        `)
        .eq('event_id', eventId);

      if (error) throw error;
      setEventJudges(data || []);
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      message.error('Failed to load judges');
    }
  }, []);

  const fetchScores = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('scores')
        .select(`
          *,
          judge:judges(
            id,
            full_name,
            church
          ),
          criteria:event_criteria(
            id,
            name,
            max_score,
            weight
          )
        `)
        .eq('event_id', eventId);

      if (error) throw error;
      setScores(data || []);
    } catch (error: unknown) {
      message.error('Failed to load scores');
    }
  }, [eventId]);

  const addParticipantsToEvent = useCallback(async () => {
    if (selectedParticipants.length === 0) {
      message.warning('Please select participants to add');
      return;
    }

    try {
      setParticipantsLoading(true);

      // Check if participants are already registered
      const existingParticipantIds = eventParticipants.map(ep => ep.participant_id);
      const newParticipantIds = selectedParticipants.filter(id => !existingParticipantIds.includes(id));

      if (newParticipantIds.length === 0) {
        message.info('All selected participants are already registered for this event');
        setSelectedParticipants([]);
        return;
      }

      // Add new participants
      const { error } = await supabase
        .from('event_participants')
        .insert(
          newParticipantIds.map(participantId => ({
            event_id: eventId,
            participant_id: participantId
          }))
        );

      if (error) throw error;

      message.success(`Successfully added ${newParticipantIds.length} participant(s) to the event`);
      setSelectedParticipants([]);
      fetchEventParticipants();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add participants to event';
      message.error(errorMessage);
    } finally {
      setParticipantsLoading(false);
    }
  }, [selectedParticipants, eventParticipants, eventId, fetchEventParticipants]);

  const removeParticipantFromEvent = useCallback(async (participantId: string) => {
    try {
      const { error } = await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', eventId)
        .eq('participant_id', participantId);

      if (error) throw error;

      message.success('Participant removed from event');
      fetchEventParticipants();
    } catch (error: unknown) {
      message.error('Failed to remove participant from event');
    }
  }, [eventId, fetchEventParticipants]);

  const handleBatchDeleteParticipants = useCallback(async () => {
    if (selectedEventParticipantKeys.length === 0) {
      message.warning('Please select participants to remove');
      return;
    }

    try {
      setBatchDeletingParticipants(true);
      
      // Delete each selected participant from the event
      for (const participantId of selectedEventParticipantKeys) {
        const { error } = await supabase
          .from('event_participants')
          .delete()
          .eq('event_id', eventId)
          .eq('participant_id', String(participantId));
        
        if (error) throw error;
      }

      message.success(`Successfully removed ${selectedEventParticipantKeys.length} participant(s) from the event`);
      setSelectedEventParticipantKeys([]);
      fetchEventParticipants();
    } catch (error: any) {
      message.error(error.message || 'Failed to remove participants from event');
    } finally {
      setBatchDeletingParticipants(false);
    }
  }, [selectedEventParticipantKeys, eventId, fetchEventParticipants]);

  const handleParticipantSelection = useCallback((participantId: string, checked: boolean) => {
    if (checked) {
      setSelectedParticipants([...selectedParticipants, participantId]);
    } else {
      setSelectedParticipants(selectedParticipants.filter(id => id !== participantId));
    }
  }, [selectedParticipants]);

  const isParticipantRegistered = useCallback((participantId: string) => {
    return eventParticipants.some(ep => ep.participant_id === participantId);
  }, [eventParticipants]);

  const isGroupRegistered = useCallback((groupId: string) => {
    return eventGroups.some(eg => eg.group_id === groupId);
  }, [eventGroups]);

  const hasScoresSubmitted = useCallback((participantId: string) => {
    return scores.some(s => s.participant_id === participantId);
  }, [scores]);

  const addGroupsToEvent = useCallback(async () => {
    if (selectedGroups.length === 0) {
      message.warning('Please select groups to add');
      return;
    }

    try {
      setParticipantsLoading(true);

      // Check if groups are already registered
      const existingGroupIds = eventGroups.map(eg => eg.group_id);
      const newGroupIds = selectedGroups.filter(id => !existingGroupIds.includes(id));

      if (newGroupIds.length === 0) {
        message.info('All selected groups are already registered for this event');
        setSelectedGroups([]);
        return;
      }

      // Add new groups
      const { error } = await supabase
        .from('event_groups')
        .insert(
          newGroupIds.map(groupId => ({
            event_id: eventId,
            group_id: groupId
          }))
        );

      if (error) throw error;

      message.success(`Successfully added ${newGroupIds.length} group(s) to the event`);
      setSelectedGroups([]);
      fetchEventGroups();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add groups to event';
      message.error(errorMessage);
    } finally {
      setParticipantsLoading(false);
    }
  }, [selectedGroups, eventGroups, eventId, fetchEventGroups]);

  const removeGroupFromEvent = useCallback(async (groupId: string) => {
    try {
      const { error } = await supabase
        .from('event_groups')
        .delete()
        .eq('event_id', eventId)
        .eq('group_id', groupId);

      if (error) throw error;

      message.success('Group removed from event');
      fetchEventGroups();
    } catch (error: unknown) {
      message.error('Failed to remove group from event');
    }
  }, [eventId, fetchEventGroups]);

  const removeJudgeFromEvent = useCallback(async (judgeId: string) => {
    try {
      const { error } = await supabase
        .from('event_judges')
        .delete()
        .eq('event_id', eventId)
        .eq('judge_id', judgeId);

      if (error) throw error;

      message.success('Judge removed from event');
      fetchEventJudges();
    } catch (error: unknown) {
      message.error('Failed to remove judge from event');
    }
  }, [eventId, fetchEventJudges]);

  const addJudgesToEvent = useCallback(async () => {
    if (selectedJudges.length === 0) {
      message.warning('Please select judges to add');
      return;
    }

    try {
      setParticipantsLoading(true);

      // Check if judges are already assigned
      const existingJudgeIds = eventJudges.map(ej => ej.judge_id);
      const newJudgeIds = selectedJudges.filter(id => !existingJudgeIds.includes(id));

      if (newJudgeIds.length === 0) {
        message.info('All selected judges are already assigned to this event');
        setSelectedJudges([]);
        return;
      }

      // Add new judges
      const { error } = await supabase
        .from('event_judges')
        .insert(
          newJudgeIds.map(judgeId => ({
            event_id: eventId,
            judge_id: judgeId
          }))
        );

      if (error) throw error;

      message.success(`Successfully added ${newJudgeIds.length} judge(s) to the event`);
      setSelectedJudges([]);
      fetchEventJudges();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add judges to event';
      message.error(errorMessage);
    } finally {
      setParticipantsLoading(false);
    }
  }, [selectedJudges, eventJudges, eventId, fetchEventJudges]);

  const openScoreModal = useCallback((participant: Participant) => {
    setSelectedParticipantForScoring(participant);
    
    // Get existing scores for this participant
    const participantScores = scores.filter(s => s.participant_id === participant.id);
    
    // Prepare form data with existing scores
    const formData: Record<string, number> = {};
    participantScores.forEach(score => {
      formData[`${score.judge_id}_${score.criteria_id}`] = score.score;
    });
    
    scoreForm.setFieldsValue(formData);
    setIsScoreModalOpen(true);
  }, [scores, scoreForm]);

  const saveScores = useCallback(async (values: Record<string, number>) => {
    if (!selectedParticipantForScoring || !eventId) return;

    try {
      setSavingScores(true);
      
      // Get all judges and criteria for this event
      const eventJudgeIds = eventJudges.map(ej => ej.judge_id);
      
      // Process each score entry
      const scoreEntries: Array<{
        event_id: string;
        participant_id: string;
        judge_id: string;
        criteria_id: string;
        score: number;
        is_locked: boolean;
      }> = [];

      Object.entries(values).forEach(([key, score]) => {
        if (score !== undefined && score !== null) {
          const [judgeId, criteriaId] = key.split('_');
          
          // Only process if judge is assigned to this event
          if (eventJudgeIds.includes(judgeId)) {
            scoreEntries.push({
              event_id: eventId,
              participant_id: selectedParticipantForScoring.id,
              judge_id: judgeId,
              criteria_id: criteriaId,
              score: Number(score),
              is_locked: true
            });
          }
        }
      });

      if (scoreEntries.length === 0) {
        message.warning('No valid scores to save');
        return;
      }

      // Delete existing scores for this participant first
      const { error: deleteError } = await supabase
        .from('scores')
        .delete()
        .eq('event_id', eventId)
        .eq('participant_id', selectedParticipantForScoring.id);

      if (deleteError) throw deleteError;

      // Insert new scores
      const { error: insertError } = await supabase
        .from('scores')
        .insert(scoreEntries);

      if (insertError) throw insertError;

      message.success('Scores saved successfully');
      setIsScoreModalOpen(false);
      setSelectedParticipantForScoring(null);
      scoreForm.resetFields();
      
      // Refresh scores data
      await fetchScores();
      
    } catch (error: unknown) {
      console.error('Error saving scores:', error);
      message.error('Failed to save scores');
    } finally {
      setSavingScores(false);
    }
  }, [selectedParticipantForScoring, eventId, eventJudges, scoreForm, fetchScores]);

  // useEffect to fetch data when component mounts
  useEffect(() => {
    if (eventId) {
      fetchEventDetails();
      fetchAllParticipants();
      fetchEventParticipants();
      fetchEventCriteria();
      fetchGroups();
      fetchEventGroups();
      fetchEventJudges();
      fetchJudges();
      fetchScores();
    }
  }, [eventId, fetchEventDetails, fetchAllParticipants, fetchEventParticipants, fetchEventCriteria, fetchGroups, fetchEventGroups, fetchEventJudges, fetchJudges, fetchScores]);

  const handleGroupSelection = useCallback((groupId: string, checked: boolean) => {
    if (checked) {
      setSelectedGroups([...selectedGroups, groupId]);
    } else {
      setSelectedGroups(selectedGroups.filter(id => id !== groupId));
    }
  }, [selectedGroups]);

  const participantColumns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 200,
      render: (text: string, record: Participant) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            Chest: {record.chest_number} • {record.age_category} • {record.church}
          </div>
        </div>
      )
    },
    {
      title: 'Age Category',
      dataIndex: 'age_category',
      key: 'age_category',
      width: 150,
      align: 'center' as const,
    },
    {
      title: 'District',
      dataIndex: 'district',
      key: 'district',
      width: 150
    },
    {
      title: 'Scores',
      key: 'scores',
      width: 150,
      align: 'center' as const,
      render: (_: unknown, record: Participant) => {
        const hasScores = hasScoresSubmitted(record.id);
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {hasScores ? (
                <>
                  <CheckCircle size={16} style={{ color: '#52c41a' }} />
                  <span style={{ fontSize: '12px', color: '#52c41a' }}>Submitted</span>
                </>
              ) : (
                <>
                  <XCircle size={16} style={{ color: '#ff4d4f' }} />
                  <span style={{ fontSize: '12px', color: '#ff4d4f' }}>Not Submitted</span>
                </>
              )}
            </div>
            <Button
              type="text"
              size="small"
              icon={<Edit3 size={14} />}
              onClick={() => openScoreModal(record)}
              title="Edit Scores"
            />
          </div>
        );
      }
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: Participant) => (
        <Button
          type="text"
          danger
          icon={<Trash2 size={16} />}
          onClick={() => removeParticipantFromEvent(record.id)}
          disabled={!isParticipantRegistered(record.id)}
        />
      )
    }
  ];

  const eventParticipantRowSelection = {
    selectedRowKeys: selectedEventParticipantKeys,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedEventParticipantKeys(selectedRowKeys);
    },
  };

  const groupColumns = [
    {
      title: 'Group Name',
      dataIndex: ['group', 'name'],
      key: 'name',
      width: 200,
      render: (text: string, record: EventGroup) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.group.description || 'No description'}
          </div>
        </div>
      )
    },
    {
      title: 'Members',
      dataIndex: ['group', 'members'],
      key: 'members',
      width: 200,
      render: (members: any[]) => (
        <div>
          <div>{members?.length || 0} participants</div>
          {members && members.length > 0 && (
            <div style={{ fontSize: '12px', color: '#666' }}>
              {members.slice(0, 3).map(m => m.participant.full_name).join(', ')}
              {members.length > 3 && ` +${members.length - 3} more`}
            </div>
          )}
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: EventGroup) => (
        <Button
          type="text"
          danger
          icon={<Trash2 size={16} />}
          onClick={() => removeGroupFromEvent(record.group_id)}
        />
      )
    }
  ];

  const judgeColumns = [
    {
      title: 'Judge Name',
      dataIndex: ['judge', 'full_name'],
      key: 'name',
      width: 200,
    },
    {
      title: 'Church',
      dataIndex: ['judge', 'church'],
      key: 'church',
      width: 200,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: EventJudge) => (
        <Button
          type="text"
          danger
          icon={<Trash2 size={16} />}
          onClick={() => removeJudgeFromEvent(record.judge_id)}
        />
      )
    }
  ];

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navigation />
        <Layout className="md:ml-64">
          <Content style={{ padding: '16px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-6 md:pt-4">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
              <Spin size="large" />
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }

  if (!event) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navigation />
        <Layout className="md:ml-64">
          <Content style={{ padding: '16px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-6 md:pt-4">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
              <Text>Event not found or failed to load</Text>
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      <Layout className="md:ml-64">
        <Content style={{ padding: '16px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-6 md:pt-4">
          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <Button 
              icon={<ArrowLeft size={16} />} 
              onClick={() => navigate('/admin/events')}
              style={{ marginBottom: '16px' }}
            >
              Back to Events
            </Button>
            
            <div style={{ marginBottom: '8px' }}>
              <Title level={2} style={{ margin: 0 }}>{event.name}</Title>
            </div>
            <Text type="secondary">
              {event.type.charAt(0).toUpperCase() + event.type.slice(1)} Event • {event.event_type === 'individual' ? 'Individual' : 'Group'} Category
              {event.season && ` • ${event.season.name}`}
              {event.time_limit && ` • ${event.time_limit} min time limit`}
              {event.max_participants && ` • Max ${event.max_participants} participants`}
            </Text>
          </div>

          {/* Event Details */}
          <Card title="Event Details" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <Text strong>Type:</Text>
                <div>{event.type.charAt(0).toUpperCase() + event.type.slice(1)}</div>
              </div>
              <div>
                <Text strong>Category:</Text>
                <div>{event.event_type === 'individual' ? 'Individual Event' : 'Group Event'}</div>
              </div>
              <div>
                <Text strong>Status:</Text>
                <div>{event.status.charAt(0).toUpperCase() + event.status.slice(1)}</div>
              </div>
              <div>
                <Text strong>Time Limit:</Text>
                <div>{event.time_limit ? `${event.time_limit} minutes` : 'No time limit'}</div>
              </div>
              <div>
                <Text strong>Max Participants:</Text>
                <div>{event.max_participants || 'Unlimited'}</div>
              </div>
              <div>
                <Text strong>Age Category:</Text>
                <div>{event.age_category || 'All Ages'}</div>
              </div>
              <div>
                <Text strong>Event Order:</Text>
                <div>{event.event_order || 'Not set'}</div>
              </div>
              <div>
                <Text strong>Created:</Text>
                <div>{new Date(event.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            
            {event.rules && (
              <div style={{ marginTop: '16px' }}>
                <Text strong>Rules:</Text>
                <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
                  {event.rules}
                </div>
              </div>
            )}
          </Card>

          {/* Event Criteria */}
          {criteria.length > 0 && (
            <Card title="Scoring Criteria" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {criteria.map((criterion) => (
                  <div key={criterion.id} style={{ padding: '12px', border: '1px solid #d9d9d9', borderRadius: '6px' }}>
                    <div style={{ fontWeight: 500 }}>{criterion.name}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      Max Score: {criterion.max_score} • Weight: {criterion.weight}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Current Participants/Groups List */}
          {event.event_type === 'individual' ? (
            <Card 
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <Users size={16} />
                    Event Participants ({eventParticipants.length})
                  </Space>
                  <Space>
                    {selectedEventParticipantKeys.length > 0 && (
                      <Button 
                        danger 
                        icon={<Trash2 size={16} />}
                        loading={batchDeletingParticipants}
                        onClick={handleBatchDeleteParticipants}
                        size="small"
                        className="md:inline-flex hidden:flex"
                      >
                        <span className="hidden md:inline">Remove Selected ({selectedEventParticipantKeys.length})</span>
                      </Button>
                    )}
                    <Button
                      type="primary"
                      icon={<Plus size={16} />}
                      onClick={() => setIsParticipantModalOpen(true)}
                      size="small"
                      className="md:inline-flex hidden:flex"
                    >
                      <span className="hidden md:inline">Add</span>
                    </Button>
                  </Space>
                </div>
              }
              style={{ marginBottom: '24px' }}
            >
              <Table
                columns={participantColumns}
                dataSource={eventParticipants.map(ep => ep.participant)}
                rowKey="id"
                rowSelection={eventParticipantRowSelection}
                pagination={false}
                loading={participantsLoading}
                locale={{
                  emptyText: 'No participants registered for this event yet'
                }}
              />
            </Card>
          ) : (
            <Card 
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <Users size={16} />
                    Event Groups ({eventGroups.length})
                  </Space>
                  <Button
                    type="primary"
                    icon={<Plus size={16} />}
                    onClick={() => setIsGroupModalOpen(true)}
                    size="small"
                    className="md:inline-flex hidden:flex"
                  >
                    <span className="hidden md:inline">Add</span>
                  </Button>
                </div>
              }
              style={{ marginBottom: '24px' }}
            >
              <Table
                columns={groupColumns}
                dataSource={eventGroups}
                rowKey="id"
                pagination={false}
                loading={participantsLoading}
                locale={{
                  emptyText: 'No groups registered for this event yet'
                }}
              />
            </Card>
          )}

          {/* Current Judges List */}
          <Card 
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space>
                  <Users size={16} />
                  Event Judges ({eventJudges.length})
                </Space>
                <Button
                  type="primary"
                  icon={<Plus size={16} />}
                  onClick={() => setIsJudgeModalOpen(true)}
                  size="small"
                  className="md:inline-flex hidden:flex"
                >
                  <span className="hidden md:inline">Add</span>
                </Button>
              </div>
            }
            style={{ marginBottom: '24px' }}
          >
            <Table
              columns={judgeColumns}
              dataSource={eventJudges}
              rowKey="id"
              pagination={false}
              loading={participantsLoading}
              locale={{
                emptyText: 'No judges assigned to this event yet'
              }}
            />
          </Card>
        </Content>
      </Layout>

      {/* Participant Assignment Modal */}
      <Modal
        title="Add Participants to Event"
        open={isParticipantModalOpen}
        onCancel={() => {
          setIsParticipantModalOpen(false);
          setSelectedParticipants([]);
        }}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text type="secondary">
            Select participants to add to this event. Currently registered participants are shown in the table below.
          </Text>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '16px' }}>
          <Input
            placeholder="Search by chest number or name..."
            prefix={<Search size={16} style={{ color: '#bfbfbf' }} />}
            onChange={(e) => {
              const searchTerm = e.target.value.toLowerCase();
              const filtered = participants.filter(participant => 
                participant.chest_number.toLowerCase().includes(searchTerm) ||
                participant.full_name.toLowerCase().includes(searchTerm)
              );
              setFilteredParticipants(filtered);
            }}
            allowClear
          />
        </div>

        <div style={{ marginBottom: '16px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '6px', padding: '16px' }}>
          {(filteredParticipants.length > 0 ? filteredParticipants : participants).map((participant) => (
            <div key={participant.id} style={{ marginBottom: '8px' }}>
              <Checkbox
                checked={selectedParticipants.includes(participant.id)}
                onChange={(e) => handleParticipantSelection(participant.id, e.target.checked)}
                disabled={isParticipantRegistered(participant.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{participant.full_name}</span>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    ({participant.chest_number} • {participant.age_category})
                  </span>
                  {isParticipantRegistered(participant.id) && (
                    <Badge color="green" text="Already Registered" />
                  )}
                </div>
              </Checkbox>
            </div>
          ))}
        </div>

        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => {
            addParticipantsToEvent();
            setIsParticipantModalOpen(false);
          }}
          loading={participantsLoading}
          disabled={selectedParticipants.length === 0}
          style={{ width: '100%' }}
        >
          Add {selectedParticipants.length > 0 ? `${selectedParticipants.length} ` : ''}Participant{selectedParticipants.length !== 1 ? 's' : ''} to Event
        </Button>
      </Modal>

      {/* Group Assignment Modal */}
      <Modal
        title="Add Groups to Event"
        open={isGroupModalOpen}
        onCancel={() => {
          setIsGroupModalOpen(false);
          setSelectedGroups([]);
        }}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text type="secondary">
            Select groups to add to this event. Currently registered groups are shown in the table below.
          </Text>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '16px' }}>
          <Input
            placeholder="Search by group name..."
            prefix={<Search size={16} style={{ color: '#bfbfbf' }} />}
            onChange={(e) => {
              const searchTerm = e.target.value.toLowerCase();
              const filtered = groups.filter(group => 
                group.name.toLowerCase().includes(searchTerm)
              );
              setFilteredGroups(filtered);
            }}
            allowClear
          />
        </div>

        <div style={{ marginBottom: '16px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '6px', padding: '16px' }}>
          {(filteredGroups.length > 0 ? filteredGroups : groups).map((group) => (
            <div key={group.id} style={{ marginBottom: '8px' }}>
              <Checkbox
                checked={selectedGroups.includes(group.id)}
                onChange={(e) => handleGroupSelection(group.id, e.target.checked)}
                disabled={isGroupRegistered(group.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{group.name}</span>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    ({group.members?.length || 0} members)
                  </span>
                  {isGroupRegistered(group.id) && (
                    <Badge color="green" text="Already Registered" />
                  )}
                </div>
              </Checkbox>
            </div>
          ))}
        </div>

        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => {
            addGroupsToEvent();
            setIsGroupModalOpen(false);
          }}
          loading={participantsLoading}
          disabled={selectedGroups.length === 0}
          style={{ width: '100%' }}
        >
          Add {selectedGroups.length > 0 ? `${selectedGroups.length} ` : ''}Group{selectedGroups.length !== 1 ? 's' : ''} to Event
        </Button>
      </Modal>

      {/* Judge Assignment Modal */}
      <Modal
        title="Add Judges to Event"
        open={isJudgeModalOpen}
        onCancel={() => {
          setIsJudgeModalOpen(false);
          setSelectedJudges([]);
        }}
        footer={null}
        width={600}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text type="secondary">
            Select judges to assign to this event. Currently assigned judges are shown in the table below.
          </Text>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '16px' }}>
          <Input
            placeholder="Search by judge name..."
            prefix={<Search size={16} style={{ color: '#bfbfbf' }} />}
            onChange={(e) => {
              const searchTerm = e.target.value.toLowerCase();
              const filtered = judges.filter(judge => 
                judge.full_name.toLowerCase().includes(searchTerm) ||
                judge.church.toLowerCase().includes(searchTerm)
              );
              setFilteredJudges(filtered);
            }}
            allowClear
          />
        </div>

        <div style={{ marginBottom: '16px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '6px', padding: '16px' }}>
          {(filteredJudges.length > 0 ? filteredJudges : judges).map((judge) => (
            <div key={judge.id} style={{ marginBottom: '8px' }}>
              <Checkbox
                checked={selectedJudges.includes(judge.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedJudges([...selectedJudges, judge.id]);
                  } else {
                    setSelectedJudges(selectedJudges.filter(id => id !== judge.id));
                  }
                }}
                disabled={eventJudges.some(ej => ej.judge_id === judge.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{judge.full_name}</span>
                  <span style={{ fontSize: '12px', color: '#666' }}>
                    ({judge.church})
                  </span>
                  {eventJudges.some(ej => ej.judge_id === judge.id) && (
                    <Badge color="green" text="Already Registered" />
                  )}
                </div>
              </Checkbox>
            </div>
          ))}
        </div>

        <Button
          type="primary"
          icon={<Plus size={16} />}
          onClick={() => {
            addJudgesToEvent();
            setIsJudgeModalOpen(false);
          }}
          loading={participantsLoading}
          disabled={selectedJudges.length === 0}
          style={{ width: '100%' }}
        >
          Add {selectedJudges.length > 0 ? `${selectedJudges.length} ` : ''}Judge{selectedJudges.length !== 1 ? 's' : ''} to Event
        </Button>
      </Modal>

      {/* Score Editing Modal */}
      <Modal
        title={
          <div>
            <div style={{ fontSize: '16px', fontWeight: 500 }}>
              Edit Scores - {selectedParticipantForScoring?.full_name}
            </div>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Chest #{selectedParticipantForScoring?.chest_number} • {selectedParticipantForScoring?.age_category}
            </div>
          </div>
        }
        open={isScoreModalOpen}
        onCancel={() => {
          setIsScoreModalOpen(false);
          setSelectedParticipantForScoring(null);
          scoreForm.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={scoreForm}
          layout="vertical"
          onFinish={saveScores}
        >
          <div style={{ marginBottom: '16px' }}>
            <Text type="secondary">
              Enter scores for each judge and criteria. Leave empty if no score should be recorded.
            </Text>
          </div>

          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {eventJudges.map((eventJudge) => (
              <div key={eventJudge.judge_id} style={{ marginBottom: '24px' }}>
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: '#f5f5f5', 
                  borderRadius: '6px',
                  marginBottom: '12px'
                }}>
                  <Text strong style={{ fontSize: '14px' }}>
                    {eventJudge.judge.full_name}
                  </Text>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    {eventJudge.judge.church}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '12px' }}>
                  {criteria.map((criterion) => (
                    <Form.Item
                      key={`${eventJudge.judge_id}_${criterion.id}`}
                      label={
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{criterion.name}</span>
                          <span style={{ fontSize: '12px', color: '#666' }}>
                            Max: {criterion.max_score} • Weight: {criterion.weight}
                          </span>
                        </div>
                      }
                      name={`${eventJudge.judge_id}_${criterion.id}`}
                      rules={[
                        {
                          validator: (_, value) => {
                            if (value === undefined || value === null || value === '') {
                              return Promise.resolve();
                            }
                            if (value < 0) {
                              return Promise.reject('Score cannot be negative');
                            }
                            if (value > criterion.max_score) {
                              return Promise.reject(`Score cannot exceed ${criterion.max_score}`);
                            }
                            return Promise.resolve();
                          }
                        }
                      ]}
                    >
                      <InputNumber
                        min={0}
                        max={criterion.max_score}
                        step={0.1}
                        precision={1}
                        style={{ width: '100%' }}
                        placeholder={`0 - ${criterion.max_score}`}
                      />
                    </Form.Item>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: '1px solid #f0f0f0'
          }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {eventJudges.length} judges × {criteria.length} criteria = {eventJudges.length * criteria.length} possible scores
            </Text>
            <Space>
              <Button
                onClick={() => {
                  setIsScoreModalOpen(false);
                  setSelectedParticipantForScoring(null);
                  scoreForm.resetFields();
                }}
              >
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={savingScores}
              >
                Save Scores
              </Button>
            </Space>
          </div>
        </Form>
      </Modal>
    </Layout>
  );
};

export default EventDetails;
