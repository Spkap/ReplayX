# Skills

Reusable ReplayX skill artifacts.

## What Skills Are

A skill is a machine-readable pattern that the Skill Match phase (Phase 2) uses to detect known incident classes. When a skill scores above the 0.85 threshold against the current incident, the phase outputs `fast_path_available`. In the current golden-run orchestrator this flag is recorded in the artifact but all phases still run. Future orchestrator versions can use the flag to short-circuit.

This is the feedback loop: every incident that completes Phase 8 writes a new skill, improving Skill Match coverage for future incidents.

## Skill Artifacts

| File | Incident class | Written by |
|---|---|---|
| `incident-checkout-race-001.yaml` | `checkout-race-condition` | Phase 8 golden run |
| `incident-auth-session-002.yaml` | `auth-token-session-failure` | Phase 8 golden run |
| `incident-null-shape-003.yaml` | `null-data-shape-failure` | Phase 8 golden run |

## Format

Skills are written by `buildSkillYaml()` in `orchestrator/phases/postmortem-and-skill.ts`. Field reference:

```yaml
id: incident-checkout-race-001
title: Checkout confirms orders before inventory reservation settles
match:
  service: checkout-api
  incident_class: checkout-race-condition
  winning_worker: diagnosis_concurrency
fix_strategy: safe_fix
demo_summary: Best balance of safety and clarity among the proposed fixes.
```

The `match.service` and `match.incident_class` fields are what Skill Match reads to score a new incident against the catalog. A score above `0.85` triggers the `fast_path_available` decision.


## Storage

The canonical skill copy lives here in `skills/`. Each phase run also writes a per-incident copy to `artifacts/<incidentId>/skill.yaml` for audit trail purposes.

## Reference

- Phase that writes skills: `orchestrator/phases/postmortem-and-skill.ts`
- Phase that reads skills: `orchestrator/phases/skill-match.ts`
