import {useEffect, useRef, type ChangeEventHandler, type FormEventHandler, type KeyboardEventHandler, type MouseEventHandler, type ReactNode, type Ref} from 'react';
import {ArrowLeft, BookOpen, ExternalLink, KeyRound, LogOut, Plus, RefreshCw, SendHorizontal} from 'lucide-react';
import * as layout from '../layout';
import * as patterns from '../l2/patterns';
import * as primitives from '../l1/primitives';
import {TerminalSignalWordmark} from './terminal-signal';

export type ChatAttachment = {
  id: string;
  filename: string;
  byteSize: number;
  contentType?: string;
  url?: string;
};

export type ChatMessage = {
  id: string;
  room: string;
  author: string;
  body: string;
  insertedAt: Date;
  attachments: ChatAttachment[];
};

export function OpeningPanel({status}: {status: string}) {
  return (
    <layout.Surface>
      <main className="grid h-[100svh] place-items-center overflow-hidden px-4">
        <layout.Panel className="w-full max-w-[360px] p-4 shadow-[0_18px_70px_rgba(0,0,0,0.28)]">
          <layout.Inline className="mb-3">
            <primitives.TerminalMark />
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
  installCopyState: patterns.CopyState;
  authCommand: string;
  authCopyState: patterns.CopyState;
  firstDmCommand: string;
  firstDmCopyState: patterns.CopyState;
  tuiCommand: string;
  tuiCopyState: patterns.CopyState;
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
                <primitives.TerminalMark />
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
                  <primitives.GithubMark />
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
                    <patterns.CopyCommand command={installCommand} copyState={installCopyState} copyLabel="install" stepLabel="01" title="install" onCopy={onCopyInstall} />
                    <patterns.CopyCommand command={authCommand} copyState={authCopyState} copyLabel="auth" stepLabel="02" title="auth" onCopy={onCopyAuth} />
                    <patterns.CopyCommand command={firstDmCommand} copyState={firstDmCopyState} copyLabel="first dm" stepLabel="03" title="send bob" onCopy={onCopyFirstDm} />
                    <patterns.CopyCommand command={tuiCommand} copyState={tuiCopyState} copyLabel="tui" stepLabel="04" title="open tui" onCopy={onCopyTui} />
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
                <primitives.TerminalMark />
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
                <primitives.StatusText className="mt-4">{status}</primitives.StatusText>
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
  fields,
  submitControl,
  onCancel,
  onSubmit,
  onBackdropMouseDown,
  onDialogMouseDown,
  contained = false
}: {
  status: string;
  fields: ReactNode;
  submitControl: ReactNode;
  onCancel: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onBackdropMouseDown: MouseEventHandler<HTMLDivElement>;
  onDialogMouseDown: MouseEventHandler<HTMLFormElement>;
  contained?: boolean;
}) {
  return (
    <patterns.DialogForm
      contained={contained}
      onBackdropMouseDown={onBackdropMouseDown}
      onDialogMouseDown={onDialogMouseDown}
      onSubmit={onSubmit}
      status={status}
      title="change password"
      titleIcon={<KeyRound size={15} color="var(--oo-accent)" />}
      actions={
        <primitives.Button className="text-[var(--oo-muted)]" onClick={onCancel} size="sm">
          cancel
        </primitives.Button>
      }
    >
      <div className="grid gap-3">{fields}</div>
      {submitControl}
    </patterns.DialogForm>
  );
}

export function ChatAppShell({
  children,
  detail,
  onLogout,
  onOpenPassword,
  status
}: {
  children: ReactNode;
  detail: string;
  onLogout: () => void;
  onOpenPassword: () => void;
  status: string;
}) {
  return (
    <layout.Surface>
      <main className="h-[100svh] overflow-hidden bg-[var(--oo-bg)] text-[var(--oo-fg)]">
        <div className="mx-auto flex h-full w-full max-w-[980px] flex-col overflow-hidden px-4 py-3 sm:py-4">
          <header className="mb-3 flex shrink-0 items-center justify-between">
            <div className="min-w-0">
              <layout.Inline>
                <primitives.TerminalMark />
                <h1 className="text-base font-semibold">ooolala</h1>
              </layout.Inline>
              <div className="mt-1 truncate text-xs text-[var(--oo-muted)]">{detail}</div>
            </div>
            <div className="flex items-center gap-2">
              <primitives.IconButton onClick={onOpenPassword} aria-label="change password">
                <KeyRound size={15} />
              </primitives.IconButton>
              <primitives.IconButton onClick={onLogout} aria-label="logout">
                <LogOut size={15} />
              </primitives.IconButton>
            </div>
          </header>

          {status && <div className="mb-4 border border-[var(--oo-line)] p-3 text-sm text-[var(--oo-warning)]">{status}</div>}

          {children}
        </div>
      </main>
    </layout.Surface>
  );
}

export function ChatListPanel({
  knownPeers,
  onOpenPeer,
  onSelectPeer,
  onStartNewChat,
  selectedChatIndex,
  selectedChatRef
}: {
  knownPeers: string[];
  onOpenPeer: (peer: string) => void;
  onSelectPeer: (index: number) => void;
  onStartNewChat: () => void;
  selectedChatIndex: number;
  selectedChatRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <section className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col overflow-hidden border border-[var(--oo-line)] bg-[var(--oo-panel)]">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--oo-line)] px-4">
        <h2 className="text-sm font-semibold text-[var(--oo-muted)]">chats</h2>
        {knownPeers.length > 0 && (
          <primitives.IconButton onClick={onStartNewChat} size="sm" variant="strong" aria-label="new chat">
            <Plus size={16} />
          </primitives.IconButton>
        )}
      </div>

      {knownPeers.length === 0 ? (
        <patterns.EmptyState
          action={
            <primitives.Button onClick={onStartNewChat} size="sm">
              <Plus size={15} />
              new chat
            </primitives.Button>
          }
        >
          no chats yet
        </patterns.EmptyState>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          {knownPeers.map((peer, index) => {
            const isSelected = index === selectedChatIndex;

            return (
              <patterns.ListButton
                ref={isSelected ? selectedChatRef : undefined}
                isSelected={isSelected}
                key={peer}
                onClick={() => onOpenPeer(peer)}
                onFocus={() => onSelectPeer(index)}
                onMouseEnter={() => onSelectPeer(index)}
              >
                <span>@{peer}</span>
                <span className={isSelected ? 'font-mono text-[var(--oo-accent)]' : 'font-mono text-[var(--oo-muted)]'}>&gt;</span>
              </patterns.ListButton>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function NewChatPanel({
  onBack,
  onPeerChange,
  onSubmit,
  peerDraft,
  peerInputRef
}: {
  onBack: () => void;
  onPeerChange: ChangeEventHandler<HTMLInputElement>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  peerDraft: string;
  peerInputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <section className="mx-auto flex min-h-0 w-full max-w-[560px] flex-1 flex-col">
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <primitives.IconButton onClick={onBack} aria-label="back to chats">
          <ArrowLeft size={16} />
        </primitives.IconButton>
        <h2 className="text-sm font-semibold text-[var(--oo-muted)]">new chat</h2>
      </div>

      <form className="flex items-end gap-2" onSubmit={onSubmit}>
        <patterns.FormField
          ref={peerInputRef}
          fieldClassName="min-w-0 flex-1"
          label="user"
          value={peerDraft}
          onChange={onPeerChange}
          placeholder="bob"
        />
        <primitives.IconButton disabled={peerDraft.trim().length === 0} type="submit" aria-label="start chat" size="lg">
          <SendHorizontal size={16} />
        </primitives.IconButton>
      </form>
    </section>
  );
}

export function ConversationPanel({
  activePeer,
  currentUsername,
  draft,
  messageInputRef,
  messages,
  onBack,
  onDownloadAttachment,
  onDraftChange,
  onMessageKeyDown,
  onRefresh,
  onSubmit,
  timeLabelFor,
  dateLabelFor
}: {
  activePeer: string;
  currentUsername: string;
  draft: string;
  messageInputRef?: Ref<HTMLTextAreaElement>;
  messages: ChatMessage[];
  onBack: () => void;
  onDownloadAttachment: (message: ChatMessage, attachment: ChatAttachment) => void;
  onDraftChange: ChangeEventHandler<HTMLTextAreaElement>;
  onMessageKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
  onRefresh: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  timeLabelFor: (date: Date) => string;
  dateLabelFor: (date: Date) => string;
}) {
  return (
    <layout.ChatShell className="mx-auto w-full max-w-[600px]">
      <layout.ChatHeader
        actions={
          <primitives.IconButton onClick={onRefresh} size="sm" variant="strong" aria-label="refresh">
            <RefreshCw size={14} />
          </primitives.IconButton>
        }
      >
        <div className="flex min-w-0 items-center gap-3">
          <primitives.IconButton onClick={onBack} size="sm" variant="strong" aria-label="back to chats">
            <ArrowLeft size={15} />
          </primitives.IconButton>
          <div className="min-w-0 truncate text-sm font-semibold">@{activePeer}</div>
        </div>
      </layout.ChatHeader>

      <ChatTranscript
        currentUsername={currentUsername}
        dateLabelFor={dateLabelFor}
        messages={messages}
        onDownloadAttachment={onDownloadAttachment}
        timeLabelFor={timeLabelFor}
      />

      <layout.ComposerDock>
        <form onSubmit={onSubmit}>
          <div className="flex items-end gap-2 border border-[var(--oo-line)] bg-[var(--oo-panel-strong)] px-3 py-2">
            <span className="pt-2 font-mono text-sm text-[var(--oo-muted)]">&gt;</span>
            <primitives.Textarea
              ref={messageInputRef}
              value={draft}
              onChange={onDraftChange}
              onKeyDown={onMessageKeyDown}
              aria-label="message"
              rows={1}
            />
            <primitives.IconButton disabled={draft.trim().length === 0} type="submit" aria-label="send message" variant="ghost">
              <SendHorizontal size={16} />
            </primitives.IconButton>
          </div>
        </form>
      </layout.ComposerDock>
    </layout.ChatShell>
  );
}

export function ChatTranscript({
  currentUsername,
  dateLabelFor,
  messages,
  onDownloadAttachment,
  timeLabelFor
}: {
  currentUsername: string;
  dateLabelFor: (date: Date) => string;
  messages: ChatMessage[];
  onDownloadAttachment: (message: ChatMessage, attachment: ChatAttachment) => void;
  timeLabelFor: (date: Date) => string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const previousTailRef = useRef<string | null>(null);
  let previousDateKey = '';

  useEffect(() => {
    const element = scrollRef.current;
    const tail = messages.length > 0 ? messageSignature(messages[messages.length - 1]) : 'empty';
    const previousTail = previousTailRef.current;

    previousTailRef.current = tail;

    if (!element) return;
    if (previousTail !== null && previousTail === tail) return;

    element.scrollTop = element.scrollHeight;
  }, [messages]);

  return (
    <layout.Transcript scrollRef={scrollRef}>
      {messages.length === 0 ? (
        <div className="grid min-h-full items-end justify-center pb-5 text-center text-sm text-[var(--oo-muted)]">
          no messages yet. write below.
        </div>
      ) : (
        messages.flatMap((message, messageIndex) => {
          const currentDateKey = dateKey(message.insertedAt);
          const rows = [];

          if (currentDateKey !== previousDateKey) {
            rows.push(<patterns.DateMarker key={`${currentDateKey}-${messageIndex}-header`} label={dateLabelFor(message.insertedAt)} />);
            previousDateKey = currentDateKey;
          }

          rows.push(
            <patterns.MessageBubble
              attachments={message.attachments}
              body={message.body}
              isMine={message.author === currentUsername}
              key={`${message.id}-${messageIndex}`}
              onDownloadAttachment={(attachment) => {
                const matched = message.attachments.find((candidate) => candidate.id === attachment.id);
                if (matched) onDownloadAttachment(message, matched);
              }}
              time={timeLabelFor(message.insertedAt)}
            />
          );
          return rows;
        })
      )}
    </layout.Transcript>
  );
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
  copyStates: Record<string, patterns.CopyState>;
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
              <primitives.TerminalMark />
              <span className="text-sm font-semibold">ooolala</span>
              <span className="font-mono text-[11px] text-[var(--oo-muted)]">docs</span>
            </layout.Inline>
            <a
              className="inline-flex h-7 w-7 items-center justify-center border border-transparent bg-transparent text-[var(--oo-muted)] no-underline transition hover:text-[var(--oo-fg)]"
              aria-label="open GitHub repository in new tab"
              href={githubHref}
              rel="noreferrer"
              target="_blank"
            >
              <primitives.GithubMark />
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
                    <patterns.CopyCommand command={installCommand} copyState={copyStates.install || 'idle'} copyLabel="install" stepLabel="01" title="install" onCopy={() => onCopyCommand('install', installCommand)} />
                    <patterns.CopyCommand command={authCommand} copyState={copyStates.auth || 'idle'} copyLabel="auth" stepLabel="02" title="auth" onCopy={() => onCopyCommand('auth', authCommand)} />
                    <patterns.CopyCommand command={firstMessageCommand} copyState={copyStates.send || 'idle'} copyLabel="first message" stepLabel="03" title="send bob" onCopy={() => onCopyCommand('send', firstMessageCommand)} />
                    <patterns.CopyCommand command={tuiCommand} copyState={copyStates.tui || 'idle'} copyLabel="tui" stepLabel="04" title="open tui" onCopy={() => onCopyCommand('tui', tuiCommand)} />
                  </div>
                </div>

                <DocsSection id="auth" title="Auth">
                  <p>Use one terminal verb. Auth creates the account when the handle is free, or signs in when it already exists.</p>
                  <patterns.CommandGrid>
                    <patterns.CopyCommand command={authCommand} copyState={copyStates.auth || 'idle'} copyLabel="auth" title="save credentials" onCopy={() => onCopyCommand('auth', authCommand)} />
                    <patterns.StaticCommand title="account" command={`${appName} signout\n${appName} password\n${appName} who`} />
                  </patterns.CommandGrid>
                </DocsSection>

                <DocsSection id="messages" title="Messages">
                  <p>Direct messages require the other user's exact handle. Known chats are stored by the backend.</p>
                  <patterns.CommandGrid>
                    <patterns.CopyCommand command={firstMessageCommand} copyState={copyStates.send || 'idle'} copyLabel="send" title="send bob" onCopy={() => onCopyCommand('send', firstMessageCommand)} />
                    <patterns.StaticCommand title="stdin" command={`echo "hello from stdin" | ${appName} send bob -`} />
                    <patterns.StaticCommand title="read" command={`${appName} read bob\n${appName} read bob last 10\n${appName} read bob unread incoming`} />
                    <patterns.StaticCommand title="watch" command={`${appName} watch bob incoming`} />
                    <patterns.StaticCommand title="chat list" command={`${appName} open bob\n${appName} close bob`} />
                  </patterns.CommandGrid>
                </DocsSection>

                <DocsSection id="files" title="Files">
                  <p>Attach small files from the CLI. Directory paths are archived before upload.</p>
                  <patterns.CommandGrid>
                    <patterns.StaticCommand title="send files" command={`${appName} send bob "redacted log attached" attach ./run.log`} />
                    <patterns.StaticCommand title="download files" command={`${appName} download <message-id> <attachment-id> .`} />
                  </patterns.CommandGrid>
                  <p className="mt-2 text-xs text-[var(--oo-muted)]">Defaults: 5 files, 5 MiB each, 15 MiB total per message.</p>
                </DocsSection>

                <DocsSection id="tui" title="TUI">
                  <p>The TUI uses saved CLI auth. It opens the chats list first, then enters a selected chat.</p>
                  <patterns.CommandGrid>
                    <patterns.CopyCommand command={tuiCommand} copyState={copyStates.tui || 'idle'} copyLabel="tui" title="launch" onCopy={() => onCopyCommand('tui', tuiCommand)} />
                    <patterns.StaticCommand title="keys" command={'j/k move\nenter opens chat\nesc returns to chats\nn starts a new chat\ndd closes a chat'} />
                  </patterns.CommandGrid>
                </DocsSection>

                <DocsSection id="versions" title="Versioning">
                  <p>Use the compatibility vector to catch mismatched CLI, backend, database, auth, and UI contracts.</p>
                  <patterns.CommandGrid>
                    <patterns.CopyCommand command={versionCommand} copyState={copyStates.version || 'idle'} copyLabel="version" title="check" onCopy={() => onCopyCommand('version', versionCommand)} />
                    <patterns.StaticCommand title="upgrade" command={`${appName} upgrade`} />
                  </patterns.CommandGrid>
                </DocsSection>

                <DocsSection id="agents" title="Agent Instructions">
                  <p>Print the agent-facing usage notes before handing Ooolala to Codex or Claude in another terminal session.</p>
                  <patterns.CommandGrid>
                    <patterns.CopyCommand command={skillsCommand} copyState={copyStates.skills || 'idle'} copyLabel="skills" title="agent instructions" onCopy={() => onCopyCommand('skills', skillsCommand)} />
                  </patterns.CommandGrid>
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

function messageSignature(message: ChatMessage) {
  return [
    message.room,
    message.author,
    message.insertedAt.getTime(),
    message.body,
    message.attachments.map((attachment) => `${attachment.id}:${attachment.filename}:${attachment.byteSize}`).join(',')
  ].join('\u001f');
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}
