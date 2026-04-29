# ReplayX Slack Service

The intake layer for ReplayX. Engineers mention the bot in `#bugs` — the service validates the report, starts an orchestration run, and posts a live dashboard link back to the thread in seconds.

---

## What It Does

1. Receives the `@ReplayX <bug description>` mention via Slack webhook
2. Strips the mention prefix, normalizes the report text
3. POSTs to the ReplayX orchestrator at `POST /api/replayx/runs`
4. Replies in-thread with a live dashboard URL (`/live/<runId>` or the incident workspace)

If the orchestrator is not configured or run creation fails, Slack links to `/new` and says the live run was not started. It does not silently fall back to a seeded golden replay.

The Slack service has no orchestration logic of its own. It is a thin intake adapter — the orchestrator owns the run.

---

## Setup

```bash
cp slack/.env.example slack/.env
# Fill in the required values (see below)

npm install --prefix slack
npm start --prefix slack
# → http://localhost:3000
```

Or as part of the full local stack:

```bash
pnpm dev:all:slack
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SLACK_SIGNING_SECRET` | Yes | Verifies webhook signatures from Slack |
| `SLACK_BOT_TOKEN` | Yes | Bot OAuth token for posting replies |
| `SLACK_BUGS_CHANNEL_ID` | Yes | Channel the bot listens in |
| `REPLAYX_ORCHESTRATOR_URL` | Yes | Base URL of the ReplayX orchestrator (e.g. `http://localhost:3001`) |
| `REPLAYX_DASHBOARD_URL` | Yes | Base URL for constructing live dashboard links returned to Slack |
| `REPLAYX_INTERNAL_API_TOKEN` | No | Shared secret passed as `Authorization: Bearer` to the orchestrator when set |
| `PORT` | No | Webhook listener port (default: `3000`) |

Copy `.env.example` to `.env` and fill in the required values before starting.

---

## Slack App Setup

1. Create a Slack app at [api.slack.com/apps](https://api.slack.com/apps)
2. Enable **Event Subscriptions** → subscribe to `app_mention`
3. Set the request URL to `https://<your-tunnel>/slack/events`
4. Add OAuth scopes: `chat:write`, `app_mentions:read`
5. Install to workspace and copy the bot token

For local development, expose port 3000 with a tunnel (e.g. `ngrok http 3000`).

---

## Source Layout

```
slack/
├── src/
│   ├── index.js                     ← Entry point — starts Express server on PORT
│   ├── app/
│   │   └── create-app.js            ← App factory, route wiring
│   └── modules/
│       ├── replayx/
│       │   └── client.js            ← HTTP client for the orchestrator API
│       └── slack/
│           ├── controller.js        ← Mention handler and reply construction
│           ├── service.js           ← Handoff URL builders, reply formatting
│           ├── signature.js         ← Slack signature verification middleware
│           └── module.js            ← Route registration
├── test/
├── .env.example
└── package.json
```
