import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Layout, Card, Button, message, Spin, Space, Typography, Badge, Popconfirm } from 'antd';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';

const { Content } = Layout;
const { Title, Text } = Typography;

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

interface Event {
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
  event: Event;
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

  useEffect(() => {
    if (participantId) {
      fetchParticipantDetails();
    }
  }, [participantId]);

  const fetchParticipantDetails = async () => {
    try {
      setLoading(true);

      // Fetch participant details
      const { data: participantData, error: participantError } = await supabase
        .from('participants')
        .select('*')
        .eq('id', participantId)
        .single();

      if (participantError) throw participantError;
      setParticipant(participantData);

      // Fetch participant's events
      const { data: eventsData, error: eventsError } = await supabase
        .from('event_participants')
        .select(`
          *,
          event:events (
            id,
            name,
            type,
            status,
            age_category,
            created_at
          )
        `)
        .eq('participant_id', participantId)
        .order('registered_at', { ascending: false });

      if (eventsError) throw eventsError;
      setEventParticipants(eventsData || []);

      // Fetch results for this participant
      const { data: resultsData, error: resultsError } = await supabase
        .from('results')
        .select('*')
        .eq('participant_id', participantId);

      if (resultsError) throw resultsError;
      setResults(resultsData || []);

    } catch (error: any) {
      message.error(error.message || 'Failed to fetch participant details');
      navigate('/admin/participants');
    } finally {
      setLoading(false);
    }
  };

  const removeFromEvent = async (eventId: string, eventName: string) => {
    try {
      const { error } = await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', eventId)
        .eq('participant_id', participantId);

      if (error) throw error;

      message.success(`Removed from ${eventName}`);
      fetchParticipantDetails(); // Refresh data
    } catch (error: any) {
      message.error(error.message || 'Failed to remove from event');
    }
  };

  const getResultForEvent = (eventId: string) => {
    return results.find(result => result.event_id === eventId);
  };


  const getRankDisplay = (rank: number | null) => {
    if (rank === null) return 'No rank';
    if (rank === 1) return '🥇 1st Place';
    if (rank === 2) return '🥈 2nd Place';
    if (rank === 3) return '🥉 3rd Place';
    return `${rank}th Place`;
  };

  const columns = [
    {
      title: 'Event',
      dataIndex: ['event', 'name'],
      key: 'event_name',
      width: 200,
      render: (name: string, record: EventParticipant) => (
        <div>
          <div style={{ fontWeight: 500 }}>{name}</div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {record.event.type} • {record.event.age_category || 'All Categories'}
          </div>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: ['event', 'status'],
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Text>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
      )
    },
    {
      title: 'Result',
      key: 'result',
      width: 150,
      render: (_: any, record: EventParticipant) => {
        const result = getResultForEvent(record.event_id);
        if (!result) {
          return <Text type="secondary">No result yet</Text>;
        }
        return (
          <div>
            <div style={{ fontWeight: 500 }}>
              {getRankDisplay(result.rank)}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              Score: {result.total_score}
            </div>
          </div>
        );
      }
    },
    {
      title: 'Registered',
      dataIndex: 'registered_at',
      key: 'registered_at',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString()
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_: any, record: EventParticipant) => (
        <Popconfirm
          title="Remove from Event"
          description={`Are you sure you want to remove ${participant?.full_name} from ${record.event.name}?`}
          onConfirm={() => removeFromEvent(record.event_id, record.event.name)}
          okText="Yes"
          cancelText="No"
        >
          <Button
            type="text"
            danger
            icon={<Trash2 size={16} />}
            title="Remove from event"
          />
        </Popconfirm>
      )
    }
  ];

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navigation />
        <Layout className="md:ml-64">
          <Content style={{ padding: '16px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-6 md:pt-4">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
              <Spin size="large" />
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }

  if (!participant) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navigation />
        <Layout className="md:ml-64">
          <Content style={{ padding: '16px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-6 md:pt-4">
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Title level={3}>Participant not found</Title>
              <Button onClick={() => navigate('/admin/participants')}>
                Back to Participants
              </Button>
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
              onClick={() => navigate('/admin/participants')}
              style={{ marginBottom: '16px' }}
            >
              Back to Participants
            </Button>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Title level={2} style={{ margin: 0 }}>
                {participant.full_name}
              </Title>
            </div>
            
            {/* Participant Info */}
            <Card style={{ marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <Text type="secondary">Chest Number</Text>
                  <div style={{ fontWeight: 500, fontSize: '16px' }}>#{participant.chest_number}</div>
                </div>
                <div>
                  <Text type="secondary">Age Category</Text>
                  <div style={{ fontWeight: 500, fontSize: '16px' }}>{participant.age_category}</div>
                </div>
                <div>
                  <Text type="secondary">Church</Text>
                  <div style={{ fontWeight: 500, fontSize: '16px' }}>{participant.church}</div>
                </div>
                <div>
                  <Text type="secondary">District</Text>
                  <div style={{ fontWeight: 500, fontSize: '16px' }}>{participant.district}</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Events Table */}
          <Card>
            <div style={{ marginBottom: '16px' }}>
              <Title level={4} style={{ margin: 0 }}>Participating Events</Title>
              <Text type="secondary">
                {eventParticipants.length} event{eventParticipants.length !== 1 ? 's' : ''} registered
              </Text>
            </div>

            <ResponsiveTable
              columns={columns}
              dataSource={eventParticipants}
              loading={loading}
              rowKey="id"
              cardTitle={(record) => record.event.name}
              cardExtra={(record) => (
                <Space>
                  <Text>{record.event.status.charAt(0).toUpperCase() + record.event.status.slice(1)}</Text>
                  {getResultForEvent(record.event_id) && (
                    <Text type="secondary">
                      {getRankDisplay(getResultForEvent(record.event_id)?.rank || null)}
                    </Text>
                  )}
                </Space>
              )}
              locale={{
                emptyText: 'No events registered yet'
              }}
            />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default ParticipantDetails;
