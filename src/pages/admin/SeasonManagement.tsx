import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Layout, Card, Button, Form, Input, Switch, Modal, Badge, Typography, Space, Spin, message } from 'antd';
import { Plus, Edit, Trash2, Trophy } from 'lucide-react';

const { Content } = Layout;
const { Title, Text } = Typography;
const { TextArea } = Input;

interface Season {
  id: string;
  name: string;
  year: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  event_count?: number;
}

const SeasonManagement = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [seasonToDelete, setSeasonToDelete] = useState<Season | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    console.log('SeasonManagement: Component mounted');
    fetchSeasons();
  }, []);

  useEffect(() => {
    console.log('SeasonManagement: Seasons data updated', { 
      seasons: seasons.length, 
      loading, 
      seasonsData: seasons 
    });
  }, [seasons, loading]);

  const fetchSeasons = async () => {
    try {
      console.log('SeasonManagement: Fetching seasons...');
      setLoading(true);
      const { data: seasonsData, error: seasonsError } = await supabase
        .from('seasons')
        .select('*')
        .order('year', { ascending: false });

      if (seasonsError) {
        console.error('SeasonManagement: Error fetching seasons:', seasonsError);
        throw seasonsError;
      }

      console.log('SeasonManagement: Raw seasons data:', seasonsData);

      // Get event counts for each season
      const seasonsWithCounts = await Promise.all(
        seasonsData.map(async (season) => {
          const { count, error } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', season.id);

          if (error) console.error('Error counting events:', error);
          
          return {
            ...season,
            event_count: count || 0,
          };
        })
      );

      console.log('SeasonManagement: Seasons with counts:', seasonsWithCounts);
      setSeasons(seasonsWithCounts);
    } catch (error) {
      console.error('Error fetching seasons:', error);
      message.error('Failed to fetch seasons');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: any) => {
    try {
      setSubmitting(true);

      if (editingSeason) {
        const { error } = await supabase
          .from('seasons')
          .update({
            name: values.name,
            year: values.year,
            description: values.description || null,
            is_active: values.is_active,
          })
          .eq('id', editingSeason.id);

        if (error) throw error;
        message.success('Season updated successfully');
      } else {
        const { error } = await supabase
          .from('seasons')
          .insert([{
            name: values.name,
            year: values.year,
            description: values.description || null,
            is_active: values.is_active,
          }]);

        if (error) throw error;
        message.success('Season created successfully');
      }

      fetchSeasons();
      handleCloseModal();
    } catch (error: any) {
      console.error('Error saving season:', error);
      message.error(error.message || 'Failed to save season');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (season: Season) => {
    setEditingSeason(season);
    form.setFieldsValue({
      name: season.name,
      year: season.year,
      description: season.description || '',
      is_active: season.is_active,
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSeason(null);
    form.resetFields();
  };

  const handleDeleteClick = (season: Season) => {
    setSeasonToDelete(season);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!seasonToDelete) return;

    try {
      setSubmitting(true);
      
      // Delete the season (cascade will handle events and related data)
      const { error } = await supabase
        .from('seasons')
        .delete()
        .eq('id', seasonToDelete.id);

      if (error) throw error;

      message.success(`Season "${seasonToDelete.name}" and all its events deleted successfully`);
      fetchSeasons();
      setIsDeleteModalOpen(false);
      setSeasonToDelete(null);
    } catch (error: any) {
      console.error('Error deleting season:', error);
      message.error(error.message || 'Failed to delete season');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Season',
      dataIndex: 'name',
      key: 'name',
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
        <Badge color={isActive ? 'green' : 'default'} text={isActive ? 'Active' : 'Inactive'} />
      ),
    },
    {
      title: 'Events',
      dataIndex: 'event_count',
      key: 'event_count',
      width: 100,
      render: (count: number) => (
        <Badge count={count} color="blue" />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: Season) => (
        <Space>
          <Button
            type="text"
            icon={<Edit size={16} />}
            onClick={() => {
              console.log('SeasonManagement: Edit button clicked for season:', record);
              handleEdit(record);
            }}
          />
          <Button
            type="text"
            danger
            icon={<Trash2 size={16} />}
            onClick={() => {
              console.log('SeasonManagement: Delete button clicked for season:', record);
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
                  Season Management
                </Title>
                <Text type="secondary">
                  Organize events by seasons and manage competition cycles
                </Text>
              </div>
              
              <Button
                type="primary"
                icon={<Plus size={16} />}
                onClick={() => {
                  console.log('SeasonManagement: Create season button clicked');
                  setIsModalOpen(true);
                }}
                className="md:inline-flex hidden:flex"
              >
                <span className="hidden md:inline">Create Season</span>
              </Button>
            </div>
          </div>

          <Card>
            <div style={{ marginBottom: '16px' }}>
              <Title level={4} style={{ margin: 0, marginBottom: '8px' }}>Seasons</Title>
              <Text type="secondary">
                Manage competition seasons and their associated events
              </Text>
            </div>

            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                <Spin size="large" />
              </div>
            ) : seasons.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <Trophy size={48} style={{ color: '#6b7280', marginBottom: '16px' }} />
                <Title level={4} style={{ marginBottom: '8px' }}>No seasons found</Title>
                <Text type="secondary">Create your first season to get started.</Text>
              </div>
            ) : (
              <ResponsiveTable
                columns={columns}
                dataSource={seasons}
                rowKey="id"
                pagination={{ pageSize: 10 }}
                cardTitle={(record) => (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'medium' }}>{record.name}</span>
                    <Badge color={record.is_active ? 'green' : 'default'} text={record.is_active ? 'Active' : 'Inactive'} />
                  </div>
                )}
              />
            )}
          </Card>

          {/* Create/Edit Season Modal */}
          <Modal
            title={editingSeason ? 'Edit Season' : 'Create Season'}
            open={isModalOpen}
            onCancel={handleCloseModal}
            footer={null}
            width={500}
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
              {editingSeason 
                ? 'Update the season details below.' 
                : 'Create a new season to organize your events.'
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
                label="Season Name"
                name="name"
                rules={[{ required: true, message: 'Season name is required' }]}
              >
                <Input placeholder="e.g., Spring Championship" />
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
                <TextArea rows={3} placeholder="Season description..." />
              </Form.Item>

              <Form.Item
                name="is_active"
                valuePropName="checked"
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '16px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '6px'
                }}>
                  <div>
                    <Text strong>Set as Active Season</Text>
                    <div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Only one season can be active at a time
                      </Text>
                    </div>
                  </div>
                  <Switch />
                </div>
              </Form.Item>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
                <Button onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  {editingSeason ? 'Update' : 'Create'} Season
                </Button>
              </div>
            </Form>
          </Modal>

          {/* Delete Confirmation Modal */}
          <Modal
            title="Delete Season"
            open={isDeleteModalOpen}
            onCancel={() => setIsDeleteModalOpen(false)}
            onOk={handleDeleteConfirm}
            okType="danger"
            confirmLoading={submitting}
          >
            <Text>
              Are you sure you want to delete season "{seasonToDelete?.name}"? 
              This will also delete all associated events and cannot be undone.
            </Text>
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default SeasonManagement;