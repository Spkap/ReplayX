# ReplayX Codex-First Architecture

> **Canonical reference:** [`Docs/replayx-architecture.md`](./replayx-architecture.md) covers the implementation as it stands today. This file documents the architectural rationale — why Codex-first, why not Agents SDK, and how Codex maps to ReplayX phases.

---

## The Architectural Bet

ReplayX is not a conversational product. Its hard problems are software engineering problems:

- reading a real codebase and identifying the relevant files
- running shell commands and interpreting results
- proposing targeted code changes
- validating that a fix addresses the incident without breaking the healthy path
- writing reusable engineering knowledge from a resolved run

These are Codex-native tasks. The Codex SDK provides repo-aware execution, structured thread management, and sandboxed command dispatch — exactly what each ReplayX phase needs.

This is why ReplayX uses `@openai/codex-sdk` as its primary orchestration runtime, not the OpenAI Agents SDK.

---

## Runtime Split

### Codex SDK — worker execution

Every diagnosis, challenger, fix, and repro worker runs as a bounded Codex SDK thread. Each thread is:

- time-bounded with an `AbortController` timeout
- sandboxed to `read-only` for diagnosis workers
- isolated — one thread per worker per run
- falling back to a deterministic local heuristic if Codex is unavailable

### Codex CLI — scripted automation

Use `codex exec` for CI runs, scripted local review passes, and any automation that needs a full repo-aware shell session without the Codex SDK thread model.

### AGENTS.md — durable repo policy

Codex reads `AGENTS.md` before starting work. This file holds architecture invariants, design rules, working rules, and prompt ownership — the things that must be consistent across every Codex session.

---

## Why Not Agents SDK

The Agents SDK is well suited for conversational products and multi-agent orchestrations with handoffs, tracing, and voice. ReplayX does not need any of those primitives.

What ReplayX needs is reliable, deterministic phase execution:

- one orchestrator that drives a fixed sequence
- bounded workers that fail gracefully
- machine-readable outputs between every phase boundary
- artifacts that are inspectable and replayable after the run

The Codex SDK provides all of this with less framework surface area. Adding the Agents SDK would make ReplayX look like a general-purpose agent framework demo rather than an incident-fixing system.

---

## How Codex Maps to ReplayX Phases

| ReplayX phase | Codex mechanism |
|---|---|
| Incident Intake | Deterministic TypeScript validation — no Codex session needed |
| Skill Match | Deterministic scoring against `skills/*.yaml` |
| Repro | Live command execution + optional `Codex.startThread()` for failure surface summary |
| Diagnosis Arena | 6 parallel `Codex.startThread()` workers, each with a bounded prompt and structured output schema |
| Challenger Validation | Deterministic adversarial gates — no Codex session in the current seeded path |
| Fix Arena | Seeded strategy templates — no Codex session in the current seeded path |
| Review & Regression | Deterministic verdict and verification plan |
| Postmortem & Skill Write | Deterministic artifact compilation |

The architecture is designed so that later phases can add live Codex sessions without restructuring. The interface contract (`ReplayXPhaseDefinition`) and artifact schemas remain the same.

---

## Prompting Rules

These rules apply to every Codex worker in ReplayX:

- Put durable operating rules in `AGENTS.md` and `PROMPTS.md`.
- Put dynamic incident detail in the user prompt layer, not the system prompt.
- Use explicit output schemas so the orchestrator can parse and validate every worker response.
- Keep prompts concise and operational — avoid verbose role-play setups.
- Worker prompts live in `orchestrator/prompts/`.

---

## Optional — Responses API Path

If ReplayX later needs a server-side hosted worker that runs outside the Codex SDK environment, use the Responses API with a model from the Codex family and ReplayX-managed tools and routing. Keep orchestration logic inside ReplayX, not inside a third-party agent framework.

---

## Implementation Status

All 8 phases are implemented and running end to end. See [`Docs/replayx-architecture.md`](./replayx-architecture.md) for the full status table and data flow.
