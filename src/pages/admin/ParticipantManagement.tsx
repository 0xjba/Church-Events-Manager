import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Layout, Card, Button, Input, Form, Modal, Select, message, Spin, Space, Typography, Checkbox } from 'antd';
import { Plus, Edit, Trash2, Users, Upload } from 'lucide-react';

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
  
  // Bulk import state
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [resolvedData, setResolvedData] = useState<any[]>([]);
  const [submittingGroup, setSubmittingGroup] = useState(false);
  const [groupForm] = Form.useForm();
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  
  // Batch selection state
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  
  // Group batch selection state
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<React.Key[]>([]);
  const [batchDeletingGroups, setBatchDeletingGroups] = useState(false);

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
      console.error('Error fetching participants:', error);
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
      console.error('Error fetching groups:', error);
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

      if (editingParticipant) {
        // Update existing participant
        const { error } = await supabase
          .from('participants')
          .update({
            full_name: values.full_name,
            age_category: values.age_category,
            chest_number: values.chest_number,
            church: values.church,
            district: values.district,
            username: values.username,
            // Only update password if provided
            ...(values.password && { password_hash: await hashPassword(values.password) })
          })
          .eq('id', editingParticipant.id);

        if (error) {
          console.error('Database error:', error);
          throw new Error(error.message || 'Failed to update participant');
        }

        message.success('Participant updated successfully');
      } else {
        // Create new participant
        const password_hash = await hashPassword(values.password);

        const { data: newParticipant, error } = await supabase
          .from('participants')
          .insert({
            full_name: values.full_name,
            age_category: values.age_category,
            chest_number: values.chest_number,
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
      }
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

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select participants to delete');
      return;
    }

    Modal.confirm({
      title: `Delete ${selectedRowKeys.length} participant(s)?`,
      content: 'This action cannot be undone.',
      okType: 'danger',
      onOk: async () => {
        try {
          setBatchDeleting(true);
          
          // Delete each selected participant
          for (const participantId of selectedRowKeys) {
            const { error } = await supabase
              .from('participants')
              .delete()
              .eq('id', participantId);
            
            if (error) throw error;
          }

          message.success(`Successfully deleted ${selectedRowKeys.length} participant(s)`);
          setSelectedRowKeys([]);
          fetchParticipants();
        } catch (error: any) {
          message.error(error.message || 'Failed to delete participants');
        } finally {
          setBatchDeleting(false);
        }
      }
    });
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(selectedRowKeys);
    },
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

  const handleBatchDeleteGroups = async () => {
    if (selectedGroupKeys.length === 0) {
      message.warning('Please select groups to delete');
      return;
    }

    Modal.confirm({
      title: `Delete ${selectedGroupKeys.length} group(s)?`,
      content: 'This action cannot be undone.',
      okType: 'danger',
      onOk: async () => {
        try {
          setBatchDeletingGroups(true);
          
          // Delete each selected group
          for (const groupId of selectedGroupKeys) {
            const { error } = await supabase
              .from('groups')
              .delete()
              .eq('id', groupId);
            
            if (error) throw error;
          }

          message.success(`Successfully deleted ${selectedGroupKeys.length} group(s)`);
          setSelectedGroupKeys([]);
          fetchGroups();
        } catch (error: any) {
          message.error(error.message || 'Failed to delete groups');
        } finally {
          setBatchDeletingGroups(false);
        }
      }
    });
  };

  const groupRowSelection = {
    selectedRowKeys: selectedGroupKeys,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedGroupKeys(selectedRowKeys);
    },
  };

  // CSV parsing and validation functions
  const parseCSV = (fileContent: string) => {
    const lines = fileContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    const requiredHeaders = ['full_name', 'age_category', 'chest_number', 'category', 'church', 'district', 'username', 'password'];
    
    // Check if all required headers are present
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }
    
    const data = lines.slice(1).map((line, index) => {
      const values = line.split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      row._rowNumber = index + 2; // +2 because we skip header and arrays are 0-indexed
      return row;
    });
    
    return data;
  };

  const validateParticipantData = (data: any[]) => {
    const errors: string[] = [];
    const validAgeCategories = ['Sub Juniors', 'Juniors', 'Intermediates', 'Seniors'];
    const validCategories = ['individual', 'group'];
    
    data.forEach((row, index) => {
      const rowNum = row._rowNumber;
      
      // Required field validation
      if (!row.full_name) errors.push(`Row ${rowNum}: Missing full_name`);
      if (!row.age_category) errors.push(`Row ${rowNum}: Missing age_category`);
      if (!row.chest_number) errors.push(`Row ${rowNum}: Missing chest_number`);
      if (!row.category) errors.push(`Row ${rowNum}: Missing category`);
      if (!row.church) errors.push(`Row ${rowNum}: Missing church`);
      if (!row.district) errors.push(`Row ${rowNum}: Missing district`);
      if (!row.username) errors.push(`Row ${rowNum}: Missing username`);
      if (!row.password) errors.push(`Row ${rowNum}: Missing password`);
      
      // Format validation
      if (row.username && row.username.length < 3) {
        errors.push(`Row ${rowNum}: Username must be at least 3 characters`);
      }
      if (row.password && row.password.length < 4) {
        errors.push(`Row ${rowNum}: Password must be at least 4 characters`);
      }
      if (row.age_category && !validAgeCategories.includes(row.age_category)) {
        errors.push(`Row ${rowNum}: Invalid age_category. Must be one of: ${validAgeCategories.join(', ')}`);
      }
      if (row.category && !validCategories.includes(row.category)) {
        errors.push(`Row ${rowNum}: Invalid category. Must be one of: ${validCategories.join(', ')}`);
      }
    });
    
    return errors;
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      message.error('Please upload a CSV file');
      return;
    }
    
    try {
      setIsValidating(true);
      const fileContent = await file.text();
      const parsed = parseCSV(fileContent);
      const errors = validateParticipantData(parsed);
      
      if (errors.length > 0) {
        setCsvFile(file);
        setParsedData(parsed);
        setValidationErrors(errors);
        setConflicts([]);
        setResolvedData([]);
        message.warning(`Found ${errors.length} validation errors. Please check the data.`);
        return;
      }
      
      // Check for conflicts and auto-resolve
      const { conflicts: detectedConflicts, resolvedData: autoResolvedData } = await checkConflicts(parsed);
      
      setCsvFile(file);
      setParsedData(parsed);
      setValidationErrors([]);
      setConflicts(detectedConflicts);
      setResolvedData(autoResolvedData);
      
      if (detectedConflicts.length > 0) {
        message.info(`Found ${detectedConflicts.length} conflicts. Auto-resolved and ready to import.`);
      } else {
        message.success(`Successfully parsed ${parsed.length} participants. Ready to import.`);
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to parse CSV file');
    } finally {
      setIsValidating(false);
    }
  };

  const downloadTemplate = () => {
    const template = 'full_name,age_category,chest_number,category,church,district,username,password\nJohn Doe,Juniors,001,individual,Grace Church,District A,john.doe,password123\nJane Smith,Intermediates,002,group,Hope Church,District B,jane.smith,password456';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'participants_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Conflict detection and auto-resolution
  const checkConflicts = async (data: any[]) => {
    try {
      // Get existing chest numbers and usernames
      const { data: existingParticipants, error } = await supabase
        .from('participants')
        .select('chest_number, username');
      
      if (error) throw error;
      
      const existingChestNumbers = new Set(existingParticipants?.map(p => p.chest_number) || []);
      const existingUsernames = new Set(existingParticipants?.map(p => p.username) || []);
      
      const conflicts = [];
      const resolvedData = [];
      
      // Check for duplicates within the import data
      const importChestNumbers = new Set();
      const importUsernames = new Set();
      
      for (const row of data) {
        const rowNum = row._rowNumber;
        let hasConflict = false;
        const changes = [];
        
        // Check chest number conflicts
        if (existingChestNumbers.has(row.chest_number) || importChestNumbers.has(row.chest_number)) {
          const newChestNumber = findNextChestNumber(existingChestNumbers, importChestNumbers);
          changes.push(`Chest number '${row.chest_number}' → '${newChestNumber}' (auto-fixed)`);
          row.chest_number = newChestNumber;
          hasConflict = true;
        }
        importChestNumbers.add(row.chest_number);
        
        // Check username conflicts
        if (existingUsernames.has(row.username) || importUsernames.has(row.username)) {
          const newUsername = generateUniqueUsername(row.username, existingUsernames, importUsernames);
          changes.push(`Username '${row.username}' → '${newUsername}' (auto-fixed)`);
          row.username = newUsername;
          hasConflict = true;
        }
        importUsernames.add(row.username);
        
        if (hasConflict) {
          conflicts.push({
            row: rowNum,
            name: row.full_name,
            changes: changes
          });
        }
        
        resolvedData.push(row);
      }
      
      return { conflicts, resolvedData };
    } catch (error: any) {
      message.error('Failed to check conflicts: ' + error.message);
      return { conflicts: [], resolvedData: data };
    }
  };

  const findNextChestNumber = (existing: Set<string>, importSet: Set<string>) => {
    let num = 1;
    while (existing.has(num.toString().padStart(3, '0')) || importSet.has(num.toString().padStart(3, '0'))) {
      num++;
    }
    return num.toString().padStart(3, '0');
  };

  const generateUniqueUsername = (username: string, existing: Set<string>, importSet: Set<string>) => {
    let counter = 1;
    let newUsername = username;
    
    while (existing.has(newUsername) || importSet.has(newUsername)) {
      newUsername = `${username}.${counter}`;
      counter++;
    }
    
    return newUsername;
  };

  // Bulk import function
  const handleBulkImport = async () => {
    try {
      setIsValidating(true);
      
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

      // Prepare data for import
      const dataToImport = resolvedData.length > 0 ? resolvedData : parsedData;
      const participantsToInsert = [];
      
      for (const row of dataToImport) {
        const password_hash = await hashPassword(row.password);
        participantsToInsert.push({
          full_name: row.full_name,
          age_category: row.age_category,
          chest_number: row.chest_number,
          church: row.church,
          district: row.district,
          username: row.username,
          password_hash: password_hash,
          is_active: true,
          created_by: user.id
        });
      }

      // Insert all participants in a single transaction
      const { data: newParticipants, error } = await supabase
        .from('participants')
        .insert(participantsToInsert)
        .select();

      if (error) {
        console.error('Database error:', error);
        throw new Error(error.message || 'Failed to import participants');
      }

      message.success(`Successfully imported ${newParticipants.length} participants`);
      setIsBulkImportOpen(false);
      setCsvFile(null);
      setParsedData([]);
      setValidationErrors([]);
      setConflicts([]);
      setResolvedData([]);
      fetchParticipants();
      
    } catch (error: any) {
      console.error('Import error:', error);
      message.error(error.message || 'Failed to import participants');
    } finally {
      setIsValidating(false);
    }
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
      title: 'Age Category',
      dataIndex: 'age_category',
      key: 'age_category',
      width: 150,
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
              
              <div className="flex gap-2">
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
                <Button
                  icon={<Upload size={16} />}
                  onClick={() => setIsBulkImportOpen(true)}
                  className="md:inline-flex hidden:flex"
                >
                  <span className="hidden md:inline">Bulk Import</span>
                </Button>
                {selectedRowKeys.length > 0 && (
                  <Button 
                    danger 
                    icon={<Trash2 size={16} />}
                    loading={batchDeleting}
                    onClick={handleBatchDelete}
                    className="md:inline-flex hidden:flex"
                  >
                    <span className="hidden md:inline">Delete Selected ({selectedRowKeys.length})</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Card>
            <ResponsiveTable
              columns={columns}
              dataSource={participants}
              loading={loading}
              rowKey="id"
              rowSelection={rowSelection}
              cardTitle={(record) => `${record.chest_number} - ${record.full_name}`}
              locale={{
                emptyText: loading ? <Spin /> : undefined
              }}
            />
          </Card>

          <Card style={{ marginTop: '24px' }}>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    type="primary"
                    icon={<Users size={16} />}
                    onClick={() => openGroupModal()}
                    className="md:inline-flex hidden:flex"
                  >
                    <span className="hidden md:inline">Add Group</span>
                  </Button>
                  {selectedGroupKeys.length > 0 && (
                    <Button 
                      danger 
                      icon={<Trash2 size={16} />}
                      loading={batchDeletingGroups}
                      onClick={handleBatchDeleteGroups}
                      className="md:inline-flex hidden:flex"
                    >
                      <span className="hidden md:inline">Delete Selected ({selectedGroupKeys.length})</span>
                    </Button>
                  )}
                </div>
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
              rowSelection={groupRowSelection}
              cardTitle={(record) => record.name}
              cardExtra={(record) => (
                <Text type="secondary">{record.members?.length || 0} members</Text>
              )}
              locale={{
                emptyText: undefined
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
                  label="Age Category"
                  name="age_category"
                  rules={[{ required: true, message: 'Age category is required' }]}
                >
                  <Select placeholder="Select age category">
                    <Select.Option value="Sub Juniors">Sub Juniors</Select.Option>
                    <Select.Option value="Juniors">Juniors</Select.Option>
                    <Select.Option value="Intermediates">Intermediates</Select.Option>
                    <Select.Option value="Seniors">Seniors</Select.Option>
                  </Select>
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
                rules={[
                  { 
                    required: !editingParticipant, 
                    message: 'Password must be at least 4 characters', 
                    min: 4 
                  }
                ]}
              >
                <Input.Password 
                  placeholder={editingParticipant ? "Leave blank to keep current password" : "Enter password for login"} 
                />
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

          {/* Bulk Import Modal */}
          <Modal
            title="Bulk Import Participants"
            open={isBulkImportOpen}
            onCancel={() => {
              setIsBulkImportOpen(false);
              setCsvFile(null);
              setParsedData([]);
              setValidationErrors([]);
              setConflicts([]);
              setResolvedData([]);
            }}
            footer={null}
            width={800}
          >
            {!csvFile ? (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <Upload size={48} style={{ color: '#1890ff', marginBottom: '16px' }} />
                <Title level={4}>Upload CSV File</Title>
                <Text type="secondary" style={{ marginBottom: '24px', display: 'block' }}>
                  Upload a CSV file with participant data. Download the template for the correct format.
                </Text>
                
                <div style={{ marginBottom: '24px' }}>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    style={{ display: 'none' }}
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload">
                    <Button type="dashed" size="large" style={{ width: '200px', height: '60px' }}>
                      <Upload size={20} style={{ marginRight: '8px' }} />
                      Choose CSV File
                    </Button>
                  </label>
                </div>
                
                <div>
                  <Button type="link" onClick={downloadTemplate} style={{ marginRight: '16px' }}>
                    Download Template
                  </Button>
                  <Button onClick={() => setIsBulkImportOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <Text strong>File: {csvFile.name}</Text>
                  {isValidating && <Spin size="small" style={{ marginLeft: '8px' }} />}
                  <Button 
                    type="link" 
                    onClick={() => {
                      setCsvFile(null);
                      setParsedData([]);
                      setValidationErrors([]);
                      setConflicts([]);
                      setResolvedData([]);
                    }}
                    style={{ float: 'right' }}
                  >
                    Change File
                  </Button>
                </div>
                
                {validationErrors.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <Text type="danger" strong>Validation Errors ({validationErrors.length}):</Text>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '8px' }}>
                      {validationErrors.map((error, index) => (
                        <div key={index} style={{ color: '#ff4d4f', fontSize: '12px', marginBottom: '4px' }}>
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {conflicts.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <Text type="warning" strong>Auto-Resolved Conflicts ({conflicts.length}):</Text>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '8px' }}>
                      {conflicts.map((conflict, index) => (
                        <div key={index} style={{ color: '#faad14', fontSize: '12px', marginBottom: '4px' }}>
                          <strong>Row {conflict.row} ({conflict.name}):</strong> {conflict.changes.join(', ')}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {(resolvedData.length > 0 || parsedData.length > 0) && (
                  <div>
                    <Text strong>Preview ({(resolvedData.length || parsedData.length)} participants):</Text>
                    <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '8px' }}>
                      <table style={{ width: '100%', border: '1px solid #d9d9d9', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f5f5f5' }}>
                            <th style={{ padding: '8px', border: '1px solid #d9d9d9', fontSize: '12px' }}>Name</th>
                            <th style={{ padding: '8px', border: '1px solid #d9d9d9', fontSize: '12px' }}>Age Category</th>
                            <th style={{ padding: '8px', border: '1px solid #d9d9d9', fontSize: '12px' }}>Chest #</th>
                            <th style={{ padding: '8px', border: '1px solid #d9d9d9', fontSize: '12px' }}>Event Category</th>
                            <th style={{ padding: '8px', border: '1px solid #d9d9d9', fontSize: '12px' }}>Church</th>
                            <th style={{ padding: '8px', border: '1px solid #d9d9d9', fontSize: '12px' }}>Username</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(resolvedData.length > 0 ? resolvedData : parsedData).slice(0, 10).map((row, index) => (
                            <tr key={index}>
                              <td style={{ padding: '8px', border: '1px solid #d9d9d9', fontSize: '12px' }}>{row.full_name}</td>
                              <td style={{ padding: '8px', border: '1px solid #d9d9d9', fontSize: '12px' }}>{row.age_category}</td>
                              <td style={{ padding: '8px', border: '1px solid #d9d9d9', fontSize: '12px' }}>{row.chest_number}</td>
                              <td style={{ padding: '8px', border: '1px solid #d9d9d9', fontSize: '12px' }}>
                                {row.category === 'individual' ? 'Individual Event' : 'Group Event'}
                              </td>
                              <td style={{ padding: '8px', border: '1px solid #d9d9d9', fontSize: '12px' }}>{row.church}</td>
                              <td style={{ padding: '8px', border: '1px solid #d9d9d9', fontSize: '12px' }}>{row.username}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {(resolvedData.length || parsedData.length) > 10 && (
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          ... and {(resolvedData.length || parsedData.length) - 10} more participants
                        </Text>
                      )}
                    </div>
                  </div>
                )}
                
                <div style={{ marginTop: '16px', textAlign: 'right' }}>
                  <Button onClick={() => setIsBulkImportOpen(false)} style={{ marginRight: '8px' }}>
                    Cancel
                  </Button>
                  <Button 
                    type="primary" 
                    disabled={validationErrors.length > 0 || isValidating}
                    loading={isValidating}
                    onClick={handleBulkImport}
                  >
                    Import {(resolvedData.length || parsedData.length)} Participants
                  </Button>
                </div>
              </div>
            )}
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default ParticipantManagement;