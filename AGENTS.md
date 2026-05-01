# ReplayX — AGENTS.md

## What This Repo Is

ReplayX is a Codex-first incident response system for engineering teams.

It turns a production-style incident bundle into:

- a ranked diagnosis
- a validated fix strategy
- a reviewed patch
- a regression proof plan
- a postmortem
- a reusable incident skill

The core product idea: incident response should feel less like panic and more like playback.

## Current Repo State

The full 8-phase pipeline is implemented and runnable end to end:

| Phase | ID | Status |
|---|---|---|
| 1 — Incident Intake | `incident-intake` | ✅ implemented |
| 2 — Skill Match | `skill-match` | ✅ implemented |
| 3 — Repro | `repro` | ✅ implemented |
| 4 — Diagnosis Arena | `diagnosis-arena` | ✅ implemented |
| 5 — Challenger Validation | `challenger-validation` | ✅ implemented |
| 6 — Fix Arena | `fix-arena` | ✅ implemented |
| 7 — Review & Regression | `review-and-regression` | ✅ implemented |
| 8 — Postmortem & Skill Write | `postmortem-and-skill` | ✅ implemented |

Canonical layout:

```
ReplayX/
├── AGENTS.md               ← Rules for Codex / OpenAI tooling
├── CLAUDE.md               ← Rules for Claude / Claude Code
├── README.md               ← Product overview and quickstart
├── PIPELINE.md             ← Phase model, rules, and artifacts
├── PROMPTS.md              ← Stable root-level prompt catalog
├── DESIGN.md               ← Visual design system (read before any UI work)
├── orchestrator/           ← Codex-first TypeScript orchestration
├── incidents/              ← Seeded incident bundles
├── demo_app/               ← Intentionally broken target app
├── dashboard/              ← Next.js operator and leadership UI
├── slack/                  ← Slack intake and handoff service
├── skills/                 ← Reusable skill artifacts
├── tests/                  ← Orchestrator tests
└── Docs/                   ← Long-form architecture, demo, and operator docs
```

## Architecture Rule

- ReplayX must be Codex-first.
- Use `@openai/codex-sdk` as the primary orchestration runtime.
- Use Codex CLI for `codex exec`, local automation, and repeatable operator workflows.
- Do not use OpenAI Agents SDK as the core runtime.
- For hosted worker paths outside the Codex SDK, prefer the Responses API with ReplayX-owned orchestration.

See [`Docs/ENGINEERING.md`](Docs/ENGINEERING.md) for the full technical reference.

## Design Rule

Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, motion, and aesthetic direction are defined there.
Do not deviate without explicit approval.
When reviewing frontend work, flag anything that breaks the design system or feels more generic than the intended product direction.

## Build Priority

Optimize for a credible incident-response product, not framework breadth.

That means:

- one clear end-to-end incident flow
- strong fixture/eval incident classes with visible capability boundaries
- bounded diagnosis workers
- bounded fix workers
- visible verification and artifacts
- operator surfaces that explain state in under two minutes

## Prompting Rules

- Keep stable operating rules in `AGENTS.md`, `CLAUDE.md`, and `PROMPTS.md`.
- Keep stable prompt ownership in `PROMPTS.md`.
- Keep runtime prompt templates in `orchestrator/prompts/`.
- Put dynamic incident detail in the user layer, not the system layer.
- Prefer explicit output schemas and verification commands.
- Keep prompts short, operational, and machine-checkable.

## Working Rules

- Read the relevant repo files before editing.
- Keep changes product-scoped and tightly contained.
- Do not reintroduce old agent-framework abstractions.
- Run the narrowest useful verification after each batch.
- Keep docs aligned with the actual state of the repo.
- If Prompt 00 changes, keep `PROMPTS.md` and runtime prompt templates aligned.

## Done Means

A task is complete only when:

1. The requested docs or code exist.
2. The relevant prompts or architecture are internally consistent.
3. Verification was run when possible, or the limitation is stated clearly.
4. No stale Agents-SDK-based guidance remains as the recommended path.

## Source Links

- Codex SDK: https://developers.openai.com/codex/sdk
- Codex CLI: https://developers.openai.com/codex/cli
- AGENTS.md guide: https://developers.openai.com/codex/guides/agents-md
- Codex best practices: https://developers.openai.com/codex/learn/best-practices
- Prompt engineering guide: https://developers.openai.com/api/docs/guides/prompt-engineering
- Prompt caching guide: https://developers.openai.com/api/docs/guides/prompt-caching

## Key Docs

- Product overview and quickstart: [`README.md`](README.md)
- Engineering: [`Docs/ENGINEERING.md`](Docs/ENGINEERING.md)
- Operations: [`Docs/OPERATIONS.md`](Docs/OPERATIONS.md)
- Phase model: [`PIPELINE.md`](PIPELINE.md)
- Adding incident classes: [`Docs/INCIDENT_AUTHORING.md`](Docs/INCIDENT_AUTHORING.md)
