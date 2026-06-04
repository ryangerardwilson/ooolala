import {forwardRef, type ButtonHTMLAttributes, type FormEventHandler, type InputHTMLAttributes, type MouseEventHandler, type ReactNode} from 'react';
import {Copy, Download} from 'lucide-react';
import * as layout from '../layout';
import * as primitives from '../l1/primitives';

export type CopyState = 'idle' | 'copied' | 'failed';

export const FormField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  labelClassName?: string;
  fieldClassName?: string;
  fieldSize?: primitives.ButtonSize;
}>(function FormField({
  label,
  labelClassName = '',
  fieldClassName = '',
  ...inputProps
}, ref) {
  return (
    <label className={`block text-sm ${fieldClassName}`}>
      <span className={`mb-1 block text-xs text-[var(--oo-muted)] ${labelClassName}`}>{label}</span>
      <primitives.Input ref={ref} {...inputProps} />
    </label>
  );
});

export function CopyCommand({
  command,
  copyState,
  copyLabel,
  stepLabel,
  title,
  hint,
  onCopy
}: {
  command: string;
  copyState: CopyState;
  copyLabel: string;
  stepLabel?: string;
  title?: string;
  hint?: string;
  onCopy: () => void;
}) {
  const label =
    copyState === 'idle' ? (
      <Copy size={16} />
    ) : (
      <span className="font-mono text-[9px] leading-none">{copyState === 'failed' ? 'copy failed' : copyState}</span>
    );

  return (
    <div className="oo-command-row group relative flex min-h-11 min-w-0 items-stretch overflow-hidden border border-[rgba(240,241,237,0.12)] bg-[rgba(240,241,237,0.055)] text-left backdrop-blur transition hover:border-[var(--oo-accent-muted)]">
      {stepLabel && (
        <div className="relative z-10 hidden w-11 shrink-0 place-items-center border-r border-[rgba(240,241,237,0.1)] font-mono text-[9px] uppercase text-[var(--oo-muted)] sm:grid">
          {stepLabel}
        </div>
      )}
      <div className="relative z-10 min-w-0 flex-1 px-3 py-1.5">
        {title && <p className="text-[10px] font-medium lowercase leading-3 text-[var(--oo-muted)]">{title}</p>}
        <code className="oo-command-code block min-w-0 overflow-x-auto whitespace-nowrap font-mono text-[11px] leading-4 text-[var(--oo-fg)] sm:text-xs">
          {command}
        </code>
        {hint && <p className="mt-0.5 text-[11px] leading-4 text-[var(--oo-muted)]">{hint}</p>}
      </div>
      <button
        aria-label={`copy ${copyLabel} command`}
        className="relative z-10 grid w-12 shrink-0 place-items-center border-l border-[rgba(240,241,237,0.1)] text-[11px] text-[var(--oo-muted)] transition hover:bg-[rgba(240,241,237,0.08)] hover:text-[var(--oo-fg)]"
        onClick={onCopy}
        type="button"
      >
        {label}
      </button>
    </div>
  );
}

export function CommandGrid({children}: {children: ReactNode}) {
  return <div className="mt-3 grid w-full max-w-[620px] gap-2">{children}</div>;
}

export function StaticCommand({command, title}: {command: string; title: string}) {
  return (
    <div className="w-full min-w-0 overflow-hidden border border-[rgba(240,241,237,0.12)] bg-[rgba(240,241,237,0.045)] px-3 py-2">
      <p className="mb-1 text-[10px] font-medium lowercase leading-3 text-[var(--oo-muted)]">{title}</p>
      <pre className="overflow-x-auto whitespace-pre font-mono text-[11px] leading-5 text-[var(--oo-fg)]">{command}</pre>
    </div>
  );
}

export function EmptyState({children, action}: {children: ReactNode; action?: ReactNode}) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center px-4 text-center">
      <div>
        <p className="text-sm leading-6 text-[var(--oo-muted)]">{children}</p>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export const ListButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {isSelected?: boolean}>(function ListButton({
  children,
  isSelected,
  className = '',
  type = 'button',
  ...props
}, ref) {
  return (
    <button
      ref={ref}
      className={[
        'flex h-12 w-full items-center justify-between border-b border-[var(--oo-line)] px-4 text-left text-sm last:border-b-0',
        isSelected ? 'bg-[var(--oo-panel-strong)] text-[var(--oo-fg)]' : 'text-[var(--oo-muted)] hover:bg-[var(--oo-panel-strong)] hover:text-[var(--oo-fg)]',
        className
      ].join(' ')}
      type={type}
      aria-current={isSelected ? 'true' : undefined}
      {...props}
    >
      {children}
    </button>
  );
});

export function DialogForm({
  actions,
  children,
  contained = false,
  onBackdropMouseDown,
  onDialogMouseDown,
  onSubmit,
  status,
  title,
  titleIcon
}: {
  actions?: ReactNode;
  children: ReactNode;
  contained?: boolean;
  onBackdropMouseDown: MouseEventHandler<HTMLDivElement>;
  onDialogMouseDown: MouseEventHandler<HTMLFormElement>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  status: string;
  title: string;
  titleIcon?: ReactNode;
}) {
  return (
    <layout.ModalLayer contained={contained} onMouseDown={onBackdropMouseDown}>
      <form
        aria-modal="true"
        className="w-full max-w-[420px] border border-[var(--oo-line)] bg-[var(--oo-panel)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.42)]"
        onMouseDown={onDialogMouseDown}
        onSubmit={onSubmit}
        role="dialog"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <layout.Inline className="min-w-0">
            {titleIcon}
            <h2 className="text-sm font-semibold">{title}</h2>
          </layout.Inline>
          {actions}
        </div>
        {children}
        {status && <primitives.StatusText className="mt-3">{status}</primitives.StatusText>}
      </form>
    </layout.ModalLayer>
  );
}

export type BubbleAttachment = {
  id: string;
  filename: string;
  byteSize: number;
};

export function MessageBubble({
  attachments = [],
  body,
  isMine,
  time,
  onDownloadAttachment
}: {
  attachments?: BubbleAttachment[];
  body: string;
  isMine: boolean;
  time: string;
  onDownloadAttachment?: (attachment: BubbleAttachment) => void;
}) {
  return (
    <article className={`flex py-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[min(78%,42rem)] flex-col ${isMine ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-[8px] px-3 py-1.5 text-sm leading-5 ${isMine ? 'border border-[var(--oo-line)] bg-[var(--oo-panel-strong)]' : 'bg-transparent'}`}>
          {body && <span className="block">{body}</span>}
          {attachments.length > 0 && (
            <div className="mt-1 grid gap-1">
              {attachments.map((attachment) => (
                <button
                  className="inline-flex max-w-full items-center gap-1.5 border border-[var(--oo-line)] bg-[rgba(240,241,237,0.05)] px-2 py-1 text-left text-[11px] leading-4 text-[var(--oo-fg)] hover:border-[var(--oo-accent)]"
                  key={attachment.id}
                  onClick={() => onDownloadAttachment?.(attachment)}
                  type="button"
                >
                  <Download size={12} className="shrink-0 text-[var(--oo-accent)]" />
                  <span className="min-w-0 truncate">{attachment.filename}</span>
                  <span className="shrink-0 font-mono text-[9px] text-[var(--oo-muted)]">{formatBytes(attachment.byteSize)}</span>
                </button>
              ))}
            </div>
          )}
          <span className={`mt-0.5 block font-mono text-[9px] leading-none text-[var(--oo-muted)] ${isMine ? 'text-right' : 'text-left'}`}>
            {time}
          </span>
        </div>
      </div>
    </article>
  );
}

export function DateMarker({label}: {label: string}) {
  return <div className="mt-4 mb-2 text-center font-mono text-xs text-[var(--oo-muted)] first:mt-0">-- {label} --</div>;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MiB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${bytes} B`;
}
