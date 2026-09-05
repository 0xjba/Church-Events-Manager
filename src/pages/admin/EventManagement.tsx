import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input as AntInput, InputNumber, Modal, Select, message } from 'antd';
import { CalendarBlank, Copy, Eye, FileCsv, PencilSimple, Plus, Trash, UploadSimple, X } from '@phosphor-icons/react';
import { supabase } from '@/integrations/supabase/client';
import type { FormValues } from '@/lib/types';
import { AppShell } from '@/components/shell/AppShell';
import { DataTable } from '@/components/admin/DataTable';
import { Toolbar } from '@/components/admin/Toolbar';
import { Button, ProgressBar, StatusPill, statusTone } from '@/components/ui/primitives';
import { SearchInput } from '@/components/ui/inputs';
import { ImportIssues, ImportPanel, ImportSummary } from '@/components/admin/ImportPanel';
import { parseCsv } from '@/utils/csv';
import { TEMPLATES } from '@/utils/importTemplates';
import { parseEventRows, type ParsedEvent } from '@/utils/importEvents';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/utils';

interface EventRecord {
  id: string;
  name: string;
  type: string;
  event_type: string;
  level_id: string;
  age_category: string | null;
  rules: string | null;
  time_limit: number | null;
  max_participants: number | null;
  status: string;
  event_order: number | null;
  created_at: string;
  event_levels?: { id: string; name: string; year: number };
  event_criteria?: Array<{ id: string; name: string; max_score: number; weight: number }>;
}

interface EventLevel {
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

type AgeCategory = 'Sub Juniors' | 'Juniors' | 'Intermediates' | 'Seniors';

const AGE_CATEGORIES: AgeCategory[] = ['Sub Juniors', 'Juniors', 'Intermediates', 'Seniors'];
const STATUSES = ['upcoming', 'active', 'completed'];

const EventManagement = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [eventLevels, setEventLevels] = useState<EventLevel[]>([]);
  const [selectedLevelId, setSelectedLevelId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [duplicatingEvent, setDuplicatingEvent] = useState<EventRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();
  const [criteria, setCriteria] = useState<Criteria[]>([{ name: '', max_score: 10, weight: 1.0 }]);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const [isEventImportOpen, setIsEventImportOpen] = useState(false);
  const [eventImportLevel, setEventImportLevel] = useState<string>('');
  const [eventImportFile, setEventImportFile] = useState<File | null>(null);
  const [parsedEvents, setParsedEvents] = useState<ParsedEvent[]>([]);
  const [eventImportErrors, setEventImportErrors] = useState<string[]>([]);
  const [importingEvents, setImportingEvents] = useState(false);

  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    success: number;
    skipped: number;
    errors: Array<{ chest_number: string; error: string }>;
  } | null>(null);

  useEffect(() => {
    fetchEvents();
    fetchEventLevels();
  }, []);

  const fetchEventLevels = async () => {
    try {
      // An inactive level is put away: it and everything under it disappear
      // from every screen except the event levels page itself.
      const { data, error } = await supabase
        .from('event_levels')
        .select('id, name, year, is_active')
        .eq('is_active', true)
        .order('year', { ascending: false });

      if (error) throw error;
      setEventLevels(data || []);
    } catch (error) {
      console.error('Error fetching event levels:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(
          `*, event_levels!inner (id, name, year, is_active),
           event_criteria (id, name, max_score, weight)`,
        )
        .eq('event_levels.is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents((data || []) as unknown as EventRecord[]);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const levelOf = (event: EventRecord) => eventLevels.find((level) => level.id === event.level_id);

  const visibleEvents = useMemo(() => {
    const byLevel =
      selectedLevelId === 'all'
        ? events
        : events.filter((event) => event.level_id === selectedLevelId);

    const query = search.trim().toLowerCase();
    if (!query) return byLevel;
    return byLevel.filter((event) =>
      [event.name, event.age_category, event.type].filter(Boolean).some((field) =>
        String(field).toLowerCase().includes(query),
      ),
    );
  }, [events, selectedLevelId, search]);

  /* ------------------------------------------------------- event form */

  const openModal = (event?: EventRecord, isDuplicating = false) => {
    if (event) {
      const eventCriteria = event.event_criteria ?? [];
      const nextCriteria =
        eventCriteria.length > 0
          ? eventCriteria.map((criterion) => ({
              name: criterion.name,
              max_score: criterion.max_score,
              weight: criterion.weight,
            }))
          : [{ name: '', max_score: 10, weight: 1.0 }];

      if (isDuplicating) {
        setDuplicatingEvent(event);
        setEditingEvent(null);
      } else {
        setEditingEvent(event);
        setDuplicatingEvent(null);
      }

      form.setFieldsValue({
        name: isDuplicating ? `${event.name} (Copy)` : event.name,
        type: event.type,
        event_type: event.event_type || 'individual',
        level_id: event.level_id,
        age_category: event.age_category,
        rules: event.rules || '',
        time_limit: event.time_limit || undefined,
        max_participants: event.max_participants || undefined,
        status: isDuplicating ? 'upcoming' : event.status,
        event_order: event.event_order || undefined,
      });
      setCriteria(nextCriteria);
    } else {
      setEditingEvent(null);
      setDuplicatingEvent(null);
      form.resetFields();
      form.setFieldsValue({ event_type: 'individual', type: 'stage', status: 'upcoming' });
      setCriteria([{ name: '', max_score: 10, weight: 1.0 }]);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingEvent(null);
    setDuplicatingEvent(null);
    form.resetFields();
    setCriteria([{ name: '', max_score: 10, weight: 1.0 }]);
  };

  const replaceCriteria = async (eventId: string, list: Criteria[]) => {
    await supabase.from('event_criteria').delete().eq('event_id', eventId);

    if (list.length > 0) {
      const { error } = await supabase.from('event_criteria').insert(
        list.map((criterion) => ({
          event_id: eventId,
          name: criterion.name,
          max_score: criterion.max_score,
          weight: criterion.weight,
        })),
      );
      if (error) throw error;
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setSubmitting(true);

      if (!criteria.length || criteria.some((criterion) => !criterion.name.trim())) {
        message.error('Every criterion needs a name');
        return;
      }

      if (!editingEvent) {
        const level = eventLevels.find((candidate) => candidate.id === values.level_id);
        if (level && !level.is_active) {
          message.error('Cannot create events in an inactive event level');
          return;
        }
      }

      const payload = {
        name: values.name,
        type: values.type,
        event_type: values.event_type,
        level_id: values.level_id,
        age_category: values.age_category || null,
        rules: values.rules || null,
        time_limit: values.time_limit || null,
        max_participants: values.max_participants || null,
        status: values.status,
        event_order: values.event_order || null,
      };

      if (editingEvent) {
        const { error } = await supabase.from('events').update(payload).eq('id', editingEvent.id);
        if (error) throw error;
        await replaceCriteria(editingEvent.id, criteria);
        message.success('Event updated');
      } else {
        const { data: newEvent, error } = await supabase
          .from('events')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        await replaceCriteria(newEvent.id, criteria);
        message.success(duplicatingEvent ? 'Event duplicated' : 'Event created');
      }

      closeModal();
      fetchEvents();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to save event');
    } finally {
      setSubmitting(false);
    }
  };

  const addCriteria = () => setCriteria((list) => [...list, { name: '', max_score: 10, weight: 1.0 }]);

  const removeCriteria = (index: number) =>
    setCriteria((list) => (list.length > 1 ? list.filter((_, position) => position !== index) : list));

  const updateCriteria = (index: number, field: keyof Criteria, value: string | number) =>
    setCriteria((list) =>
      list.map((criterion, position) =>
        position === index ? { ...criterion, [field]: value } : criterion,
      ),
    );

  /* --------------------------------------------------------- actions */

  const deleteEvent = (event: EventRecord) => {
    Modal.confirm({
      title: `Delete ${event.name}?`,
      content: 'Criteria, entrants, scores and results for this event are deleted too.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const { error } = await supabase.from('events').delete().eq('id', event.id);
          if (error) throw error;
          message.success('Event deleted');
          fetchEvents();
        } catch (error) {
          message.error(error instanceof Error ? error.message : 'Failed to delete event');
        }
      },
    });
  };

  const updateEventStatus = async (eventId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('events').update({ status: newStatus }).eq('id', eventId);
      if (error) throw error;
      message.success('Status updated');
      fetchEvents();
    } catch {
      message.error('Failed to update event status');
    }
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) return;

    Modal.confirm({
      title: `Delete ${selectedRowKeys.length} event(s)?`,
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          setBatchDeleting(true);
          const { error } = await supabase
            .from('events')
            .delete()
            .in('id', selectedRowKeys.map(String));

          if (error) throw error;
          message.success(`Deleted ${selectedRowKeys.length} event(s)`);
          setSelectedRowKeys([]);
          fetchEvents();
        } catch (error) {
          message.error(error instanceof Error ? error.message : 'Failed to delete events');
        } finally {
          setBatchDeleting(false);
        }
      },
    });
  };

  /* --------------------------------------------------- event import */

  const resetEventImport = () => {
    setEventImportFile(null);
    setParsedEvents([]);
    setEventImportErrors([]);
  };

  const openEventImport = () => {
    setEventImportLevel(
      selectedLevelId !== 'all'
        ? selectedLevelId
        : eventLevels.find((level) => level.is_active)?.id ?? eventLevels[0]?.id ?? '',
    );
    resetEventImport();
    setIsEventImportOpen(true);
  };

  const handleEventImportFile = async (file: File) => {
    try {
      setImportingEvents(true);

      const parsed = parseCsv(await file.text(), [
        'event_name', 'age_category', 'event_format', 'entrant_type', 'criterion_name', 'criterion_max',
      ]);

      // Only events already in the target level count as duplicates.
      const existing = events
        .filter((event) => event.level_id === eventImportLevel)
        .map((event) => ({ name: event.name, age_category: event.age_category }));

      const { events: parsedList, errors } = parseEventRows(parsed.rows, existing);

      setEventImportFile(file);
      setParsedEvents(parsedList);
      setEventImportErrors(errors);

      if (errors.length > 0) message.warning(`${errors.length} problems to fix before import`);
      else message.success(`${parsedList.length} events ready to import`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Could not read that file');
    } finally {
      setImportingEvents(false);
    }
  };

  const runEventImport = async () => {
    try {
      setImportingEvents(true);

      const { data: created, error } = await supabase
        .from('events')
        .insert(parsedEvents.map((event) => ({
          name: event.name,
          type: event.type,
          event_type: event.event_type,
          level_id: eventImportLevel,
          age_category: event.age_category as AgeCategory | null,
          rules: event.rules,
          time_limit: event.time_limit,
          max_participants: event.max_participants,
          status: 'upcoming',
          event_order: event.event_order,
        })))
        .select();

      if (error) throw new Error(error.message);

      try {
        const criteria = created.flatMap((event) => {
          const source = parsedEvents.find(
            (candidate) =>
              candidate.name === event.name && (candidate.age_category ?? null) === event.age_category,
          );
          if (!source) throw new Error(`Could not match criteria to ${event.name}`);

          return source.criteria.map((criterion) => ({
            event_id: event.id,
            name: criterion.name,
            max_score: criterion.max_score,
            weight: criterion.weight,
          }));
        });

        const { error: criteriaError } = await supabase.from('event_criteria').insert(criteria);
        if (criteriaError) throw new Error(criteriaError.message);
      } catch (criteriaError) {
        // An event without criteria cannot be scored, so it should not survive.
        await supabase.from('events').delete().in('id', created.map((event) => event.id));
        throw criteriaError;
      }

      message.success(`Imported ${created.length} events`);
      setIsEventImportOpen(false);
      resetEventImport();
      fetchEvents();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to import events');
    } finally {
      setImportingEvents(false);
    }
  };

  /* ---------------------------------------------------- bulk import */

  const parseCSV = (csvText: string) => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map((header) => header.trim());

    if (headers[0] !== 'chest_number' || headers[1] !== 'age_category' || headers[2] !== 'events') {
      throw new Error('CSV must have columns: chest_number, age_category, events');
    }

    // Event lists are quoted, so a naive split on commas would break them.
    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (const character of line) {
        if (character === '"') inQuotes = !inQuotes;
        else if (character === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else current += character;
      }
      result.push(current.trim());
      return result;
    };

    return lines.slice(1).map((line) => {
      const [chest_number, age_category, eventList] = parseLine(line);
      return {
        chest_number,
        age_category,
        events: (eventList ?? '')
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean),
      };
    });
  };

  const handleBulkImport = async (file: File) => {
    try {
      setBulkImportLoading(true);
      setImportProgress(0);
      setImportResults(null);

      const csvData = parseCSV(await file.text());

      const { data: allEvents, error: eventsError } = await supabase
        .from('events')
        .select('id, name, age_category')
        .eq('event_type', 'individual');
      if (eventsError) throw eventsError;

      const eventMap = new Map<string, { id: string }>();
      allEvents?.forEach((event) => {
        eventMap.set(`${event.name.toLowerCase()}-${event.age_category || 'no-category'}`, event);
      });

      const { data: allParticipants, error: participantsError } = await supabase
        .from('participants')
        .select('id, chest_number, age_category');
      if (participantsError) throw participantsError;

      const participantMap = new Map<string, { id: string; age_category: string }>();
      allParticipants?.forEach((participant) => {
        participantMap.set(participant.chest_number, participant as { id: string; age_category: string });
      });

      const { data: existingEventParticipants, error: existingError } = await supabase
        .from('event_participants')
        .select('event_id, participant_id');
      if (existingError) throw existingError;

      const existingCombinations = new Set<string>();
      existingEventParticipants?.forEach((row) => {
        existingCombinations.add(`${row.event_id}-${row.participant_id}`);
      });

      const results = {
        success: 0,
        skipped: 0,
        errors: [] as Array<{ chest_number: string; error: string }>,
      };

      for (let index = 0; index < csvData.length; index++) {
        const { chest_number, age_category, events: eventNames } = csvData[index];

        const participant = participantMap.get(chest_number);
        if (!participant) {
          results.errors.push({ chest_number, error: 'Participant not found' });
        } else if (participant.age_category !== age_category) {
          results.errors.push({
            chest_number,
            error: `Age category mismatch. CSV: ${age_category}, participant: ${participant.age_category}`,
          });
        } else {
          for (const eventName of eventNames) {
            const event = eventMap.get(`${eventName.toLowerCase()}-${age_category}`);
            if (!event) {
              results.errors.push({
                chest_number,
                error: `Event not found: ${eventName} (${age_category})`,
              });
              continue;
            }

            const combinationKey = `${event.id}-${participant.id}`;
            if (existingCombinations.has(combinationKey)) {
              results.skipped++;
              continue;
            }

            const { error: insertError } = await supabase
              .from('event_participants')
              .insert({ event_id: event.id, participant_id: participant.id });

            if (insertError) {
              results.errors.push({
                chest_number,
                error: `Failed to add to ${eventName}: ${insertError.message}`,
              });
            } else {
              results.success++;
              existingCombinations.add(combinationKey);
            }
          }
        }

        setImportProgress(Math.round(((index + 1) / csvData.length) * 100));
      }

      setImportResults(results);

      if (results.success > 0) message.success(`Added ${results.success} entries`);
      if (results.skipped > 0) message.info(`${results.skipped} already registered`);
      if (results.errors.length > 0) message.error(`${results.errors.length} rows failed`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to import CSV');
    } finally {
      setBulkImportLoading(false);
    }
  };

  const closeBulkImportModal = () => {
    setIsBulkImportModalOpen(false);
    setImportResults(null);
    setImportProgress(0);
  };

  /* ----------------------------------------------------------- table */

  const columns = [
    {
      title: 'Event',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: EventRecord, b: EventRecord) => a.name.localeCompare(b.name),
      render: (name: string, record: EventRecord) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {record.event_order !== null && (
              <span className="tnum rounded bg-muted px-1.5 text-caption font-semibold text-muted-foreground">
                #{record.event_order}
              </span>
            )}
            <span className="truncate font-medium text-foreground">{name}</span>
          </div>
          <div className="truncate text-caption capitalize text-muted-foreground">
            {record.type} · {record.event_type} · {record.event_criteria?.length ?? 0} criteria
          </div>
        </div>
      ),
    },
    {
      title: 'Level',
      dataIndex: ['event_levels', 'name'],
      key: 'level',
      width: 170,
      render: (_: unknown, record: EventRecord) => (
        <div className="min-w-0 truncate text-foreground">{record.event_levels?.name ?? '—'}</div>
      ),
    },
    {
      title: 'Age category',
      dataIndex: 'age_category',
      key: 'age_category',
      width: 150,
      filters: AGE_CATEGORIES.map((category) => ({ text: category, value: category })),
      onFilter: (value: unknown, record: EventRecord) => record.age_category === value,
      render: (category: string | null) =>
        category ? <StatusPill>{category}</StatusPill> : <span className="text-muted-foreground">All</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: string, record: EventRecord) => (
        <Select
          value={status}
          onChange={(value) => updateEventStatus(record.id, value)}
          size="small"
          className="w-full"
          options={STATUSES.map((option) => ({
            value: option,
            label: <span className="capitalize">{option}</span>,
          }))}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: EventRecord) => (
        <div className="flex justify-end gap-1">
          <RowButton
            label="Open event"
            icon={<Eye size={15} />}
            onClick={() => navigate(`/admin/events/${record.id}`)}
          />
          <RowButton
            label="Edit event"
            icon={<PencilSimple size={15} />}
            onClick={() => openModal(record)}
          />
          <RowButton
            label="Duplicate event"
            icon={<Copy size={15} />}
            onClick={() => openModal(record, true)}
          />
          <RowButton
            label="Delete event"
            icon={<Trash size={15} />}
            danger
            onClick={() => deleteEvent(record)}
          />
        </div>
      ),
    },
  ];

  return (
    <AppShell
      variant="admin"
      title="Events"
      subtitle={`${events.length} events across ${eventLevels.length} levels`}
      maxWidth="wide"
      actions={
        <>
          <Button
            variant="secondary"
            size="sm"
            icon={<UploadSimple size={15} />}
            onClick={openEventImport}
          >
            <span className="hidden sm:inline">Import events</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<UploadSimple size={15} />}
            onClick={() => setIsBulkImportModalOpen(true)}
          >
            <span className="hidden sm:inline">Import event participants</span>
          </Button>
          <Button size="sm" icon={<Plus size={15} />} onClick={() => openModal()}>
            <span className="hidden sm:inline">Add event</span>
          </Button>
        </>
      }
    >
      <DataTable
        columns={columns}
        dataSource={visibleEvents}
        rowKey="id"
        loading={loading}
        scrollX={980}
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
              placeholder="Search events"
              className="w-full max-w-xs"
            />
            <Select
              value={selectedLevelId}
              onChange={setSelectedLevelId}
              className="w-48"
              options={[
                { value: 'all', label: 'All event levels' },
                ...eventLevels.map((level) => ({
                  value: level.id,
                  label: `${level.name} ${level.year}`,
                })),
              ]}
            />
          </Toolbar>
        }
        emptyIcon={<CalendarBlank size={22} />}
        emptyTitle={search || selectedLevelId !== 'all' ? 'No matching events' : 'No events yet'}
        emptyDescription={
          search || selectedLevelId !== 'all'
            ? 'Try a different search or event level.'
            : 'Create an event and give it scoring criteria.'
        }
        emptyAction={
          <Button size="sm" icon={<Plus size={14} />} onClick={() => openModal()}>
            Add event
          </Button>
        }
      />

      {/* ------------------------------------------------ event form */}
      <Sheet
        open={isModalOpen}
        onClose={closeModal}
        dismissable={!submitting}
        size="lg"
        title={editingEvent ? 'Edit event' : duplicatingEvent ? 'Duplicate event' : 'Add event'}
        description="Criteria decide what judges score and how much each part counts."
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" onClick={closeModal} disabled={submitting}>
              Cancel
            </Button>
            <Button size="lg" block loading={submitting} onClick={() => form.submit()}>
              {editingEvent ? 'Save changes' : 'Create event'}
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={onSubmit} requiredMark={false}>
          <Form.Item
            label="Event name"
            name="name"
            rules={[{ required: true, message: 'Event name is required' }]}
          >
            <AntInput placeholder="Solo Song Female" />
          </Form.Item>

          <div className="grid gap-3 sm:grid-cols-2">
            <Form.Item
              label="Format"
              name="type"
              rules={[{ required: true, message: 'Format is required' }]}
            >
              <Select
                options={[
                  { value: 'stage', label: 'Stage' },
                  { value: 'writing', label: 'Writing' },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="Entrant"
              name="event_type"
              rules={[{ required: true, message: 'Entrant type is required' }]}
            >
              <Select
                options={[
                  { value: 'individual', label: 'Individual' },
                  { value: 'group', label: 'Group' },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="Event level"
              name="level_id"
              rules={[{ required: true, message: 'Event level is required' }]}
            >
              <Select
                placeholder="Select level"
                options={eventLevels.map((level) => ({
                  value: level.id,
                  label: `${level.name} ${level.year}`,
                }))}
              />
            </Form.Item>

            <Form.Item label="Age category" name="age_category">
              <Select
                allowClear
                placeholder="All categories"
                options={AGE_CATEGORIES.map((category) => ({ value: category, label: category }))}
              />
            </Form.Item>

            <Form.Item
              label="Status"
              name="status"
              rules={[{ required: true, message: 'Status is required' }]}
            >
              <Select
                options={STATUSES.map((status) => ({
                  value: status,
                  label: <span className="capitalize">{status}</span>,
                }))}
              />
            </Form.Item>

            <Form.Item label="Running order" name="event_order">
              <InputNumber className="w-full" min={1} placeholder="Optional" />
            </Form.Item>

            <Form.Item label="Time limit (minutes)" name="time_limit">
              <InputNumber className="w-full" min={1} placeholder="Optional" />
            </Form.Item>

            <Form.Item label="Max participants" name="max_participants">
              <InputNumber className="w-full" min={1} placeholder="Optional" />
            </Form.Item>
          </div>

          <Form.Item label="Rules" name="rules">
            <AntInput.TextArea rows={2} placeholder="Optional notes shown to organisers" />
          </Form.Item>
        </Form>

        <div className="mb-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-caption font-medium text-foreground">Scoring criteria</p>
              <p className="text-caption text-muted-foreground">
                Judges score each criterion out of its maximum.
              </p>
            </div>
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={addCriteria}>
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {criteria.map((criterion, index) => (
              <div
                key={index}
                className="flex items-end gap-2 rounded-xl border border-border bg-surface-sunken p-2.5"
              >
                <label className="min-w-0 flex-1">
                  <span className="mb-1 block text-caption text-muted-foreground">Name</span>
                  <AntInput
                    value={criterion.name}
                    onChange={(changeEvent) => updateCriteria(index, 'name', changeEvent.target.value)}
                    placeholder="Voice quality"
                  />
                </label>
                <label className="w-20">
                  <span className="mb-1 block text-caption text-muted-foreground">Max</span>
                  <InputNumber
                    className="w-full"
                    min={1}
                    value={criterion.max_score}
                    onChange={(value) => updateCriteria(index, 'max_score', Number(value ?? 10))}
                  />
                </label>
                <label className="w-20">
                  <span className="mb-1 block text-caption text-muted-foreground">Weight</span>
                  <InputNumber
                    className="w-full"
                    min={0.1}
                    step={0.1}
                    value={criterion.weight}
                    onChange={(value) => updateCriteria(index, 'weight', Number(value ?? 1))}
                  />
                </label>
                <button
                  type="button"
                  aria-label="Remove criterion"
                  disabled={criteria.length === 1}
                  onClick={() => removeCriteria(index)}
                  className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive-soft hover:text-destructive disabled:opacity-40"
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet
        open={isEventImportOpen}
        onClose={() => {
          setIsEventImportOpen(false);
          resetEventImport();
        }}
        dismissable={!importingEvents}
        size="lg"
        title="Import events"
        description="One row per criterion; rows sharing an event name and age category build one event."
        footer={
          eventImportFile ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="lg" onClick={resetEventImport} disabled={importingEvents}>
                Change file
              </Button>
              <Button
                size="lg"
                block
                loading={importingEvents}
                disabled={eventImportErrors.length > 0 || parsedEvents.length === 0}
                onClick={runEventImport}
              >
                Import {parsedEvents.length} events
              </Button>
            </div>
          ) : undefined
        }
      >
        <div className="mb-3">
          <label className="mb-1.5 block text-caption font-medium text-foreground">Event level</label>
          <Select
            value={eventImportLevel || undefined}
            onChange={(value) => {
              setEventImportLevel(value);
              resetEventImport();
            }}
            className="w-full"
            placeholder="Which level do these events belong to?"
            options={eventLevels.map((level) => ({
              value: level.id,
              label: `${level.name} ${level.year}`,
            }))}
          />
        </div>

        {!eventImportFile ? (
          <ImportPanel
            template="events"
            onFile={handleEventImportFile}
            disabled={importingEvents || !eventImportLevel}
          />
        ) : (
          <div className="space-y-3">
            <ImportSummary file={eventImportFile} rows={parsedEvents.length} label="events" />
            <ImportIssues
              errors={eventImportErrors}
              title={`${eventImportErrors.length} problems — fix these and upload again`}
            />

            {eventImportErrors.length === 0 && (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {parsedEvents.map((event) => (
                  <li key={`${event.name}-${event.age_category}`} className="px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-body font-medium text-foreground">
                        {event.name}
                      </span>
                      <span className="shrink-0 text-caption capitalize text-muted-foreground">
                        {event.age_category ?? 'All categories'} · {event.type} · {event.event_type}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-caption text-muted-foreground">
                      {event.criteria
                        .map((criterion) => `${criterion.name} /${criterion.max_score}`)
                        .join(' · ')}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <p className="pb-2 text-caption text-muted-foreground">
              Imported events start as upcoming, with no judges or entrants attached yet.
            </p>
          </div>
        )}
      </Sheet>

      {/* --------------------------------------------- entrant import */}
      <Sheet
        open={isBulkImportModalOpen}
        onClose={closeBulkImportModal}
        dismissable={!bulkImportLoading}
        size="lg"
        title="Import event participants"
        description="Adds participants who already exist to events that already exist."
        footer={
          importResults ? (
            <Button size="lg" block onClick={closeBulkImportModal}>
              Done
            </Button>
          ) : undefined
        }
      >
        <ImportPanel
          template="eventParticipants"
          onFile={handleBulkImport}
          disabled={bulkImportLoading || Boolean(importResults)}
        />

        {bulkImportLoading && (
          <div className="mb-3">
            <p className="mb-2 text-caption text-muted-foreground">
              Processing… {importProgress}%
            </p>
            <ProgressBar value={importProgress} />
          </div>
        )}

        {importResults && (
          <div className="mb-2 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <ResultTile label="Added" value={importResults.success} tone="success" />
              <ResultTile label="Already in" value={importResults.skipped} tone="warning" />
              <ResultTile label="Failed" value={importResults.errors.length} tone="danger" />
            </div>

            {importResults.errors.length > 0 && (
              <div className="rounded-xl border border-destructive/30 bg-destructive-soft p-3">
                <p className="mb-1 text-caption font-semibold text-destructive">Errors</p>
                <ul className="scrollbar-thin max-h-48 space-y-0.5 overflow-y-auto">
                  {importResults.errors.map((error, index) => (
                    <li key={`${error.chest_number}-${index}`} className="text-caption text-destructive/90">
                      <span className="font-medium">#{error.chest_number}</span>: {error.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </AppShell>
  );
};

const RowButton = ({
  label,
  icon,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:text-muted-foreground/45 disabled:hover:bg-transparent',
      danger
        ? 'text-muted-foreground hover:bg-destructive-soft hover:text-destructive'
        : 'text-muted-foreground hover:bg-surface-sunken hover:text-foreground',
    )}
  >
    {icon}
  </button>
);

const ResultTile = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'success' | 'warning' | 'danger';
}) => (
  <div
    className={cn(
      'rounded-xl p-3 text-center',
      tone === 'success' && 'bg-success-soft text-success',
      tone === 'warning' && 'bg-warning-soft text-warning',
      tone === 'danger' && 'bg-destructive-soft text-destructive',
    )}
  >
    <p className="tnum text-title font-semibold">{value}</p>
    <p className="text-caption">{label}</p>
  </div>
);

export default EventManagement;
