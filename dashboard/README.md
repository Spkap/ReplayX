# ReplayX Dashboard

Judge-facing Next.js replay UI for ReplayX.

This app is intentionally replay-first:

- it reads saved artifacts from the repo-level `artifacts/` directory at runtime
- it reads seeded incident metadata from the repo-level `incidents/` directory at runtime
- it supports both saved replay pages and live incident runs
- live runs stream updates over WebSockets, with SSE fallback retained for resilience
- it defaults to the golden incident replay flow for judge-safe demos

Primary route:

- `/` shows the golden incident overview
- `/incidents/[incidentId]` shows a full replay page
- `/replay/[incidentId]` aliases the same full replay page for Slack/demo handoff
- `/live/[runId]` shows a live Slack-triggered run as the orchestrator advances phase by phase over a socket connection

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
