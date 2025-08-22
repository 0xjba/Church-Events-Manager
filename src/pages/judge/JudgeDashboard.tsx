import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Users, Trophy, Clock, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface AssignedEvent {
  id: string;
  name: string;
  type: string;
  status: string;
  time_limit: number | null;
  event_order: number | null;
  participants_count: number;
  my_scores_count: number;
  total_criteria: number;
}

const JudgeDashboard = () => {
  const { profile, isAdmin } = useAuth();
  const [assignedEvents, setAssignedEvents] = useState<AssignedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [judgeId, setJudgeId] = useState<string | null>(null);

  useEffect(() => {
    fetchJudgeData();
  }, [profile]);

  const fetchJudgeData = async () => {
    if (!profile?.id) return;

    try {
      // First get the judge ID
      const { data: judgeData, error: judgeError } = await supabase
        .from('judges')
        .select('id')
        .eq('profile_id', profile.id)
        .single();

      if (judgeError) throw judgeError;
      setJudgeId(judgeData.id);

      // Get assigned events with participant count and scoring progress
      const { data: eventsData, error: eventsError } = await supabase
        .from('event_judges')
        .select(`
          events (
            id,
            name,
            type,
            status,
            time_limit,
            event_order
          )
        `)
        .eq('judge_id', judgeData.id);

      if (eventsError) throw eventsError;

      // For each event, get participant count, criteria count, and judge's scoring progress
      const enrichedEvents = await Promise.all(
        eventsData.map(async (eventJudge: any) => {
          const event = eventJudge.events;
          
          // Get participant count
          const { count: participantCount } = await supabase
            .from('event_participants')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id);

          // Get criteria count
          const { count: criteriaCount } = await supabase
            .from('event_criteria')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id);

          // Get judge's scores count
          const { count: scoresCount } = await supabase
            .from('scores')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id)
            .eq('judge_id', judgeData.id);

          return {
            ...event,
            participants_count: participantCount || 0,
            my_scores_count: scoresCount || 0,
            total_criteria: criteriaCount || 0,
          };
        })
      );

      // Sort by event order
      enrichedEvents.sort((a, b) => {
        if (a.event_order === null && b.event_order === null) return 0;
        if (a.event_order === null) return 1;
        if (b.event_order === null) return -1;
        return a.event_order - b.event_order;
      });

      setAssignedEvents(enrichedEvents);
    } catch (error) {
      toast.error('Failed to load assigned events');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'upcoming':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const getScoringProgress = (event: AssignedEvent) => {
    const expectedScores = event.participants_count * event.total_criteria;
    const actualScores = event.my_scores_count;
    
    if (expectedScores === 0) return 0;
    return Math.round((actualScores / expectedScores) * 100);
  };

  const isEventComplete = (event: AssignedEvent) => {
    return getScoringProgress(event) === 100;
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="w-64 hidden md:block">
        <Navigation />
      </div>
      
      <div className="flex-1 pb-16 md:pb-0">
        <div className="p-4 md:p-6">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Judge Dashboard
            </h1>
            <p className="text-muted-foreground">
              Welcome back, {profile?.full_name}
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Assigned Events
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{assignedEvents.length}</div>
                <p className="text-xs text-muted-foreground">
                  Events to judge
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Events
                </CardTitle>
                <Play className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {assignedEvents.filter(e => e.status === 'active').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ready to score
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Completed
                </CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {assignedEvents.filter(e => isEventComplete(e)).length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Fully scored
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Assigned Events */}
          <Card>
            <CardHeader>
              <CardTitle>My Assigned Events</CardTitle>
              <CardDescription>
                Events you are assigned to judge
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : assignedEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No events assigned yet
                </div>
              ) : (
                <div className="space-y-4">
                  {assignedEvents.map((event) => {
                    const progress = getScoringProgress(event);
                    const isComplete = isEventComplete(event);
                    
                    return (
                      <div key={event.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h3 className="font-medium text-lg">{event.name}</h3>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              <span className="capitalize">{event.type} Performance</span>
                              <span className="flex items-center">
                                <Users className="h-3 w-3 mr-1" />
                                {event.participants_count} participants
                              </span>
                              {event.time_limit && (
                                <span className="flex items-center">
                                  <Clock className="h-3 w-3 mr-1" />
                                  {event.time_limit} min limit
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={getStatusColor(event.status)}>
                              {event.status}
                            </Badge>
                            {event.event_order && (
                              <Badge variant="outline">
                                Order #{event.event_order}
                              </Badge>
                            )}
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-medium">Scoring Progress</span>
                            <span className="text-sm text-muted-foreground">
                              {event.my_scores_count}/{event.participants_count * event.total_criteria} scores
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all ${
                                progress === 100 ? 'bg-green-500' : 'bg-primary'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex justify-between items-center">
                          <div className="text-sm">
                            {isComplete ? (
                              <span className="text-green-600 font-medium">
                                ✓ Scoring Complete
                              </span>
                            ) : event.status === 'active' ? (
                              <span className="text-orange-600 font-medium">
                                Ready to Score
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                {event.status === 'upcoming' ? 'Upcoming' : 'Not Started'}
                              </span>
                            )}
                          </div>
                          
                          {event.status === 'active' ? (
                            <div className="flex space-x-2">
                              <Button asChild>
                                <Link to={`/judge/score/${event.id}`}>
                                  {progress > 0 ? 'Continue Scoring' : 'Start Scoring'}
                                </Link>
                              </Button>
                              {isAdmin && (
                                <Button variant="outline" asChild>
                                  <Link to={`/admin/scoreboard/${event.id}`}>
                                    View Scoreboard
                                  </Link>
                                </Button>
                              )}
                            </div>
                          ) : (
                            <Button variant="outline" disabled>
                              {event.status === 'completed' ? 'View Details' : 'Not Available'}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
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

export default JudgeDashboard;