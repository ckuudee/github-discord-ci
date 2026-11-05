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

async function withServer(send, fn, options = {}) {
  const app = createApp({
    webhookUrl: 'http://discord.test',
    secret: SECRET,
    send,
    ...options,
  });
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

const pushHeaders = (deliveryId) => ({
  'X-GitHub-Event': 'push',
  'X-Hub-Signature-256': sign(body),
  ...(deliveryId && { 'X-GitHub-Delivery': deliveryId }),
});

test('redelivered push (same delivery ID) returns 200 and is not sent twice', async () => {
  const sent = [];
  await withServer(async (...a) => sent.push(a), async (base) => {
    const first = await post(base, pushHeaders('abc-123'));
    const second = await post(base, pushHeaders('abc-123'));
    assert.equal(first.status, 202);
    assert.equal(second.status, 200);
    assert.equal(sent.length, 1);
  });
});

test('different delivery IDs are both processed', async () => {
  const sent = [];
  await withServer(async (...a) => sent.push(a), async (base) => {
    await post(base, pushHeaders('id-1'));
    await post(base, pushHeaders('id-2'));
    assert.equal(sent.length, 2);
  });
});

test('a failed Discord send does not block a redelivery', async () => {
  let calls = 0;
  const send = async () => {
    calls += 1;
    if (calls === 1) throw new Error('discord down');
  };
  await withServer(send, async (base) => {
    await post(base, pushHeaders('retry-me'));
    await new Promise((resolve) => setTimeout(resolve, 20)); // let the catch run
    const res = await post(base, pushHeaders('retry-me'));
    assert.equal(res.status, 202);
    assert.equal(calls, 2);
  });
});

test('requests without a delivery ID are not deduplicated', async () => {
  const sent = [];
  await withServer(async (...a) => sent.push(a), async (base) => {
    await post(base, pushHeaders());
    await post(base, pushHeaders());
    assert.equal(sent.length, 2);
  });
});

test('delivery IDs expire after the TTL', async () => {
  const sent = [];
  await withServer(
    async (...a) => sent.push(a),
    async (base) => {
      await post(base, pushHeaders('short-lived'));
      await new Promise((resolve) => setTimeout(resolve, 30));
      const res = await post(base, pushHeaders('short-lived'));
      assert.equal(res.status, 202);
      assert.equal(sent.length, 2);
    },
    { deliveryTtlMs: 10 },
  );
});

test('an unsigned request with a known delivery ID cannot poison the cache', async () => {
  const sent = [];
  await withServer(async (...a) => sent.push(a), async (base) => {
    const bad = await post(base, {
      'X-GitHub-Event': 'push',
      'X-Hub-Signature-256': 'sha256=bad',
      'X-GitHub-Delivery': 'poison',
    });
    assert.equal(bad.status, 401);
    const real = await post(base, pushHeaders('poison'));
    assert.equal(real.status, 202);
    assert.equal(sent.length, 1);
  });
});
