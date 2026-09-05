import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Checkbox, Form, Input as AntInput, Modal, Select, Spin, message } from 'antd';
import { Eye, FileCsv, PencilSimple, Plus, Trash, UploadSimple, UserPlus, UsersThree } from '@phosphor-icons/react';
import { supabase } from '@/integrations/supabase/client';
import type { FormValues } from '@/lib/types';
import { setPassword, setPasswords } from '@/utils/credentials';
import { AppShell } from '@/components/shell/AppShell';
import { DataTable } from '@/components/admin/DataTable';
import { Toolbar } from '@/components/admin/Toolbar';
import { Button, Card, StatusPill } from '@/components/ui/primitives';
import { SearchInput, SegmentedControl } from '@/components/ui/inputs';
import { ImportPanel } from '@/components/admin/ImportPanel';
import { Sheet } from '@/components/ui/Sheet';

interface Participant {
  id: string;
  full_name: string;
  age_category: string;
  chest_number: string;
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
    participant: { full_name: string; chest_number: string; church: string };
  }>;
}

const AGE_CATEGORIES = ['Sub Juniors', 'Juniors', 'Intermediates', 'Seniors'];

const ParticipantManagement = () => {
  const navigate = useNavigate();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'people' | 'groups'>('people');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [submittingGroup, setSubmittingGroup] = useState(false);
  const [groupForm] = Form.useForm();
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<FormValues[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [conflicts, setConflicts] = useState<Array<{ row: number; name: string; changes: string[] }>>([]);
  const [resolvedData, setResolvedData] = useState<FormValues[]>([]);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<React.Key[]>([]);
  const [batchDeletingGroups, setBatchDeletingGroups] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchParticipants();
    fetchGroups();
  }, []);

  const filteredParticipants = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return participants;
    return participants.filter(
      (participant) =>
        participant.full_name.toLowerCase().includes(query) ||
        participant.chest_number.toLowerCase().includes(query) ||
        participant.church?.toLowerCase().includes(query),
    );
  }, [participants, searchTerm]);

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
        .select(
          `*, members:group_members( id, participant_id, participant:participants( full_name, chest_number, church ) )`,
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGroups((data || []) as unknown as Group[]);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setSubmitting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('No active session found. Please log in again.');

      if (editingParticipant) {
        const { error } = await supabase
          .from('participants')
          .update({
            full_name: values.full_name,
            age_category: values.age_category,
            chest_number: values.chest_number,
            church: values.church,
            district: values.district,
            username: values.username,
          })
          .eq('id', editingParticipant.id);

        if (error) throw new Error(error.message || 'Failed to update participant');

        // Hashing happens in the edge function, not here.
        if (values.password) {
          await setPassword('participant', editingParticipant.id, values.password);
        }

        message.success('Participant updated');
      } else {
        const { data: newParticipant, error } = await supabase
          .from('participants')
          .insert({
            full_name: values.full_name,
            age_category: values.age_category,
            chest_number: values.chest_number,
            church: values.church,
            district: values.district,
            username: values.username,
            is_active: true,
            created_by: user.id,
          })
          .select()
          .single();

        if (error) throw new Error(error.message || 'Failed to create participant');

        try {
          await setPassword('participant', newParticipant.id, values.password);
        } catch (credentialError) {
          // Don't leave a participant behind that nobody can log in as.
          await supabase.from('participants').delete().eq('id', newParticipant.id);
          throw credentialError;
        }

        message.success('Participant created with login credentials');
      }

      closeParticipantModal();
      fetchParticipants();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to save participant');
    } finally {
      setSubmitting(false);
    }
  };

  const openParticipantModal = (participant?: Participant) => {
    if (participant) {
      setEditingParticipant(participant);
      form.setFieldsValue(participant);
    } else {
      setEditingParticipant(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const closeParticipantModal = () => {
    setIsModalOpen(false);
    setEditingParticipant(null);
    form.resetFields();
  };

  const handleDelete = (participant: Participant) => {
    Modal.confirm({
      title: `Delete ${participant.full_name}?`,
      content: 'Their scores and results are removed with them. This cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const { error } = await supabase.from('participants').delete().eq('id', participant.id);
          if (error) throw error;
          message.success('Participant deleted');
          fetchParticipants();
        } catch {
          message.error('Failed to delete participant');
        }
      },
    });
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) return;

    Modal.confirm({
      title: `Delete ${selectedRowKeys.length} participant(s)?`,
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          setBatchDeleting(true);
          const { error } = await supabase
            .from('participants')
            .delete()
            .in('id', selectedRowKeys.map(String));

          if (error) throw error;
          message.success(`Deleted ${selectedRowKeys.length} participant(s)`);
          setSelectedRowKeys([]);
          fetchParticipants();
        } catch (error) {
          message.error(error instanceof Error ? error.message : 'Failed to delete participants');
        } finally {
          setBatchDeleting(false);
        }
      },
    });
  };

  /* ----------------------------------------------------------- groups */

  const openGroupModal = (group?: Group) => {
    if (group) {
      setEditingGroup(group);
      groupForm.setFieldsValue({ name: group.name, description: group.description || '' });
      setSelectedParticipants(group.members?.map((member) => member.participant_id) || []);
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

  const replaceGroupMembers = async (groupId: string, participantIds: string[]) => {
    await supabase.from('group_members').delete().eq('group_id', groupId);

    if (participantIds.length > 0) {
      const { error } = await supabase.from('group_members').insert(
        participantIds.map((participantId) => ({
          group_id: groupId,
          participant_id: participantId,
        })),
      );
      if (error) throw error;
    }
  };

  const onSubmitGroup = async (values: FormValues) => {
    try {
      setSubmittingGroup(true);

      if (selectedParticipants.length === 0) {
        message.error('Select at least one participant for the group');
        return;
      }

      if (editingGroup) {
        const { error } = await supabase
          .from('groups')
          .update({ name: values.name, description: values.description || null })
          .eq('id', editingGroup.id);

        if (error) throw error;
        await replaceGroupMembers(editingGroup.id, selectedParticipants);
        message.success('Group updated');
      } else {
        const { data: newGroup, error } = await supabase
          .from('groups')
          .insert({ name: values.name, description: values.description || null })
          .select()
          .single();

        if (error) throw error;
        await replaceGroupMembers(newGroup.id, selectedParticipants);
        message.success('Group created');
      }

      closeGroupModal();
      fetchGroups();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to save group');
    } finally {
      setSubmittingGroup(false);
    }
  };

  const deleteGroup = (group: Group) => {
    Modal.confirm({
      title: `Delete ${group.name}?`,
      content: 'Members stay registered; only the group is removed.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const { error } = await supabase.from('groups').delete().eq('id', group.id);
          if (error) throw error;
          message.success('Group deleted');
          fetchGroups();
        } catch {
          message.error('Failed to delete group');
        }
      },
    });
  };

  const handleBatchDeleteGroups = () => {
    if (selectedGroupKeys.length === 0) return;

    Modal.confirm({
      title: `Delete ${selectedGroupKeys.length} group(s)?`,
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          setBatchDeletingGroups(true);
          const { error } = await supabase
            .from('groups')
            .delete()
            .in('id', selectedGroupKeys.map(String));

          if (error) throw error;
          message.success(`Deleted ${selectedGroupKeys.length} group(s)`);
          setSelectedGroupKeys([]);
          fetchGroups();
        } catch (error) {
          message.error(error instanceof Error ? error.message : 'Failed to delete groups');
        } finally {
          setBatchDeletingGroups(false);
        }
      },
    });
  };

  /* ------------------------------------------------------ bulk import */

  const parseCSV = (fileContent: string) => {
    const lines = fileContent.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      throw new Error('CSV file must have a header row and at least one data row');
    }

    const headers = lines[0].split(',').map((header) => header.trim());
    const requiredHeaders = [
      'full_name',
      'age_category',
      'chest_number',
      'church',
      'district',
      'username',
      'password',
    ];

    const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`);
    }

    return lines.slice(1).map((line, index) => {
      const values = line.split(',').map((value) => value.trim());
      const row: FormValues = {};
      headers.forEach((header, position) => {
        row[header] = values[position] || '';
      });
      row._rowNumber = index + 2; // header row plus zero-indexing
      return row;
    });
  };

  const validateParticipantData = (data: FormValues[]) => {
    const errors: string[] = [];

    data.forEach((row) => {
      const rowNum = row._rowNumber;

      if (!row.full_name) errors.push(`Row ${rowNum}: Missing full_name`);
      if (!row.age_category) errors.push(`Row ${rowNum}: Missing age_category`);
      if (!row.chest_number) errors.push(`Row ${rowNum}: Missing chest_number`);
      if (!row.church) errors.push(`Row ${rowNum}: Missing church`);
      if (!row.district) errors.push(`Row ${rowNum}: Missing district`);
      if (!row.username) errors.push(`Row ${rowNum}: Missing username`);
      if (!row.password) errors.push(`Row ${rowNum}: Missing password`);

      if (row.username && row.username.length < 3) {
        errors.push(`Row ${rowNum}: Username must be at least 3 characters`);
      }
      if (row.password && row.password.length < 8) {
        errors.push(`Row ${rowNum}: Password must be at least 8 characters`);
      }
      if (row.age_category && !AGE_CATEGORIES.includes(row.age_category)) {
        errors.push(`Row ${rowNum}: Invalid age_category. One of: ${AGE_CATEGORIES.join(', ')}`);
      }
    });

    return errors;
  };

  const findNextChestNumber = (existing: Set<unknown>, importSet: Set<unknown>) => {
    let num = 1;
    while (
      existing.has(num.toString().padStart(3, '0')) ||
      importSet.has(num.toString().padStart(3, '0'))
    ) {
      num++;
    }
    return num.toString().padStart(3, '0');
  };

  const generateUniqueUsername = (username: string, existing: Set<unknown>, importSet: Set<unknown>) => {
    let counter = 1;
    let candidate = username;
    while (existing.has(candidate) || importSet.has(candidate)) {
      candidate = `${username}.${counter}`;
      counter++;
    }
    return candidate;
  };

  const checkConflicts = async (data: FormValues[]) => {
    try {
      const { data: existingParticipants, error } = await supabase
        .from('participants')
        .select('chest_number, username');

      if (error) throw error;

      const existingChestNumbers = new Set(existingParticipants?.map((p) => p.chest_number) || []);
      const existingUsernames = new Set(existingParticipants?.map((p) => p.username) || []);

      const detected: Array<{ row: number; name: string; changes: string[] }> = [];
      const resolved: FormValues[] = [];
      const importChestNumbers = new Set<string>();
      const importUsernames = new Set<string>();

      for (const row of data) {
        const changes: string[] = [];

        if (existingChestNumbers.has(row.chest_number) || importChestNumbers.has(row.chest_number)) {
          const next = findNextChestNumber(existingChestNumbers, importChestNumbers);
          changes.push(`Chest number ${row.chest_number} → ${next}`);
          row.chest_number = next;
        }
        importChestNumbers.add(row.chest_number);

        if (existingUsernames.has(row.username) || importUsernames.has(row.username)) {
          const next = generateUniqueUsername(row.username, existingUsernames, importUsernames);
          changes.push(`Username ${row.username} → ${next}`);
          row.username = next;
        }
        importUsernames.add(row.username);

        if (changes.length > 0) {
          detected.push({ row: row._rowNumber, name: row.full_name, changes });
        }
        resolved.push(row);
      }

      return { conflicts: detected, resolvedData: resolved };
    } catch (error) {
      message.error(
        `Failed to check conflicts: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return { conflicts: [], resolvedData: data };
    }
  };

  const resetImport = () => {
    setCsvFile(null);
    setParsedData([]);
    setValidationErrors([]);
    setConflicts([]);
    setResolvedData([]);
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      message.error('Please upload a CSV file');
      return;
    }

    try {
      setIsValidating(true);
      const parsed = parseCSV(await file.text());
      const errors = validateParticipantData(parsed);

      if (errors.length > 0) {
        setCsvFile(file);
        setParsedData(parsed);
        setValidationErrors(errors);
        setConflicts([]);
        setResolvedData([]);
        message.warning(`${errors.length} rows need fixing before import`);
        return;
      }

      const { conflicts: detected, resolvedData: autoResolved } = await checkConflicts(parsed);
      setCsvFile(file);
      setParsedData(parsed);
      setValidationErrors([]);
      setConflicts(detected);
      setResolvedData(autoResolved);

      if (detected.length > 0) {
        message.info(`${detected.length} conflicts auto-resolved and ready to import`);
      } else {
        message.success(`${parsed.length} participants ready to import`);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to parse CSV file');
    } finally {
      setIsValidating(false);
    }
  };

  const handleBulkImport = async () => {
    try {
      setIsValidating(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('No active session found. Please log in again.');

      const dataToImport = resolvedData.length > 0 ? resolvedData : parsedData;
      const participantsToInsert = dataToImport.map((row) => ({
        full_name: row.full_name,
        age_category: row.age_category,
        chest_number: row.chest_number,
        church: row.church,
        district: row.district,
        username: row.username,
        is_active: true,
        created_by: user.id,
      }));

      const { data: newParticipants, error } = await supabase
        .from('participants')
        .insert(participantsToInsert)
        .select();

      if (error) throw new Error(error.message || 'Failed to import participants');

      // Passwords are hashed server side, keyed by the row just created.
      try {
        const credentials = newParticipants.map((created) => {
          const row = dataToImport.find((candidate) => candidate.username === created.username);
          if (!row) throw new Error(`Could not match a password to ${created.username}`);
          return { user_type: 'participant' as const, user_id: created.id, password: row.password };
        });
        await setPasswords(credentials);
      } catch (credentialError) {
        await supabase
          .from('participants')
          .delete()
          .in('id', newParticipants.map((created) => created.id));
        throw credentialError;
      }

      message.success(`Imported ${newParticipants.length} participants`);
      setIsBulkImportOpen(false);
      resetImport();
      fetchParticipants();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to import participants');
    } finally {
      setIsValidating(false);
    }
  };

  /* ------------------------------------------------------------ table */

  const participantColumns = [
    {
      title: 'Chest',
      dataIndex: 'chest_number',
      key: 'chest_number',
      width: 88,
      sorter: (a: Participant, b: Participant) => a.chest_number.localeCompare(b.chest_number),
      render: (chestNumber: string) => (
        <span className="tnum font-semibold text-foreground">{chestNumber}</span>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      sorter: (a: Participant, b: Participant) => a.full_name.localeCompare(b.full_name),
      render: (fullName: string, record: Participant) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{fullName}</div>
          {record.username && (
            <div className="truncate text-caption text-muted-foreground">@{record.username}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Age category',
      dataIndex: 'age_category',
      key: 'age_category',
      width: 150,
      filters: AGE_CATEGORIES.map((category) => ({ text: category, value: category })),
      onFilter: (value: unknown, record: Participant) => record.age_category === value,
      render: (category: string) => <StatusPill>{category}</StatusPill>,
    },
    { title: 'Church', dataIndex: 'church', key: 'church', ellipsis: true },
    { title: 'District', dataIndex: 'district', key: 'district', ellipsis: true },
    {
      title: '',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: unknown, record: Participant) => (
        <div className="flex justify-end gap-1">
          <IconButton
            label="View details"
            icon={<Eye size={15} />}
            onClick={() => navigate(`/admin/participants/${record.id}`)}
          />
          <IconButton
            label="Edit"
            icon={<PencilSimple size={15} />}
            onClick={() => openParticipantModal(record)}
          />
          <IconButton
            label="Delete"
            danger
            icon={<Trash size={15} />}
            onClick={() => handleDelete(record)}
          />
        </div>
      ),
    },
  ];

  const groupColumns = [
    {
      title: 'Group',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Group) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{name}</div>
          {record.description && (
            <div className="truncate text-caption text-muted-foreground">{record.description}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Members',
      dataIndex: 'members',
      key: 'members',
      render: (members: Group['members']) => (
        <div className="min-w-0">
          <div className="tnum font-medium text-foreground">{members?.length || 0}</div>
          {members && members.length > 0 && (
            <div className="truncate text-caption text-muted-foreground">
              {members
                .slice(0, 3)
                .map((member) => member.participant?.full_name)
                .join(', ')}
              {members.length > 3 && ` +${members.length - 3} more`}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      fixed: 'right' as const,
      render: (_: unknown, record: Group) => (
        <div className="flex justify-end gap-1">
          <IconButton label="Edit" icon={<PencilSimple size={15} />} onClick={() => openGroupModal(record)} />
          <IconButton
            label="Delete"
            danger
            icon={<Trash size={15} />}
            onClick={() => deleteGroup(record)}
          />
        </div>
      ),
    },
  ];

  const previewRows = resolvedData.length > 0 ? resolvedData : parsedData;

  return (
    <AppShell
      variant="admin"
      title="Participants"
      subtitle={`${participants.length} registered · ${groups.length} groups`}
      maxWidth="wide"
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            icon={<UploadSimple size={15} />}
            onClick={() => setIsBulkImportOpen(true)}
          >
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button
            size="sm"
            icon={<Plus size={15} />}
            onClick={() => (tab === 'people' ? openParticipantModal() : openGroupModal())}
          >
            <span className="hidden sm:inline">
              {tab === 'people' ? 'Add participant' : 'Add group'}
            </span>
          </Button>
        </>
      }
    >
      <SegmentedControl
        value={tab}
        onChange={(value) => setTab(value as 'people' | 'groups')}
        className="mb-4 max-w-sm"
        options={[
          { value: 'people', label: 'Participants', count: participants.length },
          { value: 'groups', label: 'Groups', count: groups.length },
        ]}
      />

      {tab === 'people' ? (
        <DataTable
          columns={participantColumns}
          dataSource={filteredParticipants}
          rowKey="id"
          loading={loading}
          scrollX={860}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          toolbar={
            <Toolbar
              selectionCount={selectedRowKeys.length}
              selectionActions={
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash size={14} />}
                    loading={batchDeleting}
                    onClick={handleBatchDelete}
                  >
                    Delete
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedRowKeys([])}>
                    Clear
                  </Button>
                </>
              }
            >
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Search name, chest number or church"
                className="w-full max-w-sm"
              />
              {searchTerm && (
                <span className="tnum text-caption text-muted-foreground">
                  {filteredParticipants.length} of {participants.length}
                </span>
              )}
            </Toolbar>
          }
          emptyIcon={<UserPlus size={22} />}
          emptyTitle={searchTerm ? 'No matching participants' : 'No participants yet'}
          emptyDescription={
            searchTerm
              ? 'Try a different name or chest number.'
              : 'Add participants one at a time, or import a CSV.'
          }
          emptyAction={
            !searchTerm && (
              <Button size="sm" icon={<Plus size={14} />} onClick={() => openParticipantModal()}>
                Add participant
              </Button>
            )
          }
        />
      ) : (
        <DataTable
          columns={groupColumns}
          dataSource={groups}
          rowKey="id"
          loading={loading}
          scrollX={600}
          rowSelection={{
            selectedRowKeys: selectedGroupKeys,
            onChange: setSelectedGroupKeys,
          }}
          toolbar={
            <Toolbar
              selectionCount={selectedGroupKeys.length}
              selectionActions={
                <>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash size={14} />}
                    loading={batchDeletingGroups}
                    onClick={handleBatchDeleteGroups}
                  >
                    Delete
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedGroupKeys([])}>
                    Clear
                  </Button>
                </>
              }
            >
              <span className="text-caption text-muted-foreground">
                Groups compete as one entrant in group events
              </span>
            </Toolbar>
          }
          emptyIcon={<UsersThree size={22} />}
          emptyTitle="No groups yet"
          emptyDescription="Create a group to enter it into group events."
          emptyAction={
            <Button size="sm" icon={<Plus size={14} />} onClick={() => openGroupModal()}>
              Add group
            </Button>
          }
        />
      )}

      {/* ----------------------------------------- participant form */}
      <Sheet
        open={isModalOpen}
        onClose={closeParticipantModal}
        dismissable={!submitting}
        title={editingParticipant ? 'Edit participant' : 'Add participant'}
        description={
          editingParticipant
            ? 'Leave the password blank to keep the current one.'
            : 'Creates the login the participant will use.'
        }
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" onClick={closeParticipantModal} disabled={submitting}>
              Cancel
            </Button>
            <Button size="lg" block loading={submitting} onClick={() => form.submit()}>
              {editingParticipant ? 'Save changes' : 'Add participant'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
          <Form.Item
            label="Full name"
            name="full_name"
            rules={[{ required: true, min: 2, message: 'Name must be at least 2 characters' }]}
          >
            <AntInput placeholder="Full name" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              label="Age category"
              name="age_category"
              rules={[{ required: true, message: 'Age category is required' }]}
            >
              <Select
                placeholder="Select"
                options={AGE_CATEGORIES.map((category) => ({ value: category, label: category }))}
              />
            </Form.Item>

            <Form.Item
              label="Chest number"
              name="chest_number"
              rules={[{ required: true, message: 'Chest number is required' }]}
            >
              <AntInput placeholder="001" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              label="Church"
              name="church"
              rules={[{ required: true, message: 'Church is required' }]}
            >
              <AntInput />
            </Form.Item>

            <Form.Item
              label="District"
              name="district"
              rules={[{ required: true, message: 'District is required' }]}
            >
              <AntInput />
            </Form.Item>
          </div>

          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, min: 3, message: 'Username must be at least 3 characters' }]}
          >
            <AntInput placeholder="firstname.lastname" autoComplete="off" />
          </Form.Item>

          <Form.Item
            label="Password"
            name="password"
            rules={[
              {
                required: !editingParticipant,
                min: 8,
                message: 'Password must be at least 8 characters',
              },
            ]}
          >
            <AntInput.Password
              autoComplete="new-password"
              placeholder={editingParticipant ? 'Leave blank to keep current' : 'At least 8 characters'}
            />
          </Form.Item>
        </Form>
      </Sheet>

      {/* ------------------------------------------------ group form */}
      <Sheet
        open={isGroupModalOpen}
        onClose={closeGroupModal}
        dismissable={!submittingGroup}
        size="lg"
        title={editingGroup ? 'Edit group' : 'Create group'}
        description="Groups are scored as a single entrant."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" onClick={closeGroupModal} disabled={submittingGroup}>
              Cancel
            </Button>
            <Button size="lg" block loading={submittingGroup} onClick={() => groupForm.submit()}>
              {editingGroup ? 'Save changes' : 'Create group'}
            </Button>
          </div>
        }
      >
        <Form form={groupForm} layout="vertical" onFinish={onSubmitGroup} requiredMark={false}>
          <Form.Item
            label="Group name"
            name="name"
            rules={[{ required: true, message: 'Group name is required' }]}
          >
            <AntInput placeholder="Group name" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <AntInput.TextArea rows={2} placeholder="Optional" />
          </Form.Item>
        </Form>

        <div className="mb-1 flex items-center justify-between">
          <span className="text-caption font-medium text-foreground">Members</span>
          <span className="tnum text-caption text-muted-foreground">
            {selectedParticipants.length} selected
          </span>
        </div>
        <div className="scrollbar-thin max-h-64 overflow-y-auto rounded-xl border border-border">
          {participants.map((participant) => (
            <label
              key={participant.id}
              className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0 hover:bg-surface-sunken"
            >
              <Checkbox
                checked={selectedParticipants.includes(participant.id)}
                onChange={(changeEvent) =>
                  setSelectedParticipants((current) =>
                    changeEvent.target.checked
                      ? [...current, participant.id]
                      : current.filter((id) => id !== participant.id),
                  )
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body text-foreground">
                  {participant.full_name}
                </span>
                <span className="block truncate text-caption text-muted-foreground">
                  #{participant.chest_number} · {participant.church}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Sheet>

      {/* ----------------------------------------------- bulk import */}
      <Sheet
        open={isBulkImportOpen}
        onClose={() => {
          setIsBulkImportOpen(false);
          resetImport();
        }}
        dismissable={!isValidating}
        size="lg"
        title="Import participants"
        description="One CSV, one participant per row."
        footer={
          csvFile ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="lg" onClick={resetImport} disabled={isValidating}>
                Change file
              </Button>
              <Button
                size="lg"
                block
                disabled={validationErrors.length > 0 || isValidating || previewRows.length === 0}
                loading={isValidating}
                onClick={handleBulkImport}
              >
                Import {previewRows.length} participants
              </Button>
            </div>
          ) : undefined
        }
      >
        {!csvFile ? (
          <ImportPanel template="participants" onFile={handleFileUpload} disabled={isValidating} />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2">
              <FileCsv size={15} className="text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-caption text-foreground">
                {csvFile.name}
              </span>
              {isValidating && <Spin size="small" />}
            </div>

            {validationErrors.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive-soft p-3">
                <p className="text-caption font-semibold text-destructive">
                  {validationErrors.length} problems — fix these and upload again
                </p>
                <ul className="scrollbar-thin mt-1.5 max-h-40 space-y-0.5 overflow-y-auto">
                  {validationErrors.map((error) => (
                    <li key={error} className="text-caption text-destructive/90">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {conflicts.length > 0 && (
              <div className="rounded-xl border border-warning/30 bg-warning-soft p-3">
                <p className="text-caption font-semibold text-warning">
                  {conflicts.length} conflicts resolved automatically
                </p>
                <ul className="scrollbar-thin mt-1.5 max-h-40 space-y-0.5 overflow-y-auto">
                  {conflicts.map((conflict) => (
                    <li key={`${conflict.row}-${conflict.name}`} className="text-caption text-warning">
                      Row {conflict.row} ({conflict.name}): {conflict.changes.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {previewRows.length > 0 && (
              <div>
                <p className="mb-1.5 text-caption font-medium text-foreground">
                  Preview · {previewRows.length} participants
                </p>
                <div className="scrollbar-thin max-h-72 overflow-auto rounded-xl border border-border">
                  <table className="w-full text-caption">
                    <thead className="sticky top-0 bg-surface-sunken text-muted-foreground">
                      <tr>
                        <Th>Name</Th>
                        <Th>Category</Th>
                        <Th>Chest</Th>
                        <Th>Church</Th>
                        <Th>Username</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 25).map((row) => (
                        <tr key={row._rowNumber} className="border-t border-border">
                          <Td>{row.full_name}</Td>
                          <Td>{row.age_category}</Td>
                          <Td className="tnum">{row.chest_number}</Td>
                          <Td>{row.church}</Td>
                          <Td>{row.username}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewRows.length > 25 && (
                  <p className="mt-1 text-caption text-muted-foreground">
                    and {previewRows.length - 25} more
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Sheet>
    </AppShell>
  );
};

const IconButton = ({
  label,
  icon,
  onClick,
  danger,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
      danger
        ? 'text-muted-foreground hover:bg-destructive-soft hover:text-destructive'
        : 'text-muted-foreground hover:bg-surface-sunken hover:text-foreground'
    }`}
  >
    {icon}
  </button>
);

const Th = ({ children }: { children: React.ReactNode }) => (
  <th className="px-3 py-2 text-left font-medium">{children}</th>
);

const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={`truncate px-3 py-2 text-foreground ${className ?? ''}`}>{children}</td>
);

export default ParticipantManagement;
