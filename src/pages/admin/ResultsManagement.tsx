import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ResultsCalculator } from '@/utils/resultsCalculator';
import Navigation from '@/components/Navigation';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Layout, Card, Button, Badge, Modal, Select, Typography, Space, Spin, message } from 'antd';
import { Calculator, Eye, EyeOff, Download, FileText, Trophy, RefreshCw } from 'lucide-react';
import { ExportUtils } from '@/utils/exportUtils';

const { Content } = Layout;
const { Title, Text } = Typography;

interface Event {
  id: string;
  name: string;
  type: string;
  status: string;
  results_published: boolean;
  event_order: number | null;
}

const ResultsManagement = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

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
      setEvents(data || []);
    } catch (error) {
      message.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'Event', dataIndex: 'name', key: 'name' },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => <Badge color="blue" text={status} /> },
    { title: 'Results', dataIndex: 'results_published', key: 'results_published', render: (published: boolean) => <Badge color={published ? 'green' : 'orange'} text={published ? 'Published' : 'Draft'} /> },
    { title: 'Actions', key: 'actions', render: () => <Space><Button type="primary" icon={<Calculator size={16} />}>Calculate</Button></Space> },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      <Layout className="md:ml-64">
        <Content style={{ padding: '16px' }} className="md:px-6">
          <div style={{ marginBottom: '24px' }}>
            <Title level={2}>Results Management</Title>
            <Text type="secondary">Calculate and publish event results</Text>
          </div>
          <Card>
            <ResponsiveTable
              columns={columns}
              dataSource={events}
              loading={loading}
              rowKey="id"
              cardTitle={(record) => record.name}
            />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default ResultsManagement;