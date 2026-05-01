# ReplayX

**Proof engine for coding-agent incident repair.**

Coding agents can write code. That is no longer the hard part. The hard part is trust — in production, "the agent says it fixed it" is not enough. ReplayX is the trust layer: it runs a disciplined, evidence-gated incident repair loop and makes every step inspectable and replayable.

---

## How It Works

A bug report enters as a Slack mention, API call, or manual form submission. ReplayX runs a deterministic 8-phase pipeline:

```
Intake → Skill match → Repro → Diagnosis arena → Challenger validation → Fix arena → Review & regression → Postmortem & skill write
```

At every phase boundary, a strict JSON artifact is written to disk. No opaque agent traces. No unverified fix claims.

**The diagnosis arena** fans out 6 bounded Codex workers in parallel — each owns one failure domain (concurrency, auth, data shape, recent change, database, state handoff). Workers produce evidence citations and a falsification note. Weak theories are rejected by adversarial challenger gates before a fix path is selected.

**The fix arena** produces three bounded strategies (minimal, safe, durable). Each includes changed files, a verification command, a rollback note, and a score. The winning strategy must pass the regression proof plan before the run closes.

**Phase 8** writes a postmortem, a replayable artifact bundle, and a `skill.yaml` — closing the feedback loop. The next similar incident finds it in Phase 2.

Full phase reference: [`PIPELINE.md`](PIPELINE.md)

---

## Run Modes

| Mode | Trigger | What happens |
|---|---|---|
| **Realtime investigation** | Fresh Slack/API/manual text | Validates, searches source, captures recent changes, writes an evidence packet. Stops before claiming an unvalidated patch. |
| **Fixture/eval pipeline** | Explicit fixture `incidentId` or `pnpm golden-run` | Runs all 8 phases for a bundled incident class. Writes full artifact set including replay bundle and skill. |

---

## Quickstart

**Requirements:** Node.js ≥ 24, pnpm ≥ 10. Codex/OpenAI auth only if you want live Codex workers.

```bash
# Install
pnpm install
pnpm --dir dashboard install
npm --prefix slack install

# Start (target app + dashboard)
pnpm dev:all
```

| Service | URL |
|---|---|
| Target app | `http://127.0.0.1:4311` |
| Dashboard | `http://localhost:3001` |

**Create a realtime incident:**

```bash
curl -s -X POST http://localhost:3001/api/replayx/runs \
  -H 'content-type: application/json' \
  --data '{"source":"manual","text":"checkout is overselling stock during concurrent orders"}'
```

Open the returned `livePath` in your browser.

**Run the full fixture/eval pipeline:**

```bash
pnpm golden-run incidents/checkout-race-condition.json
# open http://localhost:3001/replay/incident-checkout-race-001
```

---

## Repository Layout

```
ReplayX/
├── orchestrator/     Phase runner, type contracts, prompts, and Codex workers
├── dashboard/        Next.js product surface and live-run control plane
├── slack/            Slack intake service
├── demo_app/         Intentionally broken target app for fixture/eval incidents
├── incidents/        Normalized incident fixtures (3 bundled classes)
├── skills/           Reusable incident skills written by Phase 8
├── tests/            Orchestrator and control-plane tests
├── artifacts/        Phase outputs written at runtime (git-ignored)
└── Docs/             Engineering, operations, and authoring docs
```

---

## Verification

```bash
pnpm build
pnpm test
pnpm --dir dashboard build
npm --prefix slack test
```

---

## Documentation

| Need | Document |
|---|---|
| Phase model, flow diagram, artifact map | [`PIPELINE.md`](PIPELINE.md) |
| Runtime architecture, component map, worker model | [`Docs/ENGINEERING.md`](Docs/ENGINEERING.md) |
| Local setup, Slack, env vars, routes, troubleshooting | [`Docs/OPERATIONS.md`](Docs/OPERATIONS.md) |
| Adding a new incident class end to end | [`Docs/INCIDENT_AUTHORING.md`](Docs/INCIDENT_AUTHORING.md) |
| Dashboard routes, auth, archive semantics | [`dashboard/README.md`](dashboard/README.md) |
| Target app bugs and repro scripts | [`demo_app/README.md`](demo_app/README.md) |
| Incident fixture format and schema | [`incidents/README.md`](incidents/README.md) |
| Skill catalog and scoring | [`skills/README.md`](skills/README.md) |

---

## Current Boundary

ReplayX does not pretend every fresh bug is already fixed. Fresh realtime incidents stop at the evidence packet and patch-planning gate today. The fixture/eval path runs end to end for all three bundled incident classes. The next major step is a bounded Codex patch worker: edit only the justified files, rerun validation, store the diff, and mark a PR path ready only after the proof passes.

---

## License

MIT
