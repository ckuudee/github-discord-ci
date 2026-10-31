require('dotenv').config();
const express = require('express');
const { verifySignature } = require('./verifySignature');
const { parsePush } = require('./parsePush');
const { buildEmbed, sendEmbed } = require('./discord');

const { PORT = 3000, DISCORD_WEBHOOK_URL, GITHUB_WEBHOOK_SECRET } = process.env;

function createApp({ webhookUrl, secret, send = sendEmbed }) {
  const app = express();

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // express.raw keeps the exact bytes GitHub signed; re-serialized JSON would not
  // produce the same HMAC.
  app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
    if (!verifySignature(secret, req.body, req.get('X-Hub-Signature-256'))) {
      return res.status(401).send('invalid signature');
    }

    const event = req.get('X-GitHub-Event');
    if (event === 'ping') return res.status(200).send('pong');
    if (event !== 'push') return res.status(204).end();

    let payload;
    try {
      payload = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.status(400).send('invalid JSON');
    }

    const push = parsePush(payload);
    if (!push) return res.status(204).end();

    // Ack immediately; GitHub gives up on webhooks after ~10s.
    res.status(202).send('accepted');

    send(webhookUrl, buildEmbed(push)).catch((err) =>
      console.error('Failed to send to Discord:', err.message),
    );
  });

  return app;
}

if (require.main === module) {
  if (!DISCORD_WEBHOOK_URL || !GITHUB_WEBHOOK_SECRET) {
    console.error('Set DISCORD_WEBHOOK_URL and GITHUB_WEBHOOK_SECRET in .env');
    process.exit(1);
  }
  createApp({ webhookUrl: DISCORD_WEBHOOK_URL, secret: GITHUB_WEBHOOK_SECRET }).listen(
    PORT,
    () => console.log(`Listening on http://localhost:${PORT}`),
  );
}

module.exports = { createApp };
