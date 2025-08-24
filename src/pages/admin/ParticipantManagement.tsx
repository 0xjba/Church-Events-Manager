import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Layout, Card, Button, Input, Form, Modal, Select, message, Spin, Space, Typography, Checkbox } from 'antd';
import { Plus, Edit, Trash2, Users } from 'lucide-react';

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

interface Group {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  members?: Array<{
    id: string;
    participant_id: string;
    participant: {
      full_name: string;
      chest_number: string;
      church: string;
    };
  }>;
}

const ParticipantManagement = () => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  
  // Groups state
  const [groups, setGroups] = useState<Group[]>([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [submittingGroup, setSubmittingGroup] = useState(false);
  const [groupForm] = Form.useForm();
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  useEffect(() => {
    fetchParticipants();
    fetchGroups();
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

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          members:group_members(
            id,
            participant_id,
            participant:participants(
              full_name,
              chest_number,
              church
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      message.error('Failed to load groups');
    }
  };

  const onSubmit = async (values: any) => {
    try {
      setSubmitting(true);
      
      // Get the current user's session
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('No active session found. Please log in again.');
      }

      // Hash password using the same method as the edge function
      const hashPassword = async (password: string) => {
        const encoder = new TextEncoder();
        const salt = 'pypa-salt';
        const passwordData = encoder.encode(password + salt);
        const hash = await crypto.subtle.digest('SHA-256', passwordData);
        return Array.from(new Uint8Array(hash))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      };

      const password_hash = await hashPassword(values.password);

      // Create participant directly in the database
      const { data: newParticipant, error } = await supabase
        .from('participants')
        .insert({
          full_name: values.full_name,
          age: values.age,
          chest_number: values.chest_number,
          category: values.category,
          church: values.church,
          district: values.district,
          username: values.username,
          password_hash: password_hash,
          is_active: true,
          created_by: user.id
          // Note: profile_id column was removed from participants table
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw new Error(error.message || 'Failed to create participant');
      }

      message.success('Participant created successfully with login credentials');
      setIsModalOpen(false);
      form.resetFields();
      fetchParticipants();
    } catch (error: any) {
      console.error('Error creating participant:', error);
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

  // Group management functions
  const openGroupModal = (group?: Group) => {
    if (group) {
      setEditingGroup(group);
      groupForm.setFieldsValue({
        name: group.name,
        description: group.description || ''
      });
      setSelectedParticipants(group.members?.map(m => m.participant_id) || []);
    } else {
      setEditingGroup(null);
      groupForm.resetFields();
      setSelectedParticipants([]);
    }
    setIsGroupModalOpen(true);
  };

  const closeGroupModal = () => {
    setIsGroupModalOpen(false);
    setEditingGroup(null);
    groupForm.resetFields();
    setSelectedParticipants([]);
  };

  const onSubmitGroup = async (values: any) => {
    try {
      setSubmittingGroup(true);

      if (selectedParticipants.length === 0) {
        message.error('Please select at least one participant for the group');
        return;
      }

      if (editingGroup) {
        // Update existing group
        const { error: groupError } = await supabase
          .from('groups')
          .update({
            name: values.name,
            description: values.description || null
          })
          .eq('id', editingGroup.id);

        if (groupError) throw groupError;

        // Update group members
        await updateGroupMembers(editingGroup.id, selectedParticipants);

        message.success('Group updated successfully');
      } else {
        // Create new group
        const { data: newGroup, error: groupError } = await supabase
          .from('groups')
          .insert({
            name: values.name,
            description: values.description || null
          })
          .select()
          .single();

        if (groupError) throw groupError;

        // Add group members
        await createGroupMembers(newGroup.id, selectedParticipants);

        message.success('Group created successfully');
      }

      closeGroupModal();
      fetchGroups();
    } catch (error: any) {
      message.error(error.message || 'Failed to save group');
    } finally {
      setSubmittingGroup(false);
    }
  };

  const updateGroupMembers = async (groupId: string, participantIds: string[]) => {
    // Delete existing members
    await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId);

    // Add new members
    if (participantIds.length > 0) {
      const { error } = await supabase
        .from('group_members')
        .insert(participantIds.map(participantId => ({
          group_id: groupId,
          participant_id: participantId
        })));

      if (error) throw error;
    }
  };

  const createGroupMembers = async (groupId: string, participantIds: string[]) => {
    if (participantIds.length > 0) {
      const { error } = await supabase
        .from('group_members')
        .insert(participantIds.map(participantId => ({
          group_id: groupId,
          participant_id: participantId
        })));

      if (error) throw error;
    }
  };

  const deleteGroup = async (id: string) => {
    Modal.confirm({
      title: 'Are you sure you want to delete this group?',
      okType: 'danger',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from('groups')
            .delete()
            .eq('id', id);

          if (error) throw error;
          message.success('Group deleted successfully');
          fetchGroups();
        } catch (error) {
          message.error('Failed to delete group');
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
        <Content style={{ padding: '16px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-6 md:pt-4">
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
                className="md:inline-flex hidden:flex"
              >
                <span className="hidden md:inline">Add Participant</span>
              </Button>
            </div>
          </div>

          <Card>
            <div style={{ marginBottom: '16px' }}>
              <Title level={4} style={{ margin: 0 }}>Participants</Title>
              <Text type="secondary">All registered participants</Text>
            </div>
            
            <ResponsiveTable
              columns={columns}
              dataSource={participants}
              loading={loading}
              rowKey="id"
              cardTitle={(record) => `${record.chest_number} - ${record.full_name}`}
              locale={{
                emptyText: loading ? <Spin /> : 'No participants registered yet'
              }}
            />
          </Card>

          <Card style={{ marginTop: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <Title level={4} style={{ margin: 0 }}>Groups</Title>
                  <Text type="secondary">Manage participant groups for group events</Text>
                </div>
                
                <Button
                  type="primary"
                  icon={<Users size={16} />}
                  onClick={() => openGroupModal()}
                  className="md:inline-flex hidden:flex"
                >
                  <span className="hidden md:inline">Add Group</span>
                </Button>
              </div>
            </div>
            
            <ResponsiveTable
              columns={[
                {
                  title: 'Group Name',
                  dataIndex: 'name',
                  key: 'name',
                },
                {
                  title: 'Description',
                  dataIndex: 'description',
                  key: 'description',
                  render: (description: string | null) => description || 'No description',
                },
                {
                  title: 'Members',
                  dataIndex: 'members',
                  key: 'members',
                  render: (members: any[]) => (
                    <div>
                      {members?.length || 0} participants
                      {members && members.length > 0 && (
                        <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                          {members.slice(0, 3).map(m => m.participant.full_name).join(', ')}
                          {members.length > 3 && ` +${members.length - 3} more`}
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  title: 'Actions',
                  key: 'actions',
                  width: 120,
                  render: (_: any, record: Group) => (
                    <Space>
                      <Button
                        type="text"
                        icon={<Edit size={16} />}
                        onClick={() => openGroupModal(record)}
                      />
                      <Button
                        type="text"
                        danger
                        icon={<Trash2 size={16} />}
                        onClick={() => deleteGroup(record.id)}
                      />
                    </Space>
                  ),
                },
              ]}
              dataSource={groups}
              loading={loading}
              rowKey="id"
              cardTitle={(record) => record.name}
              cardExtra={(record) => (
                <Text type="secondary">{record.members?.length || 0} members</Text>
              )}
              locale={{
                emptyText: 'No groups created yet'
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
                  normalize={(value) => value ? parseInt(value) : undefined}
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

          {/* Group Modal */}
          <Modal
            title={editingGroup ? 'Edit Group' : 'Create New Group'}
            open={isGroupModalOpen}
            onCancel={closeGroupModal}
            footer={null}
            width={700}
            destroyOnClose
          >
            <Form
              form={groupForm}
              onFinish={onSubmitGroup}
              layout="vertical"
              style={{ marginTop: '16px' }}
            >
              <Form.Item
                label="Group Name"
                name="name"
                rules={[{ required: true, message: 'Group name is required' }]}
              >
                <Input placeholder="Enter group name" />
              </Form.Item>
              
              <Form.Item
                label="Description"
                name="description"
              >
                <Input.TextArea rows={2} placeholder="Optional description" />
              </Form.Item>

              <Form.Item
                label="Select Participants"
                required
              >
                <div style={{ 
                  border: '1px solid #d9d9d9', 
                  borderRadius: '6px', 
                  padding: '12px',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {participants.map(participant => (
                    <div key={participant.id} style={{ marginBottom: '8px' }}>
                      <Checkbox
                        checked={selectedParticipants.includes(participant.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedParticipants([...selectedParticipants, participant.id]);
                          } else {
                            setSelectedParticipants(selectedParticipants.filter(id => id !== participant.id));
                          }
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{participant.full_name}</span>
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>
                            #{participant.chest_number} • {participant.church}
                          </span>
                        </div>
                      </Checkbox>
                    </div>
                  ))}
                </div>
                <Text type="secondary">
                  Selected: {selectedParticipants.length} participant{selectedParticipants.length !== 1 ? 's' : ''}
                </Text>
              </Form.Item>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
                <Button onClick={closeGroupModal}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" loading={submittingGroup}>
                  {editingGroup ? 'Update' : 'Create'} Group
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