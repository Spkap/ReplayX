# Incident Authoring Guide

How to add a new incident class to ReplayX — from fixture to diagnosis to fix strategy.

---

## Overview

Each incident class travels through the full 8-phase pipeline. To support a new class end to end you need to touch four places:

1. `incidents/<id>.json` — the normalized incident fixture
2. `orchestrator/phases/diagnosis-arena.ts` — heuristic signal for each diagnosis worker
3. `orchestrator/phases/challenger-validation.ts` — class affinity profile
4. `orchestrator/phases/fix-arena.ts` — fix strategy templates

The `skills/<id>.yaml` and all artifacts under `artifacts/` are generated automatically on the first golden run.

---

## Step 1 — Write the Incident Fixture

Create `incidents/<your-incident-id>.json`. The file must pass strict validation in `orchestrator/normalize-incident.ts`. Every key is required unless noted.

```json
{
  "schemaVersion": 1,
  "incidentId": "your-incident-id",
  "title": "Short human-readable title",
  "incidentClass": "your-incident-class",
  "service": "your-service-name",
  "environment": "production",
  "severity": "sev-2",
  "repoRoot": "demo_app",
  "summary": {
    "symptom": "One sentence describing what the user sees.",
    "customerImpact": "What business function is broken.",
    "firstObservedAt": "2026-04-01T12:00:00Z",
    "customerVisible": true
  },
  "suspectedFiles": [
    "demo_app/src/path/to/suspected-file.ts"
  ],
  "evidence": {
    "stackTraces": [
      {
        "source": "service-name",
        "errorType": "TypeError",
        "message": "Cannot read properties of null",
        "frames": [
          {
            "file": "demo_app/src/path/to/file.ts",
            "line": 42,
            "column": 5,
            "function": "functionName"
          }
        ]
      }
    ],
    "logs": [
      {
        "source": "service-name",
        "observedAt": "2026-04-01T12:00:01Z",
        "level": "error",
        "message": "Detailed log message describing the failure.",
        "context": {
          "key": "value"
        }
      }
    ],
    "metrics": [
      {
        "name": "error_rate",
        "unit": "percent",
        "value": 12.4,
        "observedAt": "2026-04-01T12:00:00Z",
        "baselineValue": 0.1
      }
    ]
  },
  "commands": {
    "failing": {
      "label": "Failing scenario label",
      "command": "tsx demo_app/scripts/repro-your-incident.ts",
      "workingDirectory": ".",
      "expectedExitCode": 1
    },
    "healthy": {
      "label": "Healthy scenario label",
      "command": "tsx demo_app/scripts/repro-your-incident.ts --healthy",
      "workingDirectory": ".",
      "expectedExitCode": 0
    }
  },
  "recentChanges": [
    {
      "commit": "abc1234",
      "summary": "Short description of the change that likely introduced the bug.",
      "author": "engineer@example.com",
      "mergedAt": "2026-03-30T09:00:00Z",
      "files": [
        "demo_app/src/path/to/changed-file.ts"
      ]
    }
  ],
  "constraints": [
    "Do not modify unrelated services.",
    "Fix must not add latency to the healthy path."
  ],
  "acceptanceCriteria": [
    "The failing command exits 1 before the fix and 0 after.",
    "The healthy command exits 0 before and after the fix."
  ]
}
```

### Validation rules

- `incidentClass` must be one of the registered classes in `orchestrator/types.ts` — add your new class there first.
- `environment` must be `development`, `staging`, or `production`.
- `severity` must be `sev-1`, `sev-2`, `sev-3`, or `sev-4`.
- `evidence.stackTraces`, `evidence.logs`, `evidence.metrics`, and `recentChanges` must each contain at least one entry.
- `commands.failing.expectedExitCode` must be non-zero. `commands.healthy.expectedExitCode` must be `0`.

### Test validation locally

```bash
tsx orchestrator/main.ts --phase incident-intake incidents/your-incident-id.json
```

---

## Step 2 — Register the Incident Class

Open `orchestrator/types.ts` and add your class to `replayXIncidentClasses`:

```typescript
export const replayXIncidentClasses = [
  "checkout-race-condition",
  "auth-token-session-failure",
  "null-data-shape-failure",
  "your-new-incident-class"          // ← add here
] as const;
```

---

## Step 3 — Add Diagnosis Heuristics

Open `orchestrator/phases/diagnosis-arena.ts` and find `deriveLocalHeuristicOutput`. Each `case` block corresponds to one diagnosis worker's heuristic for one incident class.

For `diagnosis_concurrency` (for example), add a `case "your-new-incident-class"` branch:

```typescript
case "diagnosis_concurrency": {
  // existing cases...
  // Add detection logic based on evidenceText and combinedSource:
  const strongSignal =
    matchesAny(evidenceText, ["your", "evidence", "keywords"]) &&
    matchesAny(combinedSource, ["yourFunctionName", "yourVariable"]);

  if (strongSignal) {
    return {
      worker: worker.id,
      specialty: worker.specialtyName,
      diagnosis: "Precise one-sentence root cause statement.",
      confidence: 0.95,
      observations: [
        "Observation 1 citing specific code or log output.",
        "Observation 2."
      ],
      commands_run: commandsRun,
      candidate_files: pickCandidateFiles(focusFiles, [
        "demo_app/src/path/to/relevant-file.ts"
      ]),
      falsification_note: "What evidence would disprove this theory.",
      status: "completed"
    };
  }

  // weak signal fallback — always provide one
  return { ..., confidence: 0.15, status: "weak_signal" };
}
```

Repeat for any other workers that have relevant detection logic for your class. Workers without a strong signal for your class should return `weak_signal` naturally since their generic fallback handles it.

---

## Step 4 — Add a Challenger Class Profile

Open `orchestrator/phases/challenger-validation.ts` and add your class to `classProfiles`:

```typescript
"your-new-incident-class": {
  preferredWorker: "diagnosis_concurrency",    // worker most suited to this class
  supportingWorkers: {
    diagnosis_database: 0.72,
    diagnosis_state_handoff: 0.65
  },
  keywords: [
    "keyword1", "keyword2", "mechanism-term"   // terms present in strong diagnoses
  ]
}
```

The `preferredWorker` will receive the highest class-support score. Supporting workers get partial credit. Any worker not listed gets a baseline score of 0.12.

---

## Step 5 — Add Fix Strategy Templates

Open `orchestrator/phases/fix-arena.ts` and find `selectFixStrategyOutputs`. Add a `case "your-new-incident-class"` block returning three strategy objects:

```typescript
case "your-new-incident-class":
  return [
    {
      strategy: "minimal_fix",
      status: "completed",
      summary: "Smallest targeted change description.",
      files_changed: ["demo_app/src/path/to/file.ts"],
      verification_command: verificationCommand,
      verification_result: "Verification plan: apply this patch and confirm the failing command now exits 0.",
      blast_radius: "low",
      rollback_note: "How to revert.",
      risk_note: "What risk remains after this fix.",
      score: 0.82,
      demo_summary: "One sentence for the demo card."
    },
    {
      strategy: "safe_fix",
      status: "completed",
      summary: "Broader change that adds a guard or normalizes state.",
      files_changed: ["demo_app/src/a.ts", "demo_app/src/b.ts"],
      // ...
      score: 0.93
    },
    {
      strategy: "durable_fix",
      status: "completed",
      summary: "Structural change for long-term correctness.",
      files_changed: ["demo_app/src/a.ts", "demo_app/src/b.ts", "demo_app/src/c.ts"],
      // ...
      blast_radius: "medium",
      score: 0.87
    }
  ];
```

Score guidelines:
- The highest-scored completed strategy wins.
- `safe_fix` typically scores highest — it has the best balance of clarity and verification confidence.
- `durable_fix` should score lower than `safe_fix` unless it is provably safer.

---

## Step 6 — Write the Repro Script

Create `demo_app/scripts/repro-<your-incident-id>.ts` that exits `1` on the failing path and `0` on the healthy path. Keep it self-contained.

Wire the relevant endpoint into `demo_app/server.ts` if the incident needs an HTTP trigger.

---

## Step 7 — Run the Pipeline

```bash
# Verify each phase in order
tsx orchestrator/main.ts --phase incident-intake    incidents/your-incident-id.json
tsx orchestrator/main.ts --phase skill-match        incidents/your-incident-id.json
tsx orchestrator/main.ts --phase repro              incidents/your-incident-id.json
tsx orchestrator/main.ts --phase diagnosis-arena    incidents/your-incident-id.json
tsx orchestrator/main.ts --phase challenger-validation incidents/your-incident-id.json

# Run the full golden path
pnpm golden-run incidents/your-incident-id.json
```

Check `artifacts/your-incident-id/` for phase outputs. Verify that:

- Phase 3 repro is `confirmed` (not `blocked`)
- Phase 4 surfaces your intended worker as rank 1 or 2
- Phase 5 challenger accepts your preferred worker as the winner
- Phase 6 fix arena selects `safe_fix` as the winner
- Phase 8 writes `skills/your-incident-id.yaml` to disk

---

## Checklist

- [ ] `orchestrator/types.ts` — new class registered in `replayXIncidentClasses`
- [ ] `incidents/your-incident-id.json` — fixture validates without error
- [ ] `orchestrator/phases/diagnosis-arena.ts` — heuristic blocks added for relevant workers
- [ ] `orchestrator/phases/challenger-validation.ts` — class profile added to `classProfiles`
- [ ] `orchestrator/phases/fix-arena.ts` — three fix strategy templates added
- [ ] `demo_app/scripts/` — repro script exits correctly on failing and healthy paths
- [ ] `pnpm golden-run` completes without errors
- [ ] `skills/your-incident-id.yaml` exists after the golden run
