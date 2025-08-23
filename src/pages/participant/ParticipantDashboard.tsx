import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, User, Calendar, LogOut, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';

const ParticipantDashboard = () => {
  const { participant, signOut } = useParticipantAuth();

  if (!participant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Not authenticated</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border p-4">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            <Trophy className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold">PYPA</h1>
              <p className="text-sm text-muted-foreground">Participant Portal</p>
            </div>
          </div>
          <Button variant="ghost" onClick={signOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 max-w-4xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Welcome, {participant.full_name}!
          </h2>
          <p className="text-muted-foreground">
            Chest Number: {participant.chest_number} | Category: {participant.category}
          </p>
        </div>

        {/* Participant Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                My Profile
              </CardTitle>
              <CardDescription>Your participant information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-sm font-medium">Name:</span>
                <p className="text-sm text-muted-foreground">{participant.full_name}</p>
              </div>
              <div>
                <span className="text-sm font-medium">Age:</span>
                <p className="text-sm text-muted-foreground">{participant.age} years</p>
              </div>
              <div>
                <span className="text-sm font-medium">Chest Number:</span>
                <p className="text-sm text-muted-foreground">{participant.chest_number}</p>
              </div>
              <div>
                <span className="text-sm font-medium">Category:</span>
                <p className="text-sm text-muted-foreground capitalize">{participant.category}</p>
              </div>
              <div>
                <span className="text-sm font-medium">Church:</span>
                <p className="text-sm text-muted-foreground">{participant.church}</p>
              </div>
              <div>
                <span className="text-sm font-medium">District:</span>
                <p className="text-sm text-muted-foreground">{participant.district}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                My Events
              </CardTitle>
              <CardDescription>Your registered events and competitions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No events registered yet</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Events will appear here once you're registered by administrators
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/leaderboard">
            <Card className="cursor-pointer hover:bg-accent transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  View Leaderboard
                </CardTitle>
                <CardDescription>Check rankings and results</CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Card className="opacity-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                My Results
              </CardTitle>
              <CardDescription>View your scores and rankings (Coming Soon)</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ParticipantDashboard;