import {useEffect, useRef, useState, type FormEvent} from 'react';
import {LogIn} from 'lucide-react';
import {patterns, primitives, product} from './components';
import type {ChatAttachment, ChatMessage} from './components/product';

type Message = ChatMessage;

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

type Attachment = ChatAttachment;

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
const githubHref = 'https://github.com/ryangerardwilson/ooolala';
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
    return <product.OpeningPanel status={status} />;
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
    <product.ChatAppShell
      detail={step === 'chat' ? activeApiUrl : `${session.username} · ${activeApiUrl}`}
      onLogout={logout}
      onOpenPassword={openPasswordModal}
      status={status}
    >
      {step === 'chats' && (
        <product.ChatListPanel
          knownPeers={knownPeers}
          onOpenPeer={(peer) => void openKnownDm(peer)}
          onSelectPeer={setSelectedChatIndex}
          onStartNewChat={startNewChat}
          selectedChatIndex={selectedChatIndex}
          selectedChatRef={selectedChatRef}
        />
      )}

      {step === 'newPeer' && (
        <product.NewChatPanel
          onBack={() => {
            setStatus('');
            setStep('chats');
          }}
          onPeerChange={(event) => setPeerDraft(event.target.value)}
          onSubmit={openNewDm}
          peerDraft={peerDraft}
          peerInputRef={peerInputRef}
        />
      )}

      {step === 'chat' && (
        <product.ConversationPanel
          activePeer={activePeer}
          currentUsername={session.username}
          dateLabelFor={dateLabel}
          draft={draft}
          messageInputRef={messageInputRef}
          messages={messages}
          onBack={() => {
            setStatus('');
            setStep('chats');
          }}
          onDownloadAttachment={(message, attachment) => void downloadMessageAttachment(message, attachment)}
          onDraftChange={(event) => setDraft(event.target.value)}
          onMessageKeyDown={(event) => {
            const isEnter = event.key === 'Enter';
            const isCtrlM = event.ctrlKey && event.key.toLowerCase() === 'm';

            if ((isEnter || isCtrlM) && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          onRefresh={() => void loadConversation(session, activePeer)}
          onSubmit={sendMessage}
          timeLabelFor={formatTime}
        />
      )}

      {isPasswordFormOpen && (
        <PasswordModal
          status={passwordStatus}
          onCancel={closePasswordModal}
          onChangePassword={changePassword}
        />
      )}
    </product.ChatAppShell>
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
      <product.AuthPanel
        onSubmit={submitLogin}
        status={localStatus || (!isSubmitting && hasSubmittedAuth ? status : '')}
        fields={
          <>
            <patterns.FormField
              autoComplete="username"
              autoFocus
              fieldSize="sm"
              label="username"
              labelClassName="text-[11px]"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setLocalStatus('');
                setHasSubmittedAuth(false);
              }}
            />
            <patterns.FormField
              autoComplete="current-password"
              fieldSize="sm"
              label="password"
              labelClassName="text-[11px]"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setLocalStatus('');
                setHasSubmittedAuth(false);
              }}
            />
          </>
        }
        submitControl={
          <primitives.Button
            className="mt-4"
            disabled={isSubmitting || !username.trim() || !password}
            fullWidth
            size="sm"
            type="submit"
            variant="primary"
          >
            <LogIn size={15} />
            {isSubmitting ? 'signing in...' : 'sign in'}
          </primitives.Button>
        }
      />
    );
  }

  return (
    <product.Landing
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
      githubHref={githubHref}
      webHref={webPath}
    />
  );
}

type DocsCommandKey =
  | 'install'
  | 'auth'
  | 'send'
  | 'tui'
  | 'version'
  | 'skills';

function DocsPage() {
  const [copyStates, setCopyStates] = useState<Record<DocsCommandKey, CopyState>>({
    install: 'idle',
    auth: 'idle',
    send: 'idle',
    tui: 'idle',
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
    <product.DocsShell
      appName={appName}
      githubHref={githubHref}
      installCommand={installCommand}
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
    <product.PasswordDialog
      status={localStatus || status}
      onCancel={onCancel}
      onSubmit={submitPassword}
      onBackdropMouseDown={onCancel}
      onDialogMouseDown={(event) => event.stopPropagation()}
      fields={
        <>
          <patterns.FormField
            ref={passwordInputRef}
            autoComplete="new-password"
            label="new password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
          />
          <patterns.FormField
            autoComplete="new-password"
            label="confirm new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            type="password"
          />
        </>
      }
      submitControl={
        <primitives.Button
          className="mt-5"
          disabled={isSubmitting || !password || !confirmPassword}
          fullWidth
          type="submit"
          variant="primary"
        >
          {isSubmitting ? 'saving...' : 'save'}
        </primitives.Button>
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
