# ReplayX Deferred Work

This file now tracks only the work that is still intentionally deferred after the control-plane hardening and follow-up DX passes on `main` (2026-04-22).

Completed from the original `/autoplan` backlog:

- shared featured-proof selector + cross-surface proof consistency
- archive as a read-only lifecycle
- historical analytics truth preserved after archive
- `pnpm dev:all` and no-Slack quickstart
- standardized operator-facing troubleshooting copy and `/help/troubleshooting`
- proof-first docs cleanup and migration notes

## P3

### Real identity/session model for operator surfaces

- What: replace broad signed-link operator access with a real identity/session boundary when ReplayX moves beyond demo-stage use.
- Why: root-scope query-parameter access is tactical, not durable.
- Pros: revocation, better auditability, safer multi-user operation.
- Cons: much larger product and implementation scope.
- Context: CEO and Eng reviews both accepted the current approach as a bridge, not as a destination.
- Effort: L/XL (human) -> M/L with Codex + gstack
- Priority: P3
- Depends on / blocked by: proving the current product wedge is worth scaling
