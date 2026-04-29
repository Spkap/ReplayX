# ReplayX

> **Incident response, replayed.**

Drop a bug report into Slack. Walk away with a confirmed repro, a ranked diagnosis, a validated fix strategy, and a reusable skill — all in one deterministic, fully auditable run.

No war rooms. No guesswork. No opaque agent traces.

---

## The Problem

Production incidents are a coordination disaster. Engineers context-switch between Slack threads, runbooks, dashboards, and gut instinct. By the time a fix lands, the postmortem is shallow and the same pattern breaks again three sprints later.

**ReplayX changes the loop.** Every incident runs through a fixed sequence of specialists. Every hypothesis is challenged before it advances. Every resolved incident leaves a skill artifact behind — so the next engineer sees a known pattern, not a blank slate.

---

## What You Get

After one complete run:

- **Confirmed repro** — real commands, real exit codes, real failure surface — before any theory is entertained
- **Six parallel diagnosis workers** — each pinned to one failure domain, each producing a structured analysis with confidence score and a falsification note
- **Adversarial validation** — weak or underdetermined theories are rejected before they reach the fix stage
- **Three ranked fix strategies** — scored by blast radius, rollback confidence, and verification quality
- **Regression-proof verification plan** — not "fix the bug" — prove it's fixed and prove nothing else broke
- **A reusable incident skill** — written back to the skills catalog so future runs recognize the pattern instantly

Everything is on disk, in plain JSON, fully inspectable. Nothing is hidden in an agent trace.

---

## How It Works

ReplayX runs a **deterministic 8-phase workflow**. Every phase boundary is a strict JSON contract. No phase accepts vague output from the one before it.

```
Bug report in Slack (or POST /api/replayx/runs)
    │
    ├─① Incident Intake        validate and normalize the raw report
    ├─② Skill Match            score against the growing skills catalog
    ├─③ Repro                  execute failing + healthy commands; confirm the bug is real
    ├─④ Diagnosis Arena        six Codex workers fan out in parallel
    ├─⑤ Challenger Validation  adversarially reject weak hypotheses
    ├─⑥ Fix Arena              generate minimal · safe · durable strategies; rank by score
    ├─⑦ Review & Regression    write the verification proof plan
    └─⑧ Postmortem & Skill     compile the postmortem; write a reusable skill back to catalog
```

The live dashboard streams each phase as it completes. The replay surface makes every artifact shareable and inspectable after the run.

→ Full phase spec, flow diagram, and artifact map: **[PIPELINE.md](PIPELINE.md)**

---

## Quickstart

**Requirements:** Node.js ≥ 24.0 · pnpm ≥ 10 · Codex/OpenAI auth for live Codex workers

```bash
# Install
pnpm install
pnpm --dir dashboard install

# Start the stack (demo app + dashboard)
pnpm dev:all
```

**Trigger a run from Slack:**
```
@ReplayX checkout is overselling stock during concurrent orders
```

**Or trigger directly:**
```bash
curl -s -X POST http://localhost:3001/api/replayx/runs \
  -H 'content-type: application/json' \
  --data '{"source":"manual","text":"checkout is overselling stock during concurrent orders"}'
```

If `REPLAYX_INTERNAL_API_TOKEN` is set, add `-H "authorization: Bearer ${REPLAYX_INTERNAL_API_TOKEN}"`.

Open the `incidentWorkspacePath` or `livePath` from the response. Plain incident text creates a realtime investigation run: ReplayX captures validation, repo search, recent changes, and an evidence packet before it claims any fix.

**Run an explicit fixture/eval replay:**
```bash
pnpm golden-run incidents/checkout-race-condition.json
# → http://localhost:3001/replay/incident-checkout-race-001
```

To exercise the full deterministic fixture path through the live API, supply a fixture id explicitly:

```bash
curl -s -X POST http://localhost:3001/api/replayx/runs \
  -H 'content-type: application/json' \
  --data '{"source":"manual","incidentId":"incident-checkout-race-001","text":"checkout is overselling stock during concurrent orders"}'
```

---

## Included Incidents

Three fully validated incident classes ship in the launch registry:

| Incident | What it tests |
|---|---|
| **Checkout Race Condition** — oversell during concurrent orders | Non-atomic read-write, stale reservation token |
| **Auth Token Session Failure** — session expires mid-flow | Broken token refresh path, stale session state |
| **Null Data Shape Failure** — optional field arrives `null` | Missing null guard, downstream schema violation |

→ Adding a new incident class: **[Docs/replayx-incident-authoring-guide.md](Docs/replayx-incident-authoring-guide.md)**

---

## Stack

| Layer | Technology |
|---|---|
| Orchestration | Node.js ≥ 24.0 + TypeScript + `@openai/codex-sdk` v0.121.0 |
| Dashboard | Next.js — live run streaming + replay visualization |
| Intake | Slack bot + REST API (`POST /api/replayx/runs`) |
| Control plane | SQLite-backed store at `.replayx-control-plane/` |
| Artifacts | Plain JSON on disk under `artifacts/<incident-id>/` |

ReplayX uses `@openai/codex-sdk` because the hard parts of incident response — reading a real codebase, running commands, proposing a targeted fix — are software engineering tasks that need code-aware reasoning. Fresh live incidents do not silently fall back to seeded answers; deterministic fixture/eval runs remain available when explicitly selected.

→ Architecture rationale: **[Docs/replayx-codex-first-architecture.md](Docs/replayx-codex-first-architecture.md)**
→ Full stack reference: **[Docs/replayx-architecture.md](Docs/replayx-architecture.md)**

---

## Documentation

| Doc | What's inside |
|---|---|
| [PIPELINE.md](PIPELINE.md) | Phase model, flow diagram, specialist table, artifact map, implementation status |
| [Docs/replayx-architecture.md](Docs/replayx-architecture.md) | Stack, runtime split, env vars, data flow, key files |
| [Docs/replayx-codex-first-architecture.md](Docs/replayx-codex-first-architecture.md) | Why Codex-first; why not Agents SDK; fallback guarantee |
| [Docs/replayx-demo-runbook.md](Docs/replayx-demo-runbook.md) | Live demo setup, preflight checklist, what to say |
| [Docs/replayx-incident-authoring-guide.md](Docs/replayx-incident-authoring-guide.md) | Add a new incident class end to end |
| [dashboard/README.md](dashboard/README.md) | Dashboard routes, local dev, signed links, env vars |
| [slack/README.md](slack/README.md) | Slack service setup, env vars, deployment |
| [incidents/README.md](incidents/README.md) | Incident fixture format, validation rules, schema reference |

---

## License

MIT
