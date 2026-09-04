import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { CircleNotch, Eye, EyeSlash, Gavel, IdentificationBadge, ShieldCheck, WarningCircle } from '@phosphor-icons/react';
import { useAuth } from '@/hooks/useAuth';
import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import { Button } from '@/components/ui/primitives';
import { Field, Input } from '@/components/ui/inputs';
import { cn } from '@/lib/utils';

type Role = 'admin' | 'judge' | 'participant';

const ROLES: Array<{ value: Role; label: string; hint: string; icon: typeof Gavel }> = [
  { value: 'judge', label: 'Judge', hint: 'Score entrants', icon: Gavel },
  { value: 'participant', label: 'Participant', hint: 'View your details', icon: IdentificationBadge },
  { value: 'admin', label: 'Admin', hint: 'Run the event', icon: ShieldCheck },
];

const errorText = (error: unknown, fallback: string) => {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message ?? fallback);
  }
  return fallback;
};

const Auth = () => {
  const { user: adminUser, signIn: adminSignIn, loading: adminLoading } = useAuth();
  const { participant, signIn: participantSignIn, loading: participantLoading } = useParticipantAuth();
  const navigate = useNavigate();

  // Judges are the busiest role on the day, so their tab opens first.
  const [role, setRole] = useState<Role>('judge');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (adminUser && !adminLoading) navigate('/', { replace: true });
    if (participant && !participantLoading) {
      navigate(participant.role === 'judge' ? '/judge' : '/participant', { replace: true });
    }
  }, [adminUser, participant, adminLoading, participantLoading, navigate]);

  const submit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (role === 'admin') {
        const { error: signInError } = await adminSignIn(username, password);
        if (signInError) throw signInError;
        message.success('Signed in');
        return;
      }

      const { error: signInError } = await participantSignIn(username, password);
      if (signInError) throw signInError;
      message.success('Signed in');
      navigate(role === 'judge' ? '/judge' : '/participant', { replace: true });
    } catch (signInError) {
      const text = errorText(signInError, 'Please check your credentials');
      setError(text);
      message.error(text);
    } finally {
      setSubmitting(false);
    }
  };

  const switchRole = (next: Role) => {
    setRole(next);
    setError('');
  };

  if (adminLoading || participantLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <CircleNotch className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="pt-safe mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <div className="mb-8 text-center">
          <img src="/pypa-logo.png" alt="" className="mx-auto h-16 w-16 rounded-2xl shadow-card" />
          <h1 className="mt-4 text-display font-semibold tracking-tight text-foreground">PYPA</h1>
          <p className="text-body text-muted-foreground">
            Pentecostal Youth People&apos;s Association
          </p>
        </div>

        {/* Role first: it changes what the credentials mean. */}
        <div className="mb-5 grid grid-cols-3 gap-2">
          {ROLES.map((option) => {
            const Icon = option.icon;
            const selected = role === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => switchRole(option.value)}
                aria-pressed={selected}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-colors',
                  selected
                    ? 'border-primary bg-primary-soft text-primary-strong'
                    : 'border-border bg-surface text-muted-foreground hover:border-border-strong',
                )}
              >
                <Icon size={20} />
                <span className="text-caption font-semibold">{option.label}</span>
                <span className="text-[11px] leading-tight opacity-80">{option.hint}</span>
              </button>
            );
          })}
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-border bg-surface p-5 shadow-card"
        >
          <h2 className="text-title font-semibold text-foreground">
            {role === 'admin' ? 'Admin sign in' : role === 'judge' ? 'Judge sign in' : 'Participant sign in'}
          </h2>
          <p className="mb-4 mt-0.5 text-caption text-muted-foreground">
            {role === 'admin'
              ? 'Use the email and password for your admin account.'
              : 'Use the username and password your administrator gave you.'}
          </p>

          <div className="space-y-3">
            <Field label={role === 'admin' ? 'Email' : 'Username'} required>
              <Input
                value={username}
                onChange={(changeEvent) => setUsername(changeEvent.target.value)}
                type={role === 'admin' ? 'email' : 'text'}
                inputMode={role === 'admin' ? 'email' : 'text'}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                required
                placeholder={role === 'admin' ? 'you@example.com' : 'your.username'}
              />
            </Field>

            <Field label="Password" required>
              <div className="relative">
                <Input
                  value={password}
                  onChange={(changeEvent) => setPassword(changeEvent.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                  {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-lg bg-destructive-soft p-3 text-caption text-destructive"
            >
              <WarningCircle size={14} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          <Button type="submit" size="lg" block loading={submitting} className="mt-4">
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-caption text-muted-foreground">
          {role === 'admin'
            ? 'Admin accounts are created by your system administrator.'
            : 'Lost your credentials? Ask an administrator to reset them.'}
        </p>
      </div>
    </div>
  );
};

export default Auth;
