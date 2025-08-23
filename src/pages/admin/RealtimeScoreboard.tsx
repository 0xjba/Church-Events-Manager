import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeScores } from '@/hooks/useRealtimeScores';
import Navigation from '@/components/Navigation';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Layout, Card, Badge, Button, Typography, Space, Spin, message } from 'antd';
import { RefreshCw, Lock, Unlock } from 'lucide-react';

const { Content } = Layout;
const { Title, Text } = Typography;

const RealtimeScoreboard = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { scores, loading: scoresLoading, refetch } = useRealtimeScores({ eventId });

  useEffect(() => {
    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (error) throw error;
      setEvent(data);
    } catch (error) {
      message.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'Participant', dataIndex: 'participant_name', key: 'participant_name' },
    { title: 'Judge', dataIndex: 'judge_name', key: 'judge_name' },
    { title: 'Criteria', dataIndex: 'criteria_name', key: 'criteria_name' },
    { title: 'Score', dataIndex: 'score', key: 'score', render: (score: number) => <span style={{ fontWeight: 'bold' }}>{score}</span> },
    { title: 'Status', dataIndex: 'is_locked', key: 'is_locked', render: (locked: boolean) => locked ? <Lock size={16} /> : <Unlock size={16} /> },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      <Layout className="md:ml-64">
        <Content style={{ padding: '16px' }} className="md:px-6">
          <div style={{ marginBottom: '24px' }}>
            <Title level={2}>Realtime Scoreboard</Title>
            <Text type="secondary">{event?.name || 'Loading...'}</Text>
          </div>
          <Card>
            <ResponsiveTable
              columns={columns}
              dataSource={scores}
              loading={loading || scoresLoading}
              rowKey="id"
              cardTitle={(record) => record.participant_name}
            />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default RealtimeScoreboard;