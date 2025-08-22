import { useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Users, Trophy } from 'lucide-react';

const JudgeDashboard = () => {
  const { profile } = useAuth();

  // Mock data - will be replaced with real data
  const assignedEvents = [
    {
      id: '1',
      name: 'Youth Choir Competition',
      type: 'stage',
      status: 'upcoming',
      participantCount: 12,
      startTime: '10:00 AM',
      maxScore: 50
    },
    {
      id: '2',
      name: 'Scripture Memorization',
      type: 'writing',
      status: 'active',
      participantCount: 8,
      startTime: '2:00 PM',
      maxScore: 30
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Assigned Events
                </CardTitle>
                <Trophy className="h-4 w-4 text-primary" />
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
                <Clock className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {assignedEvents.filter(e => e.status === 'active').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently judging
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Participants
                </CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {assignedEvents.reduce((sum, event) => sum + event.participantCount, 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  To be judged
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>My Assigned Events</CardTitle>
              <CardDescription>
                Events you are assigned to judge
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignedEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No events assigned yet
                </div>
              ) : (
                <div className="space-y-4">
                  {assignedEvents.map((event) => (
                    <div key={event.id} className="border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">{event.name}</h3>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                            <span className="capitalize">{event.type} event</span>
                            <span>{event.participantCount} participants</span>
                            <span>Max: {event.maxScore} points</span>
                          </div>
                        </div>
                        <Badge className={getStatusColor(event.status)}>
                          {event.status}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 mr-1" />
                          {event.startTime}
                        </div>
                        
                        {event.status === 'active' && (
                          <Button size="sm">
                            Start Judging
                          </Button>
                        )}
                        
                        {event.status === 'upcoming' && (
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
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

      <div className="md:hidden">
        <Navigation />
      </div>
    </div>
  );
};

export default JudgeDashboard;