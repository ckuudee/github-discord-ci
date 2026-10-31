const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createApp } = require('../src/server');
const { verifySignature } = require('../src/verifySignature');
const fixture = require('./fixtures/push.json');

const SECRET = 'test-secret';
const body = Buffer.from(JSON.stringify(fixture));
const sign = (buf, secret = SECRET) =>
  'sha256=' + crypto.createHmac('sha256', secret).update(buf).digest('hex');

async function withServer(send, fn) {
  const app = createApp({ webhookUrl: 'http://discord.test', secret: SECRET, send });
  const server = app.listen(0);
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
  }
}

const post = (base, headers) =>
  fetch(`${base}/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });

test('verifySignature accepts valid and rejects tampered/missing signatures', () => {
  assert.equal(verifySignature(SECRET, body, sign(body)), true);
  assert.equal(verifySignature(SECRET, body, sign(body, 'wrong')), false);
  assert.equal(verifySignature(SECRET, body, undefined), false);
  assert.equal(verifySignature(SECRET, body, 'sha256=short'), false);
});

test('webhook rejects a bad signature with 401 and sends nothing', async () => {
  const sent = [];
  await withServer(async (...a) => sent.push(a), async (base) => {
    const res = await post(base, { 'X-GitHub-Event': 'push', 'X-Hub-Signature-256': 'sha256=bad' });
    assert.equal(res.status, 401);
    assert.equal(sent.length, 0);
  });
});

test('webhook answers ping with 200 and does not call Discord', async () => {
  const sent = [];
  await withServer(async (...a) => sent.push(a), async (base) => {
    const res = await post(base, { 'X-GitHub-Event': 'ping', 'X-Hub-Signature-256': sign(body) });
    assert.equal(res.status, 200);
    assert.equal(sent.length, 0);
  });
});

test('valid push returns 202 and sends an embed to Discord', async () => {
  const sent = [];
  await withServer(async (...a) => sent.push(a), async (base) => {
    const res = await post(base, { 'X-GitHub-Event': 'push', 'X-Hub-Signature-256': sign(body) });
    assert.equal(res.status, 202);
    assert.equal(sent.length, 1);
    assert.equal(sent[0][1].title, 'docs: add setup and smee.io demo instructions');
  });
});
