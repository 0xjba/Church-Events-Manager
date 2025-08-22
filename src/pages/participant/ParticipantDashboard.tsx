import { useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Trophy, Clock, Users } from 'lucide-react';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { NetworkStatus } from '@/components/NetworkStatus';

const ParticipantDashboard = () => {
  const { profile } = useAuth();

  // Mock data - will be replaced with real data
  const myEvents = [
    {
      id: '1',
      name: 'Youth Choir Competition',
      type: 'stage',
      status: 'upcoming',
      startTime: '10:00 AM',
      date: '2024-01-25',
      chestNumber: 'P001'
    },
    {
      id: '2',
      name: 'Scripture Memorization',
      type: 'writing',
      status: 'completed',
      startTime: '2:00 PM',
      date: '2024-01-20',
      chestNumber: 'P001',
      score: 28,
      maxScore: 30,
      rank: 2
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

  const upcomingEvents = myEvents.filter(e => e.status === 'upcoming');
  const completedEvents = myEvents.filter(e => e.status === 'completed');

  return (
    <div className="flex min-h-screen bg-background">
      <div className="w-64 hidden md:block">
        <Navigation />
      </div>
      
      <div className="flex-1 pb-16 md:pb-0">
        <div className="p-4 md:p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                My Dashboard
              </h1>
              <NetworkStatus />
            </div>
            <p className="text-muted-foreground">
              Welcome back, {profile?.full_name}
            </p>
          </div>

          <PWAInstallPrompt />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  My Events
                </CardTitle>
                <Trophy className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{myEvents.length}</div>
                <p className="text-xs text-muted-foreground">
                  Registered events
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Upcoming
                </CardTitle>
                <Calendar className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{upcomingEvents.length}</div>
                <p className="text-xs text-muted-foreground">
                  Events to participate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Completed
                </CardTitle>
                <Users className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completedEvents.length}</div>
                <p className="text-xs text-muted-foreground">
                  Events finished
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {upcomingEvents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Events</CardTitle>
                  <CardDescription>
                    Events you are registered for
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {upcomingEvents.map((event) => (
                      <div key={event.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{event.name}</h3>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                              <span className="capitalize">{event.type} event</span>
                              <span>Chest #{event.chestNumber}</span>
                            </div>
                          </div>
                          <Badge className={getStatusColor(event.status)}>
                            {event.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="h-4 w-4 mr-1" />
                          {event.date} at {event.startTime}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {completedEvents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>My Results</CardTitle>
                  <CardDescription>
                    Your performance in completed events
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {completedEvents.map((event) => (
                      <div key={event.id} className="border border-border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-lg">{event.name}</h3>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                              <span className="capitalize">{event.type} event</span>
                              <span>Chest #{event.chestNumber}</span>
                            </div>
                          </div>
                          <Badge className={getStatusColor(event.status)}>
                            {event.status}
                          </Badge>
                        </div>
                        
                        {event.score !== undefined && (
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-muted-foreground">
                              Score: <span className="font-semibold text-foreground">
                                {event.score}/{event.maxScore}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Rank: <span className="font-semibold text-foreground">
                                #{event.rank}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {myEvents.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Events Yet</h3>
                  <p className="text-muted-foreground">
                    You haven't been registered for any events yet. Contact the admin to get registered.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <Navigation />
      </div>
    </div>
  );
};

export default ParticipantDashboard;