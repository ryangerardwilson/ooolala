#!/usr/bin/env node
import React, {useEffect, useRef, useState} from 'react';
import {Box, Text, render, useApp, useInput, useStdout} from 'ink';
import TextInput from 'ink-text-input';

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
  attachments?: Attachment[];
};

type Attachment = {
  id: string;
  filename: string;
  content_type: string;
  byte_size: number;
  url?: string;
};

type Session = {
  username: string;
  password: string;
};

const apiUrl = process.env.OOOLALA_API || process.env.OOOLALA_DEFAULT_API_URL || 'https://ooolala.ryangerardwilson.com/api';
const appName = process.env.OOOLALA_APP || 'ooolala';
const authHint = process.env.OOOLALA_AUTH_HINT || `${appName} auth <username>`;
const initialUsername = process.env.OOOLALA_USERNAME || '';
const initialPassword = process.env.OOOLALA_PASSWORD || '';
const maxContentWidth = 80;
const minContentWidth = 24;

function App() {
  const {exit} = useApp();
  const autoLoginAttemptedRef = useRef(false);
  const deleteArmedRef = useRef(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [step, setStep] = useState<'loading' | 'authRequired' | 'chats' | 'newPeer' | 'chat'>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [peer, setPeer] = useState('');
  const [activePeer, setActivePeer] = useState('');
  const [knownPeers, setKnownPeers] = useState<string[]>([]);
  const [selectedChatIndex, setSelectedChatIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState('');
  const {stdout} = useStdout();
  const terminalColumns = stdout.columns || 88;
  const terminalRows = Math.max(16, stdout.rows || 32);
  const contentWidth = Math.max(minContentWidth, Math.min(maxContentWidth, terminalColumns));
  const messageLineWidth = contentWidth;
  const messageBodyWidth = Math.max(24, Math.min(64, Math.floor(messageLineWidth * 0.74)));

  useEffect(() => {
    if (autoLoginAttemptedRef.current) return;

    autoLoginAttemptedRef.current = true;
    if (!initialUsername || !initialPassword) {
      setStatus(`not authed; run ${authHint}`);
      setStep('authRequired');
      return;
    }

    void loginWith(initialUsername, initialPassword);
  }, []);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      clearDeleteShortcut();
      exit();
      return;
    }

    if (key.escape) {
      clearDeleteShortcut();
      if (session && (step === 'chat' || step === 'newPeer')) {
        setDraft('');
        setStatus('');
        setStep('chats');
        return;
      }

      return;
    }

    if (!session || step !== 'chats') return;

    const chats = knownPeers;

    if (input === 'q') {
      clearDeleteShortcut();
      exit();
      return;
    }

    if (input === 'n') {
      clearDeleteShortcut();
      setPeer('');
      setStatus('');
      setStep('newPeer');
      return;
    }

    if (input === 'd' && chats[selectedChatIndex]) {
      const selectedPeer = chats[selectedChatIndex];

      if (deleteArmedRef.current) {
        clearDeleteShortcut();
        void removeDm(selectedPeer, session);
      } else {
        armDeleteShortcut(selectedPeer);
      }

      return;
    }

    clearDeleteShortcut();

    if (key.upArrow && chats.length > 0) {
      setSelectedChatIndex((current) => Math.max(0, current - 1));
      return;
    }

    if (key.downArrow && chats.length > 0) {
      setSelectedChatIndex((current) => Math.min(chats.length - 1, current + 1));
      return;
    }

    if (key.return && chats[selectedChatIndex]) {
      void openDm(chats[selectedChatIndex], session);
      return;
    }

    const numericChoice = Number.parseInt(input, 10);

    if (Number.isInteger(numericChoice) && chats[numericChoice - 1]) {
      setSelectedChatIndex(numericChoice - 1);
      void openDm(chats[numericChoice - 1], session);
    }
  });

  useEffect(() => {
    setSelectedChatIndex((current) => {
      if (knownPeers.length === 0) return 0;
      return Math.max(0, Math.min(knownPeers.length - 1, current));
    });
  }, [knownPeers.length]);

  useEffect(() => {
    if (!session || !activePeer || step !== 'chat') return;

    const timer = setInterval(() => {
      void loadConversation(session, activePeer);
    }, 5_000);

    return () => clearInterval(timer);
  }, [activePeer, session, step]);

  async function loginWith(nextUsername: string, nextPassword: string) {
    setStatus('');

    try {
      const response = await fetch(`${apiUrl}/login`, {
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({username: nextUsername, password: nextPassword})
      });

      if (!response.ok) {
        setStatus((await response.text()).trim());
        setStep('authRequired');
        return;
      }

      const nextSession = {username: nextUsername.trim(), password: nextPassword};
      const peers = await loadKnownPeers(nextSession);
      setSession(nextSession);
      setPeer('');
      setKnownPeers(peers);
      setSelectedChatIndex(0);
      setStatus('');
      setStep('chats');
    } catch {
      setStatus('backend unavailable');
      setStep('authRequired');
    }
  }

  async function openDm(currentPeer = peer, currentSession = session) {
    if (!currentSession) return;

    const nextPeer = currentPeer.trim();
    if (nextPeer.length === 0) return;

    const started = await startDm(currentSession, nextPeer);
    if (!started) return;

    const loaded = await loadConversation(currentSession, nextPeer);
    if (loaded) {
      setKnownPeers((current) => uniq([...current, nextPeer]));
      setStep('chat');
    }
  }

  async function startDm(currentSession: Session, nextPeer: string) {
    const response = await fetch(`${apiUrl}/dm/chats`, {
      method: 'POST',
      headers: {
        ...authHeaders(currentSession),
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({with: nextPeer, format: 'json'})
    });

    const text = await response.text();

    if (!response.ok) {
      setStatus(text.trim());
      return false;
    }

    setStatus('');
    return true;
  }

  async function removeDm(currentPeer: string, currentSession: Session) {
    const response = await fetch(`${apiUrl}/dm/chats?${new URLSearchParams({with: currentPeer})}`, {
      method: 'DELETE',
      headers: authHeaders(currentSession)
    });

    const text = await response.text();

    if (!response.ok) {
      setStatus(text.trim());
      return false;
    }

    setKnownPeers((current) => current.filter((knownPeer) => knownPeer !== currentPeer));
    setStatus('');
    return true;
  }

  async function loadKnownPeers(currentSession: Session) {
    try {
      const response = await fetch(`${apiUrl}/dm/peers?${new URLSearchParams({format: 'json'})}`, {
        headers: authHeaders(currentSession)
      });

      if (!response.ok) return [];
      return parsePeerList(await response.text());
    } catch {
      return [];
    }
  }

  async function loadConversation(currentSession: Session, nextPeer: string) {
    const response = await fetch(`${apiUrl}/dm?${new URLSearchParams({with: nextPeer, format: 'json'})}`, {
      headers: authHeaders(currentSession)
    });

    const text = await response.text();

    if (!response.ok) {
      setStatus(text.trim());
      return false;
    }

    setActivePeer(nextPeer);
    setMessages(parseMessagesResponse(text));
    setStatus('');
    return true;
  }

  async function sendMessage(value: string) {
    if (!session || !activePeer) return;

    const body = value.trim();
    if (body.length === 0) return;

    const response = await fetch(`${apiUrl}/dm`, {
      method: 'POST',
      headers: {
        ...authHeaders(session),
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({to: activePeer, body, format: 'json'})
    });

    const text = await response.text();

    if (!response.ok) {
      setStatus(text.trim());
      return;
    }

    setMessages((current) => [...current, parseMessageResponse(text)]);
    setDraft('');
    setStatus('');
  }

  function armDeleteShortcut(_selectedPeer: string) {
    deleteArmedRef.current = true;

    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = setTimeout(() => {
      deleteArmedRef.current = false;
    }, 900);
  }

  function clearDeleteShortcut() {
    deleteArmedRef.current = false;

    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
  }

  return (
    <Box width={terminalColumns} height={terminalRows} justifyContent="center">
      <Box flexDirection="column" width={contentWidth} height={terminalRows}>
        <Box marginBottom={1}>
          <Text color="gray">ooolala</Text>
          {!session && step === 'loading' && (
            <>
              <Text>  </Text>
              <Text color="gray">opening</Text>
            </>
          )}
          {session && step !== 'chat' && (
            <>
              <Text>  </Text>
              <Text color="cyan">{session.username}</Text>
            </>
          )}
          <Text color="gray">  {apiUrl}</Text>
        </Box>

        {!session && step === 'loading' && (
          <Box minHeight={8}>
            <Text color="gray">opening chat...</Text>
          </Box>
        )}

        {!session && step === 'authRequired' && (
          <Box minHeight={8}>
            <Text color="yellow">{status || `not authed; run ${authHint}`}</Text>
          </Box>
        )}

        {session && (
          <>
            {step === 'chats' && (
              <Box flexDirection="column" minHeight={8}>
                <Text color="gray">chats</Text>

                {knownPeers.length === 0 && (
                  <Box>
                    <Text color="gray">no chats yet</Text>
                  </Box>
                )}

                {knownPeers.map((chatPeer, index) => (
                  <Box key={chatPeer}>
                    <Text color={index === selectedChatIndex ? 'cyan' : 'gray'}>
                      {index === selectedChatIndex ? '>' : ' '} {index + 1} @{chatPeer}
                    </Text>
                  </Box>
                ))}

                <Box marginTop={1}>
                  <Text color="gray">n new chat · dd remove</Text>
                </Box>
              </Box>
            )}

            {step === 'newPeer' && (
              <Box flexDirection="column" minHeight={8}>
                <Text color="gray">new chat</Text>
                <Box>
                  <Text color="gray">user </Text>
                  <TextInput value={peer} placeholder="bob" onChange={setPeer} onSubmit={openDm} />
                </Box>
              </Box>
            )}

            {step === 'chat' && (
              <Box flexDirection="column" flexGrow={1}>
                <Box marginBottom={1}>
                  <Text color="gray">peer </Text>
                  <Text color="cyan">@{activePeer}</Text>
                </Box>

                <Box flexDirection="column" flexGrow={1}>
                  {messages.length === 0 ? (
                    <Text color="gray">no messages</Text>
                  ) : (
                    <MessageList
                      messages={messages}
                      bodyWidth={messageBodyWidth}
                      lineWidth={messageLineWidth}
                      currentUsername={session.username}
                    />
                  )}
                </Box>

                {status && (
                  <Box marginBottom={1}>
                    <Text color="yellow">{status}</Text>
                  </Box>
                )}

                <Box marginTop={1} width={messageLineWidth} backgroundColor="#1f2328" paddingX={1} paddingY={1}>
                  <Text color="gray">&gt; </Text>
                  <TextInput value={draft} onChange={setDraft} onSubmit={sendMessage} />
                </Box>
              </Box>
            )}
          </>
        )}

        {status && step !== 'chat' && (
          <Box marginTop={1}>
            <Text color="yellow">{status}</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function MessageList({
  messages,
  bodyWidth,
  lineWidth,
  currentUsername
}: {
  messages: Message[];
  bodyWidth: number;
  lineWidth: number;
  currentUsername: string;
}) {
  let previousDateKey = '';

  return (
    <>
      {messages.flatMap((message, messageIndex) => {
        const currentDateKey = dateKey(message.insertedAt);
        const rows = [];

        if (currentDateKey !== previousDateKey) {
          rows.push(
            <DateHeader
              key={`${currentDateKey}-${messageIndex}-header`}
              label={dateLabel(message.insertedAt)}
              width={lineWidth}
            />
          );
          previousDateKey = currentDateKey;
        }

        rows.push(
          <MessageRow
            key={`${message.id}-${messageIndex}`}
            message={message}
            bodyWidth={bodyWidth}
            lineWidth={lineWidth}
            isMine={message.author === currentUsername}
          />
        );
        return rows;
      })}
    </>
  );
}

function DateHeader({label, width}: {label: string; width: number}) {
  return (
    <Box marginTop={1} marginBottom={1} width={width} justifyContent="center">
      <Text color="gray">-- {label} --</Text>
    </Box>
  );
}

function MessageRow({
  message,
  bodyWidth,
  lineWidth,
  isMine
}: {
  message: Message;
  bodyWidth: number;
  lineWidth: number;
  isMine: boolean;
}) {
  const lines = wrapMessageBody(message.body, bodyWidth);
  const attachmentLines = message.attachments.map((attachment) =>
    `@ ${attachment.filename} ${formatBytes(attachment.byte_size)} ${message.id}/${attachment.id}`
  );
  const timestamp = `[${formatTime(message.insertedAt)}]`;
  const contentLines = [...lines, ...attachmentLines];
  const blockWidth = Math.min(bodyWidth, Math.max(...contentLines.map((line) => line.length), 1));

  return (
    <Box flexDirection="column" marginBottom={1} width={lineWidth}>
      <Box width={lineWidth} justifyContent={isMine ? 'flex-end' : 'flex-start'}>
        <Box width={blockWidth} flexDirection="column" flexShrink={0}>
          {lines.map((line, index) => (
            <Text key={`${message.id}-${index}`} wrap="truncate-end">
              {line}
            </Text>
          ))}
          {attachmentLines.map((line, index) => (
            <Text key={`${message.id}-attachment-${index}`} color="cyan" wrap="truncate-end">
              {line}
            </Text>
          ))}
        </Box>
      </Box>
      <Box width={lineWidth} justifyContent={isMine ? 'flex-end' : 'flex-start'}>
        <Text color="gray">{timestamp}</Text>
      </Box>
    </Box>
  );
}

function wrapMessageBody(body: string, width: number) {
  const normalized = body.replace(/\s+/g, ' ').trim();

  if (normalized.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let current = '';

  for (const token of normalized.split(' ')) {
    if (token.length > width) {
      if (current) {
        lines.push(current);
        current = '';
      }

      for (let start = 0; start < token.length; start += width) {
        lines.push(token.slice(start, start + width));
      }

      continue;
    }

    if (!current) {
      current = token;
      continue;
    }

    if (current.length + 1 + token.length <= width) {
      current = `${current} ${token}`;
    } else {
      lines.push(current);
      current = token;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function authHeaders(session: Session) {
  return {
    authorization: `Basic ${Buffer.from(`${session.username}:${session.password}`).toString('base64')}`
  };
}

function parsePeerList(text: string) {
  const parsed = JSON.parse(text) as {peers?: string[]};
  return uniq(parsed.peers || []);
}

function dmRoom(username: string, peer: string) {
  return `dm:${[username, peer].sort().join(':')}`;
}

function uniq(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
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
    attachments: message.attachments || []
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

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MiB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${bytes} B`;
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

if (process.stdout.isTTY) {
  process.stdout.write('\x1b[2J\x1b[H');
}

render(<App />, {exitOnCtrlC: false});
