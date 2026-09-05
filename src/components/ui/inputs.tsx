import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export const Field = ({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) => (
  <label className={cn('block', className)}>
    <span className="mb-1.5 flex items-center gap-1 text-caption font-medium text-foreground">
      {label}
      {required && <span className="text-destructive">*</span>}
    </span>
    {children}
    {error ? (
      <span className="mt-1 block text-caption text-destructive">{error}</span>
    ) : hint ? (
      <span className="mt-1 block text-caption text-muted-foreground">{hint}</span>
    ) : null}
  </label>
);

export const inputClass =
  'h-11 w-full rounded-lg border border-input bg-surface px-3 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputClass, className)} {...props} />
  ),
);
Input.displayName = 'Input';

export const SearchInput = ({
  value,
  onChange,
  placeholder = 'Search',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) => (
  <div className={cn('relative', className)}>
    <MagnifyingGlass
      size={16}
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
    />
    <input
      type="search"
      inputMode="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={cn(inputClass, 'pl-9')}
    />
  </div>
);

/** Two to four mutually exclusive options; larger sets belong in a select. */
export const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Array<{ value: T; label: ReactNode; count?: number }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) => (
  <div
    role="tablist"
    className={cn('flex gap-1 rounded-xl bg-surface-sunken p-1', className)}
  >
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={selected}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-caption font-medium transition-colors',
            selected
              ? 'bg-surface text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
          {option.count !== undefined && (
            <span
              className={cn(
                'tnum rounded-full px-1.5 text-[11px]',
                selected ? 'bg-primary-soft text-primary-strong' : 'bg-muted',
              )}
            >
              {option.count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);
