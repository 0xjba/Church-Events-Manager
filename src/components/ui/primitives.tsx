import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { CircleNotch } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/* ---------------------------------------------------------------- Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-strong active:bg-primary-strong',
  secondary:
    'bg-surface text-foreground border border-border hover:bg-surface-sunken active:bg-muted',
  ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
  danger: 'bg-destructive text-destructive-foreground hover:brightness-95',
  success: 'bg-success text-success-foreground hover:brightness-95',
};

// lg is the mobile default: 48px is the smallest comfortable touch target.
const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-caption gap-1.5',
  md: 'h-11 px-4 text-body gap-2',
  lg: 'h-12 px-5 text-body gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, block, icon, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-lg font-medium transition-colors',
        // A faded fill drops the label to ~1.8:1; an inert grey keeps a
        // disabled button readable, which matters when "not yet" is the
        // state a judge stares at most.
        'disabled:pointer-events-none disabled:border-transparent disabled:bg-muted disabled:text-muted-foreground',
        buttonVariants[variant],
        buttonSizes[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading ? <CircleNotch className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

/* ------------------------------------------------------------------ Card */

export const Card = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('rounded-xl border border-border bg-surface shadow-card', className)}
    {...props}
  />
);

export const CardBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-4 md:p-5', className)} {...props} />
);

export const CardHeader = ({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) => (
  <div className={cn('flex items-start justify-between gap-3 px-4 pt-4 md:px-5 md:pt-5', className)}>
    <div className="min-w-0">
      <h2 className="truncate text-title font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="mt-0.5 text-caption text-muted-foreground">{subtitle}</p>}
    </div>
    {action}
  </div>
);

/* ------------------------------------------------------------- StatusPill */

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const toneStyles: Record<Tone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary-soft text-primary-strong',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-destructive-soft text-destructive',
  info: 'bg-info-soft text-info',
};

export const StatusPill = ({
  tone = 'neutral',
  children,
  dot,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-medium capitalize',
      toneStyles[tone],
      className,
    )}
  >
    {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
    {children}
  </span>
);

export const statusTone = (status?: string | null): Tone => {
  switch (status) {
    case 'active':
      return 'info';
    case 'completed':
      return 'success';
    case 'upcoming':
      return 'neutral';
    default:
      return 'neutral';
  }
};

/* --------------------------------------------------------------- Progress */

export const ProgressBar = ({
  value,
  tone = 'primary',
  className,
}: {
  value: number;
  tone?: 'primary' | 'success';
  className?: string;
}) => (
  <div
    className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    role="progressbar"
    aria-valuenow={Math.round(value)}
    aria-valuemin={0}
    aria-valuemax={100}
  >
    <div
      className={cn(
        'h-full rounded-full transition-[width] duration-300',
        tone === 'success' ? 'bg-success' : 'bg-primary',
      )}
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);

/* ------------------------------------------------------------- StatTile */

export const StatTile = ({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}) => (
  <div className="rounded-xl border border-border bg-surface p-4 shadow-card">
    <div className="flex items-center justify-between gap-2">
      <span className="text-caption font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {icon && (
        <span className={cn('rounded-md p-1.5', toneStyles[tone])} aria-hidden>
          {icon}
        </span>
      )}
    </div>
    <p className="tnum mt-2 text-metric font-semibold text-foreground">{value}</p>
    {hint && <p className="mt-0.5 text-caption text-muted-foreground">{hint}</p>}
  </div>
);

/* ------------------------------------------------------------ EmptyState */

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
    {icon && (
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
    )}
    <p className="text-title font-semibold text-foreground">{title}</p>
    {description && (
      <p className="mt-1 max-w-sm text-body text-muted-foreground">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

/* -------------------------------------------------------------- Skeleton */

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('relative overflow-hidden rounded-lg bg-muted', className)}>
    <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent" />
  </div>
);

/* ------------------------------------------------------------- Separator */

export const Separator = ({ className }: { className?: string }) => (
  <div className={cn('h-px w-full bg-border', className)} />
);

/* ---------------------------------------------------------------- Avatar */

export const initials = (name?: string | null) =>
  (name ?? '')
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

export const Avatar = ({
  name,
  size = 36,
  className,
}: {
  name?: string | null;
  size?: number;
  className?: string;
}) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground',
      className,
    )}
    style={{ width: size, height: size, fontSize: size * 0.38 }}
  >
    {initials(name)}
  </span>
);
