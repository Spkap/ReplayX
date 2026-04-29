# Why Codex-First

The architectural rationale behind ReplayX — why `@openai/codex-sdk` is the primary runtime, and why the Agents SDK is not used.

> For the implementation as it stands today, see [replayx-architecture.md](./replayx-architecture.md).

---

## The Core Bet

ReplayX is not a conversational product. Its problems are engineering problems:

- reading a real codebase and identifying the files most likely to contain the bug
- running shell commands against a live demo app and interpreting exit codes
- proposing a targeted, minimal code change rather than generic advice
- verifying that a fix addresses the failing path without breaking the healthy one
- writing reusable engineering knowledge from a resolved incident run

These are **Codex-native tasks**. Codex reads real repositories, runs real commands, and reasons about code as code — not as tokens in a text stream. That distinction matters in every phase of ReplayX.

---

## How Codex Maps to ReplayX Phases

| Phase | Codex mechanism | Why |
|---|---|---|
| Incident Intake | Deterministic TypeScript — no Codex session | Schema validation needs no reasoning |
| Skill Match | Deterministic scoring — no Codex session | Matching against YAML fields is arithmetic |
| Repro | Live command execution + optional `Codex.startThread()` | Interpreting failure output benefits from code-aware reasoning |
| Diagnosis Arena | 6 parallel `Codex.startThread()` workers | Each worker reads actual source files and stack traces |
| Challenger Validation | Deterministic adversarial gates — no Codex session | Gate logic is structural, not semantic |
| Fix Arena | Seeded strategy templates — no Codex session | Strategies are pre-constructed for the registered incident classes |
| Review & Regression | Deterministic verdict and proof plan | Verification command selection is rule-based |
| Postmortem & Skill Write | Deterministic artifact compilation | Assembly from prior phase outputs |

The design is intentional: Codex is used exactly where code-aware reasoning adds signal, and kept out of phases where deterministic logic is sufficient. This keeps the golden run reliable and auditable.

---

## Worker Configuration

Every Codex worker is configured the same way:

```typescript
const thread = codex.startThread({
  workingDirectory: runtime.repoRoot,   // runs inside the actual repo
  approvalPolicy: "never",              // no interactive prompts
  sandboxMode: "read-only",             // diagnosis workers cannot mutate state
  model: runtime.defaultModel,          // configurable via REPLAYX_CODEX_MODEL
  modelReasoningEffort: "low",          // bounded latency per worker
  networkAccessEnabled: false,          // no external calls
  webSearchMode: "disabled"             // no search; only repo context
});
```

Each worker is:
- **isolated** — one thread per worker per run, no shared state
- **time-bounded** — AbortController timeout (repro: 30s, diagnosis: 45s by default)
- **fallback-safe** — on timeout or failure, the phase falls back to a deterministic local heuristic and produces the same artifact shape

---

## Why Not Agents SDK

The Agents SDK is well suited for conversational products and multi-agent orchestrations with handoffs, tracing, and voice. ReplayX needs none of those primitives.

What ReplayX needs:

- one orchestrator driving a **fixed phase sequence**
- bounded workers that **fail gracefully** without terminating the run
- **machine-readable JSON outputs** between every phase boundary
- artifacts that are **inspectable and replayable** after the run is over

The Codex SDK provides all of this with significantly less framework surface area. Introducing the Agents SDK would make ReplayX look like a general-purpose agent framework demonstration rather than a purpose-built incident-fixing system.

---

## Fallback Architecture

Every Codex-backed phase carries a deterministic local heuristic fallback. This is not a compromise — it is a design requirement.

When `REPLAYX_USE_CODEX_DIAGNOSIS_WORKERS=0` or when a Codex SDK call times out or fails:

1. The phase logs the failure into the worker's `mode: "local-heuristic"` record
2. The deterministic heuristic runs using pre-seeded incident class logic
3. The phase produces the **identical artifact shape** as if Codex had run
4. The run continues

This guarantees that `pnpm golden-run` always produces a complete artifact set — whether or not a live Codex connection is available.

---

## Prompting Rules

These rules apply to every Codex worker in ReplayX:

- Put durable operating rules in `AGENTS.md` and `PROMPTS.md` — not in worker prompts.
- Put dynamic incident detail in the **user prompt layer**, not the system prompt.
- Require **explicit output schemas** on every worker prompt so the orchestrator can parse and validate responses.
- Keep prompts concise and operational — verbose role-play setups waste context and latency.
- Worker prompts live in `orchestrator/prompts/`.

---

## Future Paths

The architecture is designed so that later phases can add live Codex sessions without restructuring. The `ReplayXPhaseDefinition` interface and artifact schemas remain stable.

If ReplayX later needs a server-side hosted worker running outside the Codex SDK environment, use the Responses API with a model from the Codex family and ReplayX-managed tools and routing. Keep orchestration logic inside ReplayX, not inside a third-party agent framework.
