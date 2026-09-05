import { useState } from 'react';
import type { ReactNode } from 'react';
import { Table } from 'antd';
import type { TableProps } from 'antd';
import { ArrowsInLineVertical, ArrowsOutLineVertical } from '@phosphor-icons/react';
import { EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/**
 * Admin tables.
 *
 * Density is a preference, not a house style, so the toggle ships rather than
 * guessing whether this admin wants air or rows. The table keeps its own
 * horizontal scroll so a wide table never widens the page.
 */
export function DataTable<T extends object>({
  columns,
  dataSource,
  rowKey,
  loading,
  rowSelection,
  pagination,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  emptyIcon,
  emptyAction,
  toolbar,
  footer,
  scrollX = 900,
  className,
}: {
  columns: TableProps<T>['columns'];
  dataSource: T[];
  rowKey: string;
  loading?: boolean;
  rowSelection?: TableProps<T>['rowSelection'];
  pagination?: TableProps<T>['pagination'];
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  scrollX?: number;
  className?: string;
}) {
  const [compact, setCompact] = useState(false);

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-surface shadow-card', className)}>
      {(toolbar || dataSource.length > 0) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">{toolbar}</div>
          <div className="flex shrink-0 items-center gap-1 rounded-lg bg-surface-sunken p-0.5">
            <DensityButton
              active={!compact}
              label="Comfortable rows"
              onClick={() => setCompact(false)}
              icon={<ArrowsOutLineVertical size={15} />}
            />
            <DensityButton
              active={compact}
              label="Compact rows"
              onClick={() => setCompact(true)}
              icon={<ArrowsInLineVertical size={15} />}
            />
          </div>
        </div>
      )}

      {/* lovable-tagger cannot parse generic type arguments in JSX, so the
          element stays untyped here and the wrapper's props carry the types. */}
      <Table
        columns={columns as TableProps<Record<string, unknown>>['columns']}
        dataSource={dataSource as Record<string, unknown>[]}
        rowKey={rowKey}
        loading={loading}
        rowSelection={rowSelection as TableProps<Record<string, unknown>>['rowSelection']}
        size={compact ? 'small' : 'middle'}
        pagination={
          pagination === false
            ? false
            : {
                pageSize: compact ? 25 : 12,
                showSizeChanger: false,
                hideOnSinglePage: true,
                ...(typeof pagination === 'object' ? pagination : {}),
              }
        }
        scroll={{ x: scrollX }}
        locale={{
          emptyText: (
            <EmptyState
              icon={emptyIcon}
              title={emptyTitle}
              description={emptyDescription}
              action={emptyAction}
            />
          ),
        }}
      />

      {footer && <div className="border-t border-border px-4 py-3">{footer}</div>}
    </div>
  );
}

const DensityButton = ({
  active,
  label,
  onClick,
  icon,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  icon: ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    aria-pressed={active}
    title={label}
    className={cn(
      'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
      active ? 'bg-surface text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
    )}
  >
    {icon}
  </button>
);
