import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Trophy } from 'lucide-react';
import { toast } from 'sonner';

const Auth = () => {
  const { signIn, signUp, loading } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Sign in form state
  const [signInData, setSignInData] = useState({
    username: '',
    password: ''
  });

  // Sign up form state - temporary admin creation enabled
  const [signUpData, setSignUpData] = useState({
    username: '',
    email: '',
    password: '',
    fullName: '',
    role: 'participant' as 'admin' | 'judge' | 'participant'
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
      signUpData.role // Allow admin creation temporarily
    );
    
    if (error) {
      setError(error.message || 'Failed to create account');
      toast.error(error.message || 'Please try again');
    } else {
      toast.success('Account created successfully!');
    }
    
    setIsLoading(false);
  };

  if (loading) {
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

        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <Card>
              <CardHeader>
                <CardTitle>Sign In</CardTitle>
                <CardDescription>
                  Enter your credentials to access PYPA
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-username">Username</Label>
                    <Input
                      id="signin-username"
                      type="text"
                      placeholder="Enter your username"
                      value={signInData.username}
                      onChange={(e) => setSignInData({ ...signInData, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="Enter your password"
                      value={signInData.password}
                      onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
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
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup">
            <Card>
              <CardHeader>
                <CardTitle>Create Account</CardTitle>
                <CardDescription>
                  Create your PYPA account (temporary admin setup enabled)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-username">Username</Label>
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder="Choose a username"
                      value={signUpData.username}
                      onChange={(e) => setSignUpData({ ...signUpData, username: e.target.value })}
                      required
                    />
                  </div>
                   <div className="space-y-2">
                     <Label htmlFor="signup-email">Email Address</Label>
                     <Input
                       id="signup-email"
                       type="email"
                       placeholder="Enter your email address"
                       value={signUpData.email}
                       onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                       required
                     />
                   </div>
                   <div className="space-y-2">
                     <Label htmlFor="signup-fullname">Full Name</Label>
                     <Input
                       id="signup-fullname"
                       type="text"
                       placeholder="Enter your full name"
                       value={signUpData.fullName}
                       onChange={(e) => setSignUpData({ ...signUpData, fullName: e.target.value })}
                       required
                     />
                   </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-role">Role (Temporary Admin Setup)</Label>
                    <Select value={signUpData.role} onValueChange={(value: 'admin' | 'judge' | 'participant') => setSignUpData({ ...signUpData, role: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">🔑 Admin (Create First Admin)</SelectItem>
                        <SelectItem value="participant">👤 Participant</SelectItem>
                        <SelectItem value="judge">⚖️ Judge</SelectItem>
                      </SelectContent>
                    </Select>
                    {signUpData.role === 'admin' && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          <strong>⚠️ First Admin Setup:</strong> Create your admin account, then disable this option.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="Create a password"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
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