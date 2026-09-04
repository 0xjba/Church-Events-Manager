import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Filters and bulk actions above a table: search first, actions right. */
export const Toolbar = ({
  children,
  selectionCount,
  selectionActions,
  className,
}: {
  children?: ReactNode;
  selectionCount?: number;
  selectionActions?: ReactNode;
  className?: string;
}) => {
  if (selectionCount) {
    return (
      <div className={cn('flex flex-wrap items-center gap-3', className)}>
        <span className="tnum rounded-lg bg-primary-soft px-2.5 py-1 text-caption font-medium text-primary-strong">
          {selectionCount} selected
        </span>
        {selectionActions}
      </div>
    );
  }

  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>;
};
