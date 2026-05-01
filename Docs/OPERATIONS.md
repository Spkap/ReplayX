# Operations

Local setup, run creation, Slack intake, dashboard routes, environment variables, and verification.

---

## Install

```bash
pnpm install
pnpm --dir dashboard install
npm --prefix slack install
```

---

## Start the Stack

```bash
# Target app + dashboard
pnpm dev:all

# Target app + dashboard + Slack service
pnpm dev:all:slack
```

| Service | URL |
|---|---|
| Target app | `http://127.0.0.1:4311` |
| Dashboard | `http://localhost:3001` |
| Slack service | `http://localhost:3000` |

---

## Create a Realtime Run

```bash
curl -s -X POST http://localhost:3001/api/replayx/runs \
  -H 'content-type: application/json' \
  --data '{"source":"manual","text":"checkout is overselling stock during concurrent orders"}'
```

If `REPLAYX_INTERNAL_API_TOKEN` is set, add the auth header:

```bash
curl -s -X POST http://localhost:3001/api/replayx/runs \
  -H "authorization: Bearer ${REPLAYX_INTERNAL_API_TOKEN}" \
  -H 'content-type: application/json' \
  --data '{"source":"manual","text":"checkout is overselling stock during concurrent orders"}'
```

Open the returned `incidentWorkspacePath` or `livePath`.

---

## Run the Fixture/Eval Pipeline

```bash
pnpm golden-run incidents/checkout-race-condition.json
pnpm golden-run incidents/auth-token-session-failure.json
pnpm golden-run incidents/null-data-shape-failure.json
```

Then open a replay page:

```
http://localhost:3001/replay/incident-checkout-race-001
```

---

## Dashboard Routes

| Path | Purpose |
|---|---|
| `/` | Product entrance |
| `/new` | Manual realtime run creation |
| `/live/<runId>` | Live run — phase updates stream over WebSocket |
| `/workspaces/<workspaceId>/incidents/<runId>` | Signed incident workspace |
| `/replay/<incidentId>` | Fixture/eval replay from precomputed artifacts |
| `/ops` | Operator fleet view |
| `/analytics` | Historical run analytics |
| `/help/troubleshooting` | Signed-link troubleshooting and local stack remediation |

---

## Slack Setup

```bash
cp slack/.env.example slack/.env
```

Required values:

| Variable | Value |
|---|---|
| `SLACK_SIGNING_SECRET` | From your Slack app |
| `SLACK_BOT_TOKEN` | From your Slack app |
| `SLACK_BUGS_CHANNEL_ID` | Channel where `@ReplayX` is mentioned |
| `REPLAYX_ORCHESTRATOR_URL` | `http://localhost:3001` (local) |
| `REPLAYX_DASHBOARD_URL` | `http://localhost:3001` (local) |

Optional:

| Variable | Value |
|---|---|
| `REPLAYX_INTERNAL_API_TOKEN` | Shared auth token (if the dashboard requires it) |

**Slack flow:**
1. Operator mentions `@ReplayX <bug description>` in the bugs channel.
2. Slack service validates the request signature.
3. Posts to `POST /api/replayx/runs`.
4. Replies with a live workspace link.
5. If run creation fails, links to `/new` — never silently falls back to a seeded replay.

---

## Environment Variables

### Orchestrator

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `REPLAYX_CODEX_MODEL` | No | SDK default | Model for Codex SDK workers |
| `REPLAYX_USE_CODEX_REPRO_WORKER` | No | `1` | Set `0` for deterministic repro fallback only |
| `REPLAYX_USE_CODEX_DIAGNOSIS_WORKERS` | No | `1` | Set `0` for deterministic diagnosis fallback only |
| `REPLAYX_MAX_PARALLEL_WORKERS` | No | `4` | Diagnosis worker concurrency cap |
| `REPLAYX_CODEX_REPRO_TIMEOUT_MS` | No | SDK default | Repro worker timeout |
| `REPLAYX_CODEX_DIAGNOSIS_TIMEOUT_MS` | No | SDK default | Per-diagnosis-worker timeout |

### Dashboard and Slack

| Variable | Required | Purpose |
|---|---|---|
| `REPLAYX_INTERNAL_API_TOKEN` | Production | Signs operator links and enforces auth on `/ops`, `/analytics`, and workspaces |
| `REPLAYX_REALTIME_VALIDATION_COMMAND` | No | Baseline command for fresh realtime incident validation |
| `REPLAYX_ALLOW_SEEDED_KEYWORD_MATCH` | No | Set `1` to allow keyword routing to seeded fixtures; default is realtime |
| `REPLAYX_GITHUB_PR_MODE` | No | Set `live` to allow PR creation; default is `preview` (bundle only) |
| `REPLAYX_SLACK_API_URL` | No | Lets the dashboard post final run status back to Slack |

---

## Verification

```bash
pnpm build
pnpm test
pnpm --dir dashboard build
npm --prefix slack test
```

For docs-only changes:

```bash
git diff --check
find README.md Docs PIPELINE.md -name '*.md' -print
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `401` creating runs | Include `Authorization: Bearer <token>` when `REPLAYX_INTERNAL_API_TOKEN` is set |
| Slack replies with `/new` link | Check `REPLAYX_ORCHESTRATOR_URL`, `REPLAYX_DASHBOARD_URL`, and dashboard availability |
| Realtime run stops before PR | Expected. Fresh incidents stop at the evidence packet until the bounded patch worker ships |
| Replay page missing | Run `pnpm golden-run incidents/<id>.json` first |
| Dashboard cannot read artifacts | Confirm the dashboard starts from this repo root and `outputFileTracingRoot` points to the repo root |
