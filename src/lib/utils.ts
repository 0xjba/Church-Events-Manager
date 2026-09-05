import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/*
 * tailwind-merge only knows Tailwind's stock font sizes, so it read custom
 * ones like `text-body` as text *colours* and dropped the real colour that
 * came before them — which is how primary buttons ended up with dark text on
 * a dark ground. Teaching it the custom scale fixes every such pair.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['caption', 'body', 'title', 'display', 'metric'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Scores come back as raw floats; show at most two decimals, no trailing zeros. */
export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return String(Math.round(value * 100) / 100);
}
