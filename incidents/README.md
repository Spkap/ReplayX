# Incident Fixtures

Validated incident bundles for the ReplayX fixture registry. Each fixture is a structured JSON file that fully describes a production-style incident — the evidence, the repro commands, the recent changes, and the acceptance criteria for a fix.

The orchestrator reads a fixture to start any run. Nothing needs a live monitoring system or a real production environment.

---

## Included Incidents

| File | Class | What it tests |
|---|---|---|
| `checkout-race-condition.json` | `checkout-race-condition` | Concurrent stock reservation; non-atomic read-write |
| `auth-token-session-failure.json` | `auth-token-session-failure` | Token refresh timing; session state handoff |
| `null-data-shape-failure.json` | `null-data-shape-failure` | Null field propagation; schema contract violation |

---

## Usage

```bash
# Run the full golden path against an incident
pnpm golden-run incidents/checkout-race-condition.json

# Run a single phase
tsx orchestrator/main.ts --phase repro incidents/checkout-race-condition.json
```

---

## Fixture Format

Each fixture is a normalized JSON file following the `NormalizedIncident` contract in `orchestrator/types.ts`. Strictly validated by `orchestrator/normalize-incident.ts` before the orchestrator proceeds.

| Field | Type | Description |
|---|---|---|
| `schemaVersion` | `1` | Always literal `1` |
| `incidentId` | string | Unique slug — used for artifact directories and skill IDs |
| `title` | string | Human-readable incident title |
| `incidentClass` | enum | One of the three registered classes |
| `service` | string | Service name — used in skill match scoring |
| `environment` | enum | `development` \| `staging` \| `production` |
| `severity` | enum | `sev-1` through `sev-4` |
| `repoRoot` | string | Path to the target repo (`.` = project root, `demo_app/` for demo incidents) |
| `summary.symptom` | string | One-line customer-visible description |
| `summary.customerImpact` | string | Business-level impact |
| `summary.firstObservedAt` | ISO datetime | When the incident surfaced |
| `summary.customerVisible` | boolean | Whether end users are affected |
| `suspectedFiles` | string[] | Files most likely to contain the bug |
| `evidence.stackTraces` | array | Each trace: `source`, `errorType`, `message`, `frames[]` |
| `evidence.logs` | array | Log excerpts with `source`, `level`, `message`, `context` |
| `evidence.metrics` | array | Metric snapshots with `name`, `value`, `unit`, `baselineValue` |
| `commands.failing` | object | `label`, `command`, `workingDirectory`, `expectedExitCode` (must be non-zero) |
| `commands.healthy` | object | Same shape; `expectedExitCode: 0` |
| `recentChanges` | array | `commit`, `summary`, `author`, `mergedAt`, `files[]` |
| `constraints` | string[] | What the fix must not do |
| `acceptanceCriteria` | string[] | What "fixed" means |

Any missing or extra key throws before the orchestrator proceeds.

---

## Adding a New Incident Class

See [Docs/INCIDENT_AUTHORING.md](../Docs/INCIDENT_AUTHORING.md).
