# ReplayX Documentation

Long-form reference for product, architecture, demo operations, and incident authoring.

**New here?** Start with [`README.md`](../README.md) at the repo root — it's the product overview and quickstart. Come here for depth.

---

## Where to Go

| What you need | Go here |
|---|---|
| How the 8 phases work end to end | [PIPELINE.md](../PIPELINE.md) |
| Technical stack, data flow, env vars | [replayx-architecture.md](./replayx-architecture.md) |
| Why Codex-first, why not Agents SDK | [replayx-codex-first-architecture.md](./replayx-codex-first-architecture.md) |
| Running a live demo | [replayx-demo-runbook.md](./replayx-demo-runbook.md) |
| 100M realtime product plan | [replayx-100m-realtime-product-plan.md](./replayx-100m-realtime-product-plan.md) |
| Adding a new incident class | [replayx-incident-authoring-guide.md](./replayx-incident-authoring-guide.md) |
| Worker prompt pack and design rationale | [replayx-codex-first-prompts.md](./replayx-codex-first-prompts.md) |
| 2-minute spoken demo script | [replayx-2min-demo-script.md](./replayx-2min-demo-script.md) |

---

## Component READMEs

| Component | What's inside |
|---|---|
| [dashboard/README.md](../dashboard/README.md) | Dashboard routes, live/replay modes, signed links, local dev |
| [slack/README.md](../slack/README.md) | Slack intake wiring, env vars, app setup |
| [demo_app/README.md](../demo_app/README.md) | Seeded bugs, repro routes, repro scripts |
| [incidents/README.md](../incidents/README.md) | Fixture format, field reference, validation rules |
| [skills/README.md](../skills/README.md) | Skill YAML format, scoring weights, feedback loop |

---

## Source of Truth

When docs overlap, these files are canonical:

| Topic | Canonical file |
|---|---|
| Product overview and quickstart | [README.md](../README.md) |
| Phase model and artifact map | [PIPELINE.md](../PIPELINE.md) |
| Technical architecture | [replayx-architecture.md](./replayx-architecture.md) |
| Design system | [DESIGN.md](../DESIGN.md) |
| Prompt catalog | [PROMPTS.md](../PROMPTS.md) |
| Adding incident classes | [replayx-incident-authoring-guide.md](./replayx-incident-authoring-guide.md) |
