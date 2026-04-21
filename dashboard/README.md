# ReplayX Dashboard

Judge-facing Next.js replay UI for ReplayX.

This app is intentionally proof-first:

- it reads saved artifacts from the repo-level `artifacts/` directory at runtime
- it reads seeded incident metadata from the repo-level `incidents/` directory at runtime
- it supports both saved replay pages and live incident runs
- live runs stream updates over WebSockets, with SSE fallback retained for resilience
- it keeps `/` public and proof-first, with signed links unlocking operator-only surfaces

Primary route:

- `/` shows the featured proof entrance
- `/incidents/[incidentId]` shows a full replay page
- `/replay/[incidentId]` aliases the same full replay page for Slack/demo handoff
- `/live/[runId]` shows a live Slack-triggered run as the orchestrator advances phase by phase over a socket connection
- `/ops` and `/analytics` are signed operator surfaces when internal auth is enabled

## Demo usage

```bash
cd dashboard
pnpm install
pnpm dev -- --port 3001
```

Open the main dashboard:

- `/`

Open the golden replay after generating artifacts:

- `/replay/incident-checkout-race-001`

Live runs are created by posting to `/api/replayx/runs` and then opened at:

- `/live/<runId>`

Troubleshooting for signed links, archived runs, missing runs, and local stack setup lives at:

- `/help/troubleshooting`
