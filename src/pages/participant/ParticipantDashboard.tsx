import { Link } from 'react-router-dom';
import { CalendarBlank, CaretRight, ChartBar, Trophy } from '@phosphor-icons/react';
import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import { AppShell } from '@/components/shell/AppShell';
import { Card, CardHeader, EmptyState } from '@/components/ui/primitives';

const ParticipantDashboard = () => {
  const { participant } = useParticipantAuth();

  if (!participant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <EmptyState
          icon={<Trophy size={22} />}
          title="Not signed in"
          description="Sign in again to see your participant details."
        />
      </div>
    );
  }

  const details: Array<[string, string | undefined]> = [
    ['Chest number', participant.chest_number ? `#${participant.chest_number}` : undefined],
    ['Age category', participant.age_category],
    ['Age', participant.age ? `${participant.age} years` : undefined],
    ['Church', participant.church],
    ['District', participant.district],
  ];

  return (
    <AppShell title={participant.full_name} subtitle="Participant">
      {/* Identity card: the chest number is what officials ask for, so it leads. */}
      <div className="mb-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-raised">
        <p className="text-caption uppercase tracking-wide opacity-80">Chest number</p>
        <p className="tnum mt-1 text-[2.5rem] font-semibold leading-none">
          {participant.chest_number ? `#${participant.chest_number}` : '—'}
        </p>
        <p className="mt-3 text-body opacity-90">
          {participant.age_category ? `${participant.age_category} · ` : ''}
          {participant.church}
        </p>
      </div>

      <Card className="mb-4">
        <CardHeader title="My details" subtitle="Registered information" />
        <dl className="divide-y divide-border px-4 pb-1 md:px-5">
          {details
            .filter(([, value]) => Boolean(value))
            .map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 py-3">
                <dt className="text-caption text-muted-foreground">{label}</dt>
                <dd className="truncate text-body font-medium capitalize text-foreground">
                  {value}
                </dd>
              </div>
            ))}
        </dl>
      </Card>

      <Card className="mb-4">
        <CardHeader title="My events" subtitle="Events you are registered for" />
        <EmptyState
          icon={<CalendarBlank size={20} />}
          title="No events yet"
          description="Registered events appear here once an administrator adds you to them."
          className="py-8"
        />
      </Card>

      <Card className="mb-4">
        <CardHeader title="My results" subtitle="Scores and placements" />
        <EmptyState
          icon={<ChartBar size={20} />}
          title="No published results"
          description="Results appear after the judges finish and an administrator publishes them."
          className="py-8"
        />
      </Card>

      <Link
        to="/leaderboard"
        className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-card transition-colors hover:border-primary/40"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary-strong">
          <Trophy size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body font-medium text-foreground">Leaderboard</span>
          <span className="block text-caption text-muted-foreground">
            Published rankings across all events
          </span>
        </span>
        <CaretRight size={18} className="text-muted-foreground" />
      </Link>
    </AppShell>
  );
};

export default ParticipantDashboard;
