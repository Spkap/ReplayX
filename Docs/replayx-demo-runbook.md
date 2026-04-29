# ReplayX Demo Runbook

Operational guide for running a live ReplayX demo — from cold start to a complete 8-phase incident run on screen.

The strongest demo flow:

1. Show the bug in the demo app
2. Mention ReplayX in Slack
3. Watch the dashboard capture validation, repo search, and recent-change evidence
4. Show the proof gate: ReplayX stops before claiming a fix without validated code changes

Best incident for this flow: **checkout race condition** — concrete, high-signal, and narrates cleanly in under two minutes.

---

## Demo Modes

| Mode | Path | When to use |
|---|---|---|
| **Live run** | Slack trigger or `POST /api/replayx/runs` → `/workspaces/:workspaceId/incidents/:runId` or `/live/:runId` | Primary demo — shows real orchestration, real phase updates |
| **Manual live run** | `/new` | Primary no-Slack path — creates a realtime incident from fresh text |
| **Featured run** | `/` → latest live run or new run form | Product entrance — starts or resumes real work |
| **Fixture replay** | `/replay/incident-checkout-race-001` | Explicit eval fallback — use only when demonstrating fixture coverage |

Always make the mode explicit. Fresh incident text is realtime. Seeded fixtures are evals, not the default product path.

---

## Prerequisites

### 1. Environment setup

```bash
# Orchestrator (optional — all defaults apply when unset)
cp .env.example .env

# Slack service (required for the live trigger flow)
cp slack/.env.example slack/.env
```

**Required in `slack/.env`:**

```
SLACK_SIGNING_SECRET=<your value>
SLACK_BOT_TOKEN=<your value>
SLACK_BUGS_CHANNEL_ID=<your value>
REPLAYX_DASHBOARD_URL=http://localhost:3001
REPLAYX_ORCHESTRATOR_URL=http://localhost:3001
REPLAYX_INTERNAL_API_TOKEN=<shared secret>
```

**Optional orchestrator variables (all have safe defaults):**

```
REPLAYX_CODEX_MODEL=gpt-5-codex
REPLAYX_USE_CODEX_REPRO_WORKER=1
REPLAYX_USE_CODEX_DIAGNOSIS_WORKERS=1
REPLAYX_MAX_PARALLEL_WORKERS=4
```

If you want signed operator links, export the same token before launching the dashboard:

```bash
export REPLAYX_INTERNAL_API_TOKEN=<same shared secret>
export REPLAYX_SLACK_API_URL=http://localhost:3000
```

### 2. Install dependencies

```bash
pnpm install
pnpm --dir dashboard install
npm --prefix slack install
```

---

## Start the Stack

**Fastest path — demo app + dashboard, no Slack:**

```bash
pnpm dev:all
```

**Full live intake flow — demo app + dashboard + Slack:**

```bash
pnpm dev:all:slack
```

**Or open three terminals manually:**

```bash
# Terminal 1 — demo app
pnpm demo-app
# → http://127.0.0.1:4311

# Terminal 2 — dashboard
pnpm --dir dashboard dev -- --port 3001
# → http://localhost:3001

# Terminal 3 — Slack service
npm start --prefix slack
# → http://localhost:3000
```

---

## Precompute the Fixture Fallback (Optional)

Only needed if you want the `/replay/incident-checkout-race-001` fallback ready before the demo:

```bash
pnpm golden-run incidents/checkout-race-condition.json
```

Wait for all 8 phases to complete before relying on the replay route.

---

## Live Demo Flow

### Step 1 — Show the bug

Open `http://127.0.0.1:4311`. Show the failing state for the checkout race condition — concurrent orders triggering an oversell. Keep this brief. The point is to make the incident feel real, not to explain the broken app.

### Step 2 — Open the live run entrance

Open `http://localhost:3001/new`. Paste the incident text and start a live run. If you start from the homepage, use **Start Live Incident**.

### Step 3 — Trigger from Slack

In your Slack workspace's bugs channel, mention the bot:

```
@ReplayX checkout is overselling stock during concurrent orders
```

The bot acknowledges and returns a live dashboard URL, usually in the form `/workspaces/<workspaceId>/incidents/<runId>`.

### Step 4 — Watch the live run

Click the link. The live page opens immediately and updates as the orchestrator advances through each phase.

Call out as they happen:

- **Phase 4:** "Six diagnosis workers fan out in parallel — each owns one failure domain."
- **Phase 5:** "The challenger phase adversarially rejects any theory that can't hold up."
- **Phase 6:** "Three fix strategies are generated and ranked. The safe fix wins."
- **Phase 7:** "The verification plan tells you exactly how to prove the patch works."
- **Phase 8:** "A reusable skill gets written back to the catalog. The next engineer sees a known pattern, not a blank slate."

---

## Manual Trigger (No Slack)

If Slack is unavailable, start a live run directly:

```bash
curl -s -X POST http://localhost:3001/api/replayx/runs \
  -H "authorization: Bearer ${REPLAYX_INTERNAL_API_TOKEN}" \
  -H 'content-type: application/json' \
  --data '{"source":"manual","text":"checkout is overselling stock during concurrent orders"}'
```

The response includes `livePath` — open that in the browser. The demo value is identical: live orchestration, live dashboard updates, final incident skill.

---

## Replay Fallback

If live orchestration is unavailable:

1. Open `http://localhost:3001/replay/incident-checkout-race-001`
2. Walk through diagnosis, fix, proof plan, postmortem, and skill as a polished artifact story
3. Emphasize: every artifact is on disk, inspectable, and replayable — nothing is hidden in an agent trace

---

## What to Say

**Use language like:**

- "Slack is the intake layer — one mention starts a full incident run."
- "The dashboard updates live as the orchestrator advances through all eight phases."
- "Six diagnosis workers run in parallel, each specializing in a different failure domain."
- "The challenger phase adversarially rejects weak theories before anything reaches the fix stage."
- "At the end of the run, ReplayX writes a reusable skill back to its catalog."

**Avoid:**

- "It polls a file." — it streams over WebSockets.
- "This is just a replay." — replay is the proof surface; live is the product.
- "It's basically a chatbot for logs." — it reads code, runs commands, and proposes patches.

---

## Preflight Checklist

Run this before any external walkthrough:

**Build verification:**

```bash
pnpm --dir dashboard build
npm test --prefix slack
```

**Stack check:**

```bash
# All three services start cleanly
pnpm demo-app                              # → http://127.0.0.1:4311
pnpm --dir dashboard dev -- --port 3001   # → http://localhost:3001
npm start --prefix slack                   # → http://localhost:3000
```

**Manual live run check:**

```bash
curl -s -X POST http://localhost:3001/api/replayx/runs \
  -H "authorization: Bearer ${REPLAYX_INTERNAL_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"source":"manual","text":"checkout oversell bug from preflight"}'
```

Expected response: `ok: true`, `runId` present, `incidentWorkspacePath` present, `livePath` present.

Then verify:
- Run progresses to `resolved_to_pr`
- Final skill path present after completion (`skills/incident-checkout-race-001.yaml` or similar)

**Behavior checklist:**

- [ ] Demo app starts and seeded bug reproduces at `http://127.0.0.1:4311`
- [ ] Dashboard loads at `http://localhost:3001`
- [ ] Slack service starts without auth or boot errors
- [ ] Slack mention creates a run and returns an incident workspace handoff URL
- [ ] Live dashboard page updates through multiple phases without reload
- [ ] Reusable skill card appears only at the end of the run (Phase 8)
- [ ] Replay path loads cleanly at `/replay/incident-checkout-race-001` (if precomputed)

**Troubleshooting:**

If anything behaves unexpectedly during local setup, open:

```
http://localhost:3001/help/troubleshooting
```
