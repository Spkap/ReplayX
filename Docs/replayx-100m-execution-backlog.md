# ReplayX 100M Execution Backlog

Reviewed April 24, 2026, Asia/Kolkata.

This backlog turns the company game plan into buildable work. It is sorted by company leverage, not implementation convenience.

## Operating Rule

ReplayX wins by making proof visible.

Do not ship more surface area until the existing surface proves:

- what failed
- what was rejected
- what patch is safe
- what command passed
- what risk remains
- what memory was created

## P0: Trust And Taste

### P0.1 Rewrite The Homepage Around The Product Promise

Problem:

The homepage currently explains access architecture instead of customer pain. "Show the evidence first. Open the operator surfaces second." is tasteful but internal.

Files:

- `dashboard/app/page.tsx`
- `dashboard/app/globals.css`

Change:

- Replace H1 with "Investigate production bugs. Prove the fix. Remember the pattern."
- Replace the lead with a Slack -> repro -> diagnosis -> validation -> PR -> memory story.
- Replace "Open Trusted Replay" with "Replay one real incident" or "Watch the proof run."
- Remove "Product pillars."
- Add an incident tape in the first viewport.

Acceptance:

- A new visitor can explain ReplayX in under two minutes.
- First viewport shows product objects, not just claims.
- No "three surfaces" copy remains.

Verification:

- `pnpm dashboard:build`
- gstack responsive screenshots at mobile/tablet/desktop.

### P0.2 Fix Live Workspace Right Rail Overlap

Problem:

Rendered validation tab shows the "Fast facts" rail overlapping the "Next action" card and hiding actions.

Evidence:

- `/tmp/replayx-overnight-live-validation.png`
- `/tmp/replayx-overnight-live-validation-annotated.png`

Files:

- `dashboard/app/live/[runId]/live-run-client.tsx`
- `dashboard/app/globals.css`

Change:

- Make right rail sections stack without absolute overlap.
- Keep next action visible.
- Keep PR preview visible.
- Avoid nested cards.

Acceptance:

- No overlap at 1280x720, 768x1024, or 375x812.
- Archive/retry/PR actions remain readable.

Verification:

- gstack screenshot overview and validation tab.
- `pnpm dashboard:build`

### P0.3 Compact The Live Workspace Hero

Problem:

The incident hero consumes too much of the first viewport. Proof arrives too late.

Files:

- `dashboard/app/live/[runId]/live-run-client.tsx`
- `dashboard/app/globals.css`

Change:

- Reduce hero height.
- Move proof state, validation state, rejected theories, and next action above the fold.
- Add phase rail.

Acceptance:

- In 1280x720 viewport, user sees current phase, validation state, and at least one proof object without scrolling.

### P0.4 Make Validation The Authority Screen

Problem:

Validation currently shows a verdict and commands, but not enough proof detail.

Files:

- `dashboard/app/live/[runId]/live-run-client.tsx`
- `dashboard/lib/live-runs.ts`
- `dashboard/lib/live-run-resolution.ts`
- `orchestrator/phases/review-and-regression.ts`

Change:

- Show failing-before command.
- Show passing-after command.
- Show healthy-control command.
- Show exit codes.
- Show durations.
- Show diff and PR links.
- Show residual risk.
- Show why the proof is sufficient and where it is incomplete.

Acceptance:

- A skeptical engineer can judge the patch without reading raw artifacts.

### P0.5 Remove Design-System Drift

Problem:

Rendered and source audits found design drift: undefined CSS token references, radial decorative blobs, negative letter spacing, old "Golden Replay" naming, and generic card patterns.

Files:

- `dashboard/app/globals.css`
- `dashboard/app/incidents/[incidentId]/page.tsx`
- `dashboard/app/page.tsx`

Change:

- Remove radial background blobs.
- Set letter spacing to `0`.
- Replace undefined tokens or define them intentionally.
- Pick one name, probably "Proof Run" or "Trusted Replay", not both "Golden Replay" and "Trusted Replay."
- Remove purple/indigo drift from the incidents page.

Acceptance:

- `rg -n -e '--text-muted|--text-dim|--brand|--bg-subtle' dashboard/app` returns zero or those tokens are defined.
- `rg -n 'Golden Replay' dashboard Docs README.md PIPELINE.md` returns zero if naming is retired.
- Visual screenshots match `DESIGN.md`.

## P0: Product Honesty

### P0.6 Add Run Capability Labels

Problem:

ReplayX must not hide whether a run used seeded templates, Codex patch generation, or manual handoff.

Files:

- `orchestrator/types.ts`
- `dashboard/lib/live-runs.ts`
- `dashboard/lib/live-run-resolution.ts`
- `dashboard/app/live/[runId]/live-run-client.tsx`

Add labels:

- `seeded_template`
- `codex_patch_candidate`
- `validated_pr_preview`
- `live_pr_created`
- `manual_handoff`
- `capability_limited`

Acceptance:

- Every run has a visible capability label.
- Unsupported incidents clearly show assisted handoff, not failure.

### P0.7 Align CLI Review With Live Proof

Problem:

Dashboard live validation proves seeded patches. CLI Phase 7 emits `planned`. This splits product truth.

Files:

- `orchestrator/phases/review-and-regression.ts`
- `dashboard/lib/live-run-resolution.ts`
- `tests/pipeline-contracts.test.ts`
- `tests/live-run-resolution.test.ts`

Change:

- Extract sandbox proof into a shared proof engine.
- Let Phase 7 consume or produce executed proof when a patch exists.
- Keep `planned` only when no patch was executed.

Acceptance:

- CLI and live dashboard agree on the proof status.
- Tests cover planned, verified, and blocked states.

### P0.8 Add `/setup` Readiness Screen

Problem:

A first-time operator needs docs and curl commands to start. The product should provide a guided readiness path.

Files:

- `dashboard/app/setup/page.tsx`
- `dashboard/lib/live-runs.ts`
- `dashboard/README.md`
- `Docs/replayx-demo-runbook.md`

Screen:

- Demo app running
- Dashboard running
- Codex auth available
- Slack configured
- internal token configured
- GitHub mode selected
- run store connected

Actions:

- Start Demo Run
- Copy API Trigger
- Open Slack Setup
- Open Troubleshooting

Acceptance:

- New operator can start a demo run from the UI.
- Missing setup is explicit.

## P1: Proof Engine

### P1.1 Build Bounded Codex Patch Worker

Problem:

Fix Arena is static templates. Live patching uses hardcoded string replacements.

Files:

- `orchestrator/phases/fix-arena.ts`
- `dashboard/lib/live-run-resolution.ts`
- `orchestrator/prompts`
- `orchestrator/types.ts`

Change:

- Add Codex patch worker behind feature flag.
- Run in isolated sandbox.
- Restrict files by policy.
- Produce exact diff.
- Run validation commands.
- Emit residual risk.

Feature flag:

- `REPLAYX_USE_CODEX_PATCH_WORKER=1`

Acceptance:

- One incident class can produce a Codex-generated patch candidate.
- Seeded templates remain as fixtures and baseline path.

### P1.2 Build Wrong-Fix Rejection Demo

Problem:

The signature story needs a visible wrong fix losing.

Files:

- `demo_app`
- `dashboard/lib/live-run-resolution.ts`
- `tests/live-run-resolution.test.ts`
- `dashboard/app/live/[runId]/live-run-client.tsx`

Change:

- Add a tempting patch that passes a superficial check but fails the real concurrent proof.
- Show it in the decision ledger as rejected.
- Make the correct patch pass.

Acceptance:

- Demo line is true: "ReplayX shows why the wrong fix lost."

### P1.3 Build Eval Corpus

Problem:

Tests prove seeded happy paths, not diagnosis accuracy or false fix safety.

Files:

- `evals/`
- `scripts/eval-replayx.mjs`
- `tests/`

Each eval case:

- incident packet
- ground truth root cause
- accepted diagnosis files
- expected rejected theories
- failing-before command
- passing-after command
- allowed patch files
- forbidden patch patterns
- expected capability outcome

Acceptance:

- Eval report prints top-1 accuracy, top-3 accuracy, false validation rate, patch pass rate, handoff precision.

## P1: Memory Moat

### P1.4 Ship IncidentSkill v2

Problem:

Current skills are thin YAML and cannot guide safe execution.

Files:

- `skills/README.md`
- `orchestrator/phases/postmortem-and-skill.ts`
- `orchestrator/phases/skill-match.ts`
- `orchestrator/types.ts`

Add schema:

- metadata
- provenance
- positive match conditions
- negative match conditions
- evidence required
- diagnostic commands
- allowed files
- forbidden patch patterns
- verification commands
- known wrong fixes
- residual risk
- lifecycle
- eval score
- drift conditions

Acceptance:

- Phase 8 writes v2 skills.
- Phase 2 uses positive and negative signals.
- Existing v1 skills still load through compatibility.

### P1.5 Add Skill Lifecycle And Promotion Queue

Problem:

Memory should not be automatically trusted.

Lifecycle:

- draft
- canary
- proven
- deprecated

Promotion requires:

- sandbox proof
- reviewer approval
- eval pass
- service owner approval for production classes

Acceptance:

- Memory tab shows lifecycle, provenance, and confidence.
- Ops shows pending memory promotions.

## P1: Real Incident Intake

### P1.6 Build Raw Incident Intake

Problem:

Real customers will not send normalized fixtures.

Files:

- `orchestrator/normalize-incident.ts`
- `slack/src`
- `dashboard/lib/live-runs.ts`

Input:

- Slack text
- pasted logs
- stack traces
- service/repo/environment
- optional commands

Output:

- normalized incident bundle
- missing evidence list
- capability outcome

Acceptance:

- Raw Slack text can create a safe run or assisted handoff.
- Missing commands do not crash the flow.

## P2: Integrations

### P2.1 GitHub App Or Install Path

Goal:

Make PR preview and live PR mode understandable.

Add:

- PR mode label everywhere
- setup state
- branch push permissions
- artifact links
- reviewer instructions

### P2.2 Sentry Or Datadog Evidence Import

Goal:

Pull real production context without becoming an observability product.

Start with one:

- Sentry issue details, stack trace, release, suspect commit
- Datadog alert, dashboard link, logs query, service metadata

### P2.3 Incident Tool Export

Goal:

Send proof back to the system of record.

Targets:

- incident.io
- Rootly
- FireHydrant

Export:

- timeline summary
- validation proof
- postmortem
- PR link
- skill link

## Team Lanes

### Product

- Own category: incident proof engine.
- Kill vague AI SRE language.
- Define supported incident classes.
- Define capability labels.
- Shape design partner pilot.

### Design

- Promote proof objects.
- Remove generic cards.
- Compact workspace.
- Make validation authoritative.
- Make Ops a control room.
- Make Memory feel like a catalog.

### Engineering

- Shared proof engine.
- Codex patch worker.
- Eval harness.
- v2 skills.
- raw intake.
- policy controls.

### Growth

- Website rewrite.
- "Replay one real incident" CTA.
- Design partner landing page.
- Checkout race demo video.
- Public incident proof sample.

### Sales

- Book 10 calls.
- Run 3 historical incident pilots.
- Sell proof, not replacement.
- Track buyer objections.

### DevRel

- Publish "Why AI coding agents need incident proof."
- Publish "How ReplayX rejected the wrong fix."
- Publish eval scorecard when credible.
- Create local demo script with one command.

## Daily Build Loop

Use this loop until the P0 list is done:

1. Pick one P0 item.
2. Write acceptance criteria before editing.
3. Implement in the smallest surface.
4. Run narrow tests.
5. Run dashboard build if UI changed.
6. Capture gstack screenshot if UI changed.
7. Update docs if product truth changed.
8. Record open risk.

## Weekly Company Review

Every week, answer:

- Is the proof loop more real than last week?
- Did we remove one misleading claim?
- Did we make one unsupported class safer through handoff?
- Did memory get more executable?
- Did the demo become easier to understand?
- Did a buyer give us a real incident to replay?

## First 10 Tickets

1. Fix validation right-rail overlap.
2. Rewrite homepage H1/subhead/CTA.
3. Remove product pillars.
4. Add first-viewport incident tape.
5. Add run capability label.
6. Create `/setup` readiness screen.
7. Extract sandbox proof engine.
8. Add Codex patch worker feature flag.
9. Draft IncidentSkill v2 schema.
10. Add first eval corpus with current three classes.
