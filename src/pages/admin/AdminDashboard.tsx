import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowsClockwise, CalendarBlank, CaretRight, Certificate, ChartBar, Gavel, Pulse, Target, Trophy, User, UsersThree, WarningCircle } from '@phosphor-icons/react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminStats } from '@/hooks/useAdminStats';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { AppShell } from '@/components/shell/AppShell';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { Button, Card, CardHeader, EmptyState, Skeleton, StatTile } from '@/components/ui/primitives';

const QUICK_LINKS = [
  { label: 'Participants', description: 'Register and manage entrants', path: '/admin/participants', icon: UsersThree },
  { label: 'Judges', description: 'Accounts and assignments', path: '/admin/judges', icon: Gavel },
  { label: 'Events', description: 'Criteria, entrants, status', path: '/admin/events', icon: CalendarBlank },
  { label: 'Results', description: 'Publish and export', path: '/admin/results', icon: Trophy },
];

const activityIcon = (type: string) => {
  switch (type) {
    case 'participant':
      return <User size={14} />;
    case 'judge':
      return <Certificate size={14} />;
    case 'score':
      return <Target size={14} />;
    default:
      return <CalendarBlank size={14} />;
  }
};

const AdminDashboard = () => {
  const { profile } = useAuth();
  const { stats, loading, error, refetch } = useAdminStats();
  const {
    activities,
    loading: activitiesLoading,
    error: activitiesError,
    refetch: refetchActivities,
  } = useRecentActivity();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refreshAll = () => {
    refetch();
    refetchActivities();
    setLastUpdated(new Date());
  };

  return (
    <AppShell
      variant="admin"
      title="Dashboard"
      subtitle={profile?.full_name ? `Signed in as ${profile.full_name}` : undefined}
      actions={
        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowsClockwise size={14} />}
          loading={loading || activitiesLoading}
          onClick={refreshAll}
        >
          <span className="hidden sm:inline">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="sm:hidden">Refresh</span>
        </Button>
      }
    >
      <PWAInstallPrompt />

      {(error || activitiesError) && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive-soft p-4">
          <WarningCircle size={18} className="mt-0.5 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="text-body font-medium text-destructive">Could not load dashboard data</p>
            <p className="mt-0.5 text-caption text-destructive/80">{error || activitiesError}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={refreshAll}>
            Retry
          </Button>
        </div>
      )}

      {/* Counts first: the numbers an administrator checks on arrival. */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[104px]" />)
        ) : (
          <>
            <StatTile
              label="Participants"
              value={stats.totalParticipants}
              hint="Registered"
              icon={<UsersThree size={15} />}
              tone="primary"
            />
            <StatTile
              label="Active events"
              value={stats.activeEvents}
              hint="Not yet completed"
              icon={<Pulse size={15} />}
              tone="info"
            />
            <StatTile
              label="Judges"
              value={stats.totalJudges}
              hint="Accounts"
              icon={<Gavel size={15} />}
              tone="neutral"
            />
            <StatTile
              label="Completed"
              value={stats.completedEvents}
              hint={`of ${stats.totalEvents} events`}
              icon={<ChartBar size={15} />}
              tone="success"
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent activity" subtitle="Latest changes across the event" />
          <div className="px-4 pb-4 md:px-5 md:pb-5">
            {activitiesLoading ? (
              <div className="space-y-2 pt-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : activities.length === 0 ? (
              <EmptyState
                icon={<Pulse size={20} />}
                title="No recent activity"
                description="Registrations, scores and status changes show up here."
                className="py-8"
              />
            ) : (
              <ul className="divide-y divide-border">
                {activities.map((activity, index) => (
                  <li key={`${activity.timestamp}-${index}`} className="flex gap-3 py-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary-strong">
                      {activityIcon(activity.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-medium text-foreground">
                        {activity.title}
                      </p>
                      <p className="truncate text-caption text-muted-foreground">
                        {activity.description}
                      </p>
                    </div>
                    <time className="shrink-0 text-caption text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Jump to" subtitle="Common tasks" />
          <div className="p-2 md:p-3">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-sunken"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-sunken text-muted-foreground">
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-body font-medium text-foreground">{link.label}</span>
                    <span className="block truncate text-caption text-muted-foreground">
                      {link.description}
                    </span>
                  </span>
                  <CaretRight size={16} className="text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </AppShell>
  );
};

export default AdminDashboard;
