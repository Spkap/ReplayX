# Slack Integration

This folder contains the ReplayX Slack service as a self-contained package.

## Render deployment

Deploy this folder as a standalone Render web service if you want Slack in the live demo path.

After the service is created in Render, set the Slack app Event Subscriptions request URL to:

- `https://<your-render-service>.onrender.com/slack/events`

Required environment variables in Render:

- `SLACK_SIGNING_SECRET`
- `SLACK_BOT_TOKEN`
- `SLACK_BUGS_CHANNEL_ID`

Optional environment variables for the hackathon demo flow:

- `REPLAYX_DASHBOARD_URL`: base URL for the ReplayX dashboard handoff, for example `https://replayx.app`
- `REPLAYX_GOLDEN_INCIDENT_ID`: incident slug used for Slack intake handoff, defaults to `incident-checkout-race-001`
- `REPLAYX_ORCHESTRATOR_URL`: base URL for the dashboard/orchestrator service that exposes `POST /api/replayx/runs`
- `REPLAYX_INTERNAL_API_TOKEN`: bearer token required for `POST /api/slack/post-message`; if unset, the internal posting endpoint is disabled

## Structure

- `src/index.js`: service entrypoint
- `src/app/create-app.js`: Express app assembly
- `src/modules/health/`: health endpoint controller and routes
- `src/modules/slack/client.js`: Slack Web API client
- `src/modules/slack/controller.js`: webhook and API handlers
- `src/modules/slack/http-errors.js`: Slack-aware HTTP error mapping
- `src/modules/slack/module.js`: Slack module composition entrypoint
- `src/modules/slack/service.js`: mention handling and message posting behavior
- `src/modules/slack/signature.js`: request signing helpers
- `src/modules/slack/middleware/signature.js`: Express middleware for Slack signature validation
- `src/modules/slack/routes/events.js`: `POST /slack/events`
- `src/modules/slack/routes/api.js`: `POST /api/slack/post-message`
- `test/app.test.js`: service tests

## Demo role

For the hackathon demo, Slack is the intake trigger into ReplayX:

1. A user reports a bug by mentioning ReplayX in the bugs channel.
2. ReplayX creates a live run by calling `POST /api/replayx/runs` when an orchestrator URL is configured.
3. Slack replies with the live dashboard handoff target, typically `/live/<runId>`.
4. The dashboard streams phase-by-phase progress while the orchestrator advances through intake, repro, diagnosis, challenger, fix, review, and postmortem/skill writing.
5. The run ends with a postmortem and a reusable skill visible on the dashboard.

If no orchestrator URL is configured, Slack falls back to the golden replay handoff path.
