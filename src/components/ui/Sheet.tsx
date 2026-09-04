import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Bottom sheet on phones, centred dialog from md up. Actions sit at the bottom
 * of the sheet, inside thumb reach, rather than in a top-right corner.
 */
export const Sheet = ({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  size = 'md',
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  size?: 'md' | 'lg';
  dismissable?: boolean;
}) => {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissable) onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, dismissable]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-end justify-center md:items-center">
      <div
        className="absolute inset-0 animate-fade-in bg-foreground/40 backdrop-blur-[2px]"
        onClick={dismissable ? onClose : undefined}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col overflow-hidden bg-surface shadow-overlay',
          'animate-sheet-up rounded-t-2xl md:animate-slide-up md:rounded-2xl',
          size === 'lg' ? 'md:max-w-3xl' : 'md:max-w-lg',
        )}
      >
        {/* Drag affordance: signals the sheet can be dismissed downward. */}
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border-strong md:hidden" />

        {(title || dismissable) && (
          <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
            <div className="min-w-0">
              {title && <h2 className="text-title font-semibold text-foreground">{title}</h2>}
              {description && (
                <p className="mt-0.5 text-caption text-muted-foreground">{description}</p>
              )}
            </div>
            {dismissable && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 pb-2">{children}</div>

        {footer && (
          <div className="pb-safe border-t border-border bg-surface px-5 py-3">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
};
