import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

const criteriaSchema = z.object({
  name: z.string().min(1, 'Criteria name is required'),
  max_score: z.number().min(1).max(100),
  weight: z.number().min(0.1).max(10).default(1),
});

const eventSchema = z.object({
  name: z.string().min(2, 'Event name must be at least 2 characters'),
  type: z.enum(['writing', 'stage']),
  season_id: z.string().min(1, 'Season is required'),
  rules: z.string().optional(),
  time_limit: z.number().optional(),
  max_participants: z.number().optional(),
  criteria: z.array(criteriaSchema).min(1, 'At least one scoring criteria is required'),
});

type EventFormData = z.infer<typeof eventSchema>;

interface Event {
  id: string;
  name: string;
  type: string;
  season_id: string;
  rules: string | null;
  time_limit: number | null;
  max_participants: number | null;
  status: string;
  event_order: number | null;
  created_at: string;
  season?: {
    id: string;
    name: string;
    year: number;
  };
  criteria?: Array<{
    id: string;
    name: string;
    max_score: number;
    weight: number;
  }>;
}

interface Season {
  id: string;
  name: string;
  year: number;
  is_active: boolean;
}

const EventManagement = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: '',
      type: 'stage',
      season_id: '',
      rules: '',
      time_limit: undefined,
      max_participants: undefined,
      criteria: [{ name: 'Overall Performance', max_score: 10, weight: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'criteria',
  });

  useEffect(() => {
    fetchEvents();
    fetchSeasons();
  }, []);

  useEffect(() => {
    // Filter events by selected season
    if (selectedSeasonId === 'all') {
      setFilteredEvents(events);
    } else {
      setFilteredEvents(events.filter(event => event.season_id === selectedSeasonId));
    }
  }, [events, selectedSeasonId]);

  useEffect(() => {
    // Set default season when seasons are loaded and form is in create mode
    if (seasons.length > 0 && !editingEvent) {
      const activeSeason = seasons.find(s => s.is_active);
      const defaultSeasonId = activeSeason?.id || seasons[0]?.id;
      if (defaultSeasonId && !form.getValues('season_id')) {
        form.setValue('season_id', defaultSeasonId);
      }
    }
  }, [seasons, editingEvent, form]);

  const fetchSeasons = async () => {
    try {
      const { data, error } = await supabase
        .from('seasons')
        .select('id, name, year, is_active')
        .order('year', { ascending: false });

      if (error) throw error;
      setSeasons(data || []);
    } catch (error) {
      console.error('Error fetching seasons:', error);
      toast.error('Failed to load seasons');
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          seasons (
            id,
            name,
            year
          ),
          event_criteria (
            id,
            name,
            max_score,
            weight
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: EventFormData) => {
    try {
      if (editingEvent) {
        // Update existing event
        const { error: eventError } = await supabase
          .from('events')
          .update({
            name: data.name,
            type: data.type,
            season_id: data.season_id,
            rules: data.rules,
            time_limit: data.time_limit,
            max_participants: data.max_participants,
          })
          .eq('id', editingEvent.id);

        if (eventError) throw eventError;

        // Delete existing criteria and add new ones
        await supabase
          .from('event_criteria')
          .delete()
          .eq('event_id', editingEvent.id);

        const { error: criteriaError } = await supabase
          .from('event_criteria')
          .insert(
            data.criteria.map(criteria => ({
              event_id: editingEvent.id,
              name: criteria.name,
              max_score: criteria.max_score,
              weight: criteria.weight,
            }))
          );

        if (criteriaError) throw criteriaError;
        toast.success('Event updated successfully');
      } else {
        // Create new event
        const { data: event, error: eventError } = await supabase
          .from('events')
          .insert({
            name: data.name,
            type: data.type,
            season_id: data.season_id,
            rules: data.rules,
            time_limit: data.time_limit,
            max_participants: data.max_participants,
          })
          .select()
          .single();

        if (eventError) throw eventError;

        // Add criteria
        const { error: criteriaError } = await supabase
          .from('event_criteria')
          .insert(
            data.criteria.map(criteria => ({
              event_id: event.id,
              name: criteria.name,
              max_score: criteria.max_score,
              weight: criteria.weight,
            }))
          );

        if (criteriaError) throw criteriaError;
        toast.success('Event created successfully');
      }

      setIsDialogOpen(false);
      form.reset();
      setEditingEvent(null);
      fetchEvents();
    } catch (error) {
      toast.error(editingEvent ? 'Failed to update event' : 'Failed to create event');
    }
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    form.reset({
      name: event.name,
      type: event.type as 'writing' | 'stage',
      season_id: event.season_id,
      rules: event.rules || '',
      time_limit: event.time_limit || undefined,
      max_participants: event.max_participants || undefined,
      criteria: event.criteria || [{ name: 'Overall Performance', max_score: 10, weight: 1 }],
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Event deleted successfully');
      fetchEvents();
    } catch (error) {
      toast.error('Failed to delete event');
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="w-64 hidden md:block">
        <Navigation />
      </div>
      
      <div className="flex-1 pb-16 md:pb-0">
        <div className="p-4 md:p-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Event Management
              </h1>
              <p className="text-muted-foreground">
                Create and manage competition events for your seasons
              </p>
            </div>
            
            <div className="flex flex-col space-y-2 sm:space-y-0 sm:flex-row sm:items-center sm:gap-4">
              <Select value={selectedSeasonId} onValueChange={setSelectedSeasonId}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by season" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Seasons</SelectItem>
                  {seasons.map((season) => (
                    <SelectItem key={season.id} value={season.id}>
                      {season.name} ({season.year})
                      {season.is_active && ' - Active'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button 
                    onClick={() => {
                      setEditingEvent(null);
                      form.reset();
                      // Set default season for new events
                      if (seasons.length > 0) {
                        const activeSeason = seasons.find(s => s.is_active);
                        const defaultSeasonId = activeSeason?.id || seasons[0]?.id;
                        if (defaultSeasonId) {
                          form.setValue('season_id', defaultSeasonId);
                        }
                      }
                    }}
                    className="w-full sm:w-auto shrink-0"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Event
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingEvent ? 'Edit Event' : 'Create New Event'}
                    </DialogTitle>
                    <DialogDescription>
                      Set up event details and scoring criteria.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Event Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="stage">Stage Performance</SelectItem>
                              <SelectItem value="writing">Writing Competition</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="season_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Season</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a season" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {seasons.map((season) => (
                                <SelectItem key={season.id} value={season.id}>
                                  {season.name} ({season.year})
                                  {season.is_active && ' - Active'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="time_limit"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Time Limit (minutes)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="Optional"
                                {...field} 
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="max_participants"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Participants</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="Optional"
                                {...field} 
                                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="rules"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rules & Instructions</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Optional event rules and instructions" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <FormLabel>Scoring Criteria</FormLabel>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => append({ name: '', max_score: 10, weight: 1 })}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Criteria
                        </Button>
                      </div>
                      
                      <div className="space-y-3">
                        {fields.map((field, index) => (
                          <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                            <div className="col-span-5">
                              <FormField
                                control={form.control}
                                name={`criteria.${index}.name`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input {...field} placeholder="Criteria name" />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <div className="col-span-3">
                              <FormField
                                control={form.control}
                                name={`criteria.${index}.max_score`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input 
                                        type="number" 
                                        placeholder="Max score"
                                        {...field} 
                                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <div className="col-span-3">
                              <FormField
                                control={form.control}
                                name={`criteria.${index}.weight`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormControl>
                                      <Input 
                                        type="number" 
                                        step="0.1"
                                        placeholder="Weight"
                                        {...field} 
                                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            
                            <div className="col-span-1">
                              {fields.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => remove(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingEvent ? 'Update' : 'Create'} Event
                      </Button>
                    </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Events</CardTitle>
              <CardDescription>
                All competition events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {selectedSeasonId === 'all' 
                    ? 'No events found. Create your first event to get started.'
                    : 'No events found for the selected season.'
                  }
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Season</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Time Limit</TableHead>
                        <TableHead>Max Participants</TableHead>
                        <TableHead>Criteria Count</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEvents.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">
                            {event.name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{event.season ? `${event.season.name} (${event.season.year})` : 'No Season'}</span>
                              {event.season && seasons.find(s => s.id === event.season_id)?.is_active && (
                                <Badge variant="secondary" className="text-xs">Active</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{event.type}</TableCell>
                          <TableCell>
                            <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>
                              {event.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {event.time_limit ? `${event.time_limit} min` : 'No limit'}
                          </TableCell>
                          <TableCell>
                            {event.max_participants || 'Unlimited'}
                          </TableCell>
                          <TableCell>
                            {event.criteria?.length || 0}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(event)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(event.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="md:hidden">
        <Navigation />
      </div>
    </div>
  );
};

export default EventManagement;