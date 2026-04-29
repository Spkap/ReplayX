# ReplayX 100M Company Game Plan

Reviewed April 24, 2026, Asia/Kolkata.

This is the stronger strategy artifact. It combines repo audit, rendered product dogfooding, six parallel subagent reviews, and current online market research.

## The One Decision

ReplayX should not be an "AI incident management" company.

That phrase drops ReplayX into a crowded market where incident.io, Rootly, FireHydrant, PagerDuty, Datadog, Sentry, Harness, Resolve, Cleric, and others already claim AI investigation, incident coordination, summaries, and remediation.

ReplayX should be:

> The incident proof engine for engineering teams using coding agents.

The customer-facing line:

> ReplayX investigates production bugs, proves the fix, and remembers the pattern.

Everything in the product should make that sentence feel true.

## Why Now

The market is ready because two things are colliding:

1. Coding agents are becoming normal.
2. Production trust is not keeping up.

OpenAI's long-horizon Codex writeup frames the shift clearly: agentic coding is increasingly about time horizon, feedback loops, durable project memory, and verification, not one-shot answers. METR's time-horizon work shows task-completion horizons have been increasing fast, with a rough seven-month doubling trend in their 2025 analysis. GitHub Copilot cloud agent now works in a background environment, researches repos, makes branches, runs tests, and prepares pull requests. Sentry Seer, Datadog Bits AI SRE, and incident.io AI SRE are all pushing from production signals toward root cause and fix suggestions.

That creates the opening for ReplayX:

> Teams will use coding agents near incidents, but they need a proof layer before they trust agent-generated production fixes.

## The Company

ReplayX should own the post-alert, pre-merge trust layer.

Incident tools coordinate the room. Observability tools show telemetry. Coding agents can write code. ReplayX should sit between them and answer:

- What failed?
- Can we reproduce it?
- Which theories are weak?
- Which fix is safest?
- What proof says it works?
- What risk remains?
- What should we remember for next time?

The core loop:

```text
Incident signal
-> normalized incident bundle
-> repro proof
-> ranked diagnosis
-> rejected wrong theories
-> bounded patch strategy
-> sandbox validation
-> PR preview or PR
-> postmortem
-> executable incident skill
```

The north-star metric is not MTTR alone.

The north-star metric is:

> Time to trustworthy proof.

Supporting metrics:

- diagnosis top-1 and top-3 accuracy
- false fix rate
- validation pass rate
- handoff precision
- skill reuse precision
- recurrence reduction
- time from incident report to validated PR preview

## Market Map

| Segment | Players | They Own | ReplayX Stance |
|---|---|---|---|
| Incident coordination | incident.io, Rootly, FireHydrant | Slack/Teams rooms, roles, timelines, comms, postmortems | Integrate, do not replace |
| Paging and AIOps | PagerDuty, Opsgenie, Datadog | alert routing, event correlation, noise reduction | Integrate as signal input |
| Observability-native AI SRE | Datadog Bits AI SRE, Sentry Seer | telemetry, traces, issue context, code-change correlation | Compete only where proof must leave the observability UI |
| Code agents | Codex, GitHub Copilot cloud agent, Cursor, Claude Code, Devin | generic repo tasks, branches, PRs, tests | Use as execution substrate and partner |
| AI code review | CodeRabbit, Copilot review | PR review, static/code reasoning, review comments | Integrate into review gate |
| AI SRE startups | Resolve, Cleric, RunWhen, RunbookAI, Ciroos | autonomous investigation, runbooks, remediation | Differentiate on replayable proof and capability boundaries |
| Service catalogs | Backstage, OpsLevel, Datadog software catalog | ownership, lifecycle, service metadata | Use as context and routing input |

The strongest adjacent threats:

- incident.io AI SRE, because it has distribution inside the incident room and claims investigation, code-change context, past incidents, and PR creation.
- Datadog Bits AI SRE, because it is telemetry-native and can learn from investigations inside the observability graph.
- Sentry Seer, because it is close to the "error -> root cause -> code change" loop for application exceptions.
- GitHub Copilot cloud agent, because it can already research repos, run tests, and prepare PRs in a GitHub environment.

ReplayX wins only if it is more specific than all of them:

> We do not manage the incident. We prove the repair.

## What ReplayX Must Not Build

Do not compete in:

- on-call scheduling
- paging, SMS, escalation policies
- status pages
- stakeholder communications
- generic incident timelines
- alert ingestion and deduplication
- telemetry storage
- generic PR review
- generic service catalog
- broad infrastructure remediation

Those are large markets, but they are not ReplayX's wedge.

## The Wedge

The first paid product should be:

> Replay one real incident.

Design partner offer:

> Give ReplayX three historical production bugs. ReplayX will replay them, show what it can diagnose, show what it refuses, produce proof artifacts, and turn repeatable patterns into incident skills.

Why this works:

- It avoids pretending ReplayX can solve every incident on day one.
- It uses real customer pain, not generic demos.
- It creates a before/after sales artifact.
- It turns customer incidents into memory and evals.
- It makes proof the buyer conversation.

The target design partner should say:

> I wish we had this during the real incident.

## Product Truth

What is real today:

- The 8-phase artifact pipeline is implemented and runnable.
- Repro executes failing and healthy commands.
- Diagnosis can use bounded Codex SDK workers with deterministic fallback.
- The live dashboard can apply seeded patches in a sandbox and run validation.
- Capability-limited mode stops unmatched incidents before patching.
- Slack, live workspace, Ops, Analytics, artifacts, and signed actions exist.

What is seeded today:

- Full automation is limited to three launch classes.
- Live incident matching is a small keyword catalog.
- Fix Arena emits static templates by class.
- Live patching uses hardcoded patch functions.
- CLI Phase 7 emits a plan, not executed patch proof.
- Skill memory is thin YAML.

This is not bad. It is exactly the right prototype shape. But the product must tell the truth:

> ReplayX is capability-bounded. It fully automates validated classes, and routes everything else to assisted handoff with evidence.

The worst possible mistake is to claim general autonomous incident resolution before the proof loop exists.

## Product Taste Standard

ReplayX should feel like:

- a calm staff engineer
- an incident black box recorder
- a proof ledger
- a code-aware review gate
- a memory system that gets sharper every time

ReplayX should not feel like:

- a chatbot
- a generic AI SRE mascot
- a marketing dashboard
- a card grid
- a hackathon demo
- a fake autonomy wrapper

The product rule:

> Evidence before confidence. Proof before patch. Refusal before reckless autonomy. Memory before dashboards.

## Surface Review

### Homepage

Current issue:

The homepage has a strong visual mood, but the headline is internal: "Show the evidence first. Open the operator surfaces second." That describes access architecture, not customer pain. The first viewport spends too much space on a manifesto and not enough on the actual incident tape.

Browser evidence:

- `/tmp/replayx-overnight-home.png`
- `/tmp/replayx-overnight-home-responsive2-mobile.png`
- `/tmp/replayx-overnight-home-responsive2-desktop.png`

What to do:

- Make the first viewport a live incident tape.
- Replace internal framing with a direct customer promise.
- Remove "Product pillars."
- Stop using "Three surfaces, one product."
- Put proof, rejected theories, validation, PR, and memory in the first scroll.

Recommended H1:

> Investigate production bugs. Prove the fix. Remember the pattern.

Recommended subhead:

> ReplayX turns a Slack incident report into a defended diagnosis, safe fix strategy, regression proof, postmortem, and reusable incident skill.

Recommended first viewport:

```text
Slack report
-> Repro confirmed
-> Wrong theory rejected
-> Fix selected
-> Validation passed
-> PR preview ready
-> Skill written
```

Primary CTA:

> Replay one real incident

Secondary CTA:

> Watch the checkout race replay

### Live Workspace

Current issue:

The live workspace is the best product surface, but it hides the best product truth below a huge hero card. On the rendered validation tab, the right rail overlaps: "Fast facts" visually covers the next-action card and partially hides actions.

Browser evidence:

- `/tmp/replayx-overnight-live-overview.png`
- `/tmp/replayx-overnight-live-annotated.png`
- `/tmp/replayx-overnight-live-validation.png`
- `/tmp/replayx-overnight-live-validation-annotated.png`

What to do:

- Compress the incident hero by 40 percent.
- Add a sticky phase rail: Intake, Repro, Diagnosis, Challenge, Fix, Validate, PR, Memory.
- Move validation and rejected theories above the first fold.
- Make the current blocker, proof state, PR state, and handoff state readable in under five seconds.
- Fix the right-rail layout overlap before doing any more polish.

Recommended H1:

> ReplayX is proving this incident.

Not:

> ReplayX owns this incident.

The second version sounds confident, but too declarative before trust has been earned.

### Validation

Current issue:

Validation says "verified" and shows two commands, but it does not yet feel like the strongest screen in the product. This screen should be the authority.

What to show:

- failing command before patch
- passing command after patch
- healthy control command
- exit codes
- duration
- diff link
- PR preview link
- residual risk
- why this proof is sufficient
- why it may still be incomplete

The validation screen should be where a skeptical staff engineer relaxes.

### Diagnosis

Current issue:

The rejected theories exist, which is excellent. But they read like a supporting section. They should be a signature product object.

What to show:

- winning theory
- confidence evolution
- evidence that moved confidence
- rejected theories
- reason each theory lost
- missing evidence
- next diagnostic command if confidence is low

The demo should emphasize:

> ReplayX rejected the tempting wrong fix.

That is the killer story.

### Patch

Current issue:

Patch strategy is still a direction, not a true agent-produced diff in the core CLI path.

What to do:

- Keep the three-strategy arena.
- Add a bounded Codex patch worker.
- Let patch candidates compete on proof, not wording.
- Require exact diff and command transcript.
- Keep seeded templates as fixtures and baseline evals, not as product truth.

### Ops

Current issue:

Ops looks tasteful, but still like KPI cards plus lists. It should feel like a fleet control room.

What to show:

- active runs by phase
- blocked runs by reason
- capability-limited handoffs
- approval queue
- validation failures
- run age
- service owner
- repo
- next action
- PR preview/live PR state

Recommended H1:

> Live incident fleet.

### Analytics

Current issue:

Analytics has the right categories, but the surface is still card-heavy. It should feel like an operating review.

What to show:

- validation rate over time
- false validation rate
- handoff reasons
- skill reuse precision
- time to proof distribution
- recurring services
- incident class coverage
- Codex patch pass rate
- operator intervention rate

Avoid vanity metrics unless there is proof behind them.

### Memory

Current issue:

Memory is the moat, but the current skill artifact is too thin.

The product should make memory feel like a service catalog for incident patterns.

Skill v2 should include:

- positive match signals
- negative match signals
- required evidence
- diagnostic commands
- patch preconditions
- allowed files
- forbidden patch patterns
- validation commands
- known wrong fixes
- residual risk
- owner and service metadata
- provenance from a verified run
- eval score
- reuse history
- drift conditions

Memory lifecycle:

```text
draft -> canary -> proven -> deprecated
```

Promotion requires:

- sandbox proof
- reviewer approval
- eval pass
- service owner approval for production class skills

### Onboarding

Current issue:

A first-time operator needs docs and curl commands to start a live run. The product needs an in-app readiness path.

Build `/setup`.

Checklist:

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

This screen turns the demo from a fragile operator ritual into a product.

## Engineering Roadmap

### 0 to 14 Days: Make The Product Honest And Sharp

Goal:

Make the current product feel serious without pretending it is more general than it is.

Ship:

- homepage rewrite around the direct product promise
- live workspace right-rail overlap fix
- compact live workspace hero
- validation authority panel
- setup/readiness screen
- capability labels on every run
- copy pass removing internal architecture language
- docs pass aligning `OPENAI_API_KEY`, Codex auth, PR preview, and Slack setup

Capability label examples:

- `seeded_template_validated`
- `codex_patch_candidate`
- `manual_handoff`
- `validated_pr_preview`
- `live_pr_created`

Acceptance criteria:

- A new visitor understands ReplayX in under two minutes.
- A new operator can start a demo run without reading the runbook.
- The UI never implies unsupported incidents are fully automated.

### 30 Days: Close The Proof Loop

Goal:

Make one incident class move from seeded patch to bounded Codex patch candidate.

Ship:

- shared Phase 7 sandbox proof engine used by CLI and dashboard
- Codex patch worker behind a feature flag
- exact diff artifact
- before/after command transcript
- residual risk artifact
- skill v2 draft schema
- blind eval fixtures for the three current classes
- "wrong fix rejected" demo path

Acceptance criteria:

- One class can produce a Codex-generated patch in an isolated sandbox.
- The run records exact commands, outputs, exit codes, and diff.
- The UI can distinguish seeded baseline from Codex patch candidate.
- A deliberately tempting wrong patch fails validation and is shown as rejected.

### 60 Days: Survive Pilot Data

Goal:

ReplayX handles messy inputs and creates useful memory from real incidents.

Ship:

- raw incident intake from Slack text, logs, stack traces, service, repo, environment
- Sentry or Datadog evidence import for one class
- GitHub PR preview install path
- v2 executable skills
- skill match with positive and negative signals
- queue idempotency class
- cache stale read class
- eval dashboard

Acceptance criteria:

- A design partner can submit two historical incidents.
- ReplayX can normalize them into incident bundles with clear handoff when evidence is missing.
- Skills improve routing on repeated or similar incidents.

### 90 Days: Earn The Category

Goal:

Be credible as the incident proof engine for a narrow but valuable set of production bug classes.

Ship:

- 6 to 8 deeply tested incident classes
- repo policy and command safety controls
- service ownership integration
- Slack + GitHub + one incident tool export
- eval scorecards
- skill lifecycle and drift detection
- design partner report format
- sales-ready demo using one real or realistic incident replay

Acceptance criteria:

- ReplayX has public-ish scorecards for supported classes.
- A buyer understands exactly what is automated, what is assisted, and what is refused.
- The product has a strong "before ReplayX / after ReplayX" story.

## Incident Class Expansion

Prioritize classes where local proof is crisp and the buyer pain is common:

1. Queue retry/idempotency duplicate side effect.
2. Cache invalidation or stale read after write.
3. Database transaction or locking anomaly.
4. Deploy regression from recent commit.
5. API/client schema drift.
6. Auth refresh variant with multi-device/session boundary.
7. Feature flag rollback mismatch.
8. Background job partial failure.

Each class needs:

- fixture
- failing command
- healthy control
- wrong-fix test
- diagnosis profile
- patch worker baseline
- validation commands
- v2 skill
- eval cases

Do not add classes unless the class can produce proof.

## Eval Harness

Create `evals/` with cases shaped like:

```text
incident packet
ground truth root cause
accepted diagnosis files
expected rejected theories
failing-before command
passing-after command
allowed patch files
forbidden patch patterns
expected capability outcome
```

Adversarial sets:

- noisy logs
- misleading recent change
- wrong suspected file
- broken repro command
- near-match class
- repeated incident with skill available
- unsupported incident that must hand off

Metrics:

- top-1 diagnosis accuracy
- top-3 diagnosis accuracy
- rejected-theory correctness
- false validation rate
- patch pass rate
- healthy-control preservation
- skill-match precision
- skill-match recall
- false fast-path rate
- handoff precision
- median time to proof

This is sales collateral, engineering discipline, and product trust.

## GTM Plan

### ICP

Start with:

- 20 to 200 engineer B2B SaaS, fintech, commerce, devtools, infra SaaS, or AI app companies
- Slack and GitHub heavy
- uses Datadog, Sentry, PagerDuty, incident.io, Rootly, or FireHydrant
- has recurring production bug classes
- uses or is adopting Codex, Cursor, Copilot, Claude Code, or similar agents
- has enough test/repro culture to make proof possible

Avoid:

- huge regulated enterprise as first buyer
- tiny teams with no incident process
- infra-only incidents with no code path
- teams with no tests or commands

### Buyer

Economic buyer:

- CTO
- VP Engineering
- Head of Platform
- Head of SRE
- DevEx lead

Champion:

- staff engineer
- senior on-call engineer
- incident commander
- platform lead

### Sales Motion

Founder-led, proof-first.

1. Book pain interviews.
2. Ask for one recent incident where the fix was uncertain.
3. Offer a replay pilot.
4. Run ReplayX in read-only or sandbox mode.
5. Show diagnosis, rejected theories, patch path, proof, postmortem, skill.
6. Convert when the buyer wants it for the next incident.

### Design Partner Offer

Name:

> ReplayX Incident Proof Pilot.

Duration:

> 6 weeks.

Price:

> 10k to 15k fixed, or 3k to 5k per month for early design partners.

Includes:

- 2 historical incident replays
- 1 live or synthetic incident drill
- Slack + GitHub integration
- one telemetry source
- PR preview mode
- custom skill artifacts
- final reliability report

Guarantee:

> If ReplayX cannot produce at least one useful defended diagnosis or reusable skill from your real incidents, the pilot is free.

### Calls To Book

Book these 10 calls:

1. CTO at a 30 to 100 engineer B2B SaaS company with weekly Sev2s.
2. VP Eng at a commerce or marketplace company with checkout/payment/inventory incidents.
3. Head of Platform at a fintech using Datadog, Sentry, and GitHub.
4. SRE lead at a Series B/C company using PagerDuty plus Slack.
5. Engineering manager who owns postmortems.
6. DevEx lead rolling out coding agents internally.
7. Senior backend engineer who is frequently on call.
8. Incident commander at a team using incident.io or Rootly.
9. Security or infra leader worried about AI-generated production changes.
10. Founder/CTO of an AI product company whose agents create new reliability risks.

Questions:

- Tell me about the last incident where the fix was uncertain.
- What proof did you need before merging?
- What did the postmortem fail to prevent next time?
- Where did Slack archaeology cost time?
- Would you pay if ReplayX replayed that incident and produced reusable proof?

## Pricing

Do not price like incident management seats.

ReplayX is a proof engine, not the incident room.

Early packages:

- Design Partner: 10k to 15k for 6 weeks.
- Startup: 1.5k per month, 3 protected services, 10 proof runs per month.
- Growth: 4k per month, 10 protected services, 50 proof runs per month, Slack/GitHub/Sentry or Datadog.
- Enterprise: 10k to 20k per month, custom controls, self-hosted or isolated worker mode, audit logs, policy gates, retention.

Meter by:

- protected services
- validated proof runs
- private runner controls
- custom incident classes
- retention and policy controls

Do not meter by:

- every alert
- every Slack message
- every responder seat

## Objections

### We already use incident.io, Rootly, FireHydrant, or PagerDuty.

Good. ReplayX should integrate with them. They coordinate the incident. ReplayX proves the repair.

### Datadog or Sentry already has AI.

They are strongest inside telemetry and issue context. ReplayX owns cross-tool, repo-local proof: repro, rejected theories, patch strategy, regression proof, and reusable skills.

### We can just use Codex or Cursor directly.

Individual agents help one engineer. ReplayX gives the team an auditable incident workflow with bounded workers, challenger validation, artifacts, policy, and memory.

### We do not trust AI with production.

Correct. ReplayX starts in PR preview and proof mode. It does not need auto-merge to be valuable.

### It only handles a few classes.

That is the right early product. ReplayX should be honest about supported classes and expand through validated incident memory.

### How do we know it is not making things up?

No proof, no claim. ReplayX must show evidence, commands, diffs, rejected theories, and residual risk.

## The Launch Demo

The demo should be the checkout race condition, but framed like a real production story.

Script:

1. A Slack report arrives: checkout is overselling inventory when two users buy at the same time.
2. ReplayX opens a live workspace.
3. Repro confirms the failure.
4. Diagnosis workers disagree.
5. Challenger rejects the wrong theory.
6. Fix Arena selects a minimal patch strategy.
7. Validation runs failing and healthy commands.
8. ReplayX prepares a PR preview.
9. Postmortem is written.
10. Skill is promoted.
11. A similar future incident routes faster because the skill exists.

The key line:

> ReplayX does not just find the fix. It shows why the wrong fix lost.

## What To Kill Now

Kill:

- "AI incident management" as category language.
- "autonomous incident resolution" as the near-term claim.
- homepage architecture narration.
- "Product pillars."
- equal-card dashboard rhythm where operating surfaces are needed.
- "Golden Replay" vs "Trusted Replay" naming drift.
- hackathon/demo language in product-facing docs.
- radial ornamental blobs.
- negative letter spacing.
- seeded behavior hidden behind production claims.
- thin skill artifacts.

## Big Product Ideas

1. Wrong Fix Theatre: show a tempting patch fail validation before the right patch passes.
2. Similar Incident Tape: show previous incidents with proof links.
3. Known Wrong Fixes: memory of rejected fixes and why they failed.
4. Proof Ledger: command, exit code, artifact, owner, timestamp.
5. Capability Badge: every run says what autonomy level it used.
6. Incident Class Coverage Map: what ReplayX can fully handle today.
7. Service Memory Page: service-specific incident patterns and skills.
8. Skill Drift Alerts: mark skills stale when files/owners/commands change.
9. PR Confidence Packet: a review bundle attached to every generated PR.
10. Handoff Composer: when ReplayX refuses, it drafts exactly what the human needs.
11. Design Partner Importer: turn three historical incidents into draft skills and evals.
12. Proof Replay Link: a shareable artifact for postmortems and leadership.
13. Runbook-To-Skill Converter: turn stale runbooks into executable incident skills.
14. Service Owner Policy: which teams can approve which skills and PR modes.
15. Agent Review Arena: CodeRabbit/Copilot/Codex review of the proposed patch bundle.
16. Incident Coverage Score: percentage of incidents covered by proven skills.
17. Memory Promotion Queue: approve generated skills with diffs.
18. Near-Miss Router: "similar but not safe to fast-path."
19. Eval Scorecard: class-level trust metrics for buyers.
20. ReplayX Drill Mode: run a synthetic incident to test team and tooling readiness.

## Company Narrative

AI made code generation fast. It did not make production safer.

ReplayX is the proof layer between coding agents and production incidents.

It turns an incident from a high-pressure guess into a replayable engineering record:

- what failed
- what evidence mattered
- what theories were rejected
- what fix was safest
- what proof passed
- what risk remained
- what the team should remember next time

That is the company.

## Sources

- [incident.io AI SRE](https://incident.io/ai-sre)
- [incident.io Investigations](https://docs.incident.io/ai/investigations)
- [Rootly AI](https://docs.rootly.com/ai/ai)
- [FireHydrant AI incident management](https://docs.firehydrant.com/docs/ai-powered-incident-management)
- [PagerDuty AIOps](https://www.pagerduty.com/platform/aiops/)
- [Datadog Bits AI SRE](https://www.datadoghq.com/product/ai/bits-ai-sre/)
- [Sentry Seer](https://docs.sentry.io/product/issues/issue-details/sentry-ai/)
- [GitHub Copilot cloud agent](https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent)
- [CodeRabbit](https://www.coderabbit.ai/)
- [Harness AI SRE](https://www.harness.io/products/ai-sre)
- [OpenAI Codex SDK](https://developers.openai.com/codex/sdk)
- [OpenAI long-horizon Codex run](https://developers.openai.com/blog/run-long-horizon-tasks-with-codex)
- [OpenAI Codex agent loop](https://openai.com/index/unrolling-the-codex-agent-loop/)
- [OpenAI Codex Skills](https://developers.openai.com/codex/skills)
- [OpenAI Codex Worktrees](https://developers.openai.com/codex/app/worktrees)
- [METR time horizons](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/)
- [METR task-completion FAQ](https://metr.org/time-horizons/)
- [AIDev coding-agent PR study](https://arxiv.org/abs/2602.09185)
- [Google SRE postmortem culture](https://sre.google/sre-book/postmortem-culture/)
- [Backstage catalog descriptor format](https://backstage.io/docs/features/software-catalog/descriptor-format/)
