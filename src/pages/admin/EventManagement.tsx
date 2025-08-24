import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Layout, Card, Button, Input, Select, Modal, Badge, Form, Typography, Space, Spin, message, Popconfirm } from 'antd';
import { Plus, Edit, Trash2, X, Eye } from 'lucide-react';

const { Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

interface Event {
  id: string;
  name: string;
  type: string;
  event_type: string;
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

interface Criteria {
  id?: string;
  name: string;
  max_score: number;
  weight: number;
}

const EventManagement = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [criteria, setCriteria] = useState<Criteria[]>([{ name: '', max_score: 10, weight: 1.0 }]);

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

  const openModal = (event?: Event) => {
    if (event) {
      setEditingEvent(event);
      form.setFieldsValue({
        name: event.name,
        type: event.type,
        event_type: event.event_type || 'individual',
        season_id: event.season_id,
        rules: event.rules || '',
        time_limit: event.time_limit || undefined,
        max_participants: event.max_participants || undefined,
        status: event.status,
        event_order: event.event_order || undefined
      });
      setCriteria(event.criteria || [{ name: '', max_score: 10, weight: 1.0 }]);
    } else {
      setEditingEvent(null);
      form.resetFields();
      form.setFieldsValue({ event_type: 'individual' });
      setCriteria([{ name: '', max_score: 10, weight: 1.0 }]);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    form.resetFields();
    setCriteria([{ name: '', max_score: 10, weight: 1.0 }]);
  };

  const onSubmit = async (values: any) => {
    try {
      setSubmitting(true);

      // Validate criteria
      if (!criteria.length || criteria.some(c => !c.name.trim())) {
        message.error('All criteria must have names');
        return;
      }

      if (editingEvent) {
        // Update existing event
        const { error: eventError } = await supabase
          .from('events')
          .update({
            name: values.name,
            type: values.type,
            event_type: values.event_type,
            season_id: values.season_id,
            rules: values.rules || null,
            time_limit: values.time_limit || null,
            max_participants: values.max_participants || null,
            status: values.status,
            event_order: values.event_order || null
          })
          .eq('id', editingEvent.id);

        if (eventError) throw eventError;

        // Update criteria
        await updateEventCriteria(editingEvent.id, criteria);

        message.success('Event updated successfully');
      } else {
        // Create new event
        const { data: newEvent, error: eventError } = await supabase
          .from('events')
          .insert({
            name: values.name,
            type: values.type,
            event_type: values.event_type,
            season_id: values.season_id,
            rules: values.rules || null,
            time_limit: values.time_limit || null,
            max_participants: values.max_participants || null,
            status: values.status,
            event_order: values.event_order || null
          })
          .select()
          .single();

        if (eventError) throw eventError;

        // Create criteria
        await createEventCriteria(newEvent.id, criteria);

        message.success('Event created successfully');
      }

      closeModal();
      fetchEvents();
    } catch (error: any) {
      message.error(error.message || 'Failed to save event');
    } finally {
      setSubmitting(false);
    }
  };

  const updateEventCriteria = async (eventId: string, criteria: Criteria[]) => {
    // Delete existing criteria
    await supabase
      .from('event_criteria')
      .delete()
      .eq('event_id', eventId);

    // Insert new criteria
    if (criteria.length > 0) {
      const { error } = await supabase
        .from('event_criteria')
        .insert(criteria.map(c => ({
          event_id: eventId,
          name: c.name,
          max_score: c.max_score,
          weight: c.weight
        })));

      if (error) throw error;
    }
  };

  const createEventCriteria = async (eventId: string, criteria: Criteria[]) => {
    if (criteria.length > 0) {
      const { error } = await supabase
        .from('event_criteria')
        .insert(criteria.map(c => ({
          event_id: eventId,
          name: c.name,
          max_score: c.max_score,
          weight: c.weight
        })));

      if (error) throw error;
    }
  };

  const addCriteria = () => {
    setCriteria([...criteria, { name: '', max_score: 10, weight: 1.0 }]);
  };

  const removeCriteria = (index: number) => {
    if (criteria.length > 1) {
      setCriteria(criteria.filter((_, i) => i !== index));
    }
  };

  const updateCriteria = (index: number, field: keyof Criteria, value: any) => {
    const newCriteria = [...criteria];
    newCriteria[index] = { ...newCriteria[index], [field]: value };
    setCriteria(newCriteria);
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
      message.success('Event deleted successfully');
      fetchEvents();
    } catch (error: any) {
      message.error(error.message || 'Failed to delete event');
    }
  };

  const updateEventStatus = async (eventId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ status: newStatus })
        .eq('id', eventId);

      if (error) throw error;
      message.success('Event status updated successfully');
      fetchEvents();
    } catch (error: any) {
      message.error('Failed to update event status');
    }
  };

  const columns = [
    { title: 'Event', dataIndex: 'name', key: 'name' },
    { title: 'Type', dataIndex: 'type', key: 'type', render: (type: string) => <span style={{ textTransform: 'capitalize' }}>{type}</span> },
    { title: 'Category', dataIndex: 'event_type', key: 'event_type', render: (event_type: string) => (
      <Badge 
        color={event_type === 'individual' ? 'blue' : 'green'} 
        text={event_type === 'individual' ? 'Individual' : 'Group'} 
      />
    ) },
    { title: 'Season', dataIndex: ['season', 'name'], key: 'season' },
    { 
      title: 'Status', 
      dataIndex: 'status', 
      key: 'status', 
      render: (status: string, record: Event) => (
        <Select
          value={status}
          onChange={(value) => updateEventStatus(record.id, value)}
          style={{ width: 120 }}
        >
          <Select.Option value="upcoming">Upcoming</Select.Option>
          <Select.Option value="active">Active</Select.Option>
          <Select.Option value="completed">Completed</Select.Option>
        </Select>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Event) => (
        <Space>
          <Button 
            type="text" 
            icon={<Eye size={16} />} 
            onClick={() => navigate(`/admin/events/${record.id}`)}
            title="View Details"
          />
          <Button 
            type="text" 
            icon={<Edit size={16} />} 
            onClick={() => openModal(record)}
            title="Edit Event"
          />
          <Popconfirm
            title="Delete Event"
            description="Are you sure you want to delete this event? This action cannot be undone."
            onConfirm={() => deleteEvent(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button type="text" danger icon={<Trash2 size={16} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      <Layout className="md:ml-64">
        <Content style={{ padding: '16px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-6 md:pt-4">
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Title level={2} style={{ margin: 0 }}>Event Management</Title>
              <Button 
                type="primary" 
                icon={<Plus size={16} />} 
                onClick={() => openModal()}
                className="md:inline-flex hidden:flex"
              >
                <span className="hidden md:inline">Add Event</span>
              </Button>
            </div>
            <Text type="secondary">Create and manage competition events</Text>
          </div>

          <Card>
            <ResponsiveTable
              columns={columns}
              dataSource={filteredEvents}
              loading={loading}
              rowKey="id"
              cardTitle={(record) => record.name}
              cardExtra={(record) => (
                <Space>
                  <Badge color="blue" text={record.status} />
                  <Button 
                    size="small" 
                    icon={<Eye size={14} />} 
                    onClick={() => navigate(`/admin/events/${record.id}`)}
                    title="View Details"
                  />
                  <Button 
                    size="small" 
                    icon={<Edit size={14} />} 
                    onClick={() => openModal(record)}
                    title="Edit Event"
                  />
                  <Popconfirm
                    title="Delete Event"
                    description="Are you sure you want to delete this event?"
                    onConfirm={() => deleteEvent(record.id)}
                    okText="Yes"
                    cancelText="No"
                  >
                    <Button size="small" danger icon={<Trash2 size={14} />} />
                  </Popconfirm>
                </Space>
              )}
            />
          </Card>
        </Content>
      </Layout>

      {/* Event Modal */}
      <Modal
        title={editingEvent ? 'Edit Event' : 'Create New Event'}
        open={isModalOpen}
        onCancel={closeModal}
        footer={null}
        width={800}
        destroyOnClose
      >
        <Form
          form={form}
          onFinish={onSubmit}
          layout="vertical"
          style={{ marginTop: '16px' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Form.Item
              label="Event Name"
              name="name"
              rules={[{ required: true, message: 'Event name is required' }]}
            >
              <Input placeholder="Enter event name" />
            </Form.Item>

            <Form.Item
              label="Event Type"
              name="type"
              rules={[{ required: true, message: 'Event type is required' }]}
            >
              <Select>
                <Select.Option value="writing">Writing</Select.Option>
                <Select.Option value="stage">Stage Performance</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="Event Category"
              name="event_type"
              rules={[{ required: true, message: 'Event category is required' }]}
            >
              <Select>
                <Select.Option value="individual">Individual Event</Select.Option>
                <Select.Option value="group">Group Event</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="Season"
              name="season_id"
              rules={[{ required: true, message: 'Season is required' }]}
            >
              <Select placeholder="Select season">
                {seasons.map(season => (
                  <Select.Option key={season.id} value={season.id}>
                    {season.name} ({season.year})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label="Status"
              name="status"
              rules={[{ required: true, message: 'Status is required' }]}
            >
              <Select>
                <Select.Option value="upcoming">Upcoming</Select.Option>
                <Select.Option value="active">Active</Select.Option>
                <Select.Option value="completed">Completed</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              label="Time Limit (minutes)"
              name="time_limit"
              normalize={(value) => value ? parseInt(value) : undefined}
              rules={[{ type: 'number', min: 1, message: 'Time limit must be at least 1 minute' }]}
            >
              <Input type="number" placeholder="Optional" />
            </Form.Item>

            <Form.Item
              label="Max Participants"
              name="max_participants"
              normalize={(value) => value ? parseInt(value) : undefined}
              rules={[{ type: 'number', min: 1, message: 'Max participants must be at least 1' }]}
            >
              <Input type="number" placeholder="Optional" />
            </Form.Item>

            <Form.Item
              label="Event Order"
              name="event_order"
              normalize={(value) => value ? parseInt(value) : undefined}
              rules={[{ type: 'number', min: 1, message: 'Event order must be at least 1' }]}
            >
              <Input type="number" placeholder="Optional" />
            </Form.Item>
          </div>

          <Form.Item
            label="Rules"
            name="rules"
          >
            <TextArea rows={3} placeholder="Enter event rules (optional)" />
          </Form.Item>

          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Text strong>Scoring Criteria</Text>
              <Button 
                type="dashed" 
                size="small" 
                icon={<Plus size={14} />} 
                onClick={addCriteria}
              >
                Add Criteria
              </Button>
            </div>
            <Text type="secondary">Define the scoring criteria for this event</Text>
          </div>

          {criteria.map((criterion, index) => (
            <div key={index} style={{ 
              display: 'grid', 
              gridTemplateColumns: '2fr 1fr 1fr auto', 
              gap: '8px', 
              alignItems: 'end',
              marginBottom: '8px',
              padding: '12px',
              border: '1px solid #f0f0f0',
              borderRadius: '6px'
            }}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: '4px' }}>
                  Criteria Name <Text type="danger">*</Text>
                </Text>
                <Input 
                  placeholder="e.g., Voice Quality" 
                  value={criterion.name}
                  onChange={(e) => updateCriteria(index, 'name', e.target.value)}
                />
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: '4px' }}>Max Score</Text>
                <Input 
                  type="number" 
                  min={1}
                  value={criterion.max_score}
                  onChange={(e) => updateCriteria(index, 'max_score', parseInt(e.target.value) || 1)}
                />
              </div>

              <div>
                <Text strong style={{ display: 'block', marginBottom: '4px' }}>Weight</Text>
                <Input 
                  type="number" 
                  min={0.1} 
                  step={0.1}
                  value={criterion.weight}
                  onChange={(e) => updateCriteria(index, 'weight', parseFloat(e.target.value) || 1.0)}
                />
              </div>

              <Button
                type="text"
                danger
                icon={<X size={14} />}
                onClick={() => removeCriteria(index)}
                disabled={criteria.length === 1}
                style={{ marginBottom: '4px' }}
              />
            </div>
          ))}



          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
            <Button onClick={closeModal}>
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {editingEvent ? 'Update Event' : 'Create Event'}
            </Button>
          </div>
        </Form>
      </Modal>
    </Layout>
  );
};

export default EventManagement;