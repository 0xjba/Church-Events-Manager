import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const Auth = () => {
  const { user, signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect authenticated users away from auth page
  useEffect(() => {
    if (user && !loading) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  // Show loading state during auth check
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Sign in form state
  const [signInData, setSignInData] = useState({
    username: '',
    password: ''
  });

  // Sign up form state - participants only
  const [signUpData, setSignUpData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: ''
  });

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { error } = await signIn(signInData.username, signInData.password);
    
    if (error) {
      setError(error.message || 'Failed to sign in');
      toast.error(error.message || 'Please check your credentials');
    } else {
      toast.success('Signed in successfully!');
    }
    
    setIsLoading(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { error } = await signUp(
      signUpData.username,
      signUpData.email,
      signUpData.password,
      signUpData.fullName,
      'participant' // Only participants can register now
    );
    
    if (error) {
      setError(error.message || 'Failed to create account');
      toast.error(error.message || 'Please try again');
    } else {
      toast.success('Account created successfully!');
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center mobile-padding">
      <div className="mobile-container">
        <div className="text-center mb-8">
          <div className="flex justify-center items-center mb-4">
            <Trophy className="h-12 w-12 sm:h-16 sm:w-16 text-primary" />
          </div>
          <h1 className="text-responsive-3xl font-bold text-foreground mb-2">
            PYPA
          </h1>
          <p className="text-responsive-sm text-muted-foreground">
            Punjab Youth Preachers Association
          </p>
        </div>

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
            <TabsTrigger value="signin" className="text-responsive-sm h-10">Sign In</TabsTrigger>
            <TabsTrigger value="signup" className="text-responsive-sm h-10">Sign Up</TabsTrigger>
          </TabsList>
          
          <TabsContent value="signin">
            <Card className="mobile-card">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-responsive-xl">Welcome Back</CardTitle>
                <CardDescription className="text-responsive-sm">
                  Sign in to your PYPA account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignIn} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="signin-username" className="text-responsive-sm font-medium">Username</Label>
                    <Input
                      id="signin-username"
                      type="text"
                      placeholder="Enter your username"
                      value={signInData.username}
                      onChange={(e) => setSignInData({ ...signInData, username: e.target.value })}
                      required
                      className="h-12 text-responsive-sm"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="signin-password" className="text-responsive-sm font-medium">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                      required
                      className="h-12 text-responsive-sm"
                    />
                  </div>
                  
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription className="text-responsive-sm">{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full h-12 text-responsive-sm font-medium" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Signing In...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="signup">
            <Card className="mobile-card">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-responsive-xl">Create Account</CardTitle>
                <CardDescription className="text-responsive-sm">
                  Register as a new participant for PYPA events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignUp} className="space-y-6">
                  <div className="space-y-3">
                    <Label htmlFor="signup-username" className="text-responsive-sm font-medium">Username</Label>
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder="Choose a username"
                      value={signUpData.username}
                      onChange={(e) => setSignUpData({ ...signUpData, username: e.target.value })}
                      required
                      className="h-12 text-responsive-sm"
                    />
                  </div>
                   <div className="space-y-3">
                     <Label htmlFor="signup-email" className="text-responsive-sm font-medium">Email Address</Label>
                     <Input
                       id="signup-email"
                       type="email"
                       placeholder="Enter your email address"
                       value={signUpData.email}
                       onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                       required
                       className="h-12 text-responsive-sm"
                     />
                   </div>
                   <div className="space-y-3">
                     <Label htmlFor="signup-fullname" className="text-responsive-sm font-medium">Full Name</Label>
                     <Input
                       id="signup-fullname"
                       type="text"
                       placeholder="Enter your full name"
                       value={signUpData.fullName}
                       onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                       required
                       className="h-12 text-responsive-sm"
                     />
                   </div>
                   <div className="space-y-3">
                     <Label className="text-responsive-sm font-medium">Account Type</Label>
                     <div className="p-4 bg-muted rounded-lg border">
                       <p className="text-responsive-sm text-muted-foreground">
                         <strong>Participant Account</strong> - You will be registered as a participant. 
                         Judges and admins are managed by administrators only.
                       </p>
                     </div>
                   </div>
                  <div className="space-y-3">
                    <Label htmlFor="signup-password" className="text-responsive-sm font-medium">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a password"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                      required
                      className="h-12 text-responsive-sm"
                    />
                  </div>
                  
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription className="text-responsive-sm">{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full h-12 text-responsive-sm font-medium" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Auth;