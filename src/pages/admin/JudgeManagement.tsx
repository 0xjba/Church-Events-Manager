import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Layout, Card, Button, Input, Form, Modal, message, Spin, Space, Typography } from 'antd';
import { Plus, Edit, Trash2 } from 'lucide-react';

const { Content } = Layout;
const { Title, Text } = Typography;

interface Judge {
  id: string;
  full_name: string;
  username: string;
  email: string;
  church: string;
  contact: string | null;
  is_active: boolean;
  created_at: string;
}

const JudgeManagement = () => {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJudge, setEditingJudge] = useState<Judge | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchJudges();
  }, []);

  const fetchJudges = async () => {
    try {
      const { data, error } = await supabase
        .from('judges')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJudges(data || []);
    } catch (error) {
      message.error('Failed to load judges');
    } finally {
      setLoading(false);
    }
  };

  const hashPassword = async (password: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const onSubmit = async (values: any) => {
    try {
      setSubmitting(true);

      if (editingJudge) {
        // Update existing judge
        const updateData: any = {
          full_name: values.full_name,
          username: values.username,
          email: values.email,
          church: values.church,
          contact: values.contact || null,
        };

        // Only update password if provided
        if (values.password) {
          updateData.password_hash = await hashPassword(values.password);
        }

        const { error } = await supabase
          .from('judges')
          .update(updateData)
          .eq('id', editingJudge.id);

        if (error) throw error;
        message.success('Judge updated successfully');
      } else {
        // Create new judge record
        const { error: judgeError } = await supabase
          .from('judges')
          .insert({
            full_name: values.full_name,
            username: values.username,
            email: values.email,
            church: values.church,
            contact: values.contact || null,
            password_hash: await hashPassword(values.password),
            is_active: true
          });

        if (judgeError) throw judgeError;
        message.success('Judge added successfully');
      }

      setIsModalOpen(false);
      form.resetFields();
      setEditingJudge(null);
      fetchJudges();
    } catch (error) {
      message.error(editingJudge ? 'Failed to update judge' : 'Failed to add judge');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (judge: Judge) => {
    setEditingJudge(judge);
    form.setFieldsValue(judge);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this judge?',
      okType: 'danger',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('judges')
            .delete()
            .eq('id', id);

          if (error) throw error;
          message.success('Judge deleted successfully');
          fetchJudges();
        } catch (error) {
          message.error('Failed to delete judge');
        }
      }
    });
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Church',
      dataIndex: 'church',
      key: 'church',
    },
    {
      title: 'Contact',
      dataIndex: 'contact',
      key: 'contact',
      render: (contact: string | null) => contact || 'N/A',
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (is_active: boolean) => (
        <span style={{ 
          color: is_active ? '#52c41a' : '#f5222d',
          fontWeight: 'bold'
        }}>
          {is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, record: Judge) => (
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
        <Content style={{ padding: '16px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-6 md:pt-4">
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <Title level={2} style={{ margin: 0 }}>
                  Judge Management
                </Title>
                <Text type="secondary">
                  Manage event judges
                </Text>
              </div>
              
              <Button
                type="primary"
                icon={<Plus size={16} />}
                onClick={() => {
                  setEditingJudge(null);
                  form.resetFields();
                  setIsModalOpen(true);
                }}
              >
                Add Judge
              </Button>
            </div>
          </div>

          <Card>
            <div style={{ marginBottom: '16px' }}>
              <Title level={4} style={{ margin: 0 }}>Judges</Title>
              <Text type="secondary">All registered judges</Text>
            </div>
            
            <ResponsiveTable
              columns={columns}
              dataSource={judges}
              loading={loading}
              rowKey="id"
              cardTitle={(record) => record.full_name}
              locale={{
                emptyText: loading ? <Spin /> : 'No judges registered yet'
              }}
            />
          </Card>

          <Modal
            title={editingJudge ? 'Edit Judge' : 'Add New Judge'}
            open={isModalOpen}
            onCancel={() => {
              setIsModalOpen(false);
              setEditingJudge(null);
              form.resetFields();
            }}
            footer={null}
            width={500}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={onSubmit}
            >
              <Form.Item
                label="Judge Name"
                name="full_name"
                rules={[{ required: true, message: 'Name must be at least 2 characters', min: 2 }]}
              >
                <Input />
              </Form.Item>
              
              <Form.Item
                label="Username"
                name="username"
                rules={[{ required: true, message: 'Username is required' }]}
              >
                <Input />
              </Form.Item>
              
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  { required: true, message: 'Email is required' },
                  { type: 'email', message: 'Please enter a valid email' }
                ]}
              >
                <Input />
              </Form.Item>
              
              <Form.Item
                label={editingJudge ? "Password (leave blank to keep current)" : "Password"}
                name="password"
                rules={editingJudge ? [] : [{ required: true, message: 'Password is required' }]}
              >
                <Input.Password />
              </Form.Item>
              
              <Form.Item
                label="Church"
                name="church"
                rules={[{ required: true, message: 'Church is required' }]}
              >
                <Input />
              </Form.Item>
              
              <Form.Item
                label="Contact (Optional)"
                name="contact"
              >
                <Input placeholder="Phone or email" />
              </Form.Item>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
                <Button onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" loading={submitting}>
                  {editingJudge ? 'Update' : 'Add'} Judge
                </Button>
              </div>
            </Form>
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default JudgeManagement;