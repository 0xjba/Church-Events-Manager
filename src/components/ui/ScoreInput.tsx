import { useEffect, useRef, useState } from 'react';
import { Minus, Plus } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/**
 * Score entry for one criterion.
 *
 * Steppers beat sliders for small ranges (criteria max out around 10) because
 * every tap is an exact value, and the field itself stays typable for judges
 * who know the number they want. An untouched criterion shows a dash, never a
 * zero, so "not scored yet" cannot be mistaken for "scored zero".
 */
export const ScoreInput = ({
  value,
  max,
  step = 0.5,
  onChange,
  disabled,
  label,
  hint,
}: {
  value: number | null;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}) => {
  const [draft, setDraft] = useState<string>(value === null ? '' : String(value));

  // Two taps inside one render would both read the same stale prop, so the
  // latest value is tracked here as well and updated as soon as a tap lands.
  const latest = useRef(value);

  useEffect(() => {
    latest.current = value;
    setDraft(value === null ? '' : String(value));
  }, [value]);

  const clamp = (next: number) => Math.min(max, Math.max(0, Math.round(next * 100) / 100));

  const commit = (next: number) => {
    latest.current = next;
    onChange(next);
  };

  const nudge = (delta: number) => commit(clamp((latest.current ?? 0) + delta));

  const commitDraft = () => {
    if (draft.trim() === '') {
      setDraft(value === null ? '' : String(value));
      return;
    }
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) commit(clamp(parsed));
    else setDraft(value === null ? '' : String(value));
  };

  const filled = value === null ? 0 : (value / max) * 100;

  return (
    <div
      className={cn(
        'rounded-xl border bg-surface p-4 transition-colors',
        value === null ? 'border-border' : 'border-primary/30 bg-primary-soft/30',
      )}
    >
      {/* The maximum is shown once, beside the value, rather than repeated in
          a corner label at a third type size. */}
      <div className="mb-3 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-body font-medium text-foreground">{label}</p>
        {hint && (
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-caption text-muted-foreground">
            {hint}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={disabled || (value ?? 0) <= 0}
          onClick={() => nudge(-step)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors active:bg-muted disabled:border-border/60 disabled:bg-surface-sunken disabled:text-muted-foreground/70"
        >
          <Minus size={20} />
        </button>

        <div className="flex-1">
          {/* A bordered field, because a bare number does not look typable.
              Value and maximum share one size and one family so the pair reads
              as a single figure. */}
          <div className="flex items-center justify-center gap-1.5">
            <input
              type="text"
              inputMode="decimal"
              disabled={disabled}
              value={draft}
              placeholder="–"
              aria-label={`${label}, out of ${max}`}
              onChange={(event) => {
                const next = event.target.value.replace(/[^0-9.]/g, '');
                setDraft(next);

                // Commit while typing so the running total keeps up, but only
                // once the number is in range: "85" on the way to "8.5" would
                // otherwise be clamped to the maximum mid-keystroke.
                const parsed = Number(next);
                if (next !== '' && Number.isFinite(parsed) && parsed >= 0 && parsed <= max) {
                  commit(parsed);
                }
              }}
              onFocus={(event) => event.target.select()}
              onBlur={commitDraft}
              onKeyDown={(event) => {
                if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
              }}
              className={cn(
                'tnum h-12 w-[4.5rem] rounded-lg border bg-surface text-center text-[1.375rem] font-semibold leading-none',
                'text-foreground placeholder:font-normal placeholder:text-muted-foreground',
                'focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/25',
                'disabled:bg-surface-sunken disabled:text-muted-foreground',
                value === null ? 'border-border-strong' : 'border-primary/40',
              )}
            />
            {/* Fixed width so a "/ 5" row and a "/ 10" row keep their fields
                on the same vertical line down the sheet. */}
            <span className="tnum w-[3.25rem] text-left text-[1.375rem] font-medium leading-none text-muted-foreground">
              / {max}
            </span>
          </div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200"
              style={{ width: `${filled}%` }}
            />
          </div>
        </div>

        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={disabled || (value ?? 0) >= max}
          onClick={() => nudge(step)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors active:bg-muted disabled:border-border/60 disabled:bg-surface-sunken disabled:text-muted-foreground/70"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
};
