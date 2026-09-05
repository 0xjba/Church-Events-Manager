import { useEffect, useMemo, useState } from 'react';
import { Form, Input as AntInput, Modal, message } from 'antd';
import { Gavel, PencilSimple, Plus, Trash, UploadSimple } from '@phosphor-icons/react';
import { supabase } from '@/integrations/supabase/client';
import type { FormValues } from '@/lib/types';
import { setPassword, setPasswords } from '@/utils/credentials';
import { cell, parseCsv, type CsvRow } from '@/utils/csv';
import { TEMPLATES } from '@/utils/importTemplates';
import { ImportIssues, ImportPanel, ImportSummary } from '@/components/admin/ImportPanel';
import { useEventLevel } from '@/hooks/useEventLevel';
import { AppShell } from '@/components/shell/AppShell';
import { DataTable } from '@/components/admin/DataTable';
import { Toolbar } from '@/components/admin/Toolbar';
import { Avatar, Button, StatusPill } from '@/components/ui/primitives';
import { SearchInput } from '@/components/ui/inputs';
import { Sheet } from '@/components/ui/Sheet';

interface Judge {
  id: string;
  level_id: string | null;
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
  // A panel is assembled for one competition, so this screen works within the
  // event level chosen in the top bar.
  const { levelId, level } = useEventLevel();
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingJudge, setEditingJudge] = useState<Judge | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [search, setSearch] = useState('');

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRows, setImportRows] = useState<CsvRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchJudges();
  }, [levelId]);

  const fetchJudges = async () => {
    if (!levelId) {
      setJudges([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('judges')
        .select('*')
        .eq('level_id', levelId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJudges(data || []);
    } catch (error) {
      console.error('Error fetching judges:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return judges;
    return judges.filter((judge) =>
      [judge.full_name, judge.username, judge.email, judge.church]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(query)),
    );
  }, [judges, search]);

  const openModal = (judge?: Judge) => {
    if (judge) {
      setEditingJudge(judge);
      form.setFieldsValue(judge);
    } else {
      setEditingJudge(null);
      form.resetFields();
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingJudge(null);
    form.resetFields();
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setSubmitting(true);

      const details = {
        full_name: values.full_name,
        username: values.username,
        email: values.email,
        church: values.church,
        contact: values.contact || null,
        level_id: levelId,
      };

      if (editingJudge) {
        const { error } = await supabase.from('judges').update(details).eq('id', editingJudge.id);
        if (error) throw error;

        // Hashing happens in the edge function, not here.
        if (values.password) {
          await setPassword('judge', editingJudge.id, values.password);
        }

        message.success('Judge updated');
      } else {
        const { data: newJudge, error } = await supabase
          .from('judges')
          .insert({ ...details, is_active: true })
          .select()
          .single();

        if (error) throw error;

        try {
          await setPassword('judge', newJudge.id, values.password);
        } catch (credentialError) {
          // Don't leave a judge behind that nobody can log in as.
          await supabase.from('judges').delete().eq('id', newJudge.id);
          throw credentialError;
        }

        message.success('Judge added');
      }

      closeModal();
      fetchJudges();
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : editingJudge
            ? 'Failed to update judge'
            : 'Failed to add judge',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setImportRows([]);
    setImportErrors([]);
  };

  const validateJudgeRows = (rows: CsvRow[], existingUsernames: string[]) => {
    const errors: string[] = [];
    const seenUsernames = new Set(existingUsernames);
    const seenEmails = new Set(judges.map((judge) => judge.email));

    rows.forEach((row) => {
      const username = cell(row, 'username');
      const email = cell(row, 'email');

      if (!cell(row, 'full_name')) errors.push(`Row ${row._row}: missing full_name`);
      if (!username) errors.push(`Row ${row._row}: missing username`);
      else if (username.length < 3) errors.push(`Row ${row._row}: username must be at least 3 characters`);
      else if (seenUsernames.has(username)) errors.push(`Row ${row._row}: username ${username} is already taken`);

      if (!cell(row, 'password')) errors.push(`Row ${row._row}: missing password`);
      else if (cell(row, 'password').length < 8) {
        errors.push(`Row ${row._row}: password must be at least 8 characters`);
      }

      if (!email) errors.push(`Row ${row._row}: missing email`);
      else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        errors.push(`Row ${row._row}: ${email} is not a valid email`);
      } else if (seenEmails.has(email)) {
        errors.push(`Row ${row._row}: email ${email} is already used`);
      }

      if (!cell(row, 'church')) errors.push(`Row ${row._row}: missing church`);

      seenUsernames.add(username);
      seenEmails.add(email);
    });

    return errors;
  };

  const handleImportFile = async (file: File) => {
    try {
      setImporting(true);
      const parsed = parseCsv(await file.text(), TEMPLATES.judges.headers.filter((header) => header !== 'contact'));

      // A username is a login, so it has to be unique across every level.
      const { data: takenUsernames } = await supabase.from('judges').select('username');
      const errors = validateJudgeRows(
        parsed.rows,
        (takenUsernames ?? []).map((judge) => judge.username as string),
      );

      setImportFile(file);
      setImportRows(parsed.rows);
      setImportErrors(errors);

      if (errors.length > 0) message.warning(`${errors.length} rows need fixing before import`);
      else message.success(`${parsed.rows.length} judges ready to import`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not read that file');
    } finally {
      setImporting(false);
    }
  };

  const runImport = async () => {
    try {
      setImporting(true);

      const { data: created, error } = await supabase
        .from('judges')
        .insert(importRows.map((row) => ({
          full_name: cell(row, 'full_name'),
          username: cell(row, 'username'),
          email: cell(row, 'email'),
          church: cell(row, 'church'),
          contact: cell(row, 'contact') || null,
          level_id: levelId,
          is_active: true,
        })))
        .select();

      if (error) throw new Error(error.message);

      try {
        await setPasswords(created.map((judge) => {
          const row = importRows.find((candidate) => cell(candidate, 'username') === judge.username);
          if (!row) throw new Error(`Could not match a password to ${judge.username}`);
          return { user_type: 'judge' as const, user_id: judge.id, password: cell(row, 'password') };
        }));
      } catch (credentialError) {
        // Don't leave judges behind that nobody can log in as.
        await supabase.from('judges').delete().in('id', created.map((judge) => judge.id));
        throw credentialError;
      }

      message.success(`Imported ${created.length} judges`);
      setIsImportOpen(false);
      resetImport();
      fetchJudges();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to import judges');
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = (judge: Judge) => {
    Modal.confirm({
      title: `Delete ${judge.full_name}?`,
      content: 'Scores this judge submitted are deleted with the account.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const { error } = await supabase.from('judges').delete().eq('id', judge.id);
          if (error) throw error;
          message.success('Judge deleted');
          fetchJudges();
        } catch {
          message.error('Failed to delete judge');
        }
      },
    });
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) return;

    Modal.confirm({
      title: `Delete ${selectedRowKeys.length} judge(s)?`,
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          setBatchDeleting(true);
          const { error } = await supabase
            .from('judges')
            .delete()
            .in('id', selectedRowKeys.map(String));

          if (error) throw error;
          message.success(`Deleted ${selectedRowKeys.length} judge(s)`);
          setSelectedRowKeys([]);
          fetchJudges();
        } catch (error) {
          message.error(error instanceof Error ? error.message : 'Failed to delete judges');
        } finally {
          setBatchDeleting(false);
        }
      },
    });
  };

  const columns = [
    {
      title: 'Judge',
      dataIndex: 'full_name',
      key: 'full_name',
      sorter: (a: Judge, b: Judge) => a.full_name.localeCompare(b.full_name),
      render: (fullName: string, record: Judge) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={fullName} size={32} />
          <div className="min-w-0">
            <div className="truncate font-medium text-foreground">{fullName}</div>
            <div className="truncate text-caption text-muted-foreground">@{record.username}</div>
          </div>
        </div>
      ),
    },
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
    { title: 'Church', dataIndex: 'church', key: 'church', ellipsis: true },
    {
      title: 'Contact',
      dataIndex: 'contact',
      key: 'contact',
      render: (contact: string | null) => contact || <span className="text-muted-foreground">—</span>,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 110,
      render: (isActive: boolean) => (
        <StatusPill tone={isActive ? 'success' : 'neutral'} dot>
          {isActive ? 'Active' : 'Inactive'}
        </StatusPill>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      fixed: 'right' as const,
      render: (_: unknown, record: Judge) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            aria-label="Edit judge"
            title="Edit judge"
            onClick={() => openModal(record)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-sunken hover:text-foreground"
          >
            <PencilSimple size={15} />
          </button>
          <button
            type="button"
            aria-label="Delete judge"
            title="Delete judge"
            onClick={() => handleDelete(record)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
          >
            <Trash size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AppShell
      variant="admin"
      title="Judges"
      subtitle={level ? `${judges.length} on the panel for ${level.name} ${level.year}` : 'No active event level'}
      maxWidth="wide"
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            icon={<UploadSimple size={15} />}
            onClick={() => setIsImportOpen(true)}
          >
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button size="sm" icon={<Plus size={15} />} onClick={() => openModal()}>
            <span className="hidden sm:inline">Add judge</span>
          </Button>
        </>
      }
    >
      <DataTable
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        loading={loading}
        scrollX={860}
        rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
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
              value={search}
              onChange={setSearch}
              placeholder="Search judges"
              className="w-full max-w-sm"
            />
          </Toolbar>
        }
        emptyIcon={<Gavel size={22} />}
        emptyTitle={search ? 'No matching judges' : 'No judges on this panel yet'}
        emptyDescription={
          search
            ? 'Try a different name, username or church.'
            : 'Judges are added per event level, then assigned to its events.'
        }
        emptyAction={
          !search && (
            <Button size="sm" icon={<Plus size={14} />} onClick={() => openModal()}>
              Add judge
            </Button>
          )
        }
      />

      <Sheet
        open={isModalOpen}
        onClose={closeModal}
        dismissable={!submitting}
        title={editingJudge ? 'Edit judge' : 'Add judge'}
        description={
          editingJudge
            ? 'Leave the password blank to keep the current one.'
            : 'Creates the login this judge will use to score.'
        }
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" onClick={closeModal} disabled={submitting}>
              Cancel
            </Button>
            <Button size="lg" block loading={submitting} onClick={() => form.submit()}>
              {editingJudge ? 'Save changes' : 'Add judge'}
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
            <AntInput />
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              label="Username"
              name="username"
              rules={[{ required: true, message: 'Username is required' }]}
            >
              <AntInput autoComplete="off" />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[
                { required: !editingJudge, min: 8, message: 'Password must be at least 8 characters' },
              ]}
            >
              <AntInput.Password
                autoComplete="new-password"
                placeholder={editingJudge ? 'Leave blank' : 'At least 8 characters'}
              />
            </Form.Item>
          </div>

          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <AntInput inputMode="email" />
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              label="Church"
              name="church"
              rules={[{ required: true, message: 'Church is required' }]}
            >
              <AntInput />
            </Form.Item>

            <Form.Item label="Contact" name="contact">
              <AntInput placeholder="Optional phone" />
            </Form.Item>
          </div>
        </Form>
      </Sheet>

      <Sheet
        open={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
          resetImport();
        }}
        dismissable={!importing}
        size="lg"
        title="Import judges"
        description={`Onto the panel for ${level?.name ?? 'this level'}. One row per judge, with the login they will use.`}
        footer={
          importFile ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="lg" onClick={resetImport} disabled={importing}>
                Change file
              </Button>
              <Button
                size="lg"
                block
                loading={importing}
                disabled={importErrors.length > 0 || importRows.length === 0}
                onClick={runImport}
              >
                Import {importRows.length} judges
              </Button>
            </div>
          ) : undefined
        }
      >
        {!importFile ? (
          <ImportPanel template="judges" onFile={handleImportFile} disabled={importing} />
        ) : (
          <div className="space-y-3">
            <ImportSummary file={importFile} rows={importRows.length} label="judges" />
            <ImportIssues
              errors={importErrors}
              title={`${importErrors.length} problems — fix these and upload again`}
            />

            {importErrors.length === 0 && (
              <div className="scrollbar-thin max-h-72 overflow-auto rounded-xl border border-border">
                <table className="w-full text-caption">
                  <thead className="sticky top-0 bg-surface-sunken text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Username</th>
                      <th className="px-3 py-2 text-left font-medium">Email</th>
                      <th className="px-3 py-2 text-left font-medium">Church</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 25).map((row) => (
                      <tr key={row._row} className="border-t border-border">
                        <td className="truncate px-3 py-2 text-foreground">{cell(row, 'full_name')}</td>
                        <td className="truncate px-3 py-2 text-foreground">{cell(row, 'username')}</td>
                        <td className="truncate px-3 py-2 text-foreground">{cell(row, 'email')}</td>
                        <td className="truncate px-3 py-2 text-foreground">{cell(row, 'church')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </AppShell>
  );
};

export default JudgeManagement;
