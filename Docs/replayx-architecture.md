# ReplayX Architecture

ReplayX is a Codex-first incident response system. Its architecture reflects one central bet: that the hard parts of incident response — reading a real codebase, proposing targeted fixes, verifying results — are fundamentally software-engineering tasks. Codex is the right engine for them.

---

## Stack

| Layer | Technology |
|---|---|
| **Orchestrator** | Node.js + TypeScript + `@openai/codex-sdk` |
| **Worker execution** | Codex SDK threads, one per bounded specialist |
| **Local automation** | Codex CLI (`codex exec`) for reproducible CI and scripted review |
| **Repo policy** | `AGENTS.md` — Codex reads this before working |
| **Incident fixtures** | `incidents/` — strict `NormalizedIncident` JSON bundles |
| **Dashboard** | Next.js — live run + replay visualization |
| **Intake** | Slack bot + REST API |
| **Control plane** | SQLite-backed store at `.replayx-control-plane/` |
| **Artifact layer** | `artifacts/` — per-phase JSON and logs, replay-safe |

---

## Why Codex

ReplayX is not a conversational product. The problems it solves are engineering problems:

- reading real repository context and suspecting the right files
- running shell commands and interpreting exit codes
- proposing code changes that target the actual failure surface
- verifying that a fix addresses the incident without breaking the healthy path
- writing reusable knowledge artifacts from a resolved run

These are Codex-native tasks. The Codex SDK provides repo-aware execution, structured thread management, and sandboxed command dispatch — exactly what each ReplayX phase needs.

---

## Runtime Split

### Codex SDK — worker execution

Every diagnosis, challenger, fix, and repro worker runs as a bounded Codex SDK thread:

```typescript
const thread = codex.startThread({
  workingDirectory: runtime.repoRoot,
  approvalPolicy: "never",
  sandboxMode: "read-only",
  model: runtime.defaultModel,
  modelReasoningEffort: "low",
  networkAccessEnabled: false,
  webSearchMode: "disabled"
});
const turn = await thread.run(prompt, { outputSchema });
```

Each worker is isolated, time-bounded, and falls back to a deterministic local heuristic if Codex is unavailable.

### Codex CLI — scripted automation

Use `codex exec` for:

- reproducible CI incident runs
- scripted local review passes
- prompt iteration against seeded incidents
- any automation that needs a full repo-aware shell session without the SDK thread model

### AGENTS.md — durable repo policy

Codex reads `AGENTS.md` before starting any work. This file carries:

- architecture invariants
- design rules
- working rules
- prompt ownership

---

## Phase Architecture

The orchestrator is a single TypeScript entrypoint at `orchestrator/main.ts`. Each phase is implemented in `orchestrator/phases/<phase-id>.ts` and follows the same contract:

```typescript
export const phaseDefinition: ReplayXPhaseDefinition = {
  id: "...",
  label: "...",
  goal: "...",
  requiredVerificationCommand: "...",
  requiredOutputSchema: "...",
  artifactOutputs: [...],
  dependsOn: [...],
  status: "ready"
};
```

The golden run executes all 8 phases sequentially and writes the full artifact set. Individual phases can be invoked directly through `--phase <id>` for development and verification.

### Concurrency model

Diagnosis arena workers run with a configurable concurrency limit (`REPLAYX_MAX_PARALLEL_WORKERS`, default `4`). The orchestrator uses a cooperative concurrency pool — workers beyond the limit queue rather than fail.

### Fallback model

Every Codex-backed phase carries a deterministic local heuristic fallback. If the Codex SDK call times out, fails, or is disabled via `REPLAYX_USE_CODEX_DIAGNOSIS_WORKERS=0`, the phase produces the same artifact shape using pre-seeded logic. This guarantees that the golden run always completes, even without a live Codex connection.

---

## Data Flow

```
incidents/<id>.json
    │
    ▼
Phase 1: Incident Intake         → normalized_incident.json
    │
    ▼
Phase 2: Skill Match             → phase.skill-match.json
    │                              (scores against skills/ catalog)
    ▼
Phase 3: Repro                   → phase.repro.json, verification.repro.log
    │                              (run failing + healthy commands)
    ▼
Phase 4: Diagnosis Arena         → phase.diagnosis-arena.json
    │                              (6 Codex workers, ranked shortlist)
    ▼
Phase 5: Challenger Validation   → phase.challenger-validation.json
    │                              (adversarial checks, reject weak candidates)
    ▼
Phase 6: Fix Arena               → phase.fix-arena.json
    │                              (minimal · safe · durable strategies, winner by score)
    ▼
Phase 7: Review & Regression     → phase.review-and-regression.json
    │                              (planned or blocked verdict, verification plan)
    ▼
Phase 8: Postmortem & Skill      → postmortem.md, skill.yaml, dashboard-replay.json,
                                   demo-script.json, slack-intake.json
    │
    ├── skills/<id>.yaml          (fed back to Phase 2 on future runs)
    └── artifacts/<id>/           (full replay artifact set for dashboard)
```

---

## Skill Feedback Loop

Phase 8 writes `skills/<incidentId>.yaml` to the repository. Phase 2 scans `skills/` on every subsequent run and scores the new incident against the catalog using service name, incident class, and incident ID.

Scoring weights:

| Signal | Weight |
|---|---|
| `incident_class` match | 0.65 |
| `service` match | 0.25 |
| `id` exact match | 0.10 |

A total score of 0.85 or above triggers `fast_path_available`. The current orchestrator records this in the Phase 2 artifact and continues through all phases. The flag is available for routing logic in future versions.

---

## Dashboard Integration

The dashboard connects to the orchestrator over WebSockets for live runs. The connection path:

1. Slack bot POSTs to `/api/replayx/runs`
2. Dashboard opens `/live/<runId>`
3. Orchestrator emits phase events as it advances
4. Dashboard renders each phase card in real time

For the replay path, the dashboard reads `artifacts/<incidentId>/dashboard-replay.json` directly — no live connection required.

### Control-plane semantics

- `/` is the public, proof-first entrance.
- `/ops`, `/analytics`, live incident workspaces, and action pages are operator surfaces when `REPLAYX_INTERNAL_API_TOKEN` is enabled.
- Run-scoped and workspace-scoped signed links do not silently escalate into root operator scope.
- Archive is a read-only lifecycle state: archived runs leave the live fleet, remain readable, and still count in historical analytics.
- Local troubleshooting guidance lives at `/help/troubleshooting`.

---

## Environment Variables

| Variable | Default | Effect |
|---|---|---|
| `REPLAYX_CODEX_MODEL` | `gpt-5-codex` | Model used for all Codex SDK workers |
| `REPLAYX_USE_CODEX_REPRO_WORKER` | `1` | Set to `0` to use local heuristic for repro |
| `REPLAYX_USE_CODEX_DIAGNOSIS_WORKERS` | `1` | Set to `0` to use deterministic fallbacks for all diagnosis workers |
| `REPLAYX_MAX_PARALLEL_WORKERS` | `4` | Concurrency cap for diagnosis arena |
| `REPLAYX_INTERNAL_API_TOKEN` | — | Shared secret for dashboard run creation API |
| `REPLAYX_GITHUB_PR_MODE` | `preview` | Set to `live` to allow ReplayX to push a branch and open a GitHub PR after validation |

---

## Implementation Status

All 8 phases are implemented and the golden path runs end to end:

| Phase | Status | Mode |
|---|---|---|
| 1 — Incident Intake | ✅ | Deterministic |
| 2 — Skill Match | ✅ | Deterministic scoring against `skills/` |
| 3 — Repro | ✅ | Live command execution + optional Codex SDK worker |
| 4 — Diagnosis Arena | ✅ | 6 Codex SDK workers with deterministic fallback |
| 5 — Challenger Validation | ✅ | Deterministic adversarial gates |
| 6 — Fix Arena | ✅ | Seeded strategy templates, deterministic ranking |
| 7 — Review & Regression | ✅ | Deterministic verdict and verification plan |
| 8 — Postmortem & Skill Write | ✅ | Deterministic artifact compilation |

Fix and review logic is seeded to the three bundled incident classes (`checkout-race-condition`, `auth-token-session-failure`, `null-data-shape-failure`). Extending to new incident classes requires adding a strategy template to `orchestrator/phases/fix-arena.ts` and an incident fixture to `incidents/`. See [`Docs/replayx-incident-authoring-guide.md`](./replayx-incident-authoring-guide.md) for the step-by-step guide.

---

## Key Files

| File | Role |
|---|---|
| `orchestrator/main.ts` | Phase runner and CLI entry point |
| `orchestrator/types.ts` | Canonical type system for all phases and artifacts |
| `orchestrator/normalize-incident.ts` | Strict incident bundle validation |
| `orchestrator/phases/` | One file per phase |
| `orchestrator/prompts/diagnosis-arena.ts` | Diagnosis worker prompt templates |
| `incidents/` | Seeded incident fixture bundles |
| `skills/` | Reusable skill artifacts read by Phase 2 |
| `artifacts/` | Per-run phase outputs (written at runtime) |
