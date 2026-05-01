# Skills Catalog

Reusable incident skills written by Phase 8 of the ReplayX orchestrator.

---

## What a Skill Is

A skill is a compact YAML artifact produced at the end of every successfully resolved incident. It captures the winning diagnosis worker, the fix strategy that was selected, and the match signals that identify the incident class.

Phase 2 (Skill Match) reads every file in this directory at the start of each new run and scores it against the incoming incident. A match score ≥ 0.85 triggers `fast_path_available` — the orchestrator knows this pattern has been resolved before.

This is the self-improving loop: every incident that runs through Phase 8 extends the catalog. No separate training step required.

---

## Scoring

| Signal | Weight |
|---|---|
| `incident_class` match | 0.65 |
| `service` match | 0.25 |
| `id` exact match | 0.10 |

Total score ≥ 0.85 → `fast_path_available: true` in the Phase 2 artifact.

---

## Skill Format

```yaml
id: incident-checkout-race-001
title: Checkout confirms orders before inventory reservation settles
match:
  service: checkout-api
  incident_class: checkout-race-condition
  winning_worker: diagnosis_concurrency
fix_strategy: safe_fix
operator_summary: Best balance of safety and clarity among the proposed fixes.
```

| Field | Description |
|---|---|
| `id` | Matches `incidentId` from the original incident fixture |
| `title` | Human-readable incident title |
| `match.service` | Service the incident occurred in — used in scoring |
| `match.incident_class` | Incident class — heaviest scoring signal |
| `match.winning_worker` | Which diagnosis worker identified the root cause |
| `fix_strategy` | Selected fix strategy: `minimal_fix`, `safe_fix`, or `durable_fix` |
| `operator_summary` | One-line rationale for the selected strategy |

---

## Included Skills

| File | Incident | Winning worker | Fix strategy |
|---|---|---|---|
| `incident-checkout-race-001.yaml` | Checkout race condition | `diagnosis_concurrency` | `safe_fix` |
| `incident-auth-session-002.yaml` | Auth token session failure | `diagnosis_auth` | `safe_fix` |
| `incident-null-shape-003.yaml` | Null data shape failure | `diagnosis_data_shape` | `safe_fix` |

---

Skills are written automatically at Phase 8 completion — do not edit them by hand. To add a new incident class:

See [Docs/INCIDENT_AUTHORING.md](../Docs/INCIDENT_AUTHORING.md).
