# ReplayX — CLAUDE.md

This file is read automatically by Claude and Claude Code before any work on this repository. It carries the operating rules, architecture constraints, and task standards that must hold across every session.

---

## What This Repo Is

ReplayX is a Codex-first incident response system for engineering teams.

It turns a production-style incident bundle into:

- a ranked diagnosis
- a validated fix strategy
- a reviewed patch proposal
- a regression verification plan
- a postmortem
- a reusable incident skill

**Core idea:** incident response should feel less like panic, and more like playback.

---

## Repo State

All 8 phases are implemented and running end to end:

| Phase | ID | Status |
|---|---|---|
| 1 — Incident Intake | `incident-intake` | ✅ |
| 2 — Skill Match | `skill-match` | ✅ |
| 3 — Repro | `repro` | ✅ |
| 4 — Diagnosis Arena | `diagnosis-arena` | ✅ |
| 5 — Challenger Validation | `challenger-validation` | ✅ |
| 6 — Fix Arena | `fix-arena` | ✅ |
| 7 — Review & Regression | `review-and-regression` | ✅ |
| 8 — Postmortem & Skill Write | `postmortem-and-skill` | ✅ |

---

## Canonical Layout

```
ReplayX/
├── AGENTS.md               ← Rules for Codex / OpenAI tooling
├── CLAUDE.md               ← This file — rules for Claude
├── README.md               ← Product overview and quickstart
├── PIPELINE.md             ← Phase model, flow diagram, artifact map
├── PROMPTS.md              ← Stable root-level prompt catalog
├── DESIGN.md               ← Visual design system
├── orchestrator/           ← TypeScript orchestration (Codex-first)
│   ├── main.ts
│   ├── normalize-incident.ts
│   ├── types.ts
│   ├── phases/             ← One file per phase
│   └── prompts/            ← Phase prompt templates
├── dashboard/              ← Next.js operator and leadership UI
├── demo_app/               ← Intentionally broken target application
├── incidents/              ← Seeded incident fixture bundles
├── skills/                 ← Reusable skill artifacts
├── slack/                  ← Slack intake and handoff service
├── tests/                  ← Orchestrator tests
├── artifacts/              ← Phase outputs written at runtime
└── Docs/                   ← Architecture, demo ops, and authoring docs
```

---

## Architecture Rules

- **Codex-first**: `@openai/codex-sdk` is the primary orchestration runtime.
- **Do not use** the OpenAI Agents SDK as the core runtime.
- Codex CLI handles `codex exec`, local automation, and reproducible operator workflows.
- For hosted worker paths outside the Codex SDK, prefer the Responses API with ReplayX-owned orchestration.
- Every phase must produce machine-readable JSON artifacts. No opaque agent traces.

Full technical reference: [`Docs/ENGINEERING.md`](Docs/ENGINEERING.md)

---

## Design Rule

Always read [`DESIGN.md`](DESIGN.md) before any visual or UI work. All font choices, colors, spacing, motion, and aesthetic direction are defined there. Do not deviate without explicit approval.

When reviewing frontend code, flag anything that breaks the design system or feels more generic than the intended product direction.

---

## Working Rules

- **Read before editing.** Read the relevant source files — especially `orchestrator/types.ts` — before making changes to docs or code.
- **Stay accurate.** All documentation must reflect the actual source code state. Cross-check phase behavior against `orchestrator/phases/*.ts`.
- **Keep changes tight.** Each change should be the narrowest useful edit. Do not refactor things that are not broken.
- **Verify after each batch.** Run the narrowest relevant verification command after any code change.
- **No stale abstractions.** Do not reintroduce OpenAI Agents SDK patterns, sandbox-agent architecture, or agent handoff primitives.
- **Keep docs in sync.** If phase behavior changes, update `PIPELINE.md`. If `types.ts` changes, update `incidents/README.md` and `Docs/ENGINEERING.md`.
- **Prompt ownership.** If Prompt 00 changes, update `PROMPTS.md` and any affected runtime prompt templates in `orchestrator/prompts/`.

---

## Build Priority

Optimize for a clear, compelling, two-minute demo — not framework breadth.

That means:

- one end-to-end incident flow that works reliably
- strong seeded incidents with realistic evidence
- bounded, explainable diagnosis workers
- a dashboard operators understand immediately
- visible artifacts and verification at every step

---

## Prompting Rules

- Stable operating rules live in `AGENTS.md`, `CLAUDE.md`, and `PROMPTS.md`.
- Stable prompt ownership lives in `PROMPTS.md`.
- Runtime prompt templates live in `orchestrator/prompts/`.
- Dynamic incident detail belongs in the user prompt layer, not the system prompt.
- Prefer explicit output schemas and verification commands in every worker prompt.
- Keep prompts concise and operationally focused.

---

## Done Means

A task is complete only when:

1. Requested code or docs exist.
2. All relevant prompts and architecture docs are internally consistent.
3. Verification was run, or the limitation is explicitly stated.
4. No stale Agents-SDK-based guidance remains as a recommended path.
5. All doc changes cross-check against the actual source code.

---

## Key Files

| File | Purpose |
|---|---|
| `orchestrator/types.ts` | Canonical type system — source of truth for all phase contracts |
| `orchestrator/main.ts` | Phase runner and CLI entry point |
| `orchestrator/normalize-incident.ts` | Strict incident bundle validation |
| `orchestrator/phases/` | One implementation file per phase |
| `incidents/*.json` | Seeded incident fixtures — validated against `NormalizedIncident` |
| `skills/*.yaml` | Reusable skill artifacts read by Phase 2 |

---

## Key Docs

| Doc | Purpose |
|---|---|
| [`README.md`](README.md) | Product overview, quickstart, and doc navigation |
| [`PIPELINE.md`](PIPELINE.md) | Phase model, flow diagram, specialist table, artifact map |
| [`Docs/ENGINEERING.md`](Docs/ENGINEERING.md) | Runtime architecture, component map, Codex worker model, data storage |
| [`Docs/OPERATIONS.md`](Docs/OPERATIONS.md) | Local setup, Slack intake, routes, env vars, and verification |
| [`Docs/INCIDENT_AUTHORING.md`](Docs/INCIDENT_AUTHORING.md) | How to add a new incident class end to end |
