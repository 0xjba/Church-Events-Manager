import { useRef } from 'react';
import type { ReactNode } from 'react';
import { DownloadSimple, FileCsv } from '@phosphor-icons/react';
import { Button } from '@/components/ui/primitives';
import { TEMPLATES, downloadTemplate, type TemplateKey } from '@/utils/importTemplates';

/**
 * The upload half of every import sheet: the expected columns, a template to
 * download, and the file picker. Every importer shows the same thing, taken
 * from one definition, so a screen cannot offer a template the parser will
 * reject.
 */
/** Problems found before anything is written, listed with their row numbers. */
export const ImportIssues = ({
  errors,
  tone = 'danger',
  title,
}: {
  errors: string[];
  tone?: 'danger' | 'warning';
  title: string;
}) => {
  if (errors.length === 0) return null;

  return (
    <div
      className={
        tone === 'danger'
          ? 'rounded-xl border border-destructive/30 bg-destructive-soft p-3'
          : 'rounded-xl border border-warning/30 bg-warning-soft p-3'
      }
    >
      <p className={tone === 'danger' ? 'text-caption font-semibold text-destructive' : 'text-caption font-semibold text-warning'}>
        {title}
      </p>
      <ul className="scrollbar-thin mt-1.5 max-h-40 space-y-0.5 overflow-y-auto">
        {errors.map((error) => (
          <li
            key={error}
            className={tone === 'danger' ? 'text-caption text-destructive/90' : 'text-caption text-warning'}
          >
            {error}
          </li>
        ))}
      </ul>
    </div>
  );
};

/** A file that has been read: its name, and how many rows it holds. */
export const ImportSummary = ({ file, rows, label }: { file: File; rows: number; label: string }) => (
  <div className="flex items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2">
    <FileCsv size={15} className="text-muted-foreground" />
    <span className="min-w-0 flex-1 truncate text-caption text-foreground">{file.name}</span>
    <span className="tnum shrink-0 text-caption text-muted-foreground">
      {rows} {label}
    </span>
  </div>
);

export const ImportPanel = ({
  template,
  onFile,
  disabled,
  children,
}: {
  template: TemplateKey;
  onFile: (file: File) => void;
  disabled?: boolean;
  children?: ReactNode;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const definition = TEMPLATES[template];

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-surface-sunken p-3">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-caption font-medium text-foreground">Required columns</p>
            <p className="mt-0.5 text-caption text-muted-foreground">{definition.note}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<DownloadSimple size={14} />}
            onClick={() => downloadTemplate(template)}
          >
            Template
          </Button>
        </div>
        <code className="block overflow-x-auto whitespace-nowrap rounded-lg bg-surface px-2.5 py-2 text-caption text-muted-foreground">
          {definition.headers.join(',')}
        </code>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(changeEvent) => {
          const file = changeEvent.target.files?.[0];
          if (file) onFile(file);
          changeEvent.target.value = '';
        }}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:border-primary hover:bg-primary-soft/40 disabled:opacity-50"
      >
        <FileCsv size={28} className="text-muted-foreground" />
        <span className="text-body font-medium text-foreground">Choose a CSV file</span>
        <span className="text-caption text-muted-foreground">{definition.file}</span>
      </button>

      {children}
    </div>
  );
};
