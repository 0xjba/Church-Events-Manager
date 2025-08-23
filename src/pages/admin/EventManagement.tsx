import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Layout, Card, Button, Input, Select, Modal, Badge, Form, Typography, Space, Spin, message } from 'antd';
import { Plus, Edit, Trash2, X } from 'lucide-react';

const { Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

interface Event {
  id: string;
  name: string;
  type: string;
  season_id: string;
  rules: string | null;
  time_limit: number | null;
  max_participants: number | null;
  status: string;
  event_order: number | null;
  created_at: string;
  season?: { id: string; name: string; year: number; };
  criteria?: Array<{ id: string; name: string; max_score: number; weight: number; }>;
}

interface Season {
  id: string;
  name: string;
  year: number;
  is_active: boolean;
}

const EventManagement = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchEvents();
    fetchSeasons();
  }, []);

  useEffect(() => {
    if (selectedSeasonId === 'all') {
      setFilteredEvents(events);
    } else {
      setFilteredEvents(events.filter(event => event.season_id === selectedSeasonId));
    }
  }, [events, selectedSeasonId]);

  const fetchSeasons = async () => {
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('id, name, year, is_active')
        .order('year', { ascending: false });
      if (error) throw error;
      setSeasons(data || []);
    } catch (error) {
      message.error('Failed to load seasons');
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`*, seasons (id, name, year), event_criteria (id, name, max_score, weight)`)
        .order('created_at', { ascending: false });
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
    { title: 'Type', dataIndex: 'type', key: 'type', render: (type: string) => <span style={{ textTransform: 'capitalize' }}>{type}</span> },
    { title: 'Season', dataIndex: ['season', 'name'], key: 'season' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => <Badge color="blue" text={status} /> },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Event) => (
        <Space>
          <Button type="text" icon={<Edit size={16} />} />
          <Button type="text" danger icon={<Trash2 size={16} />} />
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      <Layout className="md:ml-64">
        <Content style={{ padding: '16px', paddingBottom: '80px' }} className="md:px-6">
          <div style={{ marginBottom: '24px' }}>
            <Title level={2}>Event Management</Title>
            <Text type="secondary">Create and manage competition events</Text>
          </div>
          <Card>
            <ResponsiveTable
              columns={columns}
              dataSource={filteredEvents}
              loading={loading}
              rowKey="id"
              cardTitle={(record) => record.name}
              cardExtra={(record) => <Badge color="blue" text={record.status} />}
            />
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default EventManagement;