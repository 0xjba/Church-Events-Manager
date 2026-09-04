import { useEffect, useState } from 'react';
import { Form, Input as AntInput, InputNumber, Switch, message } from 'antd';
import { CalendarBlank, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { supabase } from '@/integrations/supabase/client';
import type { FormValues } from '@/lib/types';
import { AppShell } from '@/components/shell/AppShell';
import { DataTable } from '@/components/admin/DataTable';
import { Button, StatusPill } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/Sheet';

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
  const [editingLevel, setEditingLevel] = useState<EventLevel | null>(null);
  const [levelToDelete, setLevelToDelete] = useState<EventLevel | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchEventLevels();
  }, []);

  const fetchEventLevels = async () => {
    try {
      setLoading(true);
      const { data: levelsData, error: levelsError } = await supabase
        .from('event_levels')
        .select('*')
        .order('year', { ascending: false });

      if (levelsError) {
        console.error('Error fetching event levels:', levelsError);
        return;
      }

      const levelsWithCounts = await Promise.all(
        (levelsData ?? []).map(async (level) => {
          const { count } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('level_id', level.id);

          return { ...level, event_count: count || 0 };
        }),
      );

      setEventLevels(levelsWithCounts as EventLevel[]);
    } catch (error) {
      console.error('Error fetching event levels:', error);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (level?: EventLevel) => {
    if (level) {
      setEditingLevel(level);
      form.setFieldsValue({
        name: level.name,
        year: level.year,
        description: level.description || '',
        is_active: level.is_active,
      });
    } else {
      setEditingLevel(null);
      form.resetFields();
      form.setFieldsValue({ year: new Date().getFullYear(), is_active: true });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLevel(null);
    form.resetFields();
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setSubmitting(true);

      const payload = {
        name: values.name,
        year: values.year,
        description: values.description || null,
        is_active: values.is_active,
      };

      if (editingLevel) {
        const { error } = await supabase
          .from('event_levels')
          .update(payload)
          .eq('id', editingLevel.id);
        if (error) throw error;
        message.success('Event level updated');
      } else {
        const { error } = await supabase.from('event_levels').insert([payload]);
        if (error) throw error;
        message.success('Event level created');
      }

      fetchEventLevels();
      closeModal();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to save event level');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!levelToDelete) return;

    try {
      setSubmitting(true);
      const { error } = await supabase.from('event_levels').delete().eq('id', levelToDelete.id);
      if (error) throw error;

      message.success(`Deleted ${levelToDelete.name} and its events`);
      fetchEventLevels();
      setLevelToDelete(null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to delete event level');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Event level',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: EventLevel) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{name}</div>
          {record.description && (
            <div className="truncate text-caption text-muted-foreground">{record.description}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Year',
      dataIndex: 'year',
      key: 'year',
      width: 100,
      sorter: (a: EventLevel, b: EventLevel) => a.year - b.year,
      render: (year: number) => <span className="tnum text-foreground">{year}</span>,
    },
    {
      title: 'Events',
      dataIndex: 'event_count',
      key: 'event_count',
      width: 110,
      align: 'right' as const,
      render: (count: number) => <span className="tnum text-foreground">{count}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 120,
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
      render: (_: unknown, record: EventLevel) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            aria-label="PencilSimple event level"
            title="PencilSimple event level"
            onClick={() => openModal(record)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-sunken hover:text-foreground"
          >
            <PencilSimple size={15} />
          </button>
          <button
            type="button"
            aria-label="Delete event level"
            title="Delete event level"
            onClick={() => setLevelToDelete(record)}
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
      title="Event levels"
      subtitle="Seasons that group events together"
      maxWidth="wide"
      actions={
        <Button size="sm" icon={<Plus size={15} />} onClick={() => openModal()}>
          <span className="hidden sm:inline">Add level</span>
        </Button>
      }
    >
      <DataTable
        columns={columns}
        dataSource={eventLevels}
        rowKey="id"
        loading={loading}
        scrollX={700}
        toolbar={
          <span className="text-caption text-muted-foreground">
            Only events in an active level can be scored
          </span>
        }
        emptyIcon={<CalendarBlank size={22} />}
        emptyTitle="No event levels yet"
        emptyDescription="Create a level before adding events to it."
        emptyAction={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => openModal()}>
            Add level
          </Button>
        }
      />

      <Sheet
        open={isModalOpen}
        onClose={closeModal}
        dismissable={!submitting}
        title={editingLevel ? 'PencilSimple event level' : 'Add event level'}
        description="Levels group a year's events and control whether they can be scored."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" onClick={closeModal} disabled={submitting}>
              Cancel
            </Button>
            <Button size="lg" block loading={submitting} onClick={() => form.submit()}>
              {editingLevel ? 'Save changes' : 'Create level'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
          <Form.Item
            label="Name"
            name="name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <AntInput placeholder="District level" />
          </Form.Item>

          <Form.Item
            label="Year"
            name="year"
            rules={[{ required: true, message: 'Year is required' }]}
          >
            <InputNumber className="w-full" min={2000} max={2100} />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <AntInput.TextArea rows={2} placeholder="Optional" />
          </Form.Item>

          <Form.Item label="Active" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Sheet>

      <Sheet
        open={Boolean(levelToDelete)}
        onClose={() => setLevelToDelete(null)}
        dismissable={!submitting}
        title={`Delete ${levelToDelete?.name}?`}
        description="This cannot be undone."
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setLevelToDelete(null)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button variant="danger" size="lg" block loading={submitting} onClick={confirmDelete}>
              Delete level
            </Button>
          </div>
        }
      >
        <p className="pb-2 text-body text-muted-foreground">
          Deleting this level also deletes its{' '}
          <span className="font-medium text-foreground">
            {levelToDelete?.event_count ?? 0} events
          </span>{' '}
          along with their criteria, scores and results.
        </p>
      </Sheet>
    </AppShell>
  );
};

export default EventLevelManagement;
