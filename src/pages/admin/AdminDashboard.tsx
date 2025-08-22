import { useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, Trophy, BarChart3 } from 'lucide-react';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { NetworkStatus } from '@/components/NetworkStatus';

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
      
      <div className="flex-1 pb-16 md:pb-0">
        <div className="p-4 md:p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Admin Dashboard
              </h1>
              <NetworkStatus />
            </div>
            <p className="text-muted-foreground">
              Welcome back, {profile?.full_name}
            </p>
          </div>

          <PWAInstallPrompt />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {stat.title}
                    </CardTitle>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <p className="text-xs text-muted-foreground">
                      {stat.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest updates and changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  No recent activity
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>
                  Common tasks and shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <a href="/admin/events" className="block p-3 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                    <div className="font-medium">Add New Event</div>
                    <div className="text-sm text-muted-foreground">Create a new competition event</div>
                  </a>
                  <a href="/admin/participants" className="block p-3 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                    <div className="font-medium">Register Participant</div>
                    <div className="text-sm text-muted-foreground">Add a new participant</div>
                  </a>
                  <a href="/admin/assignments" className="block p-3 border border-border rounded-lg cursor-pointer hover:bg-accent transition-colors">
                    <div className="font-medium">Assign Judge</div>
                    <div className="text-sm text-muted-foreground">Assign judges to events</div>
                  </a>
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