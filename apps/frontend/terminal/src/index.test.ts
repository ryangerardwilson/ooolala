import {createServer} from 'node:http';
import {chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {run} from './index.js';

test('help prints canonical command grammar', async () => {
  const help = await run(['help']);

  assert.equal(help.status, 0);
  assert.match(help.stdout, /commands:/);
  assert.match(help.stdout, /ooolala send bob/);
  assert.match(help.stdout, /ooolala send bob "logs attached" attach/);
  assert.match(help.stdout, /# download <message-id> <attachment-id>/);
  assert.match(help.stdout, /ooolala upgrade/);
  assert.match(help.stdout, /ooolala signout/);
  assert.match(help.stdout, /auth creates the account/);
  assert.doesNotMatch(help.stdout, /ooolala dm /);
  assert.doesNotMatch(help.stdout, /ooolala signup/);
});

test('no args bootstraps auth on first run', async () => {
  await withServer(async (url) => {
    await withHome(async (home) => {
      process.env.OOOLALA_API = url;

      const auth = await run([], 'user1\n1234\n');
      const who = await run(['who']);

      assert.equal(auth.stdout, 'auth user1\n');
      assert.equal(who.stdout, 'user1\n');
      assert.match(readFileSync(join(home, 'config'), 'utf8'), /^handle=user1\nusername=user1\npassword=1234\n$/);
    });
  });
});

test('removed aliases are unsupported', async () => {
  for (const argv of [['-h'], ['-v'], ['-u'], ['signup', 'user3'], ['dm', 'bob', 'hello'], ['conf'], ['remove', 'bob'], ['forget', 'bob']]) {
    const result = await run(argv);

    assert.equal(result.status, 1);
    assert.equal(result.stderr, 'unknown command; try: ooolala help\n');
  }
});

test('skills prints the agent usage instructions', async () => {
  const result = await run(['skills']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^# Ooolala Agent Skill/);
  assert.match(result.stdout, /ooolala send bob/);
  assert.doesNotMatch(result.stdout, /ooolala dm /);
  assert.match(result.stdout, /\n$/);
});

test('help and errors use the installed app name', async () => {
  const oldApp = process.env.OOOLALA_APP;

  try {
    process.env.OOOLALA_APP = 'ooolala-dev';

    const help = await run(['help']);
    const unknown = await run(['wat']);

    assert.equal(help.status, 0);
    assert.match(help.stdout, /ooolala-dev tui/);
    assert.match(help.stdout, /ooolala-dev web/);
    assert.equal(unknown.status, 1);
    assert.equal(unknown.stderr, 'unknown command; try: ooolala-dev help\n');
  } finally {
    if (oldApp === undefined) delete process.env.OOOLALA_APP;
    else process.env.OOOLALA_APP = oldApp;
  }
});

test('auth prompts for password and rejects inline password args', async () => {
  await withServer(async (url) => {
    await withHome(async (home) => {
      process.env.OOOLALA_API = url;

      const auth = await run(['auth', 'user1'], '1234\n');
      const who = await run(['who']);
      const inlinePassword = await run(['auth', 'user1', '1234']);

      assert.equal(auth.stdout, 'auth user1\n');
      assert.equal(who.stdout, 'user1\n');
      assert.match(readFileSync(join(home, 'config'), 'utf8'), /^handle=user1\nusername=user1\npassword=1234\n$/);
      assert.equal(inlinePassword.status, 1);
      assert.equal(inlinePassword.stderr, 'shape: ooolala auth [username]\n');
    });
  });
});

test('auth creates credentials when the handle is free', async () => {
  await withServer(async (url) => {
    await withHome(async (home) => {
      process.env.OOOLALA_API = url;

      const auth = await run(['auth', 'User3'], 'correct horse battery\ncorrect horse battery\n');
      const who = await run(['who']);

      assert.equal(auth.stdout, 'created and signed in as user3\ntry: ooolala send bob "hello"\n');
      assert.equal(who.stdout, 'user3\n');
      assert.match(readFileSync(join(home, 'config'), 'utf8'), /^handle=user3\nusername=user3\npassword=correct horse battery\n$/);
    });
  });
});

test('auth checks invalid usernames before collecting passwords', async () => {
  await withServer(async (url) => {
    await withHome(async () => {
      process.env.OOOLALA_API = url;

      const auth = await run(['auth', 'bad user']);

      assert.equal(auth.status, 1);
      assert.equal(auth.stderr, 'invalid username\n');
    });
  });
});

test('auth create success uses the dev command hint when present', async () => {
  await withServer(async (url) => {
    await withHome(async () => {
      process.env.OOOLALA_API = url;
      process.env.OOOLALA_COMMAND_HINT = 'scripts/dev/run-cli.sh';

      const auth = await run(['auth', 'devuser'], 'correct horse battery\ncorrect horse battery\n');

      assert.equal(auth.stdout, 'created and signed in as devuser\ntry: scripts/dev/run-cli.sh send bob "hello"\n');
    });
  });
});

test('password updates saved credentials after the backend accepts the change', async () => {
  await withServer(async (url) => {
    await withHome(async (home) => {
      process.env.OOOLALA_API = url;

      await run(['auth', 'user3'], 'first good password\nfirst good password\n');
      const updated = await run(['password'], 'second good password\nsecond good password\n');
      const oldPassword = await run(['auth', 'user3'], 'first good password\n');
      const newPassword = await run(['auth', 'user3'], 'second good password\n');

      assert.equal(updated.stdout, 'password updated\n');
      assert.match(readFileSync(join(home, 'config'), 'utf8'), /^handle=user3\nusername=user3\npassword=second good password\n$/);
      assert.equal(oldPassword.status, 1);
      assert.equal(oldPassword.stderr, 'invalid credentials\n');
      assert.equal(newPassword.status, 0);
    });
  });
});

test('signout clears saved credentials and local seen cursors', async () => {
  await withServer(async (url) => {
    await withHome(async (home) => {
      process.env.OOOLALA_API = url;

      await run(['auth', 'user1'], '1234\n');
      await run(['send', 'user2', 'hello']);
      await run(['read', 'user2']);
      const signedOut = await run(['signout']);
      const who = await run(['who']);

      assert.equal(signedOut.stdout, 'signed out\n');
      assert.equal(who.stdout, 'not authed\n');
      assert.equal(readFileSync(join(home, 'config'), 'utf8'), '');
    });
  });
});

test('api command remains unsupported', async () => {
  const result = await run(['api']);

  assert.equal(result.status, 1);
  assert.equal(result.stderr, 'unknown command; try: ooolala help\n');
});

test('local-only room commands remain unsupported', async () => {
  const examples = [
    ['me', 'ryan'],
    ['tail', 'general'],
    ['room', 'ls'],
    ['sync']
  ];

  for (const argv of examples) {
    const result = await run(argv);

    assert.equal(result.status, 1);
    assert.equal(result.stderr, 'unknown command; try: ooolala help\n');
  }
});

test('missing auth can use a wrapper-specific auth hint', async () => {
  await withHome(async () => {
    process.env.OOOLALA_AUTH_HINT = 'scripts/dev/run-cli.sh auth <username>';

    const result = await run(['send', 'user2', 'hello']);

    assert.equal(result.status, 1);
    assert.equal(result.stderr, 'not authed; run scripts/dev/run-cli.sh auth <username>\n');
  });
});

test('send and read use the backend with saved credentials', async () => {
  await withServer(async (url) => {
    await withHome(async () => {
      process.env.OOOLALA_API = url;

      await run(['auth', 'user1'], '1234\n');
      const result = await run(['send', 'user2', 'hello']);
      const transcript = await run(['read', 'user2']);
      const last = await run(['read', 'user2', 'last', '10']);

      assert.equal(result.status, 0);
      assert.match(result.stdout, /^\d\d:\d\d:\d\d dm:user1:user2 user1: hello\n$/);
      assert.equal(transcript.stdout, result.stdout);
      assert.equal(last.stdout, result.stdout);
    });
  });
});

test('send can attach files and download them later', async () => {
  await withServer(async (url) => {
    await withHome(async (home) => {
      const notePath = join(home, 'note.txt');
      const downloads = join(home, 'downloads');
      writeFileSync(notePath, 'hello file');
      process.env.OOOLALA_API = url;

      await run(['auth', 'user1'], '1234\n');
      const sent = await run(['send', 'user2', 'see attached', 'attach', notePath]);
      const downloaded = await run(['download', 'test-message-1', 'attachment-1', downloads]);

      assert.equal(sent.status, 0);
      assert.match(sent.stdout, /user1: see attached \[attachment note\.txt test-message-1\/attachment-1\]\n$/);
      assert.equal(downloaded.status, 0);
      assert.equal(readFileSync(join(downloads, 'note.txt'), 'utf8'), 'hello file');
    });
  });
});

test('open and close update the backend chat list', async () => {
  await withServer(async (url) => {
    await withHome(async () => {
      process.env.OOOLALA_API = url;

      await run(['auth', 'user1'], '1234\n');
      const opened = await run(['open', 'user2']);
      const closed = await run(['close', 'user2']);

      assert.equal(opened.status, 0);
      assert.equal(opened.stdout, 'chat user2\n');
      assert.equal(closed.status, 0);
      assert.equal(closed.stdout, 'closed user2\n');
    });
  });
});

test('web opens the browser with transient auth handoff', async () => {
  await withServer(async (url) => {
    await withHome(async (home) => {
      const browserScript = join(home, 'browser.mjs');
      const browserLog = join(home, 'browser.log');

      writeFileSync(browserScript, `
        import {writeFileSync} from 'node:fs';
        writeFileSync(process.env.OOOLALA_BROWSER_LOG, process.argv[2]);
      `);
      chmodSync(browserScript, 0o755);

      process.env.BROWSER = `${process.execPath} ${browserScript}`;
      process.env.OOOLALA_BROWSER_LOG = browserLog;
      process.env.OOOLALA_API = url;
      process.env.OOOLALA_DEFAULT_WEB_URL = 'https://web.example/';

      await run(['auth', 'user2'], '1234\n');
      const result = await run(['web']);

      assert.equal(result.status, 0);
      assert.equal(result.stdout, 'opened https://web.example/web\n');
      assert.match(readFileSync(browserLog, 'utf8'), /^https:\/\/web\.example\/web#ooolala=/);
    });
  });
});

async function withHome(callback: (home: string) => Promise<void>) {
  const oldHome = process.env.OOOLALA_HOME;
  const oldApi = process.env.OOOLALA_API;
  const oldBrowser = process.env.BROWSER;
  const oldBrowserLog = process.env.OOOLALA_BROWSER_LOG;
  const oldWebUrl = process.env.OOOLALA_WEB_URL;
  const oldDefaultApi = process.env.OOOLALA_DEFAULT_API_URL;
  const oldDefaultWebUrl = process.env.OOOLALA_DEFAULT_WEB_URL;
  const oldCommandHint = process.env.OOOLALA_COMMAND_HINT;
  const oldAuthHint = process.env.OOOLALA_AUTH_HINT;
  const oldWelcomeUser = process.env.OOOLALA_WELCOME_USER;
  const home = mkdtempSync(join(tmpdir(), 'ooolala-cli-test-'));

  try {
    process.env.OOOLALA_HOME = home;
    delete process.env.OOOLALA_API;
    delete process.env.OOOLALA_WEB_URL;
    delete process.env.OOOLALA_DEFAULT_API_URL;
    delete process.env.OOOLALA_DEFAULT_WEB_URL;
    delete process.env.OOOLALA_COMMAND_HINT;
    delete process.env.OOOLALA_AUTH_HINT;
    delete process.env.OOOLALA_WELCOME_USER;
    await callback(home);
  } finally {
    if (oldHome === undefined) delete process.env.OOOLALA_HOME;
    else process.env.OOOLALA_HOME = oldHome;

    if (oldApi === undefined) delete process.env.OOOLALA_API;
    else process.env.OOOLALA_API = oldApi;

    if (oldBrowser === undefined) delete process.env.BROWSER;
    else process.env.BROWSER = oldBrowser;

    if (oldBrowserLog === undefined) delete process.env.OOOLALA_BROWSER_LOG;
    else process.env.OOOLALA_BROWSER_LOG = oldBrowserLog;

    if (oldWebUrl === undefined) delete process.env.OOOLALA_WEB_URL;
    else process.env.OOOLALA_WEB_URL = oldWebUrl;

    if (oldDefaultApi === undefined) delete process.env.OOOLALA_DEFAULT_API_URL;
    else process.env.OOOLALA_DEFAULT_API_URL = oldDefaultApi;

    if (oldDefaultWebUrl === undefined) delete process.env.OOOLALA_DEFAULT_WEB_URL;
    else process.env.OOOLALA_DEFAULT_WEB_URL = oldDefaultWebUrl;

    if (oldCommandHint === undefined) delete process.env.OOOLALA_COMMAND_HINT;
    else process.env.OOOLALA_COMMAND_HINT = oldCommandHint;

    if (oldAuthHint === undefined) delete process.env.OOOLALA_AUTH_HINT;
    else process.env.OOOLALA_AUTH_HINT = oldAuthHint;

    if (oldWelcomeUser === undefined) delete process.env.OOOLALA_WELCOME_USER;
    else process.env.OOOLALA_WELCOME_USER = oldWelcomeUser;

    rmSync(home, {recursive: true, force: true});
  }
}

async function withServer(callback: (url: string) => Promise<void>) {
  const users = new Map([
    ['user1', '1234'],
    ['user2', '1234'],
    ['bob', '1234']
  ]);
  const messages: Array<{
    id: string;
    room: string;
    author: string;
    body: string;
    inserted_at: string;
    attachments?: Array<{id: string; filename: string; content_type: string; byte_size: number; url: string}>;
  }> = [];
  const attachments = new Map<string, {filename: string; contentType: string; data: Buffer}>();

  const server = createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/login') {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        const params = new URLSearchParams(body);
        const username = cleanUsername(params.get('username') || '');
        if (users.get(username) === params.get('password')) {
          response.writeHead(200, {'content-type': 'text/plain'});
          response.end(`ok ${username}\n`);
          return;
        }

        response.writeHead(401, {'content-type': 'text/plain'});
        response.end('invalid credentials\n');
      });
      return;
    }

    if (request.method === 'GET' && request.url?.startsWith('/signup?')) {
      const url = new URL(request.url, 'http://127.0.0.1');
      const username = cleanUsername(url.searchParams.get('username') || '');

      if (!/^[a-z0-9_][a-z0-9_.-]{1,31}$/.test(username)) {
        response.writeHead(400, {'content-type': 'text/plain'});
        response.end('invalid username\n');
        return;
      }

      if (users.has(username)) {
        response.writeHead(409, {'content-type': 'text/plain'});
        response.end('username unavailable\n');
        return;
      }

      response.writeHead(200, {'content-type': 'text/plain'});
      response.end(`ok ${username}\n`);
      return;
    }

    if (request.method === 'POST' && request.url === '/signup') {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        const params = new URLSearchParams(body);
        const username = cleanUsername(params.get('username') || '');
        const password = params.get('password') || '';

        if (password.length < 12) {
          response.writeHead(400, {'content-type': 'text/plain'});
          response.end('password must be at least 12 characters\n');
          return;
        }

        if (users.has(username)) {
          response.writeHead(409, {'content-type': 'text/plain'});
          response.end('username unavailable\n');
          return;
        }

        users.set(username, password);
        response.writeHead(201, {'content-type': 'text/plain'});
        response.end(`ok ${username}\n`);
      });
      return;
    }

    if (request.method === 'POST' && request.url === '/password') {
      const auth = basicAuth(request.headers.authorization);

      if (!auth || users.get(auth.username) !== auth.password) {
        response.writeHead(401, {'content-type': 'text/plain'});
        response.end('invalid credentials\n');
        return;
      }

      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        const params = new URLSearchParams(body);
        const password = params.get('password') || '';
        if (password.length < 12) {
          response.writeHead(400, {'content-type': 'text/plain'});
          response.end('password must be at least 12 characters\n');
          return;
        }
        users.set(auth.username, password);
        response.writeHead(200, {'content-type': 'text/plain'});
        response.end(`ok ${auth.username}\n`);
      });
      return;
    }

    if (request.method === 'POST' && request.url === '/dm') {
      const auth = basicAuth(request.headers.authorization);
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        const params = new URLSearchParams(body);
        const author = auth?.username || 'user1';
        const to = params.get('to') || '';
        const attachmentCount = Number.parseInt(params.get('attachment_count') || '0', 10);
        const messageId = `test-message-${messages.length + 1}`;
        const messageAttachments = [];

        for (let index = 0; index < attachmentCount; index += 1) {
          const id = `attachment-${index + 1}`;
          const filename = params.get(`attachment_${index}_filename`) || `attachment-${index + 1}.bin`;
          const data = Buffer.from(params.get(`attachment_${index}_data`) || '', 'base64');
          const contentType = params.get(`attachment_${index}_content_type`) || 'application/octet-stream';

          attachments.set(`${messageId}/${id}`, {filename, contentType, data});
          messageAttachments.push({
            id,
            filename,
            content_type: contentType,
            byte_size: data.byteLength,
            url: `/attachments/${messageId}/${id}`
          });
        }

        const message = {
          id: messageId,
          room: `dm:${[author, to].sort().join(':')}`,
          author,
          body: params.get('body') || '',
          inserted_at: '2026-05-28T07:00:00Z',
          attachments: messageAttachments
        };
        messages.push(message);

        if (params.get('format') === 'json') {
          response.writeHead(200, {'content-type': 'application/json'});
          response.end(`${JSON.stringify({message})}\n`);
          return;
        }

        response.writeHead(200, {'content-type': 'text/plain'});
        response.end(`2026-05-28T07:00:00Z ${message.room} ${message.author}: ${message.body}\n`);
      });
      return;
    }

    if (request.method === 'GET' && request.url?.startsWith('/dm?')) {
      const auth = basicAuth(request.headers.authorization);
      const url = new URL(request.url, 'http://127.0.0.1');
      const username = auth?.username || 'user1';
      const peer = url.searchParams.get('with') || '';
      const room = `dm:${[username, peer].sort().join(':')}`;
      const roomMessages = messages.filter((message) => message.room === room);

      response.writeHead(200, {'content-type': 'application/json'});
      response.end(`${JSON.stringify({messages: roomMessages})}\n`);
      return;
    }

    if (request.method === 'POST' && request.url === '/dm/chats') {
      let body = '';
      request.setEncoding('utf8');
      request.on('data', (chunk) => {
        body += chunk;
      });
      request.on('end', () => {
        const params = new URLSearchParams(body);
        const peer = params.get('with') || '';

        response.writeHead(200, {'content-type': 'application/json'});
        response.end(`${JSON.stringify({peer, room: `dm:user1:${peer}`})}\n`);
      });
      return;
    }

    if (request.method === 'DELETE' && request.url?.startsWith('/dm/chats?')) {
      const url = new URL(request.url, 'http://127.0.0.1');
      response.writeHead(200, {'content-type': 'text/plain'});
      response.end(`removed ${url.searchParams.get('with') || ''}\n`);
      return;
    }

    if (request.method === 'GET' && request.url?.startsWith('/attachments/')) {
      const [_empty, _attachments, messageId, attachmentId] = request.url.split('/');
      const attachment = attachments.get(`${messageId}/${attachmentId}`);

      if (!attachment) {
        response.writeHead(404, {'content-type': 'text/plain'});
        response.end('attachment not found\n');
        return;
      }

      response.writeHead(200, {
        'content-type': attachment.contentType,
        'content-disposition': `attachment; filename="${attachment.filename}"`
      });
      response.end(attachment.data);
      return;
    }

    response.writeHead(404, {'content-type': 'text/plain'});
    response.end('not found\n');
  });

  await new Promise<void>((resolveListen) => {
    server.listen(0, '127.0.0.1', resolveListen);
  });

  const address = server.address();
  assert(address && typeof address === 'object');

  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => error ? rejectClose(error) : resolveClose());
    });
  }
}

function cleanUsername(value: string) {
  return value.trim().toLowerCase();
}

function basicAuth(value: string | string[] | undefined) {
  const header = Array.isArray(value) ? value[0] : value;
  if (!header) return null;

  const [scheme, encoded] = header.split(' ');
  if (scheme?.toLowerCase() !== 'basic' || !encoded) return null;

  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const [username, password] = decoded.split(':');
  if (!username || password === undefined) return null;

  return {username: cleanUsername(username), password};
}
