#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {basename, dirname, join, resolve} from 'node:path';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
import {homedir, tmpdir} from 'node:os';

type RunResult = {
  status: number;
  stdout: string;
  stderr: string;
};

type Credentials = {
  username: string;
  password: string;
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

type AttachmentUpload = {
  filename: string;
  contentType: string;
  data: Buffer;
};

type ApiResult = {
  ok: true;
  body: string;
} | {
  ok: false;
  error: string;
};

class CommandError extends Error {}

const fallbackApiUrl = 'https://ooolala.ryangerardwilson.com/api';
const configOrder = ['handle', 'username', 'password'];

const helpTemplate = `Ooolala

features:
  inspect the installed client and upgrade through the installer
  # help | version | upgrade
  ooolala help
  ooolala version
  ooolala upgrade

  create or save backend credentials, then inspect or clear local auth
  auth creates the account when the handle is free, or signs in when it already exists
  # auth [username] | who | signout | password
  ooolala auth yourname
  ooolala auth
  ooolala who
  ooolala password
  ooolala signout

  send direct messages through the backend, including files or stdin
  # send <username> <message> [attach <path> [path ...]] | send <username> -
  ooolala send bob "hello from the terminal"
  ooolala send bob "logs attached" attach ./run.log ./screenshots
  echo "hello from stdin" | ooolala send bob -

  read, watch, open, and close direct-message chats
  # read <username> [last <count>|unread [incoming] [json]] | watch <username> [incoming] | open <username> | close <username>
  ooolala read bob
  ooolala read bob last 10
  ooolala read bob unread
  ooolala read bob unread incoming
  ooolala watch bob incoming
  ooolala open bob
  ooolala close bob

  download an attachment from a printed message/attachment pair
  # download <message-id> <attachment-id> [dir]
  ooolala download 20260531123000-AbCdEf note1 .

  launch the terminal UI
  # tui
  ooolala tui

  open local config or print agent usage instructions
  # config | skills
  ooolala config
  ooolala skills
`;

export async function run(argv: string[], stdin?: string): Promise<RunResult> {
  try {
    const stdout = await dispatch(argv, stdin);
    return {status: 0, stdout, stderr: ''};
  } catch (error) {
    return {status: 1, stdout: '', stderr: errorMessage(error)};
  }
}

async function dispatch(argv: string[], stdin?: string): Promise<string> {
  if (argv.length === 0) {
    if (!readCredentials()) return authCommand([], stdin);
    return help();
  }
  if (argv.length === 1 && argv[0] === 'help') return help();
  if (argv.length === 1 && argv[0] === 'upgrade') return upgrade();

  if (argv.length === 1 && argv[0] === 'version') return versionReport();

  if (argv[0] === 'auth') {
    return authCommand(argv.slice(1), stdin);
  }

  if (argv[0] === 'signout') {
    return signoutCommand(argv.slice(1));
  }

  if (argv[0] === 'password') {
    return passwordCommand(argv.slice(1), stdin);
  }

  if (argv.length === 1 && argv[0] === 'who') {
    const credentials = readCredentials();
    return credentials ? `${credentials.username}\n` : 'not authed\n';
  }

  if (argv[0] === 'send') return sendCommand(argv.slice(1), stdin);
  if (argv[0] === 'download') return downloadCommand(argv.slice(1));
  if (argv[0] === 'read') return readCommand(argv.slice(1));
  if (argv[0] === 'watch') return watchCommand(argv.slice(1));
  if (argv[0] === 'open') return openCommand(argv.slice(1));
  if (argv[0] === 'close') return closeCommand(argv.slice(1));

  if (argv.length === 1 && argv[0] === 'tui') {
    launchTui();
    return '';
  }

  if (argv.length === 1 && argv[0] === 'config') {
    openConfig();
    return '';
  }

  if (argv.length === 1 && argv[0] === 'skills') {
    return skills();
  }

  throw new CommandError(`unknown command; try: ${commandName()} help\n`);
}

async function sendCommand(argv: string[], stdin?: string): Promise<string> {
  if (argv.length < 2) throw new CommandError(`try: ${commandName()} send bob "hello"\n`);

  const username = argv[0];
  const parts = argv.slice(1);
  const attachIndex = parts.indexOf('attach');
  const bodyParts = attachIndex >= 0 ? parts.slice(0, attachIndex) : parts;
  const attachmentPaths = attachIndex >= 0 ? parts.slice(attachIndex + 1) : [];

  if (attachIndex >= 0 && attachmentPaths.length === 0) {
    throw new CommandError(`try: ${commandName()} send bob "logs attached" attach ./run.log\n`);
  }

  const body = bodyParts.length === 1 && bodyParts[0] === '-' ? stdin ?? await readStdin() : bodyParts.join(' ');
  if (body.trim().length === 0 && attachmentPaths.length === 0) {
    throw new CommandError(`try: ${commandName()} send bob "hello"\n`);
  }

  const attachments = prepareAttachmentUploads(attachmentPaths);
  return sendDm(username, body, attachments);
}

async function downloadCommand(argv: string[]): Promise<string> {
  if (argv.length < 2 || argv.length > 3) {
    throw new CommandError(`try: ${commandName()} download <message-id> <attachment-id> [dir]\n`);
  }

  return downloadAttachment(argv[0], argv[1], argv[2] || '.');
}

async function readCommand(argv: string[]): Promise<string> {
  if (argv.length < 1) throw new CommandError(`try: ${commandName()} read bob\n`);

  const username = argv[0];
  const rest = argv.slice(1);

  if (rest.length === 0) return tailDm(username, 'all');

  if (rest.length === 2 && rest[0] === 'last') {
    const count = Number.parseInt(rest[1], 10);
    if (Number.isInteger(count) && count > 0) return tailDm(username, count);
    throw new CommandError(`try: ${commandName()} read bob last 10\n`);
  }

  if (rest[0] === 'unread') {
    const opts = parseCanonicalUnreadOptions(rest.slice(1));
    const credentials = requireCredentials();
    const lines = await dmLines(credentials, username);
    const seen = Math.min(dmSeen(credentials.username, username), lines.length);
    const unread = filterLines(lines.slice(seen), credentials.username, opts.direction);
    setDmSeen(credentials.username, username, lines.length);
    return opts.format === 'json' ? formatJsonUnread(unread) : formatUnread(unread);
  }

  throw new CommandError(`try: ${commandName()} read bob\n`);
}

async function watchCommand(argv: string[]): Promise<string> {
  if (argv.length < 1) throw new CommandError(`try: ${commandName()} watch bob incoming\n`);
  if (argv.length > 2 || (argv[1] && argv[1] !== 'incoming')) {
    throw new CommandError(`try: ${commandName()} watch bob incoming\n`);
  }

  const credentials = requireCredentials();
  const direction = argv[1] === 'incoming' ? 'incoming' : 'all';
  const lines = await dmLines(credentials, argv[0]);
  let seen = Math.min(dmSeen(credentials.username, argv[0]), lines.length);
  const unread = filterLines(lines.slice(seen), credentials.username, direction);
  setDmSeen(credentials.username, argv[0], lines.length);
  process.stdout.write(formatLines(unread, ''));
  seen = lines.length;
  await watchDm(credentials, argv[0], seen, direction);
  return '';
}

async function openCommand(argv: string[]): Promise<string> {
  if (argv.length !== 1) throw new CommandError(`try: ${commandName()} open bob\n`);
  return startDm(argv[0]);
}

async function closeCommand(argv: string[]): Promise<string> {
  if (argv.length !== 1) throw new CommandError(`try: ${commandName()} close bob\n`);
  return closeDm(argv[0]);
}

async function tailDm(username: string, limit: number | 'all') {
  const credentials = requireCredentials();
  const lines = await dmLines(credentials, username);
  setDmSeen(credentials.username, username, lines.length);
  return formatLines(limit === 'all' ? lines : lines.slice(-limit), 'no messages\n');
}

function version() {
  return readFileSync(join(sourceRoot(), 'VERSION'), 'utf8').trim();
}

function skills() {
  const path = join(sourceRoot(), 'SKILLS.md');
  if (!existsSync(path)) throw new CommandError(`SKILLS.md not found; run ${commandName()} upgrade and try again\n`);
  return ensureNewline(readFileSync(path, 'utf8'));
}

function sourceRoot() {
  if (process.env.OOOLALA_SOURCE) return process.env.OOOLALA_SOURCE;
  if (process.env.OOOLALA_INSTALL) return dirname(process.env.OOOLALA_INSTALL);

  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '../../../..');
}

function appHome() {
  return process.env.OOOLALA_HOME || join(homedir(), '.ooolala');
}

function configPath() {
  return join(appHome(), 'config');
}

function readConfig() {
  const path = configPath();
  if (!existsSync(path)) return new Map<string, string>();

  return new Map(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.split('='))
      .filter((parts) => parts.length >= 2)
      .map(([key, ...value]) => [key.trim(), value.join('=').trim()] as [string, string])
  );
}

function writeConfig(config: Map<string, string>) {
  mkdirSync(dirname(configPath()), {recursive: true});

  const keys = [
    ...configOrder.filter((key) => config.has(key)),
    ...[...config.keys()].filter((key) => !configOrder.includes(key)).sort()
  ];

  const body = keys.length === 0 ? '' : keys.map((key) => `${key}=${config.get(key) ?? ''}`).join('\n') + '\n';
  writeFileSync(configPath(), body, {mode: 0o600});
  chmodSync(configPath(), 0o600);
}

function readCredentials(): Credentials | null {
  const config = readConfig();
  const username = config.get('username');
  const password = config.get('password');

  if (username && password) return {username, password};
  return null;
}

function requireCredentials() {
  const credentials = readCredentials();
  if (!credentials) {
    throw new CommandError(`not authed; run ${authHint()}\n`);
  }
  return credentials;
}

async function authCommand(argv: string[], stdin?: string) {
  if (argv.length > 1) throw new CommandError(`shape: ${commandName()} auth [username]\n`);

  const readAuthValue = promptReader(stdin);
  const username = clean(argv[0] ?? await readAuthValue('username: '));

  if (!username) throw new CommandError('username required\n');

  const availability = await usernameAvailability(username);

  if (availability.available) {
    const password = clean(await readAuthValue('password (12+ chars): ', true));
    const confirmation = clean(await readAuthValue('confirm password: ', true));

    if (!password) throw new CommandError('password required\n');
    if (password !== confirmation) throw new CommandError('passwords did not match\n');

    const response = await requestApi('POST', '/signup', undefined, new URLSearchParams({username, password}));
    if (!response.ok) throw new CommandError(response.error);

    const savedUsername = setCredentials(responseUsername(response.body, username), password);
    return authCreateSuccess(savedUsername);
  }

  const password = clean(await readAuthValue('password: ', true));

  if (!password) throw new CommandError('password required\n');

  const response = await requestApi('POST', '/login', undefined, new URLSearchParams({username, password}));
  if (!response.ok) throw new CommandError(response.error);

  const savedUsername = setCredentials(responseUsername(response.body, username), password);
  return `auth ${savedUsername}\n`;
}

async function usernameAvailability(username: string) {
  const response = await requestApi('GET', `/signup?${new URLSearchParams({username})}`);

  if (response.ok) {
    return {available: true, username: responseUsername(response.body, username)};
  }

  if (response.error === 'username unavailable\n') return {available: false, username};
  throw new CommandError(response.error);
}

function signoutCommand(argv: string[]) {
  if (argv.length > 0) throw new CommandError(`shape: ${commandName()} signout\n`);

  const config = readConfig();
  for (const key of [...config.keys()]) {
    if (key === 'handle' || key === 'username' || key === 'password' || key.startsWith('dm_seen.')) {
      config.delete(key);
    }
  }
  writeConfig(config);
  return 'signed out\n';
}

async function passwordCommand(argv: string[], stdin?: string) {
  if (argv.length > 0) throw new CommandError(`shape: ${commandName()} password\n`);

  const credentials = requireCredentials();
  const readAuthValue = promptReader(stdin);
  const password = clean(await readAuthValue('new password (12+ chars): ', true));
  const confirmation = clean(await readAuthValue('confirm password: ', true));

  if (!password) throw new CommandError('password required\n');
  if (password !== confirmation) throw new CommandError('passwords did not match\n');

  const response = await requestApi('POST', '/password', credentials, new URLSearchParams({password}));
  if (!response.ok) throw new CommandError(response.error);

  setCredentials(credentials.username, password);
  return 'password updated\n';
}

function setCredentials(username: string, password: string) {
  const nextUsername = clean(username);
  const config = readConfig();
  config.set('username', nextUsername);
  config.set('password', clean(password));
  if (!config.has('handle')) config.set('handle', nextUsername);
  writeConfig(config);
  return nextUsername;
}

function responseUsername(body: string, fallback: string) {
  const match = body.match(/^ok\s+([^\s]+)/);
  return match ? match[1] : fallback;
}

function authCreateSuccess(username: string) {
  const command = commandHint();

  return `created and signed in as ${username}\ntry: ${command} send ${welcomeUser()} "hello"\n`;
}

function dmSeen(username: string, peer: string) {
  const value = Number.parseInt(readConfig().get(dmSeenKey(username, peer)) || '0', 10);
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function setDmSeen(username: string, peer: string, count: number) {
  const config = readConfig();
  config.set(dmSeenKey(username, peer), String(Math.max(0, count)));
  writeConfig(config);
}

function dmSeenKey(username: string, peer: string) {
  return `dm_seen.${clean(username)}.${clean(peer)}`;
}

function apiUrl() {
  return process.env.OOOLALA_API || process.env.OOOLALA_DEFAULT_API_URL || fallbackApiUrl;
}

function prepareAttachmentUploads(paths: string[]) {
  const uploads: AttachmentUpload[] = [];
  const cleanup: string[] = [];

  try {
    for (const path of paths) {
      const prepared = prepareAttachmentPath(path);
      cleanup.push(...prepared.cleanup);
      uploads.push({
        filename: prepared.filename,
        contentType: contentTypeFor(prepared.filename),
        data: readFileSync(prepared.path)
      });
    }

    enforceAttachmentLimits(uploads);
    return uploads;
  } finally {
    for (const path of cleanup) rmSync(path, {recursive: true, force: true});
  }
}

function prepareAttachmentPath(inputPath: string) {
  const path = resolve(inputPath);
  if (!existsSync(path)) throw new CommandError(`attachment not found: ${inputPath}\n`);

  const stats = statSync(path);
  if (stats.isFile()) {
    return {path, filename: basename(path), cleanup: [] as string[]};
  }

  if (stats.isDirectory()) {
    return archiveDirectory(path);
  }

  throw new CommandError(`attachment must be a file or directory: ${inputPath}\n`);
}

function archiveDirectory(path: string) {
  const temp = mkdtempSync(join(tmpdir(), 'ooolala-attach-'));
  const name = basename(path.replace(/\/+$/, '')) || 'attachment';
  const zipPath = join(temp, `${name}.zip`);

  if (commandExists('zip')) {
    const result = spawnSync('zip', ['-qr', zipPath, '.'], {cwd: path});
    if ((result.status ?? 1) === 0 && existsSync(zipPath)) return {path: zipPath, filename: `${name}.zip`, cleanup: [temp]};
  }

  const tarPath = join(temp, `${name}.tar.gz`);
  const result = spawnSync('tar', ['-czf', tarPath, '-C', dirname(path), basename(path)]);
  if (result.error) throw new CommandError(`${result.error.message}\n`);
  if ((result.status ?? 1) !== 0 || !existsSync(tarPath)) {
    throw new CommandError('could not archive directory; install zip or tar\n');
  }

  return {path: tarPath, filename: `${name}.tar.gz`, cleanup: [temp]};
}

function commandExists(command: string) {
  const result = spawnSync('sh', ['-c', `command -v ${command} >/dev/null 2>&1`]);
  return (result.status ?? 1) === 0;
}

function enforceAttachmentLimits(uploads: AttachmentUpload[]) {
  const maxCount = envInteger('OOOLALA_MAX_ATTACHMENTS', 5);
  const maxBytes = envInteger('OOOLALA_MAX_ATTACHMENT_BYTES', 5 * 1024 * 1024);
  const maxTotalBytes = envInteger('OOOLALA_MAX_ATTACHMENTS_TOTAL_BYTES', 15 * 1024 * 1024);
  const total = uploads.reduce((sum, upload) => sum + upload.data.byteLength, 0);

  if (uploads.length > maxCount) throw new CommandError(`too many attachments; max ${maxCount}\n`);
  if (total > maxTotalBytes) throw new CommandError(`attachments too large; max ${formatBytes(maxTotalBytes)} total\n`);

  for (const upload of uploads) {
    if (upload.data.byteLength === 0) throw new CommandError(`attachment is empty: ${upload.filename}\n`);
    if (upload.data.byteLength > maxBytes) {
      throw new CommandError(`attachment too large: ${upload.filename} max ${formatBytes(maxBytes)}\n`);
    }
  }
}

function addAttachmentParams(params: URLSearchParams, attachments: AttachmentUpload[]) {
  params.set('attachment_count', String(attachments.length));

  attachments.forEach((attachment, index) => {
    params.set(`attachment_${index}_filename`, attachment.filename);
    params.set(`attachment_${index}_content_type`, attachment.contentType);
    params.set(`attachment_${index}_data`, attachment.data.toString('base64'));
  });
}

function contentTypeFor(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.txt') || lower.endsWith('.log') || lower.endsWith('.md')) return 'text/plain';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.gz')) return 'application/gzip';
  return 'application/octet-stream';
}

function responseFilename(disposition: string | null) {
  if (!disposition) return '';
  const match = disposition.match(/filename="([^"]+)"/i) || disposition.match(/filename=([^;]+)/i);
  return match ? basename(match[1].trim()) : '';
}

function unusedPath(path: string) {
  if (!existsSync(path)) return path;

  const directory = dirname(path);
  const filename = basename(path);
  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const extension = dot > 0 ? filename.slice(dot) : '';

  for (let index = 1; index < 1000; index += 1) {
    const candidate = join(directory, `${stem}-${index}${extension}`);
    if (!existsSync(candidate)) return candidate;
  }

  throw new CommandError(`could not find unused output path for ${path}\n`);
}

function envInteger(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${Math.floor(bytes / (1024 * 1024))} MiB`;
  if (bytes >= 1024) return `${Math.floor(bytes / 1024)} KiB`;
  return `${bytes} bytes`;
}

async function sendDm(username: string, body: string, attachments: AttachmentUpload[] = []) {
  const credentials = requireCredentials();
  const params = new URLSearchParams({
    to: username,
    body,
    format: 'json'
  });

  addAttachmentParams(params, attachments);

  const response = await requestApi('POST', '/dm', credentials, params);

  if (!response.ok) throw new CommandError(response.error);
  return formatLines(messagesToLines([parseMessageResponse(response.body)]), '');
}

async function downloadAttachment(messageId: string, attachmentId: string, outputDir: string) {
  const credentials = requireCredentials();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(`${apiUrl().replace(/\/+$/, '')}/attachments/${encodeURIComponent(messageId)}/${encodeURIComponent(attachmentId)}`, {
      headers: {
        authorization: `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`
      },
      signal: controller.signal
    });

    const data = Buffer.from(await response.arrayBuffer());
    if (response.status === 401) throw new CommandError('invalid credentials\n');
    if (!response.ok) throw new CommandError(ensureNewline(data.toString('utf8')));

    const filename = responseFilename(response.headers.get('content-disposition')) || `${attachmentId}.bin`;
    const directory = resolve(outputDir);
    mkdirSync(directory, {recursive: true});
    const path = unusedPath(join(directory, filename));
    writeFileSync(path, data);
    return `saved ${path}\n`;
  } catch (error) {
    if (error instanceof CommandError) throw error;
    throw new CommandError(`backend unavailable: ${errorMessage(error).trim()}\n`);
  } finally {
    clearTimeout(timeout);
  }
}

async function startDm(username: string) {
  const credentials = requireCredentials();
  const response = await requestApi('POST', '/dm/chats', credentials, new URLSearchParams({
    with: username,
    format: 'json'
  }));

  if (!response.ok) throw new CommandError(response.error);
  return `chat ${username.trim()}\n`;
}

async function closeDm(username: string) {
  const credentials = requireCredentials();
  const path = `/dm/chats?${new URLSearchParams({with: username})}`;
  const response = await requestApi('DELETE', path, credentials);

  if (!response.ok) throw new CommandError(response.error);
  return `closed ${username.trim()}\n`;
}

async function dmLines(credentials: Credentials, username: string) {
  const path = `/dm?${new URLSearchParams({with: username, format: 'json'})}`;
  const response = await requestApi('GET', path, credentials);
  if (!response.ok) throw new CommandError(response.error);
  return messagesToLines(parseMessagesResponse(response.body));
}

async function versionReport() {
  const local = localVersionLines().join('\n');
  const backend = await requestApi('GET', '/version?format=text');
  const backendText = backend.ok ? backend.body.trimEnd() : `backend_status unavailable: ${backend.error.trim()}`;

  return `local
${local}

backend ${apiUrl()}
${backendText}
`;
}

function localVersionLines() {
  return [
    `product_version ${version()}`,
    `commit ${process.env.OOOLALA_COMMIT || process.env.GITHUB_SHA || 'local'}`,
    `environment ${process.env.OOOLALA_ENV || process.env.NODE_ENV || 'client'}`,
    'command_surface 8',
    'chat_protocol 1..3',
    'auth_policy 7',
    'ui_flow 12'
  ];
}

async function requestApi(
  method: 'DELETE' | 'GET' | 'POST',
  path: string,
  credentials?: Credentials,
  body?: URLSearchParams
): Promise<ApiResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const headers: Record<string, string> = {};
    if (credentials) {
      headers.authorization = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`;
    }
    if (body) headers['content-type'] = 'application/x-www-form-urlencoded';

    const response = await fetch(`${apiUrl().replace(/\/+$/, '')}${path}`, {
      method,
      headers,
      body,
      signal: controller.signal
    });

    const text = await response.text();

    if (response.status === 401) return {ok: false, error: 'invalid credentials\n'};
    if (!response.ok) return {ok: false, error: ensureNewline(text)};
    return {ok: true, body: ensureNewline(text)};
  } catch (error) {
    return {ok: false, error: `backend unavailable: ${errorMessage(error).trim()}\n`};
  } finally {
    clearTimeout(timeout);
  }
}

function transcriptLines(transcript: string) {
  return transcript
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0 && line !== 'no messages')
    .map(localizeTranscriptLine);
}

function parseMessageResponse(body: string): BackendMessage {
  const parsed = JSON.parse(body) as {message?: BackendMessage};
  if (!parsed.message) throw new CommandError('bad backend message response\n');
  return parsed.message;
}

function parseMessagesResponse(body: string): BackendMessage[] {
  const parsed = JSON.parse(body) as {messages?: BackendMessage[]};
  if (!Array.isArray(parsed.messages)) throw new CommandError('bad backend messages response\n');
  return parsed.messages;
}

function messagesToLines(messages: BackendMessage[]) {
  return messages.map((message) => {
    const body = message.body.replace(/\s+/g, ' ').trim();
    const attachments = (message.attachments || [])
      .map((attachment) => ` [attachment ${attachment.filename} ${message.id}/${attachment.id}]`)
      .join('');
    return `${localTime(message.inserted_at)} ${message.room} ${message.author}: ${body}${attachments}`;
  });
}

function localizeTranscriptLine(line: string) {
  const isoMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\S+)\s+(\S+)\s+([^:]+):\s?(.*)$/);
  if (isoMatch) return `${localTime(isoMatch[1])} ${isoMatch[2]} ${isoMatch[3]}: ${isoMatch[4]}`;

  const legacyMatch = line.match(/^(\d\d):(\d\d):(\d\d)\s+(\S+)\s+([^:]+):\s?(.*)$/);
  if (!legacyMatch) return line;

  const now = new Date();
  const date = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    Number(legacyMatch[1]),
    Number(legacyMatch[2]),
    Number(legacyMatch[3])
  ));

  return `${localTime(date)} ${legacyMatch[4]} ${legacyMatch[5]}: ${legacyMatch[6]}`;
}

function formatLines(lines: string[], empty: string) {
  return lines.length === 0 ? empty : `${lines.join('\n')}\n`;
}

function formatUnread(lines: string[]) {
  return lines.length === 0 ? 'no unread\n' : formatLines(lines, '');
}

function formatJsonUnread(lines: string[]) {
  return lines.length === 0 ? '' : `${lines.map((line) => JSON.stringify(parseTranscriptLine(line))).join('\n')}\n`;
}

function parseTranscriptLine(line: string) {
  const isoMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\S+)\s+(\S+)\s+([^:]+):\s?(.*)$/);
  if (isoMatch) {
    return {time: localTime(isoMatch[1]), room: isoMatch[2], author: isoMatch[3].trim(), body: isoMatch[4]};
  }

  const localMatch = line.match(/^(\d\d:\d\d:\d\d)\s+(\S+)\s+([^:]+):\s?(.*)$/);
  if (localMatch) {
    return {time: localMatch[1], room: localMatch[2], author: localMatch[3].trim(), body: localMatch[4]};
  }

  return {body: line};
}

function filterLines(lines: string[], currentUsername: string, direction: 'all' | 'incoming') {
  if (direction === 'all') return lines;
  return lines.filter((line) => parseTranscriptLine(line).author !== currentUsername);
}

function parseCanonicalUnreadOptions(opts: string[]) {
  const parsed: {direction: 'all' | 'incoming'; format: 'text' | 'json'} = {
    direction: 'all',
    format: 'text'
  };

  for (const opt of opts) {
    if (opt === 'incoming') parsed.direction = 'incoming';
    else if (opt === 'json') parsed.format = 'json';
    else throw new CommandError(`try: ${commandName()} read bob unread incoming\n`);
  }

  return parsed;
}

async function watchDm(credentials: Credentials, username: string, seen: number, direction: 'all' | 'incoming') {
  let nextSeen = seen;

  while (true) {
    await sleep(1500);

    try {
      const lines = await dmLines(credentials, username);
      nextSeen = Math.min(nextSeen, lines.length);
      const newLines = filterLines(lines.slice(nextSeen), credentials.username, direction);
      if (newLines.length > 0) process.stdout.write(formatLines(newLines, ''));
      setDmSeen(credentials.username, username, lines.length);
      nextSeen = lines.length;
    } catch (error) {
      process.stderr.write(errorMessage(error));
    }
  }
}

function openConfig() {
  mkdirSync(dirname(configPath()), {recursive: true});
  if (!existsSync(configPath())) {
    writeFileSync(configPath(), '', {mode: 0o600});
    chmodSync(configPath(), 0o600);
  }

  const [editor, ...args] = editorCommand();
  const result = spawnSync(editor, [...args, configPath()], {stdio: 'inherit'});
  if (result.error) throw new CommandError(`${result.error.message}\n`);
  if ((result.status ?? 1) !== 0) throw new CommandError(`editor exited ${result.status ?? 1}\n`);
}

function editorCommand() {
  const editor = process.env.VISUAL || process.env.EDITOR || 'vim';
  const parts = splitShellWords(editor);
  const command = parts[0] || 'vim';
  const args = parts.slice(1);

  if (['vi', 'vim', 'nvim'].includes(command.split('/').pop() || command) && !args.includes('-n')) {
    return [command, '-n', ...args];
  }

  return [command, ...args];
}

function splitShellWords(value: string) {
  const matches = value.matchAll(/"([^"]*)"|'([^']*)'|[^\s"']+/g);
  return [...matches].map((match) => match[1] ?? match[2] ?? match[0]);
}

function launchTui() {
  const root = sourceRoot();
  const terminalRoot = join(root, 'apps/frontend/terminal');
  const credentials = requireCredentials();

  if (!existsSync(terminalRoot)) throw new CommandError(`terminal source not found; run ${commandName()} upgrade and try again\n`);

  const tsx = join(root, 'node_modules/.bin/tsx');
  if (!existsSync(tsx)) {
    runInteractive('npm', ['install', '--workspace', 'apps/frontend/terminal'], root);
  }

  runInteractive(tsx, ['src/tui.tsx'], terminalRoot, {
    OOOLALA_AUTO_LOGIN: '1',
    OOOLALA_USERNAME: credentials.username,
    OOOLALA_PASSWORD: credentials.password
  });
}

function runInteractive(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(command, args, {cwd, stdio: 'inherit', env: {...process.env, ...env}});
  if (result.error) throw new CommandError(`${result.error.message}\n`);
  if ((result.status ?? 1) !== 0) throw new CommandError(`${command} exited ${result.status ?? 1}\n`);
}

function upgrade() {
  const installerUrl = process.env.OOOLALA_INSTALL_URL;
  const installer = process.env.OOOLALA_INSTALL || join(sourceRoot(), 'install.sh');

  if (installerUrl) {
    return runCaptured('sh', ['-c', 'curl -fsSL "$1" | bash', 'ooolala-upgrade', installerUrl]);
  }

  if (existsSync(installer)) return runCaptured(installer, ['upgrade']);
  throw new CommandError('installer not found; set OOOLALA_INSTALL_URL or OOOLALA_INSTALL\n');
}

function runCaptured(command: string, args: string[]) {
  const result = spawnSync(command, args, {encoding: 'utf8'});
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.error) throw new CommandError(`${result.error.message}\n`);
  if ((result.status ?? 1) !== 0) throw new CommandError(output || `${command} exited ${result.status ?? 1}\n`);
  return output;
}

function promptReader(stdin?: string) {
  const scriptedInputs = stdin === undefined ? null : stdin.split(/\r?\n/);
  let scriptedIndex = 0;
  let pipedInputs: string[] | null = null;
  let pipedIndex = 0;

  return async (label: string, secret = false) => {
    if (scriptedInputs) return scriptedInputs[scriptedIndex++] ?? '';
    if (!process.stdin.isTTY) {
      pipedInputs ??= (await readStdin()).split(/\r?\n/);
      return pipedInputs[pipedIndex++] ?? '';
    }
    return secret ? promptSecret(label) : promptText(label);
  };
}

async function promptText(label: string) {
  const rl = createInterface({input: process.stdin, output: process.stderr});

  try {
    return await rl.question(label);
  } finally {
    rl.close();
  }
}

async function promptSecret(label: string) {
  if (!process.stdin.isTTY) return (await readStdin()).split(/\r?\n/)[0] ?? '';

  return new Promise<string>((resolvePrompt, rejectPrompt) => {
    const stdin = process.stdin;
    const stderr = process.stderr;
    const wasRaw = stdin.isRaw;
    let value = '';

    const cleanup = () => {
      stdin.off('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
    };

    const finish = () => {
      cleanup();
      stderr.write('\n');
      resolvePrompt(value);
    };

    const onData = (chunk: Buffer | string) => {
      const input = chunk.toString('utf8');

      for (const char of input) {
        if (char === '\u0003') {
          cleanup();
          stderr.write('\n');
          rejectPrompt(new CommandError('cancelled\n'));
          return;
        }

        if (char === '\r' || char === '\n') {
          finish();
          return;
        }

        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
          continue;
        }

        value += char;
      }
    };

    stderr.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

async function readStdin() {
  let input = '';
  process.stdin.setEncoding('utf8');

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  return input;
}

function localTime(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return [date.getHours(), date.getMinutes(), date.getSeconds()].map((part) => part.toString().padStart(2, '0')).join(':');
}

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function ensureNewline(value: string) {
  return value.endsWith('\n') ? value : `${value}\n`;
}

function commandName() {
  return process.env.OOOLALA_APP || 'ooolala';
}

function commandHint() {
  return process.env.OOOLALA_COMMAND_HINT || commandName();
}

function welcomeUser() {
  return process.env.OOOLALA_WELCOME_USER || 'bob';
}

function authHint() {
  return process.env.OOOLALA_AUTH_HINT || `${commandName()} auth <username>`;
}

function help() {
  return helpTemplate.replaceAll('ooolala', commandName());
}

function clean(value: string) {
  return String(value).trim().replace(/\t/g, ' ');
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return ensureNewline(error.message);
  return `${String(error)}\n`;
}

function grayIfTty(output: string) {
  if (output.length === 0 || !process.stdout.isTTY || process.env.NO_COLOR) return output;
  return `\u001b[38;5;245m${output}\u001b[0m`;
}

async function main() {
  const result = await run(process.argv.slice(2));
  if (result.stdout) process.stdout.write(grayIfTty(result.stdout));
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.status;
}

const entrypoint = process.argv[1] ? resolve(process.argv[1]) : '';
const currentFile = fileURLToPath(import.meta.url);

if (entrypoint === currentFile) {
  void main();
}
