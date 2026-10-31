# github-discord-ci

Tiny Express service: GitHub `push` webhook -> color-coded Discord embed (commit message, author, branch).

```
git push -> GitHub -> smee.io -> smee-client -> localhost:3000/webhook -> verify HMAC -> parse -> Discord webhook
```

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `DISCORD_WEBHOOK_URL`: Discord channel -> Settings -> Integrations -> Webhooks -> New Webhook -> Copy URL
   - `GITHUB_WEBHOOK_SECRET`: `node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"`
3. `npm run dev` and check `http://localhost:3000/health`.

## Forward webhooks to localhost with smee.io
(No ngrok: its binary was quarantined by Windows Defender on the dev machine.)
1. Go to https://smee.io, click "Start a new channel", and copy the channel URL.
2. In the GitHub repo: Settings -> Webhooks -> Add webhook
   - Payload URL: the smee channel URL
   - Content type: `application/json`
   - Secret: same as `GITHUB_WEBHOOK_SECRET`
   - Events: "Just the push event"
3. In a second terminal (with `npm run dev` already running):
   `npx smee-client --url <smee-channel-url> --target http://localhost:3000/webhook`
4. GitHub sends a `ping`; confirm a green check under Recent Deliveries.

smee channels are public: anyone with the URL can see the payloads. Use a throwaway repo.

## Demo
```
git commit --allow-empty -m "test: ci monitor" && git push
```
Embed colors: green = default branch, blurple = other branch, yellow = force push, red = branch deleted.

Inspect or replay real payloads via the smee channel page or GitHub's Recent Deliveries -> Redeliver.
`test/fixtures/push.json` is synthetic; replace it with a captured real payload.

## Test
`npm test`

## Layout
- `src/server.js`: `POST /webhook`, `GET /health`
- `src/verifySignature.js`: `X-Hub-Signature-256` check
- `src/parsePush.js`: payload -> fields
- `src/discord.js`: embed builder + sender
