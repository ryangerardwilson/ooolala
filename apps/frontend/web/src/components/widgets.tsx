import type {ButtonHTMLAttributes, FormEventHandler, InputHTMLAttributes, MouseEventHandler, ReactNode} from 'react';
import {BookOpen, Copy, Download, ExternalLink} from 'lucide-react';
import * as layout from './layout';
import {TerminalSignalWordmark} from './terminal-signal';

export type CopyState = 'idle' | 'copied' | 'failed';

export function TerminalMark() {
  return (
    <span
      aria-hidden="true"
      className="grid h-[18px] w-[18px] place-items-center border border-[var(--oo-accent)] font-mono text-[10px] leading-none text-[var(--oo-accent)]"
    >
      &gt;
    </span>
  );
}

function GithubMark({size = 13}: {size?: number}) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .3C5.37.3 0 5.67 0 12.3c0 5.3 3.44 9.8 8.2 11.38.6.11.82-.26.82-.58v-2.03c-3.34.72-4.04-1.61-4.04-1.61-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.23 1.84 1.23 1.07 1.84 2.8 1.31 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23.96-.27 1.98-.4 3-.41 1.02.01 2.04.14 3 .41 2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.47 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12.02 12.02 0 0 0 24 12.3C24 5.67 18.63.3 12 .3Z" />
    </svg>
  );
}

export function Button({
  children,
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {variant?: 'primary' | 'secondary' | 'ghost'}) {
  const variants = {
    primary: 'border-[var(--oo-accent)] bg-[var(--oo-accent)] text-[var(--oo-accent-text)]',
    secondary: 'border-[var(--oo-line)] bg-[var(--oo-panel)] text-[var(--oo-fg)] hover:border-[var(--oo-accent)]',
    ghost: 'border-[var(--oo-line)] bg-transparent text-[var(--oo-fg)] hover:border-[var(--oo-accent)]'
  };

  return (
    <button
      className={`inline-flex h-10 items-center justify-center gap-2 border px-4 text-sm disabled:opacity-50 ${variants[variant]} ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({children, className = '', ...props}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`grid h-9 w-9 place-items-center border border-[var(--oo-line)] bg-[var(--oo-panel)] text-[var(--oo-fg)] hover:border-[var(--oo-accent)] ${className}`}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement> & {label: string}) {
  const {label, className = '', ...inputProps} = props;

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-[var(--oo-muted)]">{label}</span>
      <input
        className={`h-10 w-full border border-[var(--oo-line)] bg-[var(--oo-panel-strong)] px-3 text-sm text-[var(--oo-fg)] outline-none transition focus:border-[var(--oo-accent)] ${className}`}
        {...inputProps}
      />
    </label>
  );
}

export function StatusText({children}: {children: ReactNode}) {
  if (!children) return null;
  return <p className="mt-4 text-sm leading-6 text-[var(--oo-warning)]">{children}</p>;
}

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

export function OpeningPanel({status}: {status: string}) {
  return (
    <layout.Surface>
      <main className="grid h-[100svh] place-items-center overflow-hidden px-4">
        <layout.Panel className="w-full max-w-[360px] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.28)]">
          <layout.Inline className="mb-3">
            <TerminalMark />
            <h1 className="text-base font-semibold">ooolala</h1>
          </layout.Inline>
          <p className="text-sm text-[var(--oo-muted)]">opening chat...</p>
          {status && <p className="mt-3 text-xs text-[var(--oo-warning)]">{status}</p>}
        </layout.Panel>
      </main>
    </layout.Surface>
  );
}

export function Landing({
  authLabel = 'open web app',
  docsHref,
  githubHref,
  installCommand,
  installCopyState,
  authCommand,
  authCopyState,
  firstDmCommand,
  firstDmCopyState,
  tuiCommand,
  tuiCopyState,
  onCopyInstall,
  onCopyAuth,
  onCopyFirstDm,
  onCopyTui,
  webHref
}: {
  authLabel?: string;
  docsHref?: string;
  githubHref: string;
  installCommand: string;
  installCopyState: CopyState;
  authCommand: string;
  authCopyState: CopyState;
  firstDmCommand: string;
  firstDmCopyState: CopyState;
  tuiCommand: string;
  tuiCopyState: CopyState;
  onCopyInstall: () => void;
  onCopyAuth: () => void;
  onCopyFirstDm: () => void;
  onCopyTui: () => void;
  webHref: string;
}) {
  return (
    <layout.Surface>
      <main className="h-[100svh] overflow-hidden">
        <section className="relative h-[100svh] overflow-hidden px-4 py-2 sm:px-8 lg:px-12">
          <div className="oo-hero-vignette absolute inset-0" aria-hidden="true" />
          <div className="oo-terminal-grid absolute inset-0 opacity-20" aria-hidden="true" />
          <TerminalSignalWordmark />
          <div className="relative z-10 flex h-[calc(100svh-1rem)] flex-col">
            <header className="flex h-8 shrink-0 items-center justify-between">
              <layout.Inline>
                <TerminalMark />
                <span className="text-sm font-semibold">ooolala</span>
              </layout.Inline>
              <nav className="flex items-center gap-2">
                {docsHref && (
                  <a
                    className="inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap border border-transparent bg-transparent px-2 font-mono text-[11px] text-[var(--oo-muted)] no-underline transition hover:text-[var(--oo-fg)]"
                    href={docsHref}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <BookOpen size={13} aria-hidden="true" />
                    <span>docs</span>
                  </a>
                )}
                <a
                  className="inline-flex h-7 w-7 items-center justify-center border border-transparent bg-transparent text-[var(--oo-muted)] no-underline transition hover:text-[var(--oo-fg)]"
                  aria-label="open GitHub repository in new tab"
                  href={githubHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  <GithubMark />
                </a>
                <a
                  className="inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap border border-[rgba(240,241,237,0.22)] bg-transparent px-2.5 font-mono text-[11px] text-[var(--oo-muted)] no-underline transition hover:border-[rgba(76,201,166,0.62)] hover:text-[var(--oo-fg)] sm:px-3"
                  aria-label="open web app in new tab"
                  href={webHref}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span>{authLabel}</span>
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              </nav>
            </header>

            <div className="oo-landing-stage flex min-h-0 min-w-0 flex-1 justify-start">
              <div className="mx-auto min-w-0 max-w-[700px] animate-[oo-rise_520ms_ease-out_both] text-center">
                <p className="mb-1 font-mono text-[10px] uppercase text-[var(--oo-accent)]">terminal-native chat</p>
                <h1 className="oo-landing-title mx-auto max-w-[700px] text-balance text-[1.55rem] font-semibold leading-[1.12] text-[var(--oo-fg-soft)] sm:text-[2.35rem] lg:text-[2.8rem]">
                  Codex and Claude are in your terminal. Keep the chat there too.
                </h1>
                <p className="oo-landing-copy mx-auto mt-2 max-w-[520px] text-xs leading-4 text-[var(--oo-muted)] sm:text-[13px]">
                  Send DMs from the CLI, keep the room open in the TUI, use web only when needed.
                </p>
                <div className="oo-landing-commands mx-auto mt-4 max-w-[600px]">
                  <div className="grid gap-2">
                    <CopyCommand
                      command={installCommand}
                      copyState={installCopyState}
                      copyLabel="install"
                      stepLabel="01"
                      title="install"
                      onCopy={onCopyInstall}
                    />
                    <CopyCommand
                      command={authCommand}
                      copyState={authCopyState}
                      copyLabel="auth"
                      stepLabel="02"
                      title="auth"
                      onCopy={onCopyAuth}
                    />
                    <CopyCommand
                      command={firstDmCommand}
                      copyState={firstDmCopyState}
                      copyLabel="first dm"
                      stepLabel="03"
                      title="send bob"
                      onCopy={onCopyFirstDm}
                    />
                    <CopyCommand
                      command={tuiCommand}
                      copyState={tuiCopyState}
                      copyLabel="tui"
                      stepLabel="04"
                      title="open tui"
                      onCopy={onCopyTui}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </layout.Surface>
  );
}

export function AuthPanel({
  fields,
  submitControl,
  status,
  onSubmit
}: {
  fields: ReactNode;
  submitControl: ReactNode;
  status: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  return (
    <layout.Surface>
      <main className="h-[100svh] overflow-hidden">
        <section className="relative h-[100svh] overflow-hidden px-5 py-3 sm:px-8 lg:px-12">
          <div className="oo-hero-vignette absolute inset-0" aria-hidden="true" />
          <div className="oo-terminal-grid absolute inset-0 opacity-20" aria-hidden="true" />
          <div className="relative z-10 flex h-[calc(100svh-1.5rem)] flex-col">
            <header className="flex h-8 shrink-0 items-center justify-between">
              <layout.Inline>
                <TerminalMark />
                <span className="text-sm font-semibold">ooolala</span>
              </layout.Inline>
            </header>

            <div className="grid flex-1 place-items-center py-3 sm:py-4">
              <form
                className="w-full max-w-[360px] animate-[oo-rise_420ms_ease-out_both] border border-[var(--oo-line)] bg-[rgba(23,25,20,0.78)] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.34)] backdrop-blur"
                onSubmit={onSubmit}
              >
                <h1 className="text-xl font-semibold">Sign in</h1>
                <p className="mt-1.5 text-xs leading-5 text-[var(--oo-muted)]">
                  Use the same username and password you use in the CLI.
                </p>
                <div className="mt-4 grid gap-2.5">{fields}</div>
                {submitControl}
                <StatusText>{status}</StatusText>
              </form>
            </div>
          </div>
        </section>
      </main>
    </layout.Surface>
  );
}

export function PasswordDialog({
  status,
  headerIcon,
  fields,
  submitControl,
  onCancel,
  onSubmit,
  onBackdropMouseDown,
  onDialogMouseDown,
  contained = false
}: {
  status: string;
  headerIcon: ReactNode;
  fields: ReactNode;
  submitControl: ReactNode;
  onCancel: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onBackdropMouseDown: MouseEventHandler<HTMLDivElement>;
  onDialogMouseDown: MouseEventHandler<HTMLFormElement>;
  contained?: boolean;
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
            {headerIcon}
            <h2 className="text-sm font-semibold">change password</h2>
          </layout.Inline>
          <Button className="h-8 px-3 text-[var(--oo-muted)]" onClick={onCancel}>
            cancel
          </Button>
        </div>
        <div className="grid gap-3">{fields}</div>
        {submitControl}
        {status && <p className="mt-3 text-sm text-[var(--oo-warning)]">{status}</p>}
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

export function DocsShell({
  appName,
  githubHref,
  installCommand,
  copyStates,
  onCopyCommand
}: {
  appName: string;
  githubHref: string;
  installCommand: string;
  copyStates: Record<string, CopyState>;
  onCopyCommand: (key: string, command: string) => void;
}) {
  const authCommand = `${appName} auth`;
  const firstMessageCommand = `${appName} send bob "hello"`;
  const tuiCommand = `${appName} tui`;
  const versionCommand = `${appName} version`;
  const skillsCommand = `${appName} skills`;

  return (
    <layout.Surface>
      <main className="h-[100svh] overflow-hidden bg-[var(--oo-bg)] text-[var(--oo-fg)]">
        <div className="mx-auto flex h-full w-full max-w-[1080px] flex-col px-4 py-3 sm:px-6">
          <header className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--oo-line)]">
            <layout.Inline>
              <TerminalMark />
              <span className="text-sm font-semibold">ooolala</span>
              <span className="font-mono text-[11px] text-[var(--oo-muted)]">docs</span>
            </layout.Inline>
            <a
              className="inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap border border-transparent bg-transparent px-2 font-mono text-[11px] text-[var(--oo-muted)] no-underline transition hover:text-[var(--oo-fg)]"
              aria-label="open GitHub repository in new tab"
              href={githubHref}
              rel="noreferrer"
              target="_blank"
            >
              <GithubMark />
              <span className="hidden sm:inline">github</span>
            </a>
          </header>

          <div className="grid min-h-0 flex-1 gap-4 pt-4 md:grid-cols-[172px_minmax(0,1fr)]">
            <aside className="oo-scrollbar-hidden min-w-0 shrink-0 overflow-x-auto border-b border-[var(--oo-line)] pb-2 md:border-b-0 md:border-r md:pb-0 md:pr-4">
              <nav className="flex min-w-max gap-3 font-mono text-[11px] text-[var(--oo-muted)] md:grid md:min-w-0 md:gap-2">
                {[
                  ['install', '#install'],
                  ['auth', '#auth'],
                  ['messages', '#messages'],
                  ['files', '#files'],
                  ['TUI', '#tui'],
                  ['versions', '#versions'],
                  ['agents', '#agents']
                ].map(([label, href]) => (
                  <a className="no-underline hover:text-[var(--oo-fg)]" href={href} key={href}>
                    {label}
                  </a>
                ))}
              </nav>
            </aside>

            <article className="oo-scrollbar-hidden min-h-0 overflow-auto pr-1">
              <section className="max-w-[720px] pb-12">
                <div id="install" className="scroll-mt-4">
                  <p className="font-mono text-[10px] uppercase text-[var(--oo-accent)]">command index</p>
                  <h1 className="mt-1 max-w-[620px] text-2xl font-semibold leading-tight text-[var(--oo-fg-soft)] sm:text-3xl">
                    Ooolala docs
                  </h1>
                  <p className="mt-2 max-w-[560px] text-sm leading-6 text-[var(--oo-muted)]">
                    Install, auth, send DMs, move files, open the TUI, check versions, and print agent instructions.
                  </p>
                  <p className="mt-2 max-w-[560px] text-xs leading-5 text-[var(--oo-muted)]">
                    CLI first. TUI second. Browser surface third. Account creation stays in terminal auth.
                  </p>
                  <div className="mt-4 grid w-full max-w-[620px] gap-2">
                    <CopyCommand
                      command={installCommand}
                      copyState={copyStates.install || 'idle'}
                      copyLabel="install"
                      stepLabel="01"
                      title="install"
                      onCopy={() => onCopyCommand('install', installCommand)}
                    />
                    <CopyCommand
                      command={authCommand}
                      copyState={copyStates.auth || 'idle'}
                      copyLabel="auth"
                      stepLabel="02"
                      title="auth"
                      onCopy={() => onCopyCommand('auth', authCommand)}
                    />
                    <CopyCommand
                      command={firstMessageCommand}
                      copyState={copyStates.send || 'idle'}
                      copyLabel="first message"
                      stepLabel="03"
                      title="send bob"
                      onCopy={() => onCopyCommand('send', firstMessageCommand)}
                    />
                    <CopyCommand
                      command={tuiCommand}
                      copyState={copyStates.tui || 'idle'}
                      copyLabel="tui"
                      stepLabel="04"
                      title="open tui"
                      onCopy={() => onCopyCommand('tui', tuiCommand)}
                    />
                  </div>
                </div>

                <DocsSection id="auth" title="Auth">
                  <p>Use one terminal verb. Auth creates the account when the handle is free, or signs in when it already exists.</p>
                  <DocsGrid>
                    <CopyCommand command={authCommand} copyState={copyStates.auth || 'idle'} copyLabel="auth" title="save credentials" onCopy={() => onCopyCommand('auth', authCommand)} />
                    <StaticCommand title="account" command={`${appName} signout\n${appName} password\n${appName} who`} />
                  </DocsGrid>
                </DocsSection>

                <DocsSection id="messages" title="Messages">
                  <p>Direct messages require the other user's exact handle. Known chats are stored by the backend.</p>
                  <DocsGrid>
                    <CopyCommand command={firstMessageCommand} copyState={copyStates.send || 'idle'} copyLabel="send" title="send bob" onCopy={() => onCopyCommand('send', firstMessageCommand)} />
                    <StaticCommand title="stdin" command={`echo "hello from stdin" | ${appName} send bob -`} />
                    <StaticCommand title="read" command={`${appName} read bob\n${appName} read bob last 10\n${appName} read bob unread incoming`} />
                    <StaticCommand title="watch" command={`${appName} watch bob incoming`} />
                    <StaticCommand title="chat list" command={`${appName} open bob\n${appName} close bob`} />
                  </DocsGrid>
                </DocsSection>

                <DocsSection id="files" title="Files">
                  <p>Attach small files from the CLI. Directory paths are archived before upload.</p>
                  <DocsGrid>
                    <StaticCommand title="send files" command={`${appName} send bob "redacted log attached" attach ./run.log`} />
                    <StaticCommand title="download files" command={`${appName} download <message-id> <attachment-id> .`} />
                  </DocsGrid>
                  <p className="mt-2 text-xs text-[var(--oo-muted)]">Defaults: 5 files, 5 MiB each, 15 MiB total per message.</p>
                </DocsSection>

                <DocsSection id="tui" title="TUI">
                  <p>The TUI uses saved CLI auth. It opens the chats list first, then enters a selected chat.</p>
                  <DocsGrid>
                    <CopyCommand command={tuiCommand} copyState={copyStates.tui || 'idle'} copyLabel="tui" title="launch" onCopy={() => onCopyCommand('tui', tuiCommand)} />
                    <StaticCommand title="keys" command={'j/k move\nenter opens chat\nesc returns to chats\nn starts a new chat\ndd closes a chat'} />
                  </DocsGrid>
                </DocsSection>

                <DocsSection id="versions" title="Versioning">
                  <p>Use the compatibility vector to catch mismatched CLI, backend, database, auth, and UI contracts.</p>
                  <DocsGrid>
                    <CopyCommand command={versionCommand} copyState={copyStates.version || 'idle'} copyLabel="version" title="check" onCopy={() => onCopyCommand('version', versionCommand)} />
                    <StaticCommand title="upgrade" command={`${appName} upgrade`} />
                  </DocsGrid>
                </DocsSection>

                <DocsSection id="agents" title="Agent Instructions">
                  <p>Print the agent-facing usage notes before handing Ooolala to Codex or Claude in another terminal session.</p>
                  <DocsGrid>
                    <CopyCommand command={skillsCommand} copyState={copyStates.skills || 'idle'} copyLabel="skills" title="agent instructions" onCopy={() => onCopyCommand('skills', skillsCommand)} />
                  </DocsGrid>
                </DocsSection>
              </section>
            </article>
          </div>
        </div>
      </main>
    </layout.Surface>
  );
}

function DocsSection({children, id, title}: {children: ReactNode; id: string; title: string}) {
  return (
    <section className="mt-9 scroll-mt-4 border-t border-[var(--oo-line)] pt-5 text-sm leading-6 text-[var(--oo-muted)]" id={id}>
      <h2 className="mb-2 text-base font-semibold text-[var(--oo-fg-soft)]">{title}</h2>
      {children}
    </section>
  );
}

function DocsGrid({children}: {children: ReactNode}) {
  return <div className="mt-3 grid w-full max-w-[620px] gap-2">{children}</div>;
}

function StaticCommand({command, title}: {command: string; title: string}) {
  return (
    <div className="w-full min-w-0 overflow-hidden border border-[rgba(240,241,237,0.12)] bg-[rgba(240,241,237,0.045)] px-3 py-2">
      <p className="mb-1 text-[10px] font-medium lowercase leading-3 text-[var(--oo-muted)]">{title}</p>
      <pre className="overflow-x-auto whitespace-pre font-mono text-[11px] leading-5 text-[var(--oo-fg)]">{command}</pre>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MiB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${bytes} B`;
}
