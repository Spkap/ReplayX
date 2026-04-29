# ReplayX 100M Realtime Product Plan

Date: April 27, 2026

## Operating Answer

Every product decision must answer this:

What would a 100 million dollar incident-response product do here?

The answer is not more demo surface area. The answer is operational truth:

- fresh incidents are realtime by default
- seeded incidents are fixtures/evals only
- evidence appears before confidence
- proof gates block fake resolution
- Codex edits code only inside bounded, inspectable loops
- the product remembers only validated outcomes

## Product Standard

ReplayX should feel like the place an engineering leader opens when a production bug needs disciplined execution, not a place to watch an agent perform.

The product is valuable when it can say:

- here is the original report
- here is the baseline command and output
- here are the source candidates and recent changes
- here are the theories rejected
- here is the patch that changed code
- here is the regression proof
- here is the PR or the exact reason ReplayX refused to create one
- here is the reusable skill learned from a validated fix

## Phase 0: Product Truth Cutover

Status: in progress.

Goal:

Remove the seeded demo as the default product path.

Implementation:

- Fresh Slack/API/manual incidents create `executionMode: realtime`.
- Explicit fixture ids create `executionMode: fixture`.
- Keyword fixture matching is disabled unless `REPLAYX_ALLOW_SEEDED_KEYWORD_MATCH=1`.
- Realtime runs collect validation, source search, recent git history, and an investigation packet.
- Realtime runs stop before PR-ready claims until a bounded patch worker validates code changes.
- Slack links to `/new` when live run creation is unavailable instead of falling back to golden replay.
- Dashboard `/new` starts manual realtime incidents.

Success:

- No ordinary Slack text becomes a seeded fixture by accident.
- The UI labels mode and capability on live workspaces.
- Docs describe fixture paths as evals, not the product default.

## Phase 1: Bounded Codex Patch Worker

Goal:

Turn realtime investigation packets into sandboxed, validated code patches.

Build:

- Create a patch worker contract with strict inputs: incident text, validation command, candidate files, evidence packet path.
- Restrict edits to candidate files unless the worker returns a written expansion rationale.
- Run validation before and after patch.
- Store diff, changed files, command output, rollback note, and refusal reason.
- Mark PR output `ready` only when the regression command passes after the patch.

Non-negotiable:

- No patch claim without a diff.
- No PR claim without a passing command.
- No memory promotion without a validated fix.

## Phase 2: Incident Memory And Skill Loop

Goal:

Make every validated incident reduce future incident cost.

Build:

- Promote validated realtime runs into reusable incident skills.
- Add skill-match scoring that compares fresh incidents to validated memory, not seed fixtures.
- Show why a memory match was accepted or rejected.
- Track false-positive matches and refusal quality.

## Phase 3: Operator-Grade Control Plane

Goal:

Make ReplayX feel like a live reliability system.

Build:

- Fleet view grouped by active, blocked, approval, and validated.
- Per-run proof economics: time to evidence, time to patch, commands run, wrong fixes avoided.
- Action queue for approve, retry, archive, hand off, open PR.
- Explicit mode filters: realtime, fixture/eval, archived, blocked.

## Phase 4: Design-Partner Pilot Package

Goal:

Sell proof, not automation.

Package:

- Replay two historical incidents from a design partner.
- Run one live incident or controlled drill.
- Ship one validated incident skill.
- Produce one reliability proof report.
- Price around avoided incident time, reduced risky merges, and institutional memory.

## Current Execution Slice

This pass implements the Phase 0 cutover and leaves Phase 1 as the next engineering frontier.

Verification required before calling it done:

- focused live-run tests
- Slack tests
- TypeScript typecheck
- dashboard build
- browser creation of a realtime run through `/new`
- workspace inspection showing `realtime` and `analysis_only`
