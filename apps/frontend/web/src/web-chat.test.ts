import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWebEscapeKey,
  isDocsPath,
  moveChatSelection,
  normalizeChatSelection,
  readAuthPayloadFromStorage,
  readLaunchAuthPayloadFromHash,
  webStatusText
} from './web-chat';

test('web launch auth decodes the CLI fragment handoff', () => {
  const payload = {
    username: 'user2',
    password: '1234',
    apiUrl: 'https://api.example'
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');

  assert.deepEqual(readLaunchAuthPayloadFromHash(`#ooolala=${encoded}`), payload);
});

test('web launch auth ignores ordinary hashes', () => {
  assert.equal(readLaunchAuthPayloadFromHash('#rooms'), null);
  assert.equal(readLaunchAuthPayloadFromHash(''), null);
});

test('browser auth storage restores a saved login payload', () => {
  const payload = {
    username: 'user1',
    password: '1234',
    apiUrl: 'https://api.example'
  };
  const storage = {
    getItem(key: string) {
      return key === 'ooolala.auth' ? JSON.stringify(payload) : null;
    }
  };

  assert.deepEqual(readAuthPayloadFromStorage(storage), payload);
});

test('web status copy translates login auth messages', () => {
  assert.equal(webStatusText('invalid credentials\n'), 'username or password is wrong');
  assert.equal(webStatusText('password must be at least 12 characters\n'), 'password must be at least 12 characters');
});

test('web chat treats escape and ctrl bracket as chat escape', () => {
  assert.equal(isWebEscapeKey({key: 'Escape', code: 'Escape', ctrlKey: false}), true);
  assert.equal(isWebEscapeKey({key: '[', code: 'BracketLeft', ctrlKey: true}), true);
  assert.equal(isWebEscapeKey({key: 'j', code: 'KeyJ', ctrlKey: false}), false);
});

test('web chat selection movement clamps to known chats', () => {
  assert.equal(moveChatSelection(1, 1, 3), 2);
  assert.equal(moveChatSelection(2, 1, 3), 2);
  assert.equal(moveChatSelection(0, -1, 3), 0);
  assert.equal(moveChatSelection(2, 1, 0), 0);
  assert.equal(normalizeChatSelection(8, 3), 2);
  assert.equal(normalizeChatSelection(-2, 3), 0);
  assert.equal(normalizeChatSelection(2, 0), 0);
});

test('docs route matches with or without trailing slash', () => {
  assert.equal(isDocsPath('/docs'), true);
  assert.equal(isDocsPath('/docs/'), true);
  assert.equal(isDocsPath('/web'), false);
});
