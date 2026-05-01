# Incident Authoring

This guide explains how to add a new fixture/eval incident class to ReplayX.

Fresh realtime incidents do not require fixtures. This guide is for extending the deterministic end-to-end pipeline.

## What You Need To Add

| Area | Path | Purpose |
| --- | --- | --- |
| Incident fixture | `incidents/<id>.json` | Normalized incident evidence and repro commands. |
| Diagnosis signal | `orchestrator/phases/diagnosis-arena.ts` | Local heuristic/fallback support for the incident class. |
| Challenger profile | `orchestrator/phases/challenger-validation.ts` | Class affinity and validation expectations. |
| Fix strategies | `orchestrator/phases/fix-arena.ts` | `minimal_fix`, `safe_fix`, and `durable_fix` templates. |
| Repro target | `demo_app/` or another target repo | Failing and healthy commands that prove the bug surface. |
| Tests | `tests/` | Contract or behavior tests for the new class. |

Phase 8 writes `skills/<id>.yaml` and `artifacts/<id>/skill.yaml` automatically after a successful golden run.

## Step 1: Create The Fixture

Create `incidents/<id>.json`. The object must match `NormalizedIncident` in `orchestrator/types.ts` and pass `orchestrator/normalize-incident.ts`.

Minimum shape:

```json
{
  "schemaVersion": 1,
  "incidentId": "incident-example-001",
  "title": "Short human-readable title",
  "incidentClass": "checkout-race-condition",
  "service": "checkout-api",
  "environment": "staging",
  "severity": "sev-2",
  "repoRoot": "demo_app",
  "summary": {
    "symptom": "What the user or operator sees.",
    "customerImpact": "What business behavior is broken.",
    "firstObservedAt": "2026-04-01T12:00:00Z",
    "customerVisible": true
  },
  "suspectedFiles": ["demo_app/src/path/to/file.ts"],
  "evidence": {
    "stackTraces": [],
    "logs": [],
    "metrics": []
  },
  "commands": {
    "failing": {
      "label": "failing repro",
      "command": "tsx demo_app/scripts/repro-example.ts",
      "workingDirectory": ".",
      "expectedExitCode": 1
    },
    "healthy": {
      "label": "healthy control",
      "command": "tsx demo_app/scripts/repro-example.ts --healthy",
      "workingDirectory": ".",
      "expectedExitCode": 0
    }
  },
  "recentChanges": [],
  "constraints": ["Do not weaken the healthy control."],
  "acceptanceCriteria": ["Failing command exits 0 after the fix."]
}
```

## Step 2: Add Repro Commands

The failing command should exit non-zero before the fix. The healthy command should exit zero.

For the bundled target app, place scripts in `demo_app/scripts/` and keep them deterministic. Avoid timing-sensitive repros unless the incident class is explicitly about timing or concurrency.

## Step 3: Extend Diagnosis

Update `orchestrator/phases/diagnosis-arena.ts` so local fallback mode can still produce the same output shape if Codex is unavailable.

Each diagnosis worker output must include:

- worker id
- specialty
- diagnosis
- confidence
- observations
- commands inspected
- candidate files
- falsification note
- status

Do not add a diagnosis path that can win without concrete observations.

## Step 4: Extend Challenger Validation

Update `orchestrator/phases/challenger-validation.ts` with the class support rules needed to reject weak theories. The challenger should prefer evidence density and file overlap over confident prose.

## Step 5: Add Fix Strategies

Update `orchestrator/phases/fix-arena.ts` with three bounded strategies:

| Strategy | Expectation |
| --- | --- |
| `minimal_fix` | Smallest targeted change. |
| `safe_fix` | Best balance of safety and verification confidence. |
| `durable_fix` | Structural improvement when the broader change is justified. |

Each strategy must include changed files, verification command, rollback note, risk note, and score.

## Step 6: Run Verification

```bash
pnpm golden-run incidents/<id>.json
pnpm test
```

If the dashboard replay should be checked:

```bash
pnpm dev:all
# open http://localhost:3001/replay/<incidentId>
```

## Acceptance Checklist

- [ ] Fixture validates.
- [ ] Failing command fails before the fix path.
- [ ] Healthy command passes.
- [ ] Diagnosis workers produce bounded, typed output.
- [ ] Challenger can reject weak candidates.
- [ ] Fix arena produces three strategies.
- [ ] Review/regression phase names the proof command.
- [ ] Phase 8 writes postmortem, replay bundle, and skill artifacts.
- [ ] `pnpm test` passes.
