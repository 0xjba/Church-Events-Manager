import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CalendarBlank, ChartBar, Gavel, List, SignOut, SquaresFour, Trophy, User, UsersThree, X } from '@phosphor-icons/react';
import { useAuth } from '@/hooks/useAuth';
import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import { useEventLevel } from '@/hooks/useEventLevel';
import { Avatar, Button, Separator, StatusPill } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  short: string;
  path: string;
  icon: ReactNode;
}

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', short: 'Home', path: '/admin', icon: <SquaresFour size={18} /> },
  { label: 'Participants', short: 'People', path: '/admin/participants', icon: <UsersThree size={18} /> },
  { label: 'Judges', short: 'Judges', path: '/admin/judges', icon: <Gavel size={18} /> },
  { label: 'Event Levels', short: 'Levels', path: '/admin/event-levels', icon: <CalendarBlank size={18} /> },
  { label: 'Events', short: 'Events', path: '/admin/events', icon: <ChartBar size={18} /> },
  { label: 'Results', short: 'Results', path: '/admin/results', icon: <Trophy size={18} /> },
];

const JUDGE_NAV: NavItem[] = [
  { label: 'My Events', short: 'Events', path: '/judge', icon: <Gavel size={18} /> },
  { label: 'Leaderboard', short: 'Results', path: '/leaderboard', icon: <Trophy size={18} /> },
];

const PARTICIPANT_NAV: NavItem[] = [
  { label: 'My Events', short: 'Events', path: '/participant', icon: <User size={18} /> },
  { label: 'Leaderboard', short: 'Results', path: '/leaderboard', icon: <Trophy size={18} /> },
];

const isActivePath = (pathname: string, path: string) =>
  path === pathname || (path !== '/' && pathname.startsWith(`${path}/`));

/**
 * One shell, two layouts.
 *
 * Judges and participants get the mobile-first treatment: a compact top bar and
 * a bottom tab bar sitting in the thumb zone, staying that way on desktop
 * inside a readable column. Admins get the desktop-first treatment: a permanent
 * sidebar and the full width for tables, collapsing to a drawer on small
 * screens rather than pretending a phone is the primary device.
 */
export const AppShell = ({
  children,
  title,
  subtitle,
  actions,
  variant,
  contentClassName,
  maxWidth = 'default',
}: {
  children: ReactNode;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Defaults to the signed-in role. */
  variant?: 'admin' | 'mobile';
  contentClassName?: string;
  maxWidth?: 'default' | 'wide' | 'narrow';
}) => {
  const { profile, signOut: adminSignOut } = useAuth();
  const { participant, signOut: participantSignOut } = useParticipantAuth();
  const { levels, levelId, setLevelId, loading: loadingLevels } = useEventLevel();
  const location = useLocation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const role = profile?.role ?? participant?.role;
  const user = profile ?? participant;
  const layout = variant ?? (role === 'admin' ? 'admin' : 'mobile');

  const nav =
    role === 'admin' ? ADMIN_NAV : role === 'judge' ? JUDGE_NAV : PARTICIPANT_NAV;

  const signOut = () => {
    if (profile) adminSignOut();
    else if (participant) participantSignOut();
    setProfileOpen(false);
    navigate('/auth');
  };

  const widthClass =
    maxWidth === 'wide' ? 'max-w-[1600px]' : maxWidth === 'narrow' ? 'max-w-2xl' : 'max-w-6xl';

  const profileSheet = (
    <Sheet
      open={profileOpen}
      onClose={() => setProfileOpen(false)}
      title={user?.full_name ?? 'Account'}
      description={role ? role[0].toUpperCase() + role.slice(1) : undefined}
      footer={
        <Button variant="secondary" block icon={<SignOut size={16} />} onClick={signOut}>
          Sign out
        </Button>
      }
    >
      <dl className="divide-y divide-border">
        {participant?.chest_number && (
          <Row label="Chest number" value={`#${participant.chest_number}`} />
        )}
        {participant?.age_category && <Row label="Age category" value={participant.age_category} />}
        {participant?.church && <Row label="Church" value={participant.church} />}
        {participant?.district && <Row label="District" value={participant.district} />}
        {profile?.email && <Row label="Email" value={profile.email} />}
        {profile?.username && <Row label="Username" value={profile.username} />}
        {participant?.username && <Row label="Username" value={participant.username} />}
      </dl>
    </Sheet>
  );

  if (layout === 'admin') {
    return (
      <div className="min-h-screen bg-background">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-sidebar flex-col border-r border-border bg-surface lg:flex">
          <Brand />
          <nav className="flex-1 space-y-0.5 px-3 py-3">
            {nav.map((item) => (
              <SidebarLink key={item.path} item={item} active={isActivePath(location.pathname, item.path)} />
            ))}
          </nav>
          <Separator />
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-sunken"
          >
            <Avatar name={user?.full_name} size={34} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-caption font-medium text-foreground">
                {user?.full_name}
              </span>
              <span className="block truncate text-caption capitalize text-muted-foreground">
                {role}
              </span>
            </span>
          </button>
        </aside>

        {/* Mobile drawer for the admin screens */}
        {drawerOpen && (
          <div className="pt-safe pb-safe fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 animate-fade-in bg-foreground/40"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="relative flex h-full w-72 max-w-[80%] flex-col bg-surface shadow-overlay">
              <div className="flex items-center justify-between pr-2">
                <Brand />
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setDrawerOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                  <X size={18} />
                </button>
              </div>
              <nav className="flex-1 space-y-0.5 px-3 py-3" onClick={() => setDrawerOpen(false)}>
                {nav.map((item) => (
                  <SidebarLink
                    key={item.path}
                    item={item}
                    active={isActivePath(location.pathname, item.path)}
                  />
                ))}
              </nav>
            </div>
          </div>
        )}

        <div className="lg:pl-sidebar">
          <header className="pt-safe sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur">
            <div className={cn('mx-auto flex items-center gap-3 px-4 py-3 md:px-6', widthClass)}>
              <button
                type="button"
                aria-label="Open menu"
                onClick={() => setDrawerOpen(true)}
                className="-ml-2 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden"
              >
                <List size={20} />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-display font-semibold text-foreground">{title}</h1>
                {subtitle && (
                  <p className="truncate text-caption text-muted-foreground">{subtitle}</p>
                )}
              </div>
              {/* Everything an admin sees belongs to the level chosen here, so
                  it cannot be a desktop-only control. */}
              {role === 'admin' && levels.length > 0 && (
                <label className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-caption text-muted-foreground sm:inline">
                    Event level
                  </span>
                  <select
                    value={levelId}
                    onChange={(changeEvent) => setLevelId(changeEvent.target.value)}
                    className="h-9 max-w-[9rem] rounded-lg border border-input bg-surface px-2 text-caption text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25 sm:max-w-none"
                  >
                    {/* Without this, an empty selection silently displays the
                        first level while the app holds no level at all. */}
                    {!levelId && <option value="">Choose a level</option>}
                    {levels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name} {level.year}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {role === 'admin' && !loadingLevels && levels.length === 0 && (
                <StatusPill tone="warning">No active level</StatusPill>
              )}
              {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                aria-label="Account"
                className="lg:hidden"
              >
                <Avatar name={user?.full_name} size={34} />
              </button>
            </div>
          </header>

          <main className={cn('mx-auto px-4 py-5 md:px-6 md:py-6', widthClass, contentClassName)}>
            {children}
          </main>
        </div>

        {profileSheet}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="pt-safe sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-header max-w-3xl items-center gap-3 px-4">
          <img src="/pypa-logo.png" alt="" className="h-7 w-7 rounded-md" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-title font-semibold text-foreground">{title}</h1>
            {subtitle && <p className="truncate text-caption text-muted-foreground">{subtitle}</p>}
          </div>
          {actions}
          <button type="button" onClick={() => setProfileOpen(true)} aria-label="Account">
            <Avatar name={user?.full_name} size={34} />
          </button>
        </div>
      </header>

      <main
        className={cn('mx-auto max-w-3xl px-4 pb-[calc(theme(spacing.tabbar)+1.5rem)] pt-4', contentClassName)}
      >
        {children}
      </main>

      {/* Bottom tab bar: primary destinations stay under the thumb. */}
      <nav className="pb-safe px-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface shadow-bar-up">
        <div className="mx-auto flex max-w-3xl">
          {nav.map((item) => {
            const active = isActivePath(location.pathname, item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-caption font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-14 items-center justify-center rounded-full transition-colors',
                    active && 'bg-primary-soft',
                  )}
                >
                  {item.icon}
                </span>
                {item.short}
              </Link>
            );
          })}
        </div>
      </nav>

      {profileSheet}
    </div>
  );
};

const Brand = () => (
  <div className="flex items-center gap-2.5 px-4 py-4">
    <img src="/pypa-logo.png" alt="" className="h-8 w-8 rounded-lg" />
    <span className="text-title font-semibold tracking-tight text-foreground">PYPA</span>
  </div>
);

const SidebarLink = ({ item, active }: { item: NavItem; active: boolean }) => (
  <Link
    to={item.path}
    aria-current={active ? 'page' : undefined}
    className={cn(
      'flex h-11 items-center gap-3 rounded-lg px-3 text-body font-medium transition-colors',
      active
        ? 'bg-primary-soft text-primary-strong'
        : 'text-muted-foreground hover:bg-surface-sunken hover:text-foreground',
    )}
  >
    {item.icon}
    {item.label}
  </Link>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <dt className="text-caption text-muted-foreground">{label}</dt>
    <dd className="truncate text-body font-medium capitalize text-foreground">{value}</dd>
  </div>
);
