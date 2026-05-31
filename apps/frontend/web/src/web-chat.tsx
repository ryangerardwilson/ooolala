import {useEffect, useRef, useState, type FormEvent} from 'react';
import {ArrowLeft, KeyRound, LogIn, LogOut, Plus, RefreshCw, SendHorizontal, Terminal} from 'lucide-react';
import {widgets} from './components';

type Message = {
  id: string;
  room: string;
  author: string;
  body: string;
  insertedAt: Date;
  attachments: Attachment[];
};

type BackendMessage = {
  id: string;
  room: string;
  author: string;
  body: string;
  inserted_at: string;
  attachments?: BackendAttachment[];
};

type BackendAttachment = {
  id: string;
  filename: string;
  content_type: string;
  byte_size: number;
  url?: string;
};

type Attachment = {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  url?: string;
};

type Session = {
  username: string;
  password: string;
};

type AuthPayload = Session & {
  apiUrl?: string;
};

type AuthStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

type Step = 'chats' | 'newPeer' | 'chat';
type CopyState = 'idle' | 'copied' | 'failed';
type LandingCopyKey = 'install' | 'auth' | 'firstDm' | 'tui';

type WebChatProps = {
  apiUrl: string;
};

const webEnv = import.meta.env ?? {};
const appName = webEnv.VITE_OOOLALA_APP_NAME || 'ooolala';
const installCommand = webEnv.VITE_OOOLALA_INSTALL_COMMAND || defaultInstallCommand();
const welcomeUser = webEnv.VITE_OOOLALA_WELCOME_USER || 'bob';
const webPath = '/web';
const docsPath = '/docs';

export function isWebEscapeKey(event: Pick<KeyboardEvent, 'code' | 'ctrlKey' | 'key'>) {
  return event.key === 'Escape' || (event.ctrlKey && (event.key === '[' || event.code === 'BracketLeft'));
}

export function moveChatSelection(current: number, delta: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, current + delta));
}

export function normalizeChatSelection(current: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, current));
}

export function WebChat({apiUrl}: WebChatProps) {
  if (currentPathIs(docsPath)) return <DocsPage />;

  return <ChatApp apiUrl={apiUrl} />;
}

function ChatApp({apiUrl}: WebChatProps) {
  const [activeApiUrl, setActiveApiUrl] = useState(apiUrl);
  const [session, setSession] = useState<Session | null>(null);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
  const [step, setStep] = useState<Step>('chats');
  const [knownPeers, setKnownPeers] = useState<string[]>([]);
  const [selectedChatIndex, setSelectedChatIndex] = useState(0);
  const [peerDraft, setPeerDraft] = useState('');
  const [activePeer, setActivePeer] = useState('');
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState('');
  const selectedChatRef = useRef<HTMLButtonElement | null>(null);
  const peerInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);
  const deleteArmedRef = useRef(false);
  const deleteTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function applyAuthPayload(payload: AuthPayload, options: {clearLaunchAuth?: boolean} = {}) {
      const nextApiUrl = payload.apiUrl || apiUrl;

      setIsAutoLoggingIn(true);
      setActiveApiUrl(nextApiUrl);

      await loginWith(payload.username, payload.password, nextApiUrl, () => !cancelled);

      if (!cancelled) {
        if (options.clearLaunchAuth) clearLaunchAuthPayload(webPath);
        setIsAutoLoggingIn(false);
      }
    }

    function consumeLaunchAuth() {
      try {
        const launchAuth = readLaunchAuthPayload();

        if (!launchAuth) return false;

        void applyAuthPayload(launchAuth, {clearLaunchAuth: true});
        return true;
      } catch {
        clearLaunchAuthPayload();
        setIsAutoLoggingIn(false);
        setStatus('invalid web launch auth');
        return false;
      }
    }

    function consumeStoredAuth() {
      try {
        const storedAuth = readStoredAuthPayload();
        if (!storedAuth) return false;

        void applyAuthPayload(storedAuth);
        return true;
      } catch {
        clearStoredAuthPayload();
        return false;
      }
    }

    if (!consumeLaunchAuth() && currentPathIs(webPath)) consumeStoredAuth();

    window.addEventListener('hashchange', consumeLaunchAuth);

    return () => {
      cancelled = true;
      window.removeEventListener('hashchange', consumeLaunchAuth);
    };
  }, [apiUrl]);

  useEffect(() => {
    if (session && !currentPathIs(webPath)) replacePath(webPath);
  }, [session]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!session) return;
      const isEscape = isWebEscapeKey(event);

      if (isPasswordFormOpen) {
        if (!isEscape) return;
        event.preventDefault();
        clearDeleteShortcut();
        closePasswordModal();
        return;
      }

      if (isEscape && (step === 'chat' || step === 'newPeer')) {
        event.preventDefault();
        clearDeleteShortcut();
        setDraft('');
        setStatus('');
        setStep('chats');
        return;
      }

      if (step !== 'chats' || event.altKey || event.ctrlKey || event.metaKey) return;

      const selectedPeer = knownPeers[selectedChatIndex];

      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        clearDeleteShortcut();
        startNewChat();
        return;
      }

      if (knownPeers.length > 0 && (event.key === 'ArrowDown' || event.key.toLowerCase() === 'j')) {
        event.preventDefault();
        clearDeleteShortcut();
        setSelectedChatIndex((current) => moveChatSelection(current, 1, knownPeers.length));
        return;
      }

      if (knownPeers.length > 0 && (event.key === 'ArrowUp' || event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        clearDeleteShortcut();
        setSelectedChatIndex((current) => moveChatSelection(current, -1, knownPeers.length));
        return;
      }

      if (event.key.toLowerCase() === 'd' && selectedPeer) {
        event.preventDefault();

        if (deleteArmedRef.current) {
          clearDeleteShortcut();
          void removeKnownDm(selectedPeer);
        } else {
          armDeleteShortcut(selectedPeer);
        }

        return;
      }

      clearDeleteShortcut();

      if (event.key === 'Enter' && selectedPeer) {
        event.preventDefault();
        void openKnownDm(selectedPeer);
      }
    }

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isPasswordFormOpen, knownPeers, selectedChatIndex, session, step]);

  useEffect(() => {
    setSelectedChatIndex((current) => normalizeChatSelection(current, knownPeers.length));
  }, [knownPeers.length]);

  useEffect(() => {
    if (step !== 'chats') return;
    selectedChatRef.current?.scrollIntoView({block: 'nearest'});
  }, [selectedChatIndex, step]);

  useEffect(() => {
    if (step !== 'newPeer') return;
    peerInputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (step !== 'chat') return;
    messageInputRef.current?.focus();
  }, [activePeer, step]);

  useEffect(() => {
    if (!session || !activePeer || step !== 'chat') return;

    const timer = window.setInterval(() => {
      void loadConversation(session, activePeer);
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [activeApiUrl, activePeer, session, step]);

  async function loginWith(
    nextUsername: string,
    nextPassword: string,
    nextApiUrl: string,
    shouldCommit: () => boolean = () => true
  ) {
    setStatus('');

    try {
      const response = await fetch(`${nextApiUrl}/login`, {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({username: nextUsername, password: nextPassword})
      });

      if (!shouldCommit()) return false;

      const text = await response.text();

      if (!response.ok) {
        setStatus(webStatusText(text));
        return false;
      }

      const nextSession = {username: responseUsername(text, nextUsername), password: nextPassword};
      const peers = await loadKnownPeers(nextSession, nextApiUrl);
      if (!shouldCommit()) return false;

      setActiveApiUrl(nextApiUrl);
      storeAuthPayload({...nextSession, apiUrl: nextApiUrl});
      setSession(nextSession);
      setKnownPeers(peers);
      setSelectedChatIndex(0);
      setPeerDraft('');
      setActivePeer('');
      setMessages([]);
      setStep('chats');
      setIsPasswordFormOpen(false);
      setPasswordStatus('');
      return true;
    } catch {
      if (!shouldCommit()) return false;
      setStatus('backend unavailable');
      return false;
    }
  }

  async function openKnownDm(peer: string) {
    if (!session) return;
    const peerIndex = knownPeers.indexOf(peer);
    if (peerIndex >= 0) setSelectedChatIndex(peerIndex);
    await loadConversation(session, peer, {persist: true});
  }

  async function openNewDm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) return;

    const peer = peerDraft.trim();
    if (peer.length === 0) return;

    await loadConversation(session, peer, {persist: true});
  }

  async function loadConversation(currentSession: Session, peer: string, options: {persist?: boolean} = {}) {
    if (options.persist) {
      const started = await startConversation(currentSession, peer);
      if (!started) return false;
    }

    const response = await fetch(`${activeApiUrl}/dm?${new URLSearchParams({with: peer, format: 'json'})}`, {
      headers: authHeaders(currentSession)
    });

    const text = await response.text();

    if (!response.ok) {
      setStatus(webStatusText(text));
      return false;
    }

    setActivePeer(peer);
    setKnownPeers((current) => uniq([...current, peer]));
    setMessages(parseMessagesResponse(text));
    setStatus('');
    setStep('chat');
    return true;
  }

  async function startConversation(currentSession: Session, peer: string) {
    const response = await fetch(`${activeApiUrl}/dm/chats`, {
      method: 'POST',
      headers: {
        ...authHeaders(currentSession),
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({with: peer, format: 'json'})
    });

    const text = await response.text();

    if (!response.ok) {
      setStatus(webStatusText(text));
      return false;
    }

    setStatus('');
    return true;
  }

  async function loadKnownPeers(currentSession: Session, nextApiUrl: string) {
    try {
      const response = await fetch(`${nextApiUrl}/dm/peers?${new URLSearchParams({format: 'json'})}`, {
        headers: authHeaders(currentSession)
      });

      if (!response.ok) return [];
      return parsePeerList(await response.text());
    } catch {
      return [];
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session || !activePeer) return;

    const body = draft.trim();
    if (body.length === 0) return;

    const response = await fetch(`${activeApiUrl}/dm`, {
      method: 'POST',
      headers: {
        ...authHeaders(session),
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({to: activePeer, body, format: 'json'})
    });

    const text = await response.text();

    if (!response.ok) {
      setStatus(webStatusText(text));
      return;
    }

    setMessages((current) => [...current, parseMessageResponse(text)]);
    setStatus('');
    setDraft('');
  }

  async function removeKnownDm(peer: string) {
    if (!session) return;

    const response = await fetch(`${activeApiUrl}/dm/chats?${new URLSearchParams({with: peer})}`, {
      method: 'DELETE',
      headers: authHeaders(session)
    });
    const text = await response.text();

    if (!response.ok) {
      setStatus(webStatusText(text));
      return;
    }

    setKnownPeers((current) => {
      const next = current.filter((knownPeer) => knownPeer !== peer);
      setSelectedChatIndex((selected) => normalizeChatSelection(selected, next.length));
      return next;
    });
    setStatus('');
  }

  async function downloadMessageAttachment(message: Message, attachment: Attachment) {
    if (!session) return;

    try {
      const response = await fetch(apiAttachmentUrl(activeApiUrl, message, attachment), {
        headers: authHeaders(session)
      });
      const blob = await response.blob();

      if (!response.ok) {
        setStatus(webStatusText(await blob.text()));
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
      setStatus('');
    } catch {
      setStatus('backend unavailable');
    }
  }

  function logout() {
    clearStoredAuthPayload();
    setSession(null);
    setStep('chats');
    setKnownPeers([]);
    setSelectedChatIndex(0);
    setPeerDraft('');
    setActivePeer('');
    setMessages([]);
    setDraft('');
    setStatus('');
    setIsPasswordFormOpen(false);
    setPasswordStatus('');
  }

  async function loginFromLanding(username: string, password: string) {
    await loginWith(username, password, apiUrl);
  }

  async function changePassword(newPassword: string) {
    if (!session) return false;

    setStatus('');
    setPasswordStatus('');

    try {
      const response = await fetch(`${activeApiUrl}/password`, {
        method: 'POST',
        headers: {
          ...authHeaders(session),
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({password: newPassword})
      });
      const text = await response.text();

      if (!response.ok) {
        setPasswordStatus(webStatusText(text));
        return false;
      }

      const nextSession = {...session, password: newPassword};
      setSession(nextSession);
      storeAuthPayload({...nextSession, apiUrl: activeApiUrl});
      setIsPasswordFormOpen(false);
      setStatus('password updated');
      return true;
    } catch {
      setPasswordStatus('backend unavailable');
      return false;
    }
  }

  function openPasswordModal() {
    setStatus('');
    setPasswordStatus('');
    setIsPasswordFormOpen(true);
  }

  function closePasswordModal() {
    setPasswordStatus('');
    setIsPasswordFormOpen(false);
  }

  function startNewChat() {
    clearDeleteShortcut();
    setPeerDraft('');
    setStatus('');
    setStep('newPeer');
  }

  function armDeleteShortcut(_peer: string) {
    deleteArmedRef.current = true;

    if (deleteTimerRef.current) window.clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = window.setTimeout(() => {
      deleteArmedRef.current = false;
    }, 900);
  }

  function clearDeleteShortcut() {
    deleteArmedRef.current = false;

    if (deleteTimerRef.current) {
      window.clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
  }

  if (!session && isAutoLoggingIn) {
    return <widgets.OpeningPanel status={status} />;
  }

  if (!session) {
    return (
      <LandingPage
        status={status}
        onLogin={loginFromLanding}
      />
    );
  }

  return (
    <main className="h-[100svh] overflow-hidden bg-[var(--oo-bg)] text-[var(--oo-fg)]">
      <div className="mx-auto flex h-full w-full max-w-[980px] flex-col overflow-hidden px-4 py-3 sm:py-4">
        <header className="mb-3 flex shrink-0 items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Terminal size={18} color="var(--oo-accent)" />
              <h1 className="text-base font-semibold">ooolala</h1>
            </div>
            <div className="mt-1 truncate text-xs text-[var(--oo-muted)]">
              {step === 'chat' ? activeApiUrl : `${session.username} · ${activeApiUrl}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="grid h-9 w-9 place-items-center border border-[var(--oo-line)] bg-[var(--oo-panel)] text-[var(--oo-fg)] hover:border-[var(--oo-accent)]"
              onClick={openPasswordModal}
              type="button"
              aria-label="change password"
            >
              <KeyRound size={15} />
            </button>
            <button
              className="grid h-9 w-9 place-items-center border border-[var(--oo-line)] bg-[var(--oo-panel)] text-[var(--oo-fg)] hover:border-[var(--oo-accent)]"
              onClick={logout}
              type="button"
              aria-label="logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        {status && <div className="mb-4 border border-[var(--oo-line)] p-3 text-sm text-[var(--oo-warning)]">{status}</div>}

        {step === 'chats' && (
          <section className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col overflow-hidden border border-[var(--oo-line)] bg-[var(--oo-panel)]">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--oo-line)] px-4">
              <h2 className="text-sm font-semibold text-[var(--oo-muted)]">chats</h2>
              {knownPeers.length > 0 && (
                <button
                  className="grid h-8 w-8 place-items-center border border-[var(--oo-line)] bg-[var(--oo-panel-strong)] text-[var(--oo-fg)] hover:border-[var(--oo-accent)]"
                  onClick={startNewChat}
                  type="button"
                  aria-label="new chat"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            {knownPeers.length === 0 ? (
              <div className="grid min-h-0 flex-1 place-items-center px-4 text-center">
                <div>
                  <p className="text-sm leading-6 text-[var(--oo-muted)]">no chats yet</p>
                  <button
                    className="mt-3 inline-flex h-9 items-center justify-center gap-2 border border-[var(--oo-line)] bg-[var(--oo-panel)] px-3 text-sm text-[var(--oo-fg)] hover:border-[var(--oo-accent)]"
                    onClick={startNewChat}
                    type="button"
                  >
                    <Plus size={15} />
                    new chat
                  </button>
                </div>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-auto">
                {knownPeers.map((peer, index) => {
                  const isSelected = index === selectedChatIndex;

                  return (
                    <button
                      ref={isSelected ? selectedChatRef : undefined}
                      className={[
                        'flex h-12 w-full items-center justify-between border-b border-[var(--oo-line)] px-4 text-left text-sm last:border-b-0',
                        isSelected ? 'bg-[var(--oo-panel-strong)] text-[var(--oo-fg)]' : 'text-[var(--oo-muted)] hover:bg-[var(--oo-panel-strong)] hover:text-[var(--oo-fg)]'
                      ].join(' ')}
                      key={peer}
                      onClick={() => openKnownDm(peer)}
                      onFocus={() => setSelectedChatIndex(index)}
                      onMouseEnter={() => setSelectedChatIndex(index)}
                      type="button"
                      aria-current={isSelected ? 'true' : undefined}
                    >
                      <span>@{peer}</span>
                      <span className={isSelected ? 'font-mono text-[var(--oo-accent)]' : 'font-mono text-[var(--oo-muted)]'}>&gt;</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {step === 'newPeer' && (
          <section className="mx-auto flex min-h-0 w-full max-w-[560px] flex-1 flex-col">
            <div className="mb-3 flex shrink-0 items-center gap-2">
              <button
                className="grid h-9 w-9 place-items-center border border-[var(--oo-line)] bg-[var(--oo-panel)] text-[var(--oo-fg)] hover:border-[var(--oo-accent)]"
                onClick={() => {
                  setStatus('');
                  setStep('chats');
                }}
                type="button"
                aria-label="back to chats"
              >
                <ArrowLeft size={16} />
              </button>
              <h2 className="text-sm font-semibold text-[var(--oo-muted)]">new chat</h2>
            </div>

            <form className="flex items-end gap-2" onSubmit={openNewDm}>
              <label className="min-w-0 flex-1 text-sm">
                <span className="mb-1 block text-xs text-[var(--oo-muted)]">user</span>
                <input
                  ref={peerInputRef}
                  className="h-10 w-full border border-[var(--oo-line)] bg-[var(--oo-panel-strong)] px-3 text-sm text-[var(--oo-fg)] outline-none focus:border-[var(--oo-accent)]"
                  value={peerDraft}
                  onChange={(event) => setPeerDraft(event.target.value)}
                  placeholder="bob"
                />
              </label>
              <button
                className="grid h-10 w-10 shrink-0 place-items-center border border-[var(--oo-line)] bg-[var(--oo-panel)] text-[var(--oo-fg)] disabled:opacity-40 enabled:hover:border-[var(--oo-accent)]"
                disabled={peerDraft.trim().length === 0}
                type="submit"
                aria-label="start chat"
              >
                <SendHorizontal size={16} />
              </button>
            </form>
          </section>
        )}

        {step === 'chat' && (
          <section className="mx-auto flex min-h-0 w-full max-w-[600px] flex-1 flex-col overflow-hidden border border-[var(--oo-line)] bg-[var(--oo-panel)]">
            <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--oo-line)] px-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  className="grid h-8 w-8 shrink-0 place-items-center border border-[var(--oo-line)] bg-[var(--oo-panel-strong)] text-[var(--oo-fg)] hover:border-[var(--oo-accent)]"
                  onClick={() => {
                    setStatus('');
                    setStep('chats');
                  }}
                  type="button"
                  aria-label="back to chats"
                >
                  <ArrowLeft size={15} />
                </button>
                <div className="min-w-0 truncate text-sm font-semibold">@{activePeer}</div>
              </div>
              <button
                className="grid h-8 w-8 place-items-center border border-[var(--oo-line)] bg-[var(--oo-panel-strong)] text-[var(--oo-fg)] hover:border-[var(--oo-accent)]"
                type="button"
                aria-label="refresh"
                onClick={() => loadConversation(session, activePeer)}
              >
                <RefreshCw size={14} />
              </button>
            </header>

            <MessageList
              messages={messages}
              currentUsername={session.username}
              onDownloadAttachment={downloadMessageAttachment}
            />

            <form className="shrink-0 border-t border-[var(--oo-line)] p-3" onSubmit={sendMessage}>
              <div className="flex items-end gap-2 border border-[var(--oo-line)] bg-[var(--oo-panel-strong)] px-3 py-2">
                <span className="pt-2 font-mono text-sm text-[var(--oo-muted)]">&gt;</span>
                <textarea
                  ref={messageInputRef}
                  className="min-h-10 flex-1 resize-none border-0 bg-transparent py-2 text-sm leading-5 text-[var(--oo-fg)] outline-none"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    const isEnter = event.key === 'Enter';
                    const isCtrlM = event.ctrlKey && event.key.toLowerCase() === 'm';

                    if ((isEnter || isCtrlM) && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  aria-label="message"
                  rows={1}
                />
                <button
                  className="grid h-9 w-9 place-items-center border border-[var(--oo-line)] bg-transparent text-[var(--oo-fg)] disabled:opacity-40 enabled:hover:border-[var(--oo-accent)]"
                  type="submit"
                  aria-label="send message"
                  disabled={draft.trim().length === 0}
                >
                  <SendHorizontal size={16} />
                </button>
              </div>
            </form>
          </section>
        )}
      </div>

      {isPasswordFormOpen && (
        <PasswordModal
          status={passwordStatus}
          onCancel={closePasswordModal}
          onChangePassword={changePassword}
        />
      )}
    </main>
  );
}

function LandingPage({
  status,
  onLogin
}: {
  status: string;
  onLogin: (username: string, password: string) => Promise<void>;
}) {
  const [isWebScreen, setIsWebScreen] = useState(() => currentPathIs(webPath));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localStatus, setLocalStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmittedAuth, setHasSubmittedAuth] = useState(false);
  const [copyStates, setCopyStates] = useState<Record<LandingCopyKey, CopyState>>({
    install: 'idle',
    auth: 'idle',
    firstDm: 'idle',
    tui: 'idle'
  });
  const authCommand = `${appName} auth`;
  const firstDmCommand = `${appName} send ${welcomeUser} "hello"`;
  const tuiCommand = `${appName} tui`;

  useEffect(() => {
    function onPopState() {
      setIsWebScreen(currentPathIs(webPath));
      setLocalStatus('');
      setHasSubmittedAuth(false);
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!username.trim() || !password) return;

    setIsSubmitting(true);
    setLocalStatus('');
    setHasSubmittedAuth(true);

    await onLogin(username, password);

    setIsSubmitting(false);
  }

  async function copyLandingCommand(key: LandingCopyKey, command: string) {
    const didCopy = await copyText(command);

    setCopyStates((current) => ({...current, [key]: didCopy ? 'copied' : 'failed'}));
    window.setTimeout(() => {
      setCopyStates((current) => ({...current, [key]: 'idle'}));
    }, 1_400);
  }

  if (isWebScreen) {
    return (
      <widgets.AuthPanel
        onSubmit={submitLogin}
        status={localStatus || (!isSubmitting && hasSubmittedAuth ? status : '')}
        fields={
          <>
                <label className="block text-xs">
                  <span className="mb-1 block text-[11px] text-[var(--oo-muted)]">username</span>
                  <input
                    className="h-9 w-full border border-[var(--oo-line)] bg-[var(--oo-panel-strong)] px-3 text-sm text-[var(--oo-fg)] outline-none transition focus:border-[var(--oo-accent)]"
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      setLocalStatus('');
                      setHasSubmittedAuth(false);
                    }}
                    autoComplete="username"
                    autoFocus
                  />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block text-[11px] text-[var(--oo-muted)]">password</span>
                  <input
                    className="h-9 w-full border border-[var(--oo-line)] bg-[var(--oo-panel-strong)] px-3 text-sm text-[var(--oo-fg)] outline-none transition focus:border-[var(--oo-accent)]"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setLocalStatus('');
                      setHasSubmittedAuth(false);
                    }}
                    type="password"
                    autoComplete="current-password"
                  />
                </label>
          </>
        }
        submitControl={
          <button
            className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 border border-[var(--oo-accent)] bg-[var(--oo-accent)] px-4 text-sm font-semibold text-[var(--oo-accent-text)] disabled:opacity-50"
            disabled={isSubmitting || !username.trim() || !password}
            type="submit"
          >
            <LogIn size={15} />
            {isSubmitting ? 'signing in...' : 'sign in'}
          </button>
        }
      />
    );
  }

  return (
    <widgets.Landing
      installCommand={installCommand}
      installCopyState={copyStates.install}
      authCommand={authCommand}
      authCopyState={copyStates.auth}
      firstDmCommand={firstDmCommand}
      firstDmCopyState={copyStates.firstDm}
      tuiCommand={tuiCommand}
      tuiCopyState={copyStates.tui}
      onCopyInstall={() => void copyLandingCommand('install', installCommand)}
      onCopyAuth={() => void copyLandingCommand('auth', authCommand)}
      onCopyFirstDm={() => void copyLandingCommand('firstDm', firstDmCommand)}
      onCopyTui={() => void copyLandingCommand('tui', tuiCommand)}
      authLabel="open web app"
      docsHref={docsPath}
      webHref={webPath}
    />
  );
}

type DocsCommandKey =
  | 'install'
  | 'auth'
  | 'send'
  | 'tui'
  | 'web'
  | 'version'
  | 'skills';

function DocsPage() {
  const [copyStates, setCopyStates] = useState<Record<DocsCommandKey, CopyState>>({
    install: 'idle',
    auth: 'idle',
    send: 'idle',
    tui: 'idle',
    web: 'idle',
    version: 'idle',
    skills: 'idle'
  });

  const copyCommand = async (key: DocsCommandKey, command: string) => {
    const didCopy = await copyText(command);

    setCopyStates((current) => ({...current, [key]: didCopy ? 'copied' : 'failed'}));
    window.setTimeout(() => {
      setCopyStates((current) => ({...current, [key]: 'idle'}));
    }, 1_400);
  };

  return (
    <widgets.DocsShell
      appName={appName}
      installCommand={installCommand}
      webHref={webPath}
      copyStates={copyStates}
      onCopyCommand={(key, command) => void copyCommand(key as DocsCommandKey, command)}
    />
  );
}

function PasswordModal({
  status,
  onCancel,
  onChangePassword
}: {
  status: string;
  onCancel: () => void;
  onChangePassword: (password: string) => Promise<boolean>;
}) {
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localStatus, setLocalStatus] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    passwordInputRef.current?.focus();
  }, []);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) return;

    if (password !== confirmPassword) {
      setLocalStatus("passwords don't match");
      return;
    }

    setIsSubmitting(true);
    setLocalStatus('');
    const ok = await onChangePassword(password);
    setIsSubmitting(false);

    if (!ok) return;

    setPassword('');
    setConfirmPassword('');
  }

  return (
    <widgets.PasswordDialog
      status={localStatus || status}
      headerIcon={<KeyRound size={15} color="var(--oo-accent)" />}
      onCancel={onCancel}
      onSubmit={submitPassword}
      onBackdropMouseDown={onCancel}
      onDialogMouseDown={(event) => event.stopPropagation()}
      fields={
        <>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--oo-muted)]">new password</span>
            <input
              ref={passwordInputRef}
              className="h-10 w-full border border-[var(--oo-line)] bg-[var(--oo-panel-strong)] px-3 text-sm text-[var(--oo-fg)] outline-none transition focus:border-[var(--oo-accent)]"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-[var(--oo-muted)]">confirm new password</span>
            <input
              className="h-10 w-full border border-[var(--oo-line)] bg-[var(--oo-panel-strong)] px-3 text-sm text-[var(--oo-fg)] outline-none transition focus:border-[var(--oo-accent)]"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
            />
          </label>
        </>
      }
      submitControl={
        <button
          className="mt-5 h-10 w-full border border-[var(--oo-accent)] bg-[var(--oo-accent)] px-4 text-sm font-semibold text-[var(--oo-accent-text)] disabled:opacity-50"
          disabled={isSubmitting || !password || !confirmPassword}
          type="submit"
        >
          {isSubmitting ? 'saving...' : 'save'}
        </button>
      }
    />
  );
}

function defaultInstallCommand() {
  if (typeof window === 'undefined') return 'curl -fsSL /install.sh | bash';

  return `curl -fsSL ${window.location.origin}/install.sh | bash`;
}

function currentPathIs(pathname: string) {
  if (typeof window === 'undefined') return false;

  return normalizePath(window.location.pathname) === normalizePath(pathname);
}

export function isDocsPath(pathname: string) {
  return normalizePath(pathname) === docsPath;
}

function replacePath(pathname: string) {
  if (typeof window === 'undefined' || window.location.pathname === pathname) return;

  window.history.replaceState(null, '', pathname);
}

function normalizePath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized.length === 0 ? '/' : normalized;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to the textarea path below.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textarea);
  }
}

function readLaunchAuthPayload() {
  if (typeof window === 'undefined') return null;

  return readLaunchAuthPayloadFromHash(window.location.hash);
}

export function readLaunchAuthPayloadFromHash(hash: string) {
  const marker = '#ooolala=';
  if (!hash.startsWith(marker)) return null;

  return decodeAuthPayload(hash.slice(marker.length));
}

function clearLaunchAuthPayload(pathname?: string) {
  if (typeof window === 'undefined') return;

  const marker = '#ooolala=';
  if (!window.location.hash.startsWith(marker)) return;

  window.history.replaceState(null, '', `${pathname ?? window.location.pathname}${window.location.search}`);
}

function readStoredAuthPayload() {
  if (typeof window === 'undefined') return null;

  const storedAuth = readAuthPayloadFromStorage(window.localStorage);
  if (storedAuth) return storedAuth;

  const legacySessionAuth = readAuthPayloadFromStorage(window.sessionStorage);
  if (legacySessionAuth) {
    storeAuthPayload(legacySessionAuth);
    window.sessionStorage.removeItem(authStorageKey);
  }

  return legacySessionAuth;
}

export function readAuthPayloadFromStorage(storage: Pick<AuthStorage, 'getItem'>) {
  const raw = storage.getItem(authStorageKey);
  if (!raw) return null;

  return normalizeAuthPayload(JSON.parse(raw));
}

function storeAuthPayload(payload: AuthPayload) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(authStorageKey, JSON.stringify(payload));
  } catch {
    setSessionOnlyAuthPayload(payload);
  }
}

function clearStoredAuthPayload() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(authStorageKey);
  window.sessionStorage.removeItem(authStorageKey);
}

function setSessionOnlyAuthPayload(payload: AuthPayload) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(authStorageKey, JSON.stringify(payload));
}

function decodeAuthPayload(encoded: string) {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=');
  return normalizeAuthPayload(JSON.parse(atob(padded)));
}

function normalizeAuthPayload(value: unknown): AuthPayload {
  if (!value || typeof value !== 'object') throw new Error('invalid auth payload');

  const payload = value as Record<string, unknown>;

  if (typeof payload.username !== 'string' || typeof payload.password !== 'string') {
    throw new Error('invalid auth payload');
  }

  return {
    username: payload.username,
    password: payload.password,
    ...(typeof payload.apiUrl === 'string' ? {apiUrl: payload.apiUrl} : {})
  };
}

const authStorageKey = 'ooolala.auth';

function MessageList({
  messages,
  currentUsername,
  onDownloadAttachment
}: {
  messages: Message[];
  currentUsername: string;
  onDownloadAttachment: (message: Message, attachment: Attachment) => void;
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
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto px-4 py-4">
      {messages.length === 0 ? (
        <div className="grid min-h-full items-end justify-center pb-5 text-center text-sm text-[var(--oo-muted)]">
          no messages yet. write below.
        </div>
      ) : (
        messages.flatMap((message, messageIndex) => {
          const currentDateKey = dateKey(message.insertedAt);
          const rows = [];

          if (currentDateKey !== previousDateKey) {
            rows.push(<widgets.DateMarker key={`${currentDateKey}-${messageIndex}-header`} label={dateLabel(message.insertedAt)} />);
            previousDateKey = currentDateKey;
          }

          rows.push(
            <MessageRow
              key={`${message.id}-${messageIndex}`}
              message={message}
              isMine={message.author === currentUsername}
              onDownloadAttachment={onDownloadAttachment}
            />
          );
          return rows;
        })
      )}
    </div>
  );
}

function messageSignature(message: Message) {
  return [
    message.room,
    message.author,
    message.insertedAt.getTime(),
    message.body,
    message.attachments.map((attachment) => `${attachment.id}:${attachment.filename}:${attachment.byteSize}`).join(',')
  ].join('\u001f');
}

function MessageRow({
  message,
  isMine,
  onDownloadAttachment
}: {
  message: Message;
  isMine: boolean;
  onDownloadAttachment: (message: Message, attachment: Attachment) => void;
}) {
  return (
    <widgets.MessageBubble
      attachments={message.attachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.filename,
        byteSize: attachment.byteSize
      }))}
      body={message.body}
      isMine={isMine}
      onDownloadAttachment={(attachment) => {
        const matched = message.attachments.find((candidate) => candidate.id === attachment.id);
        if (matched) onDownloadAttachment(message, matched);
      }}
      time={formatTime(message.insertedAt)}
    />
  );
}

function authHeaders(session: Session) {
  return {
    authorization: `Basic ${btoa(`${session.username}:${session.password}`)}`
  };
}

function apiAttachmentUrl(activeApiUrl: string, message: Message, attachment: Attachment) {
  const path = attachment.url || `/attachments/${encodeURIComponent(message.id)}/${encodeURIComponent(attachment.id)}`;
  return `${activeApiUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function responseUsername(body: string, fallback: string) {
  const match = body.match(/^ok\s+([^\s]+)/);
  return match ? match[1] : fallback.trim();
}

export function webStatusText(value: string) {
  const text = value.trim();

  switch (text) {
    case 'invalid credentials':
      return 'username or password is wrong';
    default:
      return text;
  }
}

function dmRoom(username: string, peer: string) {
  return `dm:${[username, peer].sort().join(':')}`;
}

function parsePeerList(text: string) {
  const parsed = JSON.parse(text) as {peers?: string[]};
  return uniq(parsed.peers || []);
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseMessageResponse(text: string): Message {
  const parsed = JSON.parse(text) as {message?: BackendMessage};
  if (!parsed.message) throw new Error('bad message response');
  return backendMessage(parsed.message);
}

function parseMessagesResponse(text: string): Message[] {
  const parsed = JSON.parse(text) as {messages?: BackendMessage[]};
  return (parsed.messages || []).map(backendMessage);
}

function backendMessage(message: BackendMessage): Message {
  const insertedAt = new Date(message.inserted_at);

  return {
    id: message.id,
    room: message.room,
    author: message.author,
    body: message.body,
    insertedAt: Number.isNaN(insertedAt.getTime()) ? new Date() : insertedAt,
    attachments: (message.attachments || []).map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      contentType: attachment.content_type,
      byteSize: attachment.byte_size,
      url: attachment.url
    }))
  };
}

function parseTranscript(text: string, fallbackRoom: string): Message[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== 'no messages')
    .map((line, index) => {
      const id = transcriptLineId(line, index);
      const isoMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\S+)\s+(\S+)\s+([^:]+):\s?(.*)$/);

      if (isoMatch) {
        const insertedAt = new Date(isoMatch[1]);

        return {
          id,
          insertedAt: Number.isNaN(insertedAt.getTime()) ? new Date() : insertedAt,
          room: isoMatch[2],
          author: isoMatch[3],
          body: isoMatch[4],
          attachments: []
        };
      }

      const match = line.match(/^(\d\d):(\d\d):(\d\d)\s+(\S+)\s+([^:]+):\s?(.*)$/);

      if (!match) {
        return {
          id,
          insertedAt: new Date(),
          author: 'backend',
          room: fallbackRoom,
          body: line,
          attachments: []
        };
      }

      return {
        id,
        insertedAt: utcTodayAt(match[1], match[2], match[3]),
        room: match[4],
        author: match[5],
        body: match[6],
        attachments: []
      };
    });
}

function transcriptLineId(line: string, index: number) {
  return `line-${index}-${hashString(line)}`;
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function utcTodayAt(hour: string, minute: string, second: string) {
  const now = new Date();

  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      Number(hour),
      Number(minute),
      Number(second)
    )
  );
}

function formatTime(date: Date) {
  let hour = date.getHours();
  const minute = date.getMinutes();
  const suffix = hour >= 12 ? 'pm' : 'am';

  hour = hour % 12;
  if (hour === 0) hour = 12;

  return `${hour}:${minute.toString().padStart(2, '0')} ${suffix}`;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function dateLabel(date: Date) {
  const today = startOfDay(new Date());
  const messageDay = startOfDay(date);
  const ageDays = Math.round((today.getTime() - messageDay.getTime()) / 86_400_000);

  if (ageDays === 0) return 'Today';
  if (ageDays === 1) return 'Yesterday';
  if (ageDays > 1 && ageDays < 7) {
    return date.toLocaleDateString(undefined, {weekday: 'long'});
  }

  return date.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
