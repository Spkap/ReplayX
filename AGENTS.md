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

See [`Docs/replayx-architecture.md`](Docs/replayx-architecture.md) for the full technical reference.

## Design Rule

Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, motion, and aesthetic direction are defined there.
Do not deviate without explicit approval.
When reviewing frontend work, flag anything that breaks the design system or feels more generic than the intended product direction.

## Build Priority

Optimize for a credible incident-response product, not framework breadth.

That means:

- one clear end-to-end incident flow
- strong launch incident classes with visible capability boundaries
- bounded diagnosis workers
- bounded fix workers
- visible verification and artifacts
- operator surfaces that explain state in under two minutes

## Prompting Rules

- Keep stable operating rules in `AGENTS.md`, `CLAUDE.md`, and `PROMPTS.md`.
- Keep the full worker prompt pack in `Docs/replayx-codex-first-prompts.md`.
- Keep build/operator prompts in `Docs/replayx-build-with-codex-usage-prompts.md`.
- Put dynamic incident detail in the user layer, not the system layer.
- Prefer explicit output schemas and verification commands.
- Keep prompts short, operational, and machine-checkable.

## Working Rules

- Read the relevant repo files before editing.
- Keep changes product-scoped and tightly contained.
- Do not reintroduce old agent-framework abstractions.
- Run the narrowest useful verification after each batch.
- Keep docs aligned with the actual state of the repo.
- If Prompt 00 changes, keep `PROMPTS.md` and `Docs/replayx-codex-first-prompts.md` aligned.

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

- Architecture: [`Docs/replayx-architecture.md`](Docs/replayx-architecture.md)
- Phase model: [`PIPELINE.md`](PIPELINE.md)
- Adding incident classes: [`Docs/replayx-incident-authoring-guide.md`](Docs/replayx-incident-authoring-guide.md)
- Launch operations: [`Docs/replayx-demo-runbook.md`](Docs/replayx-demo-runbook.md)


<claude-mem-context>
# Memory Context

# [ReplayX] recent context, 2026-04-30 1:06am GMT+5:30

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (19,910t read) | 2,007,505t work | 99% savings

### Apr 21, 2026
60 10:49p 🔵 ReplayX Dashboard — Full Page Structure Confirmed
62 10:51p 🔴 Live Run Pipeline Fixed — Node.js Test Runner Detection Bug in shouldCreateLivePullRequest()
### Apr 23, 2026
400 10:42a 🔵 ReplayX — gstack Runtime State Audited on main Branch
401 10:43a 🔵 ReplayX — Full Architecture, Services, Commands, and Test Suite Audited
403 " 🔵 ReplayX — Local Service Ports, Browser URLs, and Dashboard Routes Fully Mapped
404 " 🔵 ReplayX Dashboard Design System — Full Aesthetic Rules, Color Palette, and Anti-Slop Constraints Audited
406 10:44a 🔵 ReplayX — Full Test Suite Green: 20/20 Root Tests, 11/11 Slack Tests, Dashboard Build Clean, Typecheck Passes
408 " 🔵 ReplayX — Slack .env Has Real Bot Credentials; Root .env Has No API Keys; REPLAYX_INTERNAL_API_TOKEN Is Placeholder
409 " 🔵 ReplayX Local Dev Stack Started — Demo App on 4311, Dashboard on 3001
412 10:49a 🔵 ReplayX Live Run Client — Tab Architecture Fully Audited
416 10:57a ⚖️ ReplayX Product Pivot — Hackathon Mindset Explicitly Rejected
417 " 🔵 ReplayX — Hackathon Language Located Across 8+ Files
418 " 🔵 ReplayX Live Dashboard — Full UI Tab Structure and Rail Architecture Audited
421 11:09a 🟣 ReplayX Capability-Limited Run Mode — Graceful Operator Handoff for Unmatched Incidents
422 " 🔴 ReplayX — Two New Tests Failed Before Capability-Limited Implementation Landed
423 11:12a 🟣 ReplayX All 21 Tests Green — Capability-Limited Run Mode Fully Verified
424 " 🟣 ReplayX Dashboard — URL-Synced Tab State, Artifact Deep Links, and Rejected Theories Panel
### Apr 27, 2026
846 10:41p 🟣 ReplayX Full Agentic QA Review — Plan Initiated
847 10:42p 🔵 ReplayX Repo — 28 Modified + 6 Untracked Files vs origin/main
848 " 🔵 brooks-review Skill — Shared Dependency Files Missing from ~/.codex/skills/_shared/
849 " 🔵 ReplayX Package Structure — Three Isolated Runtimes, No Turbo/Monorepo Tooling
853 10:45p 🔵 brooks-lint Skill Suite — _shared/ Directory Entirely Absent from ~/.codex/skills/
854 " 🟣 ReplayX — 5 Parallel Agentic Review Agents Spawned Simultaneously
855 " 🔵 Slack Service Tests — 11/11 Pass, Full Integration Coverage Confirmed
856 " 🔵 ReplayX Uncommitted Diff — 1602 Insertions, 562 Deletions Across 30 Files
857 " 🔵 ReplayX Codex-First Constraint — Confirmed Enforced Across Codebase
858 10:53p 🔵 ReplayX End-to-End Architecture — Full Flow Mapped from Incidents to Dashboard
859 " 🔵 ReplayX Integration Breaks — Mismatched Routes, Ports, and Missing Validation Checks Identified
862 11:00p 🔴 runReplayXLivePipeline — Approval Gate Bypass Fixed
863 " 🔴 retryReplayXRun — Incident Selection Lost on Retry
864 " 🔴 Node.js Version Requirement Bumped to 24.0
865 " 🔴 dev-all.mjs — Shared Env Not Propagated to Child Processes
866 " 🔴 .gitignore — Dashboard Artifact Route Page Was Being Silently Excluded
867 " ✅ REPLAYX_SLACK_API_URL Added to Both .env.example Files and All Docs
868 " 🔵 ReplayX Codebase State — Current Architecture Confirmed
869 11:02p 🔵 ReplayX Checkout Race Condition — Confirmed Failure Surface
885 11:24p 🔵 ReplayX Gstack Environment State — Session Config Confirmed
886 " ⚖️ ReplayX $100M Product Direction — Live Incidents Replace Seeded Demo as Default
887 " 🔵 Explorer Agent Spawn Constraint — Full-History Fork Blocks Agent Type Override
889 11:26p 🟣 ReplayX live-runs.ts — Realtime Mode Now Default, Seeded Demo Path Gated
890 " 🔵 ReplayX Live-Run Path — Seeded Demo vs Real Incident Audit Initiated
891 " 🟣 ReplayX Realtime Investigation Engine — Core Infrastructure Added to live-runs.ts
892 11:28p 🟣 runRealtimeInvestigationPipeline — Full Phase Pipeline Wired into runReplayXLivePipeline
893 " ✅ live-runs.test.ts — Tests Updated to Assert Realtime-First Behavior
894 11:45p 🔵 ReplayX live-runs.ts — Full Architecture Audited
895 " 🔴 live-runs.ts — Realtime Routing Decision Logic Fixed
896 " ✅ tests/live-runs.test.ts — Test Suite Aligned to Realtime-First Product Direction
897 " 🔵 ReplayX Dashboard Homepage — Architecture and Auth Pattern Confirmed
898 " 🔵 Slack Service — goldenIncidentId Fallback Pattern When replayXClient Not Configured
899 " ⚖️ ReplayX $100M Direction — Realtime Investigation as Default, Fixture/Eval as Explicit-Only

Access 2008k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
