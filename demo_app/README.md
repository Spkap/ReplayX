# ReplayX Target App

An intentionally broken Node.js application. It exists to give the ReplayX orchestrator a real, running codebase to read, command, and diagnose.

This is not example code. The bugs are real and seeded deliberately — each one maps to an incident class in the fixture registry.

---

## Purpose

The target app serves three roles:

1. **Repro target** — the orchestrator executes `commands.failing` and `commands.healthy` from each incident fixture against this app to confirm the bug before any diagnosis begins
2. **Codebase for Codex workers** — diagnosis workers read actual source files here to find candidate root causes
3. **Direct inspection surface** — engineers can hit the app directly at `http://127.0.0.1:4311` to see the broken behavior before triggering a ReplayX run

---

## Start

```bash
pnpm demo-app
# → http://127.0.0.1:4311
```

---

## Routes

| Route | Description |
|---|---|
| `GET /` | Lists all available routes |
| `GET /health` | Health check — `{ ok: true }` |
| `GET /api/repro/checkout-race?mode=concurrent` | Concurrent checkout — triggers the oversell bug |
| `GET /api/repro/checkout-race?mode=serial` | Sequential checkout — healthy path |
| `GET /api/repro/auth-refresh?idleMinutes=<n>` | Auth refresh scenario — `idleMinutes` ≥ 20 triggers the failure |
| `GET /checkout/summary?fixture=missing-taxes` | Null data shape — renders a page with a missing field |
| `GET /checkout/summary?fixture=complete-quote` | Complete quote — healthy render path |

---

## Seeded Bugs

| Bug | Route | Incident class |
|---|---|---|
| **Checkout race condition** — concurrent orders oversell the same SKU | `/api/repro/checkout-race?mode=concurrent` | `checkout-race-condition` |
| **Auth token session failure** — stale token accepted mid-flow | `/api/repro/auth-refresh?idleMinutes=30` | `auth-token-session-failure` |
| **Null data shape** — `taxes` field arrives `null`, downstream crashes | `/checkout/summary?fixture=missing-taxes` | `null-data-shape-failure` |

---

## Repro Scripts

These scripts are what the orchestrator runs during Phase 3 (Repro):

```bash
# Checkout race — concurrent (expected: exits 1)
pnpm tsx demo_app/scripts/repro-checkout-race.ts

# Checkout race — serial healthy path (expected: exits 0)
pnpm tsx demo_app/scripts/repro-checkout-race.ts --serial

# Auth refresh failure
pnpm tsx demo_app/scripts/repro-auth-refresh.ts

# Null data shape failure
pnpm tsx demo_app/scripts/repro-null-shape.ts
```

Or use the named pnpm shortcuts from the repo root:

```bash
pnpm demo-app:checkout-race
pnpm demo-app:auth-refresh
pnpm demo-app:null-shape
```

---

## Source Layout

```
demo_app/
├── server.ts              ← HTTP server entry point (port 4311)
├── src/
│   ├── checkout/          ← submit-order.ts — the race-condition bug lives here
│   ├── inventory/         ← reserve-stock.ts — non-atomic reservation write
│   ├── queue/             ← checkout-worker.ts — async worker that races with the handler
│   ├── auth/              ← token refresh path — stale session bug
│   ├── orders/
│   ├── middleware/
│   ├── routes/            ← order-summary.ts — null field rendering
│   └── types.ts
└── scripts/
    ├── repro-checkout-race.ts
    ├── repro-auth-refresh.ts
    └── repro-null-shape.ts
```

The bugs are in `src/checkout/submit-order.ts`, `src/inventory/reserve-stock.ts`, `src/queue/checkout-worker.ts`, and `src/routes/order-summary.ts`. Do not fix them — they are the repro surface.
