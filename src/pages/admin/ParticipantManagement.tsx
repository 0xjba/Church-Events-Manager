import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import { Layout, Card, Button, Input, Form, Table, Modal, Select, message, Spin, Space, Typography } from 'antd';
import { Plus, Edit, Trash2 } from 'lucide-react';

const { Content } = Layout;
const { Title, Text } = Typography;

interface Participant {
  id: string;
  full_name: string;
  age: number;
  chest_number: string;
  category: string;
  church: string;
  district: string;
  created_at: string;
  username?: string;
}

const ParticipantManagement = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchParticipants();
  }, []);

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setParticipants(data || []);
    } catch (error) {
      message.error('Failed to load participants');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: any) => {
    try {
      setSubmitting(true);
      
      // Use the new edge function to create participant with authentication
      const { data: result, error } = await supabase.functions.invoke('participant-auth/create', {
        body: {
          full_name: values.full_name,
          age: values.age,
          chest_number: values.chest_number,
          category: values.category,
          church: values.church,
          district: values.district,
          username: values.username,
          password: values.password
        }
      });

      if (error || result?.error) {
        throw new Error(result?.error || error?.message || 'Failed to create participant');
      }

      message.success('Participant created successfully with login credentials');
      setIsModalOpen(false);
      form.resetFields();
      fetchParticipants();
    } catch (error: any) {
      message.error(error.message || 'Failed to add participant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (participant: Participant) => {
    setEditingParticipant(participant);
    form.setFieldsValue(participant);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this participant?',
      okType: 'danger',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('participants')
            .delete()
            .eq('id', id);

          if (error) throw error;
          message.success('Participant deleted successfully');
          fetchParticipants();
        } catch (error) {
          message.error('Failed to delete participant');
        }
      }
    });
  };

  const columns = [
    {
      title: 'Chest #',
      dataIndex: 'chest_number',
      key: 'chest_number',
      width: 100,
    },
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
    },
    {
      title: 'Age',
      dataIndex: 'age',
      key: 'age',
      width: 80,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => <span style={{ textTransform: 'capitalize' }}>{category}</span>,
    },
    {
      title: 'Church',
      dataIndex: 'church',
      key: 'church',
    },
    {
      title: 'District',
      dataIndex: 'district',
      key: 'district',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: Participant) => (
        <Space>
          <Button
            type="text"
            icon={<Edit size={16} />}
            onClick={() => handleEdit(record)}
          />
          <Button
            type="text"
            danger
            icon={<Trash2 size={16} />}
            onClick={() => handleDelete(record.id)}
          />
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <Title level={2} style={{ margin: 0 }}>
                  Participant Management
                </Title>
                <Text type="secondary">
                  Manage event participants
                </Text>
              </div>
              
              <Button
                type="primary"
                icon={<Plus size={16} />}
                onClick={() => {
                  setEditingParticipant(null);
                  form.resetFields();
                  setIsModalOpen(true);
                }}
              >
                Add Participant
              </Button>
            </div>
          </div>

          <Card>
            <div style={{ marginBottom: '16px' }}>
              <Title level={4} style={{ margin: 0 }}>Participants</Title>
              <Text type="secondary">All registered participants</Text>
            </div>
            
            <Table
              columns={columns}
              dataSource={participants}
              loading={loading}
              rowKey="id"
              locale={{
                emptyText: loading ? <Spin /> : 'No participants registered yet'
              }}
            />
          </Card>

          <Modal
            title={editingParticipant ? 'Edit Participant' : 'Add New Participant'}
            open={isModalOpen}
            onCancel={() => {
              setIsModalOpen(false);
              setEditingParticipant(null);
              form.resetFields();
            }}
            footer={null}
            width={600}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={onSubmit}
            >
              <Form.Item
                label="Full Name"
                name="full_name"
                rules={[{ required: true, message: 'Name must be at least 2 characters', min: 2 }]}
              >
                <Input />
              </Form.Item>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Form.Item
                  label="Age"
                  name="age"
                  rules={[{ required: true, type: 'number', min: 1, max: 100 }]}
                >
                  <Input type="number" />
                </Form.Item>
                
                <Form.Item
                  label="Chest Number"
                  name="chest_number"
                  rules={[{ required: true, message: 'Chest number is required' }]}
                >
                  <Input />
                </Form.Item>
              </div>
              
              <Form.Item
                label="Category"
                name="category"
                rules={[{ required: true, message: 'Category is required' }]}
              >
                <Select placeholder="Select category">
                  <Select.Option value="children">Children</Select.Option>
                  <Select.Option value="teens">Teens</Select.Option>
                  <Select.Option value="youth">Youth</Select.Option>
                  <Select.Option value="adults">Adults</Select.Option>
                </Select>
              </Form.Item>
              
              <Form.Item
                label="Church"
                name="church"
                rules={[{ required: true, message: 'Church is required' }]}
              >
                <Input />
              </Form.Item>
              
              <Form.Item
                label="District"
                name="district"
                rules={[{ required: true, message: 'District is required' }]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                label="Username"
                name="username"
                rules={[{ required: true, message: 'Username must be at least 3 characters', min: 3 }]}
              >
                <Input placeholder="Enter username for login" />
              </Form.Item>
              
              <Form.Item
                label="Password"
                name="password"
                rules={[{ required: true, message: 'Password must be at least 4 characters', min: 4 }]}
              >
                <Input.Password placeholder="Enter password for login" />
              </Form.Item>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
                <Button onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  {editingParticipant ? 'Update' : 'Add'} Participant
                </Button>
              </div>
            </Form>
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default ParticipantManagement;