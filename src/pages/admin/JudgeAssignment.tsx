import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Layout, Card, Button, Select, Modal, Badge, Input, Typography, Space, Spin, message } from 'antd';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

const { Content } = Layout;
const { Title, Text } = Typography;

interface Event {
  id: string;
  name: string;
  type: string;
  status: string;
  event_order: number | null;
  event_judges?: Array<{
    id: string;
    judge_id: string;
    assigned_at: string;
    judges: {
      id: string;
      name: string;
      church: string;
    };
  }>;
}

interface Judge {
  id: string;
  name: string;
  church: string;
}

interface EventJudge {
  id: string;
  event_id: string;
  judge_id: string;
  assigned_at: string;
}

const JudgeAssignment = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>('');
  const [assigningJudges, setAssigningJudges] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch events with their assigned judges
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          event_judges (
            id,
            judge_id,
            assigned_at,
            judges (
              id,
              name,
              church
            )
          )
        `)
        .order('event_order', { ascending: true, nullsFirst: false });

      if (eventsError) throw eventsError;
      setEvents(eventsData || []);

      // Fetch all judges
      const { data: judgesData, error: judgesError } = await supabase
        .from('judges')
        .select('*')
        .order('name');

      if (judgesError) throw judgesError;
      setJudges(judgesData || []);
    } catch (error) {
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const assignJudge = async () => {
    if (!selectedEventId || !selectedJudgeId) {
      message.error('Please select both event and judge');
      return;
    }

    try {
      setAssigningJudges(true);
      
      // Check if judge is already assigned to this event
      const { data: existing } = await supabase
        .from('event_judges')
        .select('id')
        .eq('event_id', selectedEventId)
        .eq('judge_id', selectedJudgeId)
        .single();

      if (existing) {
        message.error('Judge is already assigned to this event');
        return;
      }

      const { error } = await supabase
        .from('event_judges')
        .insert({
          event_id: selectedEventId,
          judge_id: selectedJudgeId,
        });

      if (error) throw error;

      message.success('Judge assigned successfully');
      setIsAssignModalOpen(false);
      setSelectedEventId('');
      setSelectedJudgeId('');
      fetchData();
    } catch (error) {
      message.error('Failed to assign judge');
    } finally {
      setAssigningJudges(false);
    }
  };

  const removeJudge = async (assignmentId: string) => {
    Modal.confirm({
      title: 'Remove Judge Assignment',
      content: 'Are you sure you want to remove this judge from the event?',
      okType: 'danger',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('event_judges')
            .delete()
            .eq('id', assignmentId);

          if (error) throw error;

          message.success('Judge removed successfully');
          fetchData();
        } catch (error) {
          message.error('Failed to remove judge');
        }
      }
    });
  };

  const getStatusColor = (status: string): "success" | "processing" | "default" | "error" | "warning" => {
    switch (status) {
      case 'active':
        return 'processing';
      case 'completed':
        return 'success';
      case 'upcoming':
        return 'default';
      default:
        return 'default';
    }
  };

  const getAvailableJudges = (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return judges;
    
    const assignedJudgeIds = event.event_judges?.map(ej => ej.judge_id) || [];
    return judges.filter(judge => !assignedJudgeIds.includes(judge.id));
  };

  const columns = [
    {
      title: 'Event',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Event) => (
        <div>
          <div style={{ fontWeight: 'medium' }}>{text}</div>
          <Text type="secondary" style={{ fontSize: '12px', textTransform: 'capitalize' }}>
            {record.type} Performance
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => (
        <Badge status={getStatusColor(status)} text={status} />
      ),
    },
    {
      title: 'Order',
      dataIndex: 'event_order',
      key: 'event_order',
      width: 80,
      render: (order: number | null) => order ? `#${order}` : '-',
    },
    {
      title: 'Assigned Judges',
      dataIndex: 'event_judges',
      key: 'judges',
      render: (eventJudges: Event['event_judges']) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {eventJudges && eventJudges.length > 0 ? (
            eventJudges.map((ej) => (
              <div key={ej.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Text strong style={{ fontSize: '14px' }}>{ej.judges.name}</Text>
                  <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                    {ej.judges.church}
                  </Text>
                </div>
                <Button
                  type="text"
                  danger
                  size="small"
                  icon={<Trash2 size={14} />}
                  onClick={() => removeJudge(ej.id)}
                />
              </div>
            ))
          ) : (
            <Text type="secondary">No judges assigned</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: Event) => {
        const availableJudges = getAvailableJudges(record.id);
        return (
          <Button
            type="primary"
            icon={<Plus size={16} />}
            disabled={availableJudges.length === 0}
            onClick={() => {
              setSelectedEventId(record.id);
              setIsAssignModalOpen(true);
            }}
          >
            Add Judge
          </Button>
        );
      },
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      
      <Layout className="md:ml-64">
        <Content style={{ padding: '16px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-6 md:pt-4">
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <Title level={2} style={{ margin: 0 }}>
                  Judge Assignment
                </Title>
                <Text type="secondary">
                  Assign judges to events for scoring
                </Text>
              </div>
            </div>
          </div>

          <Card>
            <div style={{ marginBottom: '16px' }}>
              <Title level={4} style={{ margin: 0 }}>Event Judge Assignments</Title>
              <Text type="secondary">
                Manage which judges are assigned to score each event
              </Text>
            </div>

            <ResponsiveTable
              columns={columns}
              dataSource={events}
              loading={loading}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              cardTitle={(record) => record.name}
              cardExtra={(record) => <Badge status={getStatusColor(record.status)} text={record.status} />}
              locale={{
                emptyText: 'No events found'
              }}
            />
          </Card>

          {/* Assign Judge Modal */}
          <Modal
            title="Assign Judge to Event"
            open={isAssignModalOpen}
            onCancel={() => {
              setIsAssignModalOpen(false);
              setSelectedEventId('');
              setSelectedJudgeId('');
            }}
            onOk={assignJudge}
            confirmLoading={assigningJudges}
            okText="Assign Judge"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>Event</Text>
                <Select
                  value={selectedEventId}
                  onChange={setSelectedEventId}
                  style={{ width: '100%' }}
                  placeholder="Select event"
                >
                  {events.map(event => (
                    <Select.Option key={event.id} value={event.id}>
                      {event.name}
                    </Select.Option>
                  ))}
                </Select>
              </div>
              
              <div>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>Judge</Text>
                <Select
                  value={selectedJudgeId}
                  onChange={setSelectedJudgeId}
                  style={{ width: '100%' }}
                  placeholder="Select judge"
                >
                  {getAvailableJudges(selectedEventId).map(judge => (
                    <Select.Option key={judge.id} value={judge.id}>
                      {judge.name} - {judge.church}
                    </Select.Option>
                  ))}
                </Select>
              </div>
            </div>
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default JudgeAssignment;