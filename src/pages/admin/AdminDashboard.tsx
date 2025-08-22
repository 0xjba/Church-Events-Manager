import { useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, Trophy, BarChart3 } from 'lucide-react';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { NetworkStatus } from '@/components/NetworkStatus';
import { Link } from 'react-router-dom';

const AdminDashboard = () => {
  const { profile } = useAuth();

  const stats = [
    {
      title: 'Total Participants',
      value: '0',
      description: 'Registered participants',
      icon: Users,
      color: 'text-blue-600'
    },
    {
      title: 'Active Events',
      value: '0',
      description: 'Events in progress',
      icon: Calendar,
      color: 'text-green-600'
    },
    {
      title: 'Judges',
      value: '0',
      description: 'Assigned judges',
      icon: Trophy,
      color: 'text-purple-600'
    },
    {
      title: 'Completed Events',
      value: '0',
      description: 'Events finished',
      icon: BarChart3,
      color: 'text-orange-600'
    }
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <div className="w-64 hidden md:block">
        <Navigation />
      </div>
      
      <div className="flex-1 pb-20 md:pb-0">
        <div className="mobile-padding">
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
              <div>
                <h1 className="text-responsive-3xl font-bold text-foreground">
                  Admin Dashboard
                </h1>
                <p className="text-responsive-sm text-muted-foreground mt-2">
                  Welcome back, {profile?.full_name}
                </p>
              </div>
              <NetworkStatus />
            </div>
          </div>

          <PWAInstallPrompt />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title} className="mobile-card">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-responsive-sm font-medium">
                      {stat.title}
                    </CardTitle>
                    <Icon className={`h-5 w-5 sm:h-4 sm:w-4 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-responsive-2xl font-bold">{stat.value}</div>
                    <p className="text-responsive-xs text-muted-foreground mt-1">
                      {stat.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="mobile-card">
              <CardHeader>
                <CardTitle className="text-responsive-lg">Recent Activity</CardTitle>
                <CardDescription className="text-responsive-sm">
                  Latest updates and changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-responsive-sm">No recent activity</p>
                </div>
              </CardContent>
            </Card>

            <Card className="mobile-card">
              <CardHeader>
                <CardTitle className="text-responsive-lg">Quick Actions</CardTitle>
                <CardDescription className="text-responsive-sm">
                  Common tasks and shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Link to="/admin/events" className="block p-4 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors touch-target">
                    <div className="font-medium text-responsive-sm">Add New Event</div>
                    <div className="text-responsive-xs text-muted-foreground mt-1">Create a new competition event</div>
                  </Link>
                  <Link to="/admin/participants" className="block p-4 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors touch-target">
                    <div className="font-medium text-responsive-sm">Register Participant</div>
                    <div className="text-responsive-xs text-muted-foreground mt-1">Add a new participant</div>
                  </Link>
                  <Link to="/admin/assignments" className="block p-4 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors touch-target">
                    <div className="font-medium text-responsive-sm">Assign Judge</div>
                    <div className="text-responsive-xs text-muted-foreground mt-1">Assign judges to events</div>
                  </Link>
                </div>
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

export default AdminDashboard;