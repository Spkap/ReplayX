# Demo App

ReplayX uses this intentionally buggy Node.js application to prove the diagnosis and fix loop.

The repro scripts run real commands against this app during Phase 3 (Repro) so the orchestrator can confirm bugs are real, not hypothetical.

## Stack

- Node.js + TypeScript
- Native `node:http` server (no web framework, no database)

## Start

```bash
pnpm demo-app
```

Default base URL: `http://127.0.0.1:4311`

## Endpoints

| Route | Purpose |
|---|---|
| `GET /health` | Liveness check |
| `GET /api/repro/checkout-race?mode=concurrent\|serial` | Triggers the inventory race condition |
| `GET /api/repro/auth-refresh?idleMinutes=30` | Triggers the token refresh bug |
| `GET /checkout/summary?fixture=missing-taxes\|complete-quote` | Triggers the null shape bug |

## Incident Mapping

| Incident | Buggy files | What breaks |
|---|---|---|
| `incident-checkout-race-001` | `src/checkout/submit-order.ts`<br>`src/inventory/reserve-stock.ts`<br>`src/queue/checkout-worker.ts` | Stale inventory snapshot before async delay — concurrent orders drive inventory negative |
| `incident-auth-session-002` | `src/auth/refresh-session.ts`<br>`src/auth/token-store.ts`<br>`src/middleware/require-session.ts` | Idle-session refresh reuses expired access token instead of rotating a new one |
| `incident-null-shape-003` | `src/orders/quote-adapter.ts`<br>`src/orders/build-summary.ts`<br>`src/routes/order-summary.tsx` | Null `taxes` array from upstream passed to `.reduce()` without normalization |

## Repro Commands

```bash
pnpm demo-app:checkout-race
pnpm demo-app:auth-refresh -- --idle-minutes 30
pnpm demo-app:null-shape -- --fixture missing-taxes
```

These are also the `commands.failing` values inside the incident fixture JSON files.
