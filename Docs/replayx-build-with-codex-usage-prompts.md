# ReplayX Build-With-Codex Usage Prompts

## Purpose

This file is not for ReplayX's internal runtime.

It is for you, the operator, to use with Codex while building ReplayX for the hackathon.

Use these prompts in sequence. Each one tells Codex what to build next in this repository.

They are designed to:

- build ReplayX itself
- stay Codex-first
- keep work demo-oriented and implementation-focused

## Demo-First Framing

For the hackathon, keep this mental model explicit:

- `demo_app/` is the broken target system
- ReplayX is the incident-response product
- Codex is the reasoning and coding brain inside ReplayX
- the ReplayX dashboard or replay UI is the main judge-facing product surface
- Slack is an intake trigger, not the whole product

The demo should not feel like "we built a broken app." It should feel like:

1. a real bug appears
2. ReplayX ingests the incident
3. Codex-powered workers reason about it
4. ReplayX shows the diagnosis and fix path
5. ReplayX proves the result
6. ReplayX emits reusable knowledge

## How To Use This File

Use one prompt at a time in Codex.

After each phase:

1. let Codex finish implementation
2. review the diff
3. run the relevant verification
4. move to the next prompt

Do not dump the entire file into Codex at once. The prompts are intentionally phased.

## Current State

All 8 phases are implemented and the full golden path runs end to end. Codex SDK workers are wired into the repro and diagnosis phases. All other phases use deterministic logic seeded to the three bundled incident classes.

For the authoritative implementation status, see [`Docs/replayx-architecture.md`](./replayx-architecture.md).

## Demo Strategy Rules

Optimize for the 2-minute demo video.

That means:

- show the broken app before showing architecture
- make ReplayX, not the demo app, the visual star
- prefer one golden incident over broad feature coverage
- use deterministic replay artifacts where live Codex behavior is not stable enough
- keep terminal output secondary to dashboard/replay visuals
- keep Slack as the trigger into ReplayX, not the entire experience

## Prompt Quality Rules For Build Prompts

Use these rules when pasting later-phase prompts into Codex:

1. One build objective per prompt.
2. Keep reusable instructions at the top and dynamic repo state later.
3. Ask for concrete deliverables, artifacts, and verification.
4. Tell Codex what not to do, not just what to do.
5. Prefer bounded ownership over "implement everything" phrasing.
6. Ask Codex to preserve machine-readable outputs where later phases depend on them.

## Context Pack Rules For Build Prompts

When running a later-phase build prompt, include only:

- the relevant phase prompt
- the current implementation files for that phase
- the nearest incident fixtures or demo-app files
- the verification commands for that phase

Do not include the whole repository unless the phase actually needs it.

## Global Build Prompt

Use this once at the start of a fresh Codex session.

```text
We are building ReplayX for a Codex hackathon.

ReplayX is a Codex-first incident response system that turns an incident bundle into:
- ranked diagnosis
- validated fix
- reviewed patch
- regression proof
- postmortem
- reusable skill

Hard constraints:
- Do not use OpenAI Agents SDK as the core runtime.
- Prefer @openai/codex-sdk for orchestration.
- Prefer Codex CLI for codex exec automation and reproducible local runs.
- Keep the build demo-scoped.
- Optimize for one strong end-to-end demo, not framework breadth.
- Read AGENTS.md and Docs/replayx-architecture.md before making changes.
- Follow Docs/replayx-codex-first-prompts.md for ReplayX's internal phase prompts.

Working style:
- Read the repo first.
- Make concrete code changes, not just plans.
- Keep the diff minimal but complete.
- Run the narrowest useful verification after each batch.
- If something is missing from the repo, scaffold it.
- Do not reintroduce openai-agents, handoffs, sandbox agents, or agent-framework abstractions.
```

## Phase 1 Prompt: Scaffold The Repo

Use this first.

```text
Build the initial ReplayX hackathon repo scaffold in this repository.

Goal:
Create the directory and file structure needed for a Codex-first ReplayX implementation.

Create at least:
- orchestrator/
- orchestrator/main.ts
- orchestrator/types.ts
- orchestrator/phases/
- incidents/
- skills/
- demo_app/
- dashboard/
- package.json
- tsconfig.json
- .gitignore
- README.md updates if needed

Requirements:
- Node.js and TypeScript first
- @openai/codex-sdk as the intended orchestration dependency
- leave clear TODO markers only where implementation depends on future phase work
- do not use OpenAI Agents SDK

Also:
- update AGENTS.md only if the new file structure needs concrete repo instructions
- keep the scaffold aligned to Docs/replayx-architecture.md

Verification:
- package.json exists
- TypeScript config exists
- repo structure is coherent

Stop only when the scaffold is in place and summarized.
```

### Phase 1 Operator Note

You do not need to use `Docs/replayx-codex-first-prompts.md` directly yet.

Phase 1 is about repo structure, packages, and scaffolding rather than internal ReplayX worker behavior.

## Phase 2 Prompt: Build The Incident Contract

```text
Implement the ReplayX incident intake layer.

Goal:
Define the normalized incident bundle contract and create seeded incident fixtures for the hackathon demo.

Requirements:
- create a strict TypeScript type for normalized incidents
- create a normalization module under orchestrator/
- create at least 3 seeded incident JSON fixtures under incidents/
- fixtures should represent:
  1. checkout race condition
  2. auth token/session failure
  3. null/data-shape failure
- keep the incidents realistic but hackathon-manageable

Do not:
- build the whole orchestrator yet
- add extra infrastructure beyond the incident contract and fixtures

Verification:
- the JSON fixtures parse
- the normalization code validates and loads them

Return:
- files added
- contract summary
- verification result
```

### Phase 2 Operator Note

You still do not need the internal worker prompt pack directly for implementation.

Phase 2 should align with the incident payload shape documented in `Docs/replayx-codex-first-prompts.md`, but it does not yet need worker prompt strings in code.

## Phase 3 Prompt: Build The Demo App

```text
Implement the hackathon demo application for ReplayX.

Goal:
Create a small app that ReplayX can diagnose and fix during the demo.

Requirements:
- use a simple stack that is easy to run locally
- include intentionally planted incident classes aligned to the seeded incidents
- keep the app small and deterministic
- add only the minimum needed to support the ReplayX demo

Preferred bugs:
- race/concurrency bug in checkout or inventory
- auth/session or token-expiry bug
- null/data-shape bug

Output:
- demo_app with runnable structure
- clear mapping from each seeded incident to an intentionally planted bug

Do not:
- over-engineer the app
- introduce production-grade complexity beyond demo needs

Verification:
- app starts
- each seeded incident corresponds to an actual failing behavior or code path
```

### Phase 3 Operator Note

You do not need the internal worker prompt pack directly here either.

Phase 3 is about creating a target system that later ReplayX workers will diagnose and fix.

## Phase 3.5 Prompt: Add Pre-Seeding Checklist

```text
Add a concise hackathon pre-seeding checklist to the repository docs.

Goal:
Make sure the team can prepare the demo before hackathon day and avoid live setup failures.

The checklist should cover:
- environment setup
- seeded incidents
- demo app verification
- one end-to-end dry run
- fallback event recording for the dashboard

Keep it short and practical.

Put it in the most sensible Markdown file for operators.
```

### Hackathon Pre-Seeding Checklist

- Environment setup
  Confirm `pnpm install` has been run, Node meets the repo requirement, and the team can start both the ReplayX repo and the demo app from a clean shell.
- Seeded incidents
  Open the three incident fixtures in `incidents/` and confirm the incident ids, failing commands, and suspected files still match the current demo app paths.
- Demo app verification
  Start the app with `pnpm demo-app`, hit `/health`, and rerun the three repro commands so each seeded failure still reproduces and each healthy control still passes.
- End-to-end dry run
  Run one full narrated practice incident from intake through bug repro, expected diagnosis target, intended fix area, and final artifact/story so the operator flow is stable.
- Fallback dashboard recording
  Capture one clean fallback run before demo day: terminal output, failing and healthy route results, and any dashboard-ready screenshots or saved JSON/event artifacts needed if live execution is flaky.

### Phase 3.5 Operator Note

This phase is operational documentation only. The internal prompt pack is not the primary source here.

## Phase 4 Prompt: Build Repro Phase

```text
Implement Phase 2 of ReplayX: repro and environment verification.

Goal:
Given a normalized incident, ReplayX should narrow the failure surface and produce a machine-readable repro result.

Requirements:
- add a repro phase module under orchestrator/phases/
- use Codex-first patterns, not Agents SDK patterns
- this is the point where real Codex SDK-backed worker execution can start entering the codebase
- define exact output JSON structure for this phase
- wire it so orchestrator/main.ts can invoke it
- if the demo app needs a simple helper script or command to support repro, add it
- keep a safe local fallback path if the Codex worker is unavailable or times out

The phase should output at least:
- repro_confirmed
- verification_status
- failure_surface
- repro_command
- candidate_files
- confidence
- blocked_reason

Verification:
- phase can run against at least one seeded incident
- output is structured and usable by later phases

Done when:
- `--phase repro` executes successfully
- JSON output is emitted to stdout or artifacts
- the failing and healthy controls are both captured
- the phase can continue even if the Codex worker is skipped or fails
```

### Phase 4 Operator Note

At Phase 4, you should start using `Docs/replayx-codex-first-prompts.md` as the internal prompt spec for the repro worker.

Use:

- Prompt 02: Repro and Environment Verification

That means:

- the repro worker role and mission should come from that file
- the repro worker output schema should match that file
- any in-code prompt string for the repro worker should be derived from that file rather than improvised ad hoc

## Phase 5 Prompt: Build Diagnosis Arena

```text
Implement the ReplayX diagnosis arena in a Codex-first way.

Goal:
Run a bounded set of diagnosis workers and rank candidate root causes.

Requirements:
- do not use OpenAI Agents SDK
- use ReplayX-owned orchestration with @openai/codex-sdk as the intended runtime model
- this phase should introduce the first real bounded Codex worker fan-out for the project
- define 4 to 8 strong diagnosis worker specializations for the hackathon build
- each worker must return structured JSON
- include ranking logic
- keep the implementation inspectable and easy to demo
- use one Codex thread per worker or another equally explicit isolation model
- prefer structured outputs via `outputSchema`
- preserve raw worker artifacts or summaries for later challenger use

Worker output should include:
- diagnosis
- confidence
- observations
- commands_run
- candidate_files
- falsification_note
- status

Also:
- map the worker prompts to Docs/replayx-codex-first-prompts.md
- keep prompt definitions versioned in code or dedicated prompt files

Verification:
- arena can execute over a seeded incident input path
- ranking output is deterministic enough for demo use

Done when:
- the arena can run more than one worker
- each worker returns machine-readable output
- a ranked shortlist is produced
- later phases can consume the shortlist without manual interpretation
```

### Phase 5 Operator Note

Since you are at Phase 5, you should already be using `Docs/replayx-codex-first-prompts.md` as the internal prompt spec for the diagnosis workers.

That means:

- diagnosis worker roles should come from that file
- diagnosis worker output schemas should match that file
- any in-code prompt strings for diagnosis workers should be derived from that file rather than improvised ad hoc

Use:

- Prompt 03: Diagnosis Arena Base Prompt
- the relevant diagnosis worker variants under Prompt 03

## Phase 6 Prompt: Build Challenger Validation

```text
Implement the ReplayX challenger phase.

Goal:
Take the top diagnosis candidates and try to disprove them before the fix arena runs.

Requirements:
- build this as a separate phase module
- accept ranked diagnosis results
- return validated and rejected candidates in a structured result
- keep the logic hackathon-simple but real
- optimize for explaining the phase clearly to judges
- prefer counter-checks and falsification logic over generic commentary

Do not:
- add framework abstractions
- overbuild evaluation systems

Verification:
- challenger can process mocked diagnosis results
- output structure matches the prompt pack

Done when:
- at least one candidate can be rejected for a concrete reason
- surviving candidates are clearly separated from rejected ones
- the output is machine-readable and ready for fix selection
```

### Phase 6 Operator Note

At Phase 6, use `Docs/replayx-codex-first-prompts.md` as the internal prompt spec for the challenger worker.

Use:

- Prompt 04: Challenger Validation

That means:

- the challenger role, mission, and required workflow should come from that file
- the challenger output schema should match that file
- any in-code challenger prompt should be derived from that file

## Phase 7 Prompt: Build Fix Arena

```text
Implement the ReplayX fix arena.

Goal:
Run three bounded fix strategies in parallel:
- minimal_fix
- safe_fix
- durable_fix

Requirements:
- Codex-first orchestration
- structured outputs
- scoring logic
- rollback note
- blast radius note
- verification result capture
- use bounded worker isolation between minimal_fix, safe_fix, and durable_fix
- use output schemas or equivalently strict JSON parsing for worker results
- preserve candidate fix artifacts for later review

The fix arena should accept:
- validated diagnosis
- allowed edit scope
- verification command

It should return:
- strategy
- summary
- files_changed
- verification_result
- blast_radius
- rollback_note
- risk_note
- score
- status

Keep the hackathon focus:
- make it work for the seeded incidents
- avoid generalized framework code

Verification:
- fix arena can run on a mocked validated diagnosis
- scoring and winner selection work

Done when:
- all three strategies can be invoked independently
- verification result is captured for each strategy
- a winner is selected without manual judgment
```

### Phase 7 Operator Note

At Phase 7, use `Docs/replayx-codex-first-prompts.md` as the internal prompt spec for the fix workers.

Use:

- Prompt 05: Fix Arena Base Prompt
- Prompt 05A: Minimal Fix
- Prompt 05B: Safe Fix
- Prompt 05C: Durable Fix

That means:

- the base fix worker contract should come from that file
- each fix strategy variant should map to one of those prompt sections
- in-code fix worker prompts should not be improvised independently from the prompt pack

### Phase 7 Demo Priority Shift

From this phase onward, build for the demo first.

That means:

- the fix arena should produce outputs that can be shown clearly in the dashboard
- the chosen fix should include a short demo-facing summary, not just raw internal data
- if full live fix generation is unstable, preserve a replayable artifact-driven path that still proves the flow

## Phase 8 Prompt: Build Review And Regression Proof

```text
Implement the ReplayX dashboard replay UI and the review/regression proof artifacts needed for the demo.

Goal:
Create the first real ReplayX judge-facing product surface and make the winning fix legible through proof.

Requirements:
- build a real `dashboard/` replay UI instead of leaving it as a placeholder
- use one golden incident as the primary path, defaulting to the strongest seeded incident
- render:
  - incident summary
  - failing signal
  - diagnosis worker fan-out
  - winning diagnosis
  - selected fix
  - review / regression proof
  - postmortem / skill summary placeholders if upstream phases are not done yet
- prefer deterministic replay from saved artifacts over a fully live unstable run
- keep the UI simple, legible, and understandable in under 30 seconds
- if review/regression are not fully live yet, use artifact-backed outputs that still show proof clearly

Verification:
- the dashboard can render one complete golden-path run from saved artifacts
- a first-time viewer can understand the flow without reading the codebase
- the replay path works even if live Codex fan-out is disabled

Done when:
- ReplayX has a real judge-facing frontend surface
- one full replay run can be shown visually from incident intake through proof
- the replay UI is strong enough to anchor the 2-minute video
```

### Phase 8 Operator Note

At Phase 8, use `Docs/replayx-codex-first-prompts.md` as the internal prompt spec for both the dashboard replay artifact shape and the review/regression workers.

Use:

- Prompt 10: Dashboard Replay Artifact Compiler
- Prompt 06: Review and Regression Proof
- Prompt 07: Regression Test Writer

That means:

- the replay UI should be driven by structured phase artifacts, not ad hoc UI-only data
- review outputs should follow the findings-first contract from that file
- regression-proof outputs should follow the narrow incident-specific proof contract from that file

## Phase 9 Prompt: Build Skill Writer And Postmortem

```text
Implement the demo script, judge-start-here flow, and artifact-writing phases.

Goal:
Generate:
- a precise 2-minute demo script
- a judge-start-here path in the repo
- reusable skill artifact
- concise postmortem

Requirements:
- write the exact video flow around one golden incident
- structure the video around:
  1. problem
  2. broken app
  3. incident input
  4. worker fan-out
  5. fix + proof
  6. transformed state
- make the README legible to someone who is completely unaware of ReplayX
- add a short “why Codex matters” explanation without sounding generic
- write skills under skills/
- use a simple YAML or JSON schema
- keep the schema precise enough for future fast-path matching
- postmortem should separate facts from inference
- use only validated upstream artifacts, not guessed narratives

Verification:
- the repo contains a script or markdown artifact for the exact 2-minute flow
- the README has a clear judge-facing start path
- skill artifact is created for a mocked successful run
- postmortem output is generated from structured run data

Done when:
- the demo can be narrated cleanly from repo artifacts
- the README is understandable in under 30 seconds
- a reusable skill artifact lands on disk
- a concise postmortem lands on disk
- both are derived from the actual run outputs
```

### Phase 9 Operator Note

At Phase 9, use `Docs/replayx-codex-first-prompts.md` as the internal prompt spec for artifact-writing and demo-script workers.

Use:

- Prompt 12: Demo Script Writer
- Prompt 08: Postmortem Writer
- Prompt 09: Skill Writer

That means:

- the demo script should come from a real artifact-backed prompt, not a loose narrative pass
- the postmortem should follow the fact-vs-inference discipline from that file
- the skill artifact should follow the reuse-oriented precision from that file

## Phase 10 Prompt: Wire End-To-End Orchestrator

```text
Wire the end-to-end golden-path orchestrator for the demo.

Goal:
Make orchestrator/main.ts run the full hackathon path:
1. load incident
2. normalize incident
3. fast-path skill match
4. repro phase
5. diagnosis arena
6. challenger
7. fix arena
8. review
9. regression proof
10. postmortem and skill writing

Requirements:
- keep phase boundaries explicit
- persist or log structured outputs between phases
- make the run easy to inspect during a demo
- avoid hidden magic
- preserve phase artifacts for replay and judging
- keep the main path deterministic for the seeded incidents
- ensure the golden-path run can feed the dashboard replay and demo script directly

Verification:
- one seeded incident can run through the full path
- output artifacts are visible on disk or in console output

Done when:
- one seeded incident completes the full path
- each phase leaves a usable artifact
- the operator can narrate the flow from artifacts alone
```

### Phase 10 Current State

The golden-run orchestration path is now implemented for the seeded demo flow.

What it already does:

- runs repro
- runs diagnosis
- runs challenger
- emits fix arena artifacts
- emits review/regression artifacts
- emits postmortem, skill, replay, Slack, and demo-script artifacts

What remains after this phase is polish and submission hardening, not core orchestration invention.

### Phase 10 Operator Note

At Phase 10, you should be wiring the orchestrator around the full internal prompt system.

Use:

- Prompt 00 as the top-level orchestration contract
- Prompt 01 through Prompt 09 as the worker contracts for the relevant phases

That means the end-to-end pipeline should route work according to the prompt pack rather than inventing separate undocumented worker behavior.

## Phase 11 Prompt: Build Hackathon Dashboard

```text
Build the polished hackathon dashboard and replay experience.

Goal:
Turn the functional replay UI into the main judge-facing ReplayX product surface.

It should show:
- incident summary
- diagnosis candidates
- challenger outcome
- fix arena strategies and scores
- winning fix
- generated skill
- postmortem summary
- clear timeline / stage progression
- before/after state framing for the golden incident

Requirements:
- keep it simple and visually clear
- optimize for cold-viewer comprehension first, aesthetics second
- if live streaming is too expensive, use replayable structured run artifacts
- make the dashboard feel like ReplayX, not like a generic admin panel
- prefer a single polished golden flow over many shallow screens

Verification:
- dashboard can render a completed run artifact
- the UI can carry the 2-minute demo video visually without heavy narration
```

### Phase 11 Current State

The dashboard now exists as a Next.js replay-first UI for the golden incident.

The remaining work in this phase is visual polish, state-transition polish, and optional replay/event refinements.

### Phase 11 Operator Note

The dashboard does not need a new internal worker prompt, but it should reflect the output contracts defined in `Docs/replayx-codex-first-prompts.md`.

In practice:

- the dashboard should visualize outputs from repro, diagnosis, challenger, fix, review, and skill/postmortem phases
- UI assumptions should follow the actual JSON artifacts emitted by those workers

## Phase 11.5 Prompt: Add Event Schema And Replay Mode

```text
Add the smallest useful event schema and replay mode for the ReplayX dashboard.

Goal:
Make the dashboard work in two modes:
- live mode from a running ReplayX pipeline
- replay mode from a saved event file

Requirements:
- define a compact event schema
- include events for:
  - pipeline start
  - phase transitions
  - diagnosis worker updates
  - challenger result
  - fix scores
  - winner selected
  - skill written
  - pipeline complete
- keep the replay path dead simple so it is a reliable hackathon fallback

Verification:
- dashboard can render a mocked saved event stream end to end
```

### Phase 11.5 Current State

The dashboard is replay-first from saved artifacts, which is the required stable path for the hackathon demo.

Saved event-stream playback is still optional polish, not a blocker, because the replay artifact already provides the reliable demo mode.

### Phase 11.5 Operator Note

This phase should stay aligned to the worker outputs and artifacts defined by the internal prompt pack, but it does not introduce a new worker prompt of its own.

## Phase 12 Prompt: Build Demo Script And Judging Flow

```text
Create the final hackathon demo package.

Goal:
Package the project so the demo is reliable and easy to narrate.

Deliver:
- one recommended demo incident
- exact commands to run the demo
- fallback plan if live inference fails
- 60-second explanation of the architecture
- 30-second explanation of why Codex-first is the correct choice
- a clean visual recording order
- explicit narration tied to the actual dashboard states

Also:
- add a concise demo section to README.md
- make the script optimized for judges, not engineers only

Verification:
- commands are coherent
- fallback path exists
- the story is crisp
- the visual sequence matches the implemented surfaces
```

### Phase 12 Current State

The golden incident demo script artifact already exists.

The remaining work in this phase is recording discipline and any final wording polish in repo-facing docs.

### Phase 12 Operator Note

This phase is presentation-oriented. It should reference the worker behavior defined by the internal prompt pack, but it does not create new internal worker prompts.

## Phase 13 Prompt: Package The Submission Story

```text
Prepare the final hackathon submission story for ReplayX.

Goal:
Make the repo and demo read like a winning product, not just an engineering experiment.

Deliver:
- a 1-line pitch
- a 3-line product explanation
- a short "why Codex-first" explanation
- a short "why this matters" explanation
- a concise README section for judges

Use the strongest parts of the older hackathon plan for product storytelling, but keep all implementation claims aligned with the current Codex-first architecture.

Do not mention OpenAI Agents SDK as the core runtime.
```

### Phase 13 Current State

README now frames the judge flow correctly, but submission-polish passes can still improve the final pitch, short product explanation, and repo copy before submission.

### Phase 13 Operator Note

This phase is also presentation-oriented. It should stay consistent with the internal prompt system and architecture docs, but it does not define new worker prompts.

## Sources

Use these as reference while building:

- `Docs/replayx-codex-first-architecture.md`
- `Docs/replayx-codex-first-prompts.md`

Official OpenAI references:

- Codex SDK: https://developers.openai.com/codex/sdk
- Codex CLI: https://developers.openai.com/codex/cli
- AGENTS.md guide: https://developers.openai.com/codex/guides/agents-md
- Codex best practices: https://developers.openai.com/codex/learn/best-practices
- Prompt engineering guide: https://developers.openai.com/api/docs/guides/prompt-engineering
- Prompt caching guide: https://developers.openai.com/api/docs/guides/prompt-caching
