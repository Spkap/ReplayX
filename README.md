# ReplayX

ReplayX is a Codex-first incident response system.

It turns a production-style bug report into a ranked diagnosis, a reviewed fix strategy, a regression verification record, a postmortem, and a reusable incident skill — all in one live, auditable run.

**The core idea:** incident response should feel less like panic, and more like playback.

---

## What ReplayX Is

ReplayX is not a log-summarizing chatbot. It is a code-aware incident workflow where Codex-powered specialists work in bounded phases:

- normalize and intake the incident bundle
- confirm the failure reproduces in the target environment
- investigate with a fleet of specialist workers, each owning one failure domain
- challenge the strongest hypotheses adversarially
- rank fix strategies by score and blast radius
- produce a reviewed verification plan
- emit a postmortem and a reusable incident skill

The dashboard is the main product surface. Slack is the intake trigger. The `demo_app/` makes the failure concrete and demoable.

---

## Product Modes

### Live run

1. A user reports a bug in Slack.
2. ReplayX starts a live incident run.
3. The dashboard updates in real time as the orchestrator advances through all 8 phases.
4. The run ends with a postmortem and a reusable skill artifact.

### Replay

Precomputed artifacts drive a stable fallback at `/replay/incident-checkout-race-001`. Use this as a safety net or when you need a no-risk demo path.

For most demos, **start with the live run path**.

---

## Why Codex

The hard parts of incident response are fundamentally coding-agent tasks:

- reading real repository context
- understanding failure evidence in code
- proposing targeted fixes instead of vague advice
- producing concrete verification steps
- writing reusable engineering knowledge

ReplayX is built around `@openai/codex-sdk` because those tasks require code-aware reasoning, not just text generation.

---

## Architecture

ReplayX follows a deterministic 8-phase model:

| # | Phase | Role |
|---|---|---|
| 1 | Incident Intake | Normalize the bundle into a strict contract |
| 2 | Skill Match | Check incident memory for a known pattern |
| 3 | Repro | Confirm the failure is real and reproducible |
| 4 | Diagnosis Arena | Fan out to 6 specialist Codex workers |
| 5 | Challenger Validation | Reject weak or broad diagnoses adversarially |
| 6 | Fix Arena | Generate and rank three bounded fix strategies |
| 7 | Review & Regression | Produce a verification plan — `planned` or `blocked` |
| 8 | Postmortem & Skill | Write reusable knowledge; compile dashboard artifacts |

This structure gives the system strong failure isolation, clear per-phase artifacts, and a workflow that judges can follow in under two minutes.

Full details: [PIPELINE.md](PIPELINE.md)

---

## Outputs

Every incident run produces a complete, inspectable artifact set:

- normalized incident bundle
- per-phase JSON outputs and logs
- ranked diagnosis results
- challenger verdict
- fix strategy ranking and winner
- regression verification plan
- human-readable postmortem
- reusable `skill.yaml` artifact

Every artifact is written to disk and exposed through the dashboard. Nothing is hidden in an opaque agent trace.

---

## Run the Demo

### 1. Install dependencies

```bash
pnpm install
pnpm --dir dashboard install
npm --prefix slack install
```

### 2. Start the broken app

```bash
pnpm demo-app
```

Demo app: `http://127.0.0.1:4311/`

### 3. Start the dashboard

```bash
pnpm --dir dashboard dev -- --port 3001
```

Dashboard: `http://localhost:3001/`

### 4. Start Slack intake

```bash
npm --prefix slack start
```

Slack service: `http://localhost:3000/`

### 5. Trigger a live run

In your Slack `#bugs` channel:

```
@ReplayX checkout is overselling stock during concurrent orders
```

The bot returns a live dashboard URL. Click it to watch the orchestrator advance in real time.

### Optional — precompute the replay fallback

```bash
pnpm golden-run incidents/checkout-race-condition.json
```

Then open: `http://localhost:3001/replay/incident-checkout-race-001`

For the full operational flow, see [Docs/replayx-demo-runbook.md](Docs/replayx-demo-runbook.md).

---

## Project Structure

```text
ReplayX/
├── AGENTS.md            # Rules for Codex / OpenAI tooling
├── CLAUDE.md            # Rules for Claude / Claude Code
├── DESIGN.md            # Visual design system
├── PIPELINE.md          # Phase model, flow diagram, specialist table, artifact map
├── PROMPTS.md           # Stable prompt catalog
├── README.md            # This file
├── orchestrator/
│   ├── main.ts          # Phase runner and CLI entry point
│   ├── normalize-incident.ts
│   ├── types.ts         # Canonical type system for all phases
│   ├── phases/          # One file per phase (8 total)
│   └── prompts/         # Phase prompt templates
├── dashboard/           # Next.js live run + replay UI
├── demo_app/            # Intentionally broken target application
├── incidents/           # Normalized incident fixture bundles
├── skills/              # Reusable skill artifacts
├── slack/               # Slack intake and handoff service
├── tests/               # Orchestrator tests
├── artifacts/           # Phase outputs written at runtime
└── Docs/                # Architecture, demo operations, and authoring guides
```

---

## Documentation

| File | Purpose |
|---|---|
| [README.md](README.md) | Product overview and quickstart |
| [AGENTS.md](AGENTS.md) | Rules for Codex / OpenAI tooling |
| [CLAUDE.md](CLAUDE.md) | Rules for Claude / Claude Code |
| [PIPELINE.md](PIPELINE.md) | Phase model, flow, specialist table, and artifact map |
| [PROMPTS.md](PROMPTS.md) | Stable prompt catalog and ownership rules |
| [DESIGN.md](DESIGN.md) | Visual design system — read before any UI work |
| [Docs/replayx-architecture.md](Docs/replayx-architecture.md) | Technical architecture: stack, runtime split, data flow |
| [Docs/replayx-demo-runbook.md](Docs/replayx-demo-runbook.md) | Live demo setup, preflight, and operational flow |
| [Docs/replayx-incident-authoring-guide.md](Docs/replayx-incident-authoring-guide.md) | How to add a new incident class end to end |
| [Docs/replayx-architecture-diagram.md](Docs/replayx-architecture-diagram.md) | Judge-friendly system diagrams |
| [Docs/README.md](Docs/README.md) | Full Docs directory map and reading order |

---

## Known Scope

- The golden path is optimized for the three bundled incident classes. Adding a new class requires extending the diagnosis, challenger, and fix phase files — see the [incident authoring guide](Docs/replayx-incident-authoring-guide.md).
- Live runs use WebSockets for dashboard updates, with SSE as the fallback transport.
- Fix verification plans are produced but the patch is not auto-applied. The review phase outputs a verification command, not an executed result.
- GitHub PR creation is available as a runtime capability but requires environment configuration.

---

## References

- Codex SDK: https://developers.openai.com/codex/sdk
- Codex CLI: https://developers.openai.com/codex/cli
- AGENTS.md guide: https://developers.openai.com/codex/guides/agents-md
- Codex best practices: https://developers.openai.com/codex/learn/best-practices
- Prompt engineering guide: https://developers.openai.com/api/docs/guides/prompt-engineering
