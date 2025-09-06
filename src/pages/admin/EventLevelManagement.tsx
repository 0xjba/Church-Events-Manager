import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Layout, Card, Button, Form, Input, Switch, Modal, Badge, Typography, Space, Spin, message } from 'antd';
import { Plus, Edit, Trash2 } from 'lucide-react';

const { Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

interface EventLevel {
  id: string;
  name: string;
  year: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  event_count?: number;
}

const EventLevelManagement = () => {
  const [eventLevels, setEventLevels] = useState<EventLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<EventLevel | null>(null);
  const [levelToDelete, setLevelToDelete] = useState<EventLevel | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    console.log('EventLevelManagement: Component mounted');
    fetchEventLevels();
  }, []);

  useEffect(() => {
    console.log('EventLevelManagement: Event levels data updated', { 
      eventLevels: eventLevels.length, 
      loading, 
      eventLevelsData: eventLevels 
    });
  }, [eventLevels, loading]);

  const fetchEventLevels = async () => {
    try {
      console.log('EventLevelManagement: Fetching event levels...');
      setLoading(true);
      const { data: levelsData, error: levelsError } = await supabase
        .from('event_levels')
        .select('*')
        .order('year', { ascending: false });

      if (levelsError) {
        console.error('EventLevelManagement: Error fetching event levels:', levelsError);
        return;
      }

      console.log('EventLevelManagement: Raw event levels data:', levelsData);

      // Get event counts for each level
      const levelsWithCounts = await Promise.all(
        levelsData.map(async (level) => {
          const { count, error } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('level_id', level.id);

          if (error) console.error('Error counting events:', error);
          
          return {
            ...level,
            event_count: count || 0,
          };
        })
      );

      console.log('EventLevelManagement: Event levels with counts:', levelsWithCounts);
      setEventLevels(levelsWithCounts);
    } catch (error) {
      console.error('Error fetching event levels:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: any) => {
    try {
      setSubmitting(true);

      if (editingLevel) {
        const { error } = await supabase
          .from('event_levels')
          .update({
            name: values.name,
            year: values.year,
            description: values.description || null,
            is_active: values.is_active,
          })
          .eq('id', editingLevel.id);

        if (error) throw error;
        message.success('Event level updated successfully');
      } else {
        const { error } = await supabase
          .from('event_levels')
          .insert([{
            name: values.name,
            year: values.year,
            description: values.description || null,
            is_active: values.is_active,
          }]);

        if (error) throw error;
        message.success('Event level created successfully');
      }

      fetchEventLevels();
      handleCloseModal();
    } catch (error: any) {
      console.error('Error saving event level:', error);
      message.error(error.message || 'Failed to save event level');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (level: EventLevel) => {
    setEditingLevel(level);
    form.setFieldsValue({
      name: level.name,
      year: level.year,
      description: level.description || '',
      is_active: level.is_active,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLevel(null);
    form.resetFields();
  };

  const handleDeleteClick = (level: EventLevel) => {
    setLevelToDelete(level);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!levelToDelete) return;

    try {
      setSubmitting(true);
      
      // Delete the event level (cascade will handle events and related data)
      const { error } = await supabase
        .from('event_levels')
        .delete()
        .eq('id', levelToDelete.id);

      if (error) throw error;

      message.success(`Event level "${levelToDelete.name}" and all its events deleted successfully`);
      fetchEventLevels();
      setIsDeleteModalOpen(false);
      setLevelToDelete(null);
    } catch (error: any) {
      console.error('Error deleting event level:', error);
      message.error(error.message || 'Failed to delete event level');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Event Level',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      render: (text: string) => <span style={{ fontWeight: 'medium' }}>{text}</span>,
    },
    {
      title: 'Year',
      dataIndex: 'year',
      key: 'year',
      width: 100,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => text || '-',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 100,
      render: (isActive: boolean) => (
        <Text>{isActive ? 'Active' : 'Inactive'}</Text>
      ),
    },
    {
      title: 'No. of Events',
      dataIndex: 'event_count',
      key: 'event_count',
      width: 140,
      render: (count: number) => (
        <Badge count={count} color="blue" />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: EventLevel) => (
        <Space>
          <Button
            type="text"
            icon={<Edit size={16} />}
            onClick={() => {
              console.log('EventLevelManagement: Edit button clicked for level:', record);
              handleEdit(record);
            }}
          />
          <Button
            type="text"
            danger
            icon={<Trash2 size={16} />}
            onClick={() => {
              console.log('EventLevelManagement: Delete button clicked for level:', record);
              handleDeleteClick(record);
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      
      <Layout className="md:ml-64">
        <Content style={{ padding: '16px', paddingBottom: '80px', paddingTop: '80px' }} className="md:pt-4">
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <Title level={2} style={{ margin: 0 }}>
                  Event Level Management
                </Title>
                <Text type="secondary">
                  Organize events by levels (Local, District, State) and manage competition hierarchy
                </Text>
              </div>
              
              <Button
                type="primary"
                icon={<Plus size={16} />}
                onClick={() => {
                  console.log('EventLevelManagement: Create level button clicked');
                  setIsModalOpen(true);
                }}
                className="md:inline-flex hidden:flex"
              >
                <span className="hidden md:inline">Create Event Level</span>
              </Button>
            </div>
          </div>

          <Card>
            <ResponsiveTable
              columns={columns}
              dataSource={eventLevels}
              loading={loading}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              cardTitle={(record) => (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'medium' }}>{record.name}</span>
                  <Text>{record.is_active ? 'Active' : 'Inactive'}</Text>
                </div>
              )}
              locale={{
                emptyText: loading ? <Spin /> : undefined
              }}
            />
          </Card>

          {/* Create/Edit Event Level Modal */}
          <Modal
            title={editingLevel ? 'Edit Event Level' : 'Create Event Level'}
            open={isModalOpen}
            onCancel={handleCloseModal}
            footer={null}
            width={500}
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
              {editingLevel 
                ? 'Update the event level details below.' 
                : 'Create a new event level to organize your events.'
              }
            </Text>

            <Form
              form={form}
              layout="vertical"
              onFinish={onSubmit}
              initialValues={{
                year: new Date().getFullYear(),
                is_active: false,
              }}
            >
              <Form.Item
                label="Event Level Name"
                name="name"
                rules={[{ required: true, message: 'Event level name is required' }]}
              >
                <Input placeholder="e.g., Local Level, District Level, State Level" />
              </Form.Item>

              <Form.Item
                label="Year"
                name="year"
                rules={[
                  { required: true, message: 'Year is required' },
                  { type: 'number', min: 2020, max: 2050, message: 'Year must be between 2020 and 2050' }
                ]}
              >
                <Input type="number" min="2020" max="2050" placeholder="2024" />
              </Form.Item>

              <Form.Item
                label="Description (Optional)"
                name="description"
              >
                <TextArea rows={3} placeholder="Event level description..." />
              </Form.Item>

              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '16px',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                marginBottom: '24px'
              }}>
                <div>
                  <Text strong>Set as Active Season</Text>
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      Only one season can be active at a time
                    </Text>
                  </div>
                </div>
                <Form.Item
                  name="is_active"
                  valuePropName="checked"
                  style={{ margin: 0 }}
                >
                  <Switch />
                </Form.Item>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
                <Button onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  {editingLevel ? 'Update' : 'Create'} Event Level
                </Button>
              </div>
            </Form>
          </Modal>

          {/* Delete Confirmation Modal */}
          <Modal
            title="Delete Event Level"
            open={isDeleteModalOpen}
            onCancel={() => setIsDeleteModalOpen(false)}
            onOk={handleDeleteConfirm}
            okType="danger"
            confirmLoading={submitting}
          >
            <Text>
              Are you sure you want to delete event level "{levelToDelete?.name}"? 
              This will also delete all associated events and cannot be undone.
            </Text>
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default EventLevelManagement;