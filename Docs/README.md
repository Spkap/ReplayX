# ReplayX Docs

Long-form product, architecture, demo operations, and authoring reference for ReplayX.

**New to the repo?** Start with [`README.md`](../README.md), then follow the reading order below.

---

## Reading Order

| # | File | Purpose |
|---|---|---|
| 1 | [`README.md`](../README.md) | Product overview, architecture summary, and quickstart |
| 2 | [`PIPELINE.md`](../PIPELINE.md) | 8-phase model, flow diagram, specialist table, and artifact map |
| 3 | [`replayx-architecture.md`](./replayx-architecture.md) | Technical deep-dive: stack, runtime split, data flow, env vars |
| 4 | [`replayx-demo-runbook.md`](./replayx-demo-runbook.md) | Live demo setup, preflight checklist, and operational flow |

---

## Architecture

| File | Purpose |
|---|---|
| [`replayx-architecture.md`](./replayx-architecture.md) | Authoritative technical reference: stack, phases, data flow, skill loop |
| [`replayx-architecture-diagram.md`](./replayx-architecture-diagram.md) | Judge-friendly system and product diagrams in Mermaid |

---

## Prompting

| File | Purpose |
|---|---|
| [`PROMPTS.md`](../PROMPTS.md) | Root-level prompt catalog — Prompt 00 and ownership rules |
| [`replayx-codex-first-prompts.md`](./replayx-codex-first-prompts.md) | Extended worker prompt pack and design rationale |
| [`replayx-build-with-codex-usage-prompts.md`](./replayx-build-with-codex-usage-prompts.md) | Operator-facing prompts used while building ReplayX |

---

## Demo & Submission

| File | Purpose |
|---|---|
| [`replayx-demo-runbook.md`](./replayx-demo-runbook.md) | Full live demo setup and operational flow |
| [`replayx-2min-demo-script.md`](./replayx-2min-demo-script.md) | Spoken pitch script and recording guidance |
| [`replayx-hackathon-submission.md`](./replayx-hackathon-submission.md) | One-liner, short write-up, and judge framing |

---

## Authoring

| File | Purpose |
|---|---|
| [`replayx-incident-authoring-guide.md`](./replayx-incident-authoring-guide.md) | End-to-end guide for adding a new incident class |

---

## Component References

| File | Purpose |
|---|---|
| [`dashboard/README.md`](../dashboard/README.md) | Dashboard routes, live/replay modes, and dev setup |
| [`slack/README.md`](../slack/README.md) | Slack intake wiring and environment variables |
| [`demo_app/README.md`](../demo_app/README.md) | Seeded broken app, repro endpoints, and incident mapping |
| [`incidents/README.md`](../incidents/README.md) | Incident fixtures, field reference, and authoring notes |
| [`skills/README.md`](../skills/README.md) | Skill artifact format and skill match scoring |

---

## Source of Truth

When multiple files touch the same topic, these are canonical:

| Topic | File |
|---|---|
| Product overview | [`README.md`](../README.md) |
| Phase model | [`PIPELINE.md`](../PIPELINE.md) |
| Technical architecture | [`replayx-architecture.md`](./replayx-architecture.md) |
| Demo operations | [`replayx-demo-runbook.md`](./replayx-demo-runbook.md) |
| Spoken pitch | [`replayx-2min-demo-script.md`](./replayx-2min-demo-script.md) |
| Design system | [`DESIGN.md`](../DESIGN.md) |
| Adding incident classes | [`replayx-incident-authoring-guide.md`](./replayx-incident-authoring-guide.md) |
