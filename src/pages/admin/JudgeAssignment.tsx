import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

interface Event {
  id: string;
  name: string;
  type: string;
  status: string;
  event_order: number | null;
  event_judges?: Array<{
    id: string;
    judge_id: string;
    assigned_at: string;
    judges: {
      id: string;
      name: string;
      church: string;
    };
  }>;
}

interface Judge {
  id: string;
  name: string;
  church: string;
}

interface EventJudge {
  id: string;
  event_id: string;
  judge_id: string;
  assigned_at: string;
}

const JudgeAssignment = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedJudgeId, setSelectedJudgeId] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch events with their assigned judges
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select(`
          *,
          event_judges (
            id,
            judge_id,
            assigned_at,
            judges (
              id,
              name,
              church
            )
          )
        `)
        .order('event_order', { ascending: true, nullsFirst: false });

      if (eventsError) throw eventsError;

      // Fetch all judges
      const { data: judgesData, error: judgesError } = await supabase
        .from('judges')
        .select('*')
        .order('name');

      if (judgesError) throw judgesError;

      setEvents(eventsData || []);
      setJudges(judgesData || []);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignJudge = async () => {
    if (!selectedEventId || !selectedJudgeId) {
      toast.error('Please select both event and judge');
      return;
    }

    try {
      const { error } = await supabase
        .from('event_judges')
        .insert({
          event_id: selectedEventId,
          judge_id: selectedJudgeId,
        });

      if (error) throw error;
      
      toast.success('Judge assigned successfully');
      setIsAssignDialogOpen(false);
      setSelectedEventId('');
      setSelectedJudgeId('');
      fetchData();
    } catch (error) {
      toast.error('Failed to assign judge');
    }
  };

  const handleUnassignJudge = async (eventId: string, judgeId: string) => {
    if (!confirm('Are you sure you want to unassign this judge?')) return;

    try {
      const { error } = await supabase
        .from('event_judges')
        .delete()
        .eq('event_id', eventId)
        .eq('judge_id', judgeId);

      if (error) throw error;
      
      toast.success('Judge unassigned successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to unassign judge');
    }
  };

  const handleUpdateEventOrder = async (eventId: string, order: number) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ event_order: order })
        .eq('id', eventId);

      if (error) throw error;
      
      fetchData();
    } catch (error) {
      toast.error('Failed to update event order');
    }
  };

  const moveEventUp = (eventIndex: number) => {
    if (eventIndex === 0) return;
    
    const currentEvent = events[eventIndex];
    const previousEvent = events[eventIndex - 1];
    
    handleUpdateEventOrder(currentEvent.id, (previousEvent.event_order || 0) - 1);
  };

  const moveEventDown = (eventIndex: number) => {
    if (eventIndex === events.length - 1) return;
    
    const currentEvent = events[eventIndex];
    const nextEvent = events[eventIndex + 1];
    
    handleUpdateEventOrder(currentEvent.id, (nextEvent.event_order || 0) + 1);
  };

  const getAvailableJudges = (eventId: string) => {
    const assignedJudgeIdsForEvent = events
      .find(e => e.id === eventId)
      ?.event_judges?.map((ej: any) => ej.judge_id) || [];
    
    return judges.filter(judge => !assignedJudgeIdsForEvent.includes(judge.id));
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="w-64 hidden md:block">
        <Navigation />
      </div>
      
      <div className="flex-1 pb-16 md:pb-0">
        <div className="p-4 md:p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Judge Assignment
              </h1>
              <p className="text-muted-foreground">
                Assign judges to events and set event order
              </p>
            </div>
            
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Judge
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Assign Judge to Event</DialogTitle>
                  <DialogDescription>
                    Select an event and judge to create an assignment.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label>Event</Label>
                    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select event" />
                      </SelectTrigger>
                      <SelectContent>
                        {events.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Judge</Label>
                    <Select value={selectedJudgeId} onValueChange={setSelectedJudgeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select judge" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedEventId && getAvailableJudges(selectedEventId).map((judge) => (
                          <SelectItem key={judge.id} value={judge.id}>
                            {judge.name} - {judge.church}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsAssignDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleAssignJudge}>
                      Assign Judge
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Event Order Management */}
            <Card>
              <CardHeader>
                <CardTitle>Event Schedule Order</CardTitle>
                <CardDescription>
                  Set the order in which events will be conducted
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No events created yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {events.map((event, index) => (
                      <div key={event.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                        <div>
                          <div className="font-medium">{event.name}</div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {event.type} • Order: {event.event_order || 'Not set'}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => moveEventUp(index)}
                            disabled={index === 0}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => moveEventDown(index)}
                            disabled={index === events.length - 1}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Judge Assignments */}
            <Card>
              <CardHeader>
                <CardTitle>Judge Assignments</CardTitle>
                <CardDescription>
                  Current judge assignments by event
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Loading...</div>
                ) : events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No events created yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {events.map((event) => (
                      <div key={event.id} className="border border-border rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <h4 className="font-medium">{event.name}</h4>
                            <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>
                              {event.status}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          {event.event_judges?.length === 0 ? (
                            <div className="text-sm text-muted-foreground py-2">
                              No judges assigned
                            </div>
                          ) : (
                            event.event_judges?.map((assignment: any) => (
                              <div key={assignment.id} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                                <div>
                                  <div className="font-medium text-sm">
                                    {assignment.judges.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {assignment.judges.church}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUnassignJudge(event.id, assignment.judge_id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <Navigation />
      </div>
    </div>
  );
};

export default JudgeAssignment;