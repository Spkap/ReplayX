# ReplayX Demo Runbook

Follow this runbook to show the strongest live ReplayX demo flow:

1. User reports a bug in Slack
2. Slack starts a live ReplayX run
3. The dashboard updates live as the orchestrator advances through all phases
4. The run ends with a postmortem and a reusable incident skill

The best incident for this flow is the checkout race condition — it is concrete, high-signal, and easy to narrate in under two minutes.

---

## Demo Modes

| Mode | Description | When to use |
|---|---|---|
| **Featured proof** | Public homepage → validated replay or latest validated run | Start here. It explains the product in under 60 seconds without requiring operator access. |
| **Live run** | Slack trigger or manual API trigger → live orchestration → dashboard updates in real time | Primary operator demo after the proof entrance. |
| **Replay** | Precomputed artifacts at `/replay/incident-checkout-race-001` | Fallback only. Use if live orchestration is unavailable. |

---

## Prerequisites

### 1. Environment configuration

Copy environment files and fill in credentials:

```bash
# Orchestrator (optional — defaults apply)
cp .env.example .env

# Slack service (required for live trigger)
cp slack/.env.example slack/.env
```

Required in `slack/.env`:

```
SLACK_SIGNING_SECRET=<your value>
SLACK_BOT_TOKEN=<your value>
SLACK_BUGS_CHANNEL_ID=<your value>
REPLAYX_DASHBOARD_URL=http://localhost:3001
REPLAYX_ORCHESTRATOR_URL=http://localhost:3001
REPLAYX_INTERNAL_API_TOKEN=<shared token>
```

Optional orchestrator variables (defaults apply if unset):

```
REPLAYX_CODEX_MODEL=gpt-5-codex           # Model used for Codex workers
REPLAYX_USE_CODEX_REPRO_WORKER=1          # Set to 0 to skip Codex repro worker
REPLAYX_USE_CODEX_DIAGNOSIS_WORKERS=1     # Set to 0 to use deterministic heuristics only
REPLAYX_MAX_PARALLEL_WORKERS=4            # Diagnosis worker concurrency limit
```

If you want the dashboard API to require auth for run creation, export the same token before launching the dashboard:

```bash
export REPLAYX_INTERNAL_API_TOKEN=<same token>
```


### 2. Install dependencies

From the repo root:

```bash
pnpm install
pnpm --dir dashboard install
npm --prefix slack install
```

---

## Live Demo Setup

Fastest path from the repo root:

```bash
pnpm dev:all
```

That starts the demo app and dashboard without requiring Slack. Add Slack when you need the full intake story:

```bash
pnpm dev:all:slack
```

If you want separate terminals, open **three** tabs from the repo root.

### Terminal 1 — Target Demo App

```bash
pnpm demo-app
```

Expected: `http://127.0.0.1:4311/`

### Terminal 2 — ReplayX Dashboard

```bash
pnpm --dir dashboard dev -- --port 3001
```

Expected: `http://localhost:3001/`

### Terminal 3 — Slack Intake Service

```bash
npm start --prefix slack
```

Expected: `http://localhost:3000/`

---

## Replay Fallback Setup (Optional)

Only needed if you want the precomputed fallback at `/replay/incident-checkout-race-001`.

```bash
pnpm golden-run incidents/checkout-race-condition.json
```

Wait for this to complete before relying on the replay route.

---

## Live Demo Flow

Use this sequence during the screen share:

### Step 1 — Show the Bug

Open the demo app at `http://127.0.0.1:4311`. Show the failing state for the checkout race condition. Keep this brief — the point is to make the incident feel real, not to stay in the broken app.

### Step 2 — Proof Entrance

Open `http://localhost:3001/`. Use the featured proof to establish the product story before opening any privileged operator surface.

### Step 3 — Slack Handoff (The Trigger)

Go to your Slack workspace's bugs channel. Mention the ReplayX bot with a short bug report:

```
@ReplayX checkout is overselling stock during concurrent orders
```

The bot acknowledges and returns a live dashboard handoff URL in the form `/live/<runId>`.

### Step 4 — Live Orchestrator Run

Click the link from Step 2. The live page opens immediately and starts updating as the orchestrator advances.

Call out as they happen:

- Current phase changing in real time
- Diagnosis worker fleet appearing during Phase 4
- Winning diagnosis and selected fix path
- Verification proof (part of the product, not a manual follow-up)
- Reusable Skill card appearing at the end of the run

---

## Replay Fallback Flow

If you need the simpler fallback:

1. Open `http://localhost:3001/replay/incident-checkout-race-001`
2. Explain that this is the precomputed judge-safe replay path
3. Walk through diagnosis, fix, proof, postmortem, and skill as a polished artifact story

---

## Manual Run Creation (No Slack)

If Slack is unavailable during the demo, start a live run directly:

```bash
curl -s -X POST http://localhost:3001/api/replayx/runs \
  -H 'content-type: application/json' \
  --data '{"source":"manual","text":"checkout is overselling stock during concurrent orders"}'
```

Then open the returned `livePath`. This demonstrates the same product value: live orchestration, live dashboard updates, and final incident memory.

If operator access or run links behave unexpectedly during local setup, open:

- `http://localhost:3001/help/troubleshooting`

---

## What To Say

Use language like:

- "Slack is the intake layer."
- "ReplayX starts a live incident run immediately."
- "The dashboard updates live as the orchestrator advances through intake, repro, diagnosis, challenger, fix, review, and postmortem."
- "At the end of the run, ReplayX emits a reusable incident skill."

Avoid:

- "It polls a file."
- "This is just a replay."
- "It's basically a chatbot for logs."

---

## Preflight Checklist

Run this before any recruiter or judge call:

**Build verification:**
```bash
pnpm --dir dashboard build
npm test --prefix slack
```

**Local stack check:**
```bash
pnpm demo-app                              # → http://127.0.0.1:4311
pnpm --dir dashboard dev -- --port 3001   # → http://localhost:3001
npm start --prefix slack                   # → http://localhost:3000
```

**Manual live-run creation check:**
```bash
curl -s -X POST http://localhost:3001/api/replayx/runs \
  -H "Content-Type: application/json" \
  -d '{"source":"manual","text":"checkout oversell bug from verification"}'
```

Expected: `ok: true`, `runId` exists, `livePath` exists, run progresses to `completed`, final skill path present after completion.

**Behavior checks:**
- [ ] Demo app starts and seeded bug reproduces
- [ ] Dashboard starts at `http://localhost:3001`
- [ ] Slack starts without auth or boot errors
- [ ] Slack mention creates a run and returns a `/live/<runId>` handoff
- [ ] Live dashboard page updates through multiple phases without reload
- [ ] Reusable skill appears only at the end of the run

**Optional replay fallback check:**
```bash
pnpm golden-run incidents/checkout-race-condition.json
```

Then verify: `http://localhost:3001/replay/incident-checkout-race-001` loads cleanly.
