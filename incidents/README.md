# Incident Fixtures

Seeded incident bundles for the ReplayX hackathon demo.

## Supported Incident Classes

| File | Class | Key failure domain |
|---|---|---|
| `checkout-race-condition.json` | `checkout-race-condition` | Concurrent stock reservation; non-atomic read-write |
| `auth-token-session-failure.json` | `auth-token-session-failure` | Token refresh timing; session state handoff |
| `null-data-shape-failure.json` | `null-data-shape-failure` | Null field propagation; schema contract violation |

## Usage

Pass any fixture to the orchestrator as the incident input:

```bash
# Run the full golden path
pnpm golden-run incidents/checkout-race-condition.json

# Run a single phase
tsx orchestrator/main.ts --phase repro incidents/checkout-race-condition.json
```

## Format

Each fixture is a normalized JSON file following the `NormalizedIncident` contract defined in `orchestrator/types.ts`. Top-level fields:

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | `1` | Always literal `1` |
| `incidentId` | string | Unique slug used for artifact directories |
| `title` | string | Human-readable title |
| `incidentClass` | enum | One of the three supported classes |
| `service` | string | Service name (used in skill scoring) |
| `environment` | enum | `development` \| `staging` \| `production` |
| `severity` | enum | `sev-1` through `sev-4` |
| `repoRoot` | string | Path to the target repo (`.` = project root) |
| `summary.symptom` | string | One-line customer-visible description |
| `summary.customerImpact` | string | Business-level impact |
| `summary.firstObservedAt` | ISO datetime | When the incident surfaced |
| `summary.customerVisible` | boolean | Whether end users are affected |
| `suspectedFiles` | string[] | Files most likely to contain the bug |
| `evidence.stackTraces` | array | Each trace: `source`, `errorType`, `message`, `frames[]` |
| `evidence.logs` | array | Log excerpts with `source`, `level`, `message`, `context` |
| `evidence.metrics` | array | Metric snapshots with `name`, `value`, `unit` |
| `commands.failing` | object | `label`, `command`, `workingDirectory`, `expectedExitCode` (must be non-zero) |
| `commands.healthy` | object | Same shape; expected exit code `0` |
| `recentChanges` | array | `commit`, `summary`, `author`, `mergedAt`, `files[]` |
| `constraints` | string[] | What the fix must not do |
| `acceptanceCriteria` | string[] | What "fixed" means |

These fixtures are validated strictly by `orchestrator/normalize-incident.ts` at runtime. Any missing or extra key throws an error before the orchestrator proceeds.
