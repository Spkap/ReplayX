# Slack Live Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Slack the entry point for a ReplayX run, then have the dashboard API run the orchestrator and expose live status updates.

**Architecture:** Slack remains deployed on Render and calls a dashboard/orchestrator API using a shared bearer token. The dashboard server stores run status in repo-local `.replayx-runs/`, starts the existing orchestrator phases in-process, and the UI polls a live route until the run completes. This avoids a database and keeps the hackathon flow clear.

**Tech Stack:** Express 5 Slack service, Next.js App Router route handlers, Node file storage, existing TypeScript ReplayX orchestrator phases.

---

### Task 1: Dashboard Live Run Store And Runner

**Files:**
- Create: `dashboard/lib/live-runs.ts`
- Test: `tests/live-runs.test.ts`

- [ ] Write failing tests for creating a run, reading status, and seeing phases progress to a final skill.
- [ ] Implement a file-backed run store under `.replayx-runs/`.
- [ ] Implement `startReplayXRun` that records queued/running/completed phase state and calls existing phase functions.
- [ ] Verify with `pnpm test`.

### Task 2: Dashboard API Routes

**Files:**
- Create: `dashboard/app/api/replayx/runs/route.ts`
- Create: `dashboard/app/api/replayx/runs/[runId]/route.ts`

- [ ] Write tests through the live-run library boundary.
- [ ] Add authenticated `POST /api/replayx/runs`.
- [ ] Add unauthenticated `GET /api/replayx/runs/[runId]`.
- [ ] Verify with `pnpm typecheck`.

### Task 3: Live Dashboard Page

**Files:**
- Create: `dashboard/app/live/[runId]/page.tsx`
- Create: `dashboard/app/live/[runId]/live-run-client.tsx`
- Modify: `dashboard/app/globals.css`

- [ ] Render Slack issue, current phase, phase timeline, worker cards, fix, proof, and skill.
- [ ] Poll the run API every two seconds while not complete.
- [ ] Verify dashboard build.

### Task 4: Slack Orchestrator Handoff

**Files:**
- Create: `slack/src/modules/replayx/client.js`
- Modify: `slack/src/modules/slack/service.js`
- Modify: `slack/src/modules/slack/module.js`
- Modify: `slack/src/app/create-app.js`
- Modify: `slack/.env.example`
- Test: `slack/test/app.test.js`

- [ ] Write failing Slack test proving an app mention creates a ReplayX run and replies with `/live/:runId`.
- [ ] Implement a ReplayX API client using `fetch`.
- [ ] Fall back to old golden replay link if orchestrator API is not configured or fails.
- [ ] Verify with `npm test --prefix slack`.

### Task 5: Final Verification

- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm dashboard:build`.
- [ ] Run `npm test --prefix slack`.
- [ ] Report exact env values needed and local/ngrok test steps.
