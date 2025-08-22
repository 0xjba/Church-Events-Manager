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
      
      <div className="flex-1 pb-20 md:pb-0">
        <div className="mobile-padding">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
              <h1 className="text-responsive-3xl font-bold text-foreground">
                Judge Assignment
              </h1>
              <p className="text-responsive-sm text-muted-foreground mt-2">
                Assign judges to events and set event order
              </p>
            </div>
            
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto h-12 text-responsive-sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Judge
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] m-4 sm:m-0">
                <DialogHeader>
                  <DialogTitle className="text-responsive-lg">Assign Judge to Event</DialogTitle>
                  <DialogDescription className="text-responsive-sm">
                    Select an event and judge to create an assignment.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-responsive-sm font-medium">Event</Label>
                    <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                      <SelectTrigger className="h-12">
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
                  
                  <div className="space-y-3">
                    <Label className="text-responsive-sm font-medium">Judge</Label>
                    <Select value={selectedJudgeId} onValueChange={setSelectedJudgeId}>
                      <SelectTrigger className="h-12">
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
                  
                  <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsAssignDialogOpen(false)}
                      className="h-12 text-responsive-sm"
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleAssignJudge} className="h-12 text-responsive-sm">
                      Assign Judge
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
            {/* Event Order Management */}
            <Card className="mobile-card">
              <CardHeader>
                <CardTitle className="text-responsive-lg">Event Schedule Order</CardTitle>
                <CardDescription className="text-responsive-sm">
                  Set the order in which events will be conducted
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <p className="text-responsive-sm">Loading...</p>
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-responsive-sm">No events created yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {events.map((event, index) => (
                      <div key={event.id} className="flex items-center justify-between p-4 border border-border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-responsive-sm truncate">{event.name}</div>
                          <div className="text-responsive-xs text-muted-foreground capitalize mt-1">
                            {event.type} • Order: {event.event_order || 'Not set'}
                          </div>
                        </div>
                        <div className="flex space-x-2 ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => moveEventUp(index)}
                            disabled={index === 0}
                            className="h-10 w-10 p-0"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => moveEventDown(index)}
                            disabled={index === events.length - 1}
                            className="h-10 w-10 p-0"
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
            <Card className="mobile-card">
              <CardHeader>
                <CardTitle className="text-responsive-lg">Judge Assignments</CardTitle>
                <CardDescription className="text-responsive-sm">
                  Current judge assignments by event
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <p className="text-responsive-sm">Loading...</p>
                  </div>
                ) : events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-responsive-sm">No events created yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {events.map((event) => (
                      <div key={event.id} className="border border-border rounded-lg p-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-responsive-sm truncate">{event.name}</h4>
                            <Badge variant={event.status === 'active' ? 'default' : 'secondary'} className="mt-2">
                              {event.status}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          {event.event_judges?.length === 0 ? (
                            <div className="text-responsive-sm text-muted-foreground py-4 text-center bg-muted/30 rounded-lg">
                              No judges assigned
                            </div>
                          ) : (
                            event.event_judges?.map((assignment: any) => (
                              <div key={assignment.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-responsive-sm truncate">
                                    {assignment.judges.name}
                                  </div>
                                  <div className="text-responsive-xs text-muted-foreground truncate">
                                    {assignment.judges.church}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUnassignJudge(event.id, assignment.judge_id)}
                                  className="ml-3 h-10 w-10 p-0 flex-shrink-0"
                                >
                                  <Trash2 className="h-4 w-4" />
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