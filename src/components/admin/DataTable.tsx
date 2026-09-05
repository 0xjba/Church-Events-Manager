import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Table } from 'antd';
import type { TableProps } from 'antd';
import { EmptyState } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/**
 * Admin tables.
 *
 * The table keeps its own horizontal scroll so a wide table never widens the
 * page. Pass `onReorder` to let an admin drag rows into a new order; the table
 * only reports the move, the page owns what the order means and how it is
 * saved.
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
  actions,
  footer,
  scrollX = 900,
  className,
  onReorder,
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
  actions?: ReactNode;
  footer?: ReactNode;
  scrollX?: number;
  className?: string;
  onReorder?: (from: number, to: number) => void;
}) {
  // The row being dragged lives in a ref: it changes on every dragover and
  // re-rendering the table mid-drag drops the drag.
  const dragFrom = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const rowProps: TableProps<Record<string, unknown>>['onRow'] = onReorder
    ? (_record, index) => ({
        draggable: true,
        onDragStart: () => {
          dragFrom.current = index ?? null;
        },
        onDragOver: (dragEvent) => {
          dragEvent.preventDefault();
          if (index !== dragOver) setDragOver(index ?? null);
        },
        onDrop: () => {
          const from = dragFrom.current;
          if (from !== null && index !== undefined && from !== index) onReorder(from, index);
          dragFrom.current = null;
          setDragOver(null);
        },
        onDragEnd: () => {
          dragFrom.current = null;
          setDragOver(null);
        },
      })
    : undefined;

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-surface shadow-card', className)}>
      {(toolbar || actions) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">{toolbar}</div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
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
        size="middle"
        onRow={rowProps}
        rowClassName={(_row, index) =>
          onReorder
            ? cn('cursor-grab active:cursor-grabbing', index === dragOver && 'bg-primary/10')
            : ''
        }
        pagination={
          pagination === false
            ? false
            : {
                pageSize: 12,
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
