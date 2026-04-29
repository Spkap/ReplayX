# ReplayX Dashboard

Next.js incident workspace and control-plane UI for ReplayX.

---

## What It Does

The dashboard serves two distinct surfaces:

**Live runs** — when a Slack mention, manual form, or API call triggers an incident run, the dashboard opens `/live/:runId` and streams phase-by-phase updates from the orchestrator over WebSockets (SSE retained as fallback transport). Fresh incident text enters realtime investigation mode by default; seeded fixtures run only when an explicit fixture id is supplied.

**Replay** — precomputed artifacts from a golden run power `/replay/:incidentId`. No live connection required. This is the stable, shareable proof surface — useful for demos, postmortem reviews, and training.

The homepage (`/`) is the product entrance: it starts or resumes real incident work first, then keeps the fixture/eval lab clearly labeled as a test surface.

---

## Routes

| Path | Access | Description |
|---|---|---|
| `/` | Public | Product entrance — featured proof run or latest validated incident |
| `/new` | Signed in production | Manual realtime incident creation |
| `/live/:runId` | Public | Live orchestrator run — phase updates stream over WebSocket |
| `/incidents/:incidentId` | Public | Full replay page from precomputed artifacts |
| `/replay/:incidentId` | Public | Alias for explicit fixture/eval replays |
| `/ops` | Signed | Operator fleet view — active runs, run actions, archive |
| `/analytics` | Signed | Historical analytics across all resolved runs |
| `/help/troubleshooting` | Public | Signed-link troubleshooting, archived runs, missing runs, local stack setup |

### Signed links

When `REPLAYX_INTERNAL_API_TOKEN` is set:

- `/ops`, `/analytics`, live incident workspaces, and action pages require a signed `?access=<token>` query parameter.
- `/` stays public — the product entrance never requires operator credentials.
- Run-scoped signed links do not silently escalate into root operator scope.

---

## Data Sources

The dashboard reads from two places at runtime:

- `artifacts/` (repo root) — replay bundles, phase outputs, postmortems
- `incidents/` (repo root) — launch incident metadata for the proof surface

For live runs, it also connects to the orchestrator WebSocket at the configured URL.

---

## Archive Semantics

Archiving a terminal run:
- removes it from the live fleet board
- keeps it readable in `/analytics` and the historical record
- makes it **read-only** — no further actions on an archived run

---

## Local Dev

```bash
cd dashboard
pnpm install
pnpm dev -- --port 3001
```

| Route | URL |
|---|---|
| Homepage | `http://localhost:3001/` |
| New live incident | `http://localhost:3001/new` |
| Fixture replay (after golden run) | `http://localhost:3001/replay/incident-checkout-race-001` |
| Live run | `http://localhost:3001/live/<runId>` |
| Incident workspace | `http://localhost:3001/workspaces/<workspaceId>/incidents/<runId>` |
| Troubleshooting | `http://localhost:3001/help/troubleshooting` |

Live runs are created by posting to `/api/replayx/runs`:

```bash
curl -s -X POST http://localhost:3001/api/replayx/runs \
  -H 'content-type: application/json' \
  --data '{"source":"manual","text":"checkout is overselling stock during concurrent orders"}'
```

If `REPLAYX_INTERNAL_API_TOKEN` is set, add `-H "authorization: Bearer ${REPLAYX_INTERNAL_API_TOKEN}"`. Then open the returned `incidentWorkspacePath` or `livePath`.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `REPLAYX_INTERNAL_API_TOKEN` | Production | Signs operator links and enforces auth on `/ops`, `/analytics`, live workspaces, and action pages |
| `REPLAYX_REALTIME_VALIDATION_COMMAND` | No | Validation baseline command for fresh realtime incidents |
| `REPLAYX_SLACK_API_URL` | No | Lets the dashboard post final run updates back to the Slack service |
| `REPLAYX_GITHUB_PR_MODE` | No | Set to `live` to allow PR creation; default is `preview` (bundle only) |
