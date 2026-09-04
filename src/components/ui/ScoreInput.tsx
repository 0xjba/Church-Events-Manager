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
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-body font-medium text-foreground">{label}</p>
          {hint && <p className="text-caption text-muted-foreground">{hint}</p>}
        </div>
        <span className="tnum shrink-0 text-caption text-muted-foreground">max {max}</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={disabled || (value ?? 0) <= 0}
          onClick={() => nudge(-step)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors active:bg-muted disabled:opacity-40"
        >
          <Minus size={20} />
        </button>

        <div className="flex-1">
          <div className="flex items-baseline justify-center gap-1">
            <input
              type="text"
              inputMode="decimal"
              disabled={disabled}
              value={draft}
              placeholder="—"
              aria-label={label}
              onChange={(event) => setDraft(event.target.value.replace(/[^0-9.]/g, ''))}
              onBlur={commitDraft}
              onKeyDown={(event) => {
                if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
              }}
              className="tnum w-20 border-none bg-transparent p-0 text-center text-metric font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <span className="tnum text-body text-muted-foreground">/ {max}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
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
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-foreground transition-colors active:bg-muted disabled:opacity-40"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
};
