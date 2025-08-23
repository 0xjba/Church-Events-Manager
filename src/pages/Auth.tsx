import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Trophy, Users, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const Auth = () => {
  const { user: adminUser, signIn: adminSignIn, signUp: adminSignUp, loading: adminLoading } = useAuth();
  const { participant, signIn: participantSignIn, loading: participantLoading } = useParticipantAuth();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userType, setUserType] = useState<'admin' | 'participant'>('admin');

  // Redirect authenticated users away from auth page
  useEffect(() => {
    if (adminUser && !adminLoading) {
      navigate('/', { replace: true });
    }
    if (participant && !participantLoading) {
      navigate('/participant', { replace: true });
    }
  }, [adminUser, participant, adminLoading, participantLoading, navigate]);

  // Admin/Judge sign in form state
  const [adminSignInData, setAdminSignInData] = useState({
    username: '',
    password: ''
  });

  // Participant sign in form state
  const [participantSignInData, setParticipantSignInData] = useState({
    username: '',
    password: ''
  });


  const handleAdminSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { error } = await adminSignIn(adminSignInData.username, adminSignInData.password);
    
    if (error) {
      setError(error.message || 'Failed to sign in');
      toast.error(error.message || 'Please check your credentials');
    } else {
      toast.success('Signed in successfully!');
    }
    
    setIsLoading(false);
  };

  const handleParticipantSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { error } = await participantSignIn(participantSignInData.username, participantSignInData.password);
    
    if (error) {
      setError(error.message || error || 'Failed to sign in');
      toast.error(error.message || error || 'Please check your credentials');
    } else {
      toast.success('Signed in successfully!');
      navigate('/participant', { replace: true });
    }
    
    setIsLoading(false);
  };

  if (adminLoading || participantLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Trophy className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">PYPA</h1>
          <p className="text-muted-foreground">Devotional & Cultural Competitions</p>
        </div>

        {/* User Type Selection */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center">Select Your Role</CardTitle>
            <CardDescription className="text-center">
              Choose your account type to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setUserType('admin')}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  userType === 'admin' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-sm font-medium">Admin/Judge</div>
                <div className="text-xs text-muted-foreground">Staff Members</div>
              </button>
              <button
                onClick={() => setUserType('participant')}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  userType === 'participant' 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <UserCheck className="h-8 w-8 mx-auto mb-2 text-primary" />
                <div className="text-sm font-medium">Participant</div>
                <div className="text-xs text-muted-foreground">Contestants</div>
              </button>
            </div>
          </CardContent>
        </Card>

        {userType === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle>Admin/Judge Sign In</CardTitle>
              <CardDescription>
                Enter your credentials to access PYPA admin panel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdminSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-signin-username">Username</Label>
                  <Input
                    id="admin-signin-username"
                    type="text"
                    placeholder="Enter your username"
                    value={adminSignInData.username}
                    onChange={(e) => setAdminSignInData({ ...adminSignInData, username: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-signin-password">Password</Label>
                  <Input
                    id="admin-signin-password"
                    type="password"
                    placeholder="Enter your password"
                    value={adminSignInData.password}
                    onChange={(e) => setAdminSignInData({ ...adminSignInData, password: e.target.value })}
                    required
                  />
                </div>
                
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>

              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Need an admin account?</strong> Contact your system administrator to create admin or judge accounts.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {userType === 'participant' && (
          <Card>
            <CardHeader>
              <CardTitle>Participant Sign In</CardTitle>
              <CardDescription>
                Enter your participant credentials to access PYPA
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleParticipantSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="participant-signin-username">Username</Label>
                  <Input
                    id="participant-signin-username"
                    type="text"
                    placeholder="Enter your username"
                    value={participantSignInData.username}
                    onChange={(e) => setParticipantSignInData({ ...participantSignInData, username: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="participant-signin-password">Password</Label>
                  <Input
                    id="participant-signin-password"
                    type="password"
                    placeholder="Enter your password"
                    value={participantSignInData.password}
                    onChange={(e) => setParticipantSignInData({ ...participantSignInData, password: e.target.value })}
                    required
                  />
                </div>
                
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>

              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Don't have participant credentials?</strong> Contact your administrator to create your participant account.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Auth;