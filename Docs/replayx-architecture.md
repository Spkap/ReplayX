# ReplayX Architecture

ReplayX is a Codex-first incident response system. Its architecture reflects a single bet: the hard parts of incident response — reading a real codebase, proposing targeted fixes, verifying results — are software engineering tasks. Codex is the right engine for them.

---

## Stack

| Layer | Technology |
|---|---|
| **Orchestrator** | Node.js ≥ 24.0 + TypeScript + `@openai/codex-sdk` v0.121.0 |
| **Worker execution** | Codex SDK threads for repro and diagnosis workers, with deterministic local runners for challenger, fix, review, and artifact compilation |
| **Local automation** | Codex CLI (`codex exec`) for reproducible CI and scripted review passes |
| **Repo policy** | `AGENTS.md` — Codex reads this before starting any work |
| **Type system** | `orchestrator/types.ts` — canonical source of truth for all phase contracts |
| **Incident fixtures** | `incidents/` — strict `NormalizedIncident` JSON bundles |
| **Dashboard** | Next.js — live run streaming and replay visualization |
| **Intake** | Slack bot + REST API (`POST /api/replayx/runs`) |
| **Control plane** | SQLite-backed store at `.replayx-control-plane/` |
| **Artifact layer** | `artifacts/` — per-phase JSON and logs, replay-safe, fully on disk |

---

## Runtime Split

### Codex SDK — worker execution

ReplayX uses bounded Codex SDK threads where current code needs repo-aware reasoning: the optional repro worker and the six diagnosis arena workers. Challenger validation, fix strategy ranking, review/regression planning, and postmortem/skill writing are deterministic TypeScript runners in the current implementation.

```typescript
const thread = codex.startThread({
  workingDirectory: runtime.repoRoot,
  approvalPolicy: "never",
  sandboxMode: "read-only",
  model: runtime.defaultModel,               // default: "gpt-5-codex"
  modelReasoningEffort: "low",
  networkAccessEnabled: false,
  webSearchMode: "disabled"
});
const turn = await thread.run(prompt, { outputSchema });
```

Each Codex-backed thread is:
- **isolated** — one thread per worker per run
- **time-bounded** — `AbortController` timeout (repro: 30s, diagnosis: 45s by default)
- **sandboxed** — `read-only` for diagnosis workers
- **fallback-safe** — falls back to a deterministic local heuristic on timeout or failure

### Codex CLI — scripted automation

Use `codex exec` for:
- reproducible CI incident runs
- scripted local review passes
- prompt iteration against seeded incidents
- any automation requiring a full repo-aware shell session without the SDK thread model

### AGENTS.md — durable repo policy

Codex reads `AGENTS.md` before starting any work. This file carries architecture invariants, design rules, working rules, and prompt ownership. It is the stable contract between the repo and any Codex session.

---

## Phase Architecture

The orchestrator is a single TypeScript entrypoint at `orchestrator/main.ts`. Each phase is implemented in `orchestrator/phases/<phase-id>.ts` and exports a phase definition plus a runner:

```typescript
export const phaseDefinition: ReplayXPhaseDefinition = {
  id: "diagnosis-arena",
  label: "Diagnosis Arena",
  goal: "Fan out to six parallel Codex workers, each specializing in one failure domain.",
  requiredVerificationCommand: "tsx orchestrator/main.ts --phase diagnosis-arena incidents/<incident>.json",
  requiredOutputSchema: "phase.diagnosis-arena.json",
  artifactOutputs: ["phase.diagnosis-arena.json", "ranking.diagnosis-arena.log", "diagnosis-workers/*.json"],
  dependsOn: ["incident-intake", "skill-match", "repro"],
  status: "ready"
};
```

### Concurrency model

Diagnosis arena workers run with a configurable concurrency cap (`REPLAYX_MAX_PARALLEL_WORKERS`, default `4`). Workers beyond the cap queue rather than fail. The orchestrator uses a cooperative concurrency pool — no worker is dropped.

### Fallback guarantee

Every Codex-backed phase carries a deterministic local heuristic fallback. When `REPLAYX_USE_CODEX_DIAGNOSIS_WORKERS=0` or when a Codex SDK call times out, the phase produces the same artifact shape using pre-seeded logic. The golden run always completes.

---

## Data Flow

```
incidents/<id>.json
    │
    ▼
Phase 1: Incident Intake
    │   reads + validates against NormalizedIncident schema
    │   → artifacts/<id>/normalized_incident.json
    │   → artifacts/<id>/phase.incident-intake.json
    ▼
Phase 2: Skill Match
    │   scans skills/ and artifacts/ for matching .yaml files
    │   scoring: incident_class ×0.65 + service ×0.25 + id ×0.10
    │   records fast_path_available when score ≥ 0.85
    │   → artifacts/<id>/phase.skill-match.json
    ▼
Phase 3: Repro
    │   executes commands.failing and commands.healthy from the incident bundle
    │   optional Codex SDK worker summarizes failure surface
    │   verdict: confirmed | partially_confirmed | blocked
    │   → artifacts/<id>/phase.repro.json
    │   → artifacts/<id>/verification.repro.log
    ▼
Phase 4: Diagnosis Arena
    │   6 Codex workers fan out in parallel (cap: REPLAYX_MAX_PARALLEL_WORKERS)
    │   each worker: diagnosis + confidence + candidate_files + observations + falsification_note
    │   results ranked by composite score (status, confidence, class affinity, file overlap, observations, commands)
    │   → artifacts/<id>/diagnosis-workers/*.json
    │   → artifacts/<id>/phase.diagnosis-arena.json
    │   → artifacts/<id>/ranking.diagnosis-arena.log
    ▼
Phase 5: Challenger Validation
    │   adversarial checks over the ranked shortlist
    │   rejects: confidence < 0.5, no observations, insufficient class support
    │   → artifacts/<id>/phase.challenger-validation.json
    │   → artifacts/<id>/challenger-validation.log
    ▼
Phase 6: Fix Arena
    │   generates minimal_fix, safe_fix, durable_fix strategy objects
    │   each with: summary, files_changed, blast_radius, rollback_note, verification_command, score
    │   winner = highest-scored completed strategy
    │   → artifacts/<id>/phase.fix-arena.json
    │   → artifacts/<id>/fix-arena.log
    ▼
Phase 7: Review & Regression
    │   verdict: planned | blocked
    │   writes regression verification proof plan
    │   does not auto-execute code
    │   → artifacts/<id>/phase.review-and-regression.json
    │   → artifacts/<id>/verification.review.log
    ▼
Phase 8: Postmortem & Skill Write
    │   compiles postmortem.md
    │   writes skill.yaml → skills/<id>.yaml  (fed back to Phase 2)
    │   emits dashboard-replay.json, demo-script.json, slack-intake.json
    │   → artifacts/<id>/postmortem.md
    │   → artifacts/<id>/skill.yaml
    │   → artifacts/<id>/dashboard-replay.json
    │   → skills/<id>.yaml
```

---

## Skill Feedback Loop

Phase 8 writes `skills/<incidentId>.yaml` to the repository. Phase 2 scans both `skills/` and `artifacts/` on every subsequent run and scores the new incident against the catalog.

**Scoring weights:**

| Signal | Weight |
|---|---|
| `incident_class` match | 0.65 |
| `service` match | 0.25 |
| `id` exact match | 0.10 |

A total score ≥ 0.85 triggers `fast_path_available`. The current orchestrator records this in the Phase 2 artifact and continues through all phases. The flag is available for routing short-circuit logic in future versions.

This is a self-improving system: every incident that resolves through Phase 8 extends the skill catalog — no separate training or redeployment required.

---

## Dashboard Integration

The dashboard connects to the orchestrator over WebSockets for live runs. SSE is retained as a fallback transport.

**Live run connection path:**

1. Slack bot (or manual API) POSTs to `/api/replayx/runs`
2. Dashboard navigates to `/live/<runId>`
3. Orchestrator emits phase events as each phase completes
4. Dashboard renders each phase card in real time

**Replay path:**

The dashboard reads `artifacts/<incidentId>/dashboard-replay.json` directly — no live connection or runtime required. This is the stable, shareable proof surface.

### Routes

| Path | Access | Description |
|---|---|---|
| `/` | Public | Product entrance — featured proof run or latest validated incident |
| `/live/:runId` | Public | Live orchestrator run, streaming over WebSocket |
| `/incidents/:incidentId` | Public | Full replay page from precomputed artifacts |
| `/replay/:incidentId` | Public | Alias for replay — used in Slack and demo handoff links |
| `/ops` | Signed | Operator fleet view — active and recent runs |
| `/analytics` | Signed | Historical analytics across all runs |
| `/help/troubleshooting` | Public | Troubleshooting for signed links, archived runs, missing runs |

### Control-plane access semantics

- `/` is always public — the product entrance never requires operator credentials.
- Operator surfaces (`/ops`, `/analytics`, live workspaces, action pages) require a signed link when `REPLAYX_INTERNAL_API_TOKEN` is set.
- Run-scoped signed links do not silently escalate into root operator scope.
- **Archive** is a lifecycle state: archived runs leave the live fleet, remain readable, and count in historical analytics. Archived runs are read-only.

---

## Environment Variables

| Variable | Default | Effect |
|---|---|---|
| Codex/OpenAI auth | — | Required only for live Codex SDK worker execution. This repo does not read `OPENAI_API_KEY` directly. |
| `REPLAYX_CODEX_MODEL` | `gpt-5-codex` | Model used for all Codex SDK workers |
| `REPLAYX_USE_CODEX_REPRO_WORKER` | `1` | Set to `0` to skip Codex repro worker and use local heuristic |
| `REPLAYX_USE_CODEX_DIAGNOSIS_WORKERS` | `1` | Set to `0` to use deterministic fallbacks for all diagnosis workers |
| `REPLAYX_MAX_PARALLEL_WORKERS` | `4` | Concurrency cap for the diagnosis arena |
| `REPLAYX_CODEX_REPRO_TIMEOUT_MS` | `30000` | Timeout for the repro Codex worker (ms) |
| `REPLAYX_CODEX_DIAGNOSIS_TIMEOUT_MS` | `45000` | Timeout per diagnosis worker (ms) |
| `REPLAYX_INTERNAL_API_TOKEN` | — | Shared secret for signed operator links. Required in production dashboard startup. |
| `REPLAYX_REALTIME_VALIDATION_COMMAND` | auto-detected | Validation baseline command for fresh realtime incidents |
| `REPLAYX_SLACK_API_URL` | — | Dashboard-side base URL for posting final run updates back to the Slack service |
| `REPLAYX_GITHUB_PR_MODE` | `preview` | Set to `live` to push a branch and open a GitHub PR after review validation |

---

## Key Files

| File | Role |
|---|---|
| `orchestrator/main.ts` | Phase runner, CLI argument parsing, golden-run sequencer |
| `orchestrator/types.ts` | Canonical type system — every phase input and output is defined here |
| `orchestrator/normalize-incident.ts` | Strict incident bundle validation — throws before Phase 1 proceeds |
| `orchestrator/phases/incident-intake.ts` | Phase 1 implementation |
| `orchestrator/phases/skill-match.ts` | Phase 2 implementation — reads `skills/` and `artifacts/` |
| `orchestrator/phases/repro.ts` | Phase 3 implementation — executes commands, calls optional Codex worker |
| `orchestrator/phases/diagnosis-arena.ts` | Phase 4 implementation — 6 workers, concurrency pool, ranking |
| `orchestrator/phases/challenger-validation.ts` | Phase 5 implementation — adversarial gates, class profiles |
| `orchestrator/phases/fix-arena.ts` | Phase 6 implementation — strategy templates, scoring, winner selection |
| `orchestrator/phases/review-and-regression.ts` | Phase 7 implementation — verdict, proof plan |
| `orchestrator/phases/postmortem-and-skill.ts` | Phase 8 implementation — skill write, artifact compilation |
| `orchestrator/prompts/diagnosis-arena.ts` | Diagnosis worker prompt templates and output schemas |
| `incidents/` | Seeded `NormalizedIncident` fixture bundles |
| `skills/` | Reusable skill YAML artifacts (read by Phase 2, written by Phase 8) |
| `artifacts/` | Per-run phase outputs — written at runtime |

---

## Implementation Status

All 8 phases are implemented for explicit fixture/eval runs. Fresh Slack/API/manual incidents now enter realtime investigation mode by default: ReplayX captures validation, source-search, and recent-change evidence, then stops before claiming a PR-ready fix until a bounded Codex patch worker validates code changes.

| Phase | Status | Mode |
|---|---|---|
| 1 — Incident Intake | ✅ | Deterministic TypeScript validation |
| 2 — Skill Match | ✅ | Deterministic scoring against `skills/` and `artifacts/` catalogs |
| 3 — Repro | ✅ | Live command execution + optional Codex SDK worker |
| 4 — Diagnosis Arena | ✅ | Up to 6 Codex SDK workers with deterministic fallback |
| 5 — Challenger Validation | ✅ | Deterministic adversarial gates with class affinity profiles |
| 6 — Fix Arena | ✅ | Seeded strategy templates, deterministic scoring and ranking |
| 7 — Review & Regression | ✅ | Deterministic verdict and verification proof plan |
| 8 — Postmortem & Skill Write | ✅ | Deterministic artifact compilation + skill catalog write |

Fix and review logic is seeded for the three bundled launch classes. Extending to new incident classes requires adding a strategy template to `orchestrator/phases/fix-arena.ts` and a class profile to `orchestrator/phases/challenger-validation.ts`. See [replayx-incident-authoring-guide.md](./replayx-incident-authoring-guide.md) for the complete step-by-step guide.
