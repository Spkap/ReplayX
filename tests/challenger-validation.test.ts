import assert from "node:assert/strict";
import test from "node:test";

import type {
  NormalizedIncident,
  ReplayXDiagnosisArenaPhaseOutput,
  ReplayXDiagnosisRankedCandidate
} from "../orchestrator/types.js";

const baseIncident: NormalizedIncident = {
  schemaVersion: 1,
  incidentId: "incident-null-shape-003",
  title: "Null taxes crash in order summary",
  incidentClass: "null-data-shape-failure",
  service: "demo_app",
  environment: "development",
  severity: "sev-2",
  repoRoot: ".",
  summary: {
    symptom:
      "The order summary page throws a TypeError when the shipping quote payload returns null for taxes instead of an array.",
    customerImpact: "Customers cannot review order totals for quotes missing optional taxes.",
    firstObservedAt: "2026-04-16T00:00:00.000Z",
    customerVisible: true
  },
  suspectedFiles: [
    "demo_app/src/orders/build-summary.ts",
    "demo_app/src/orders/quote-adapter.ts"
  ],
  evidence: {
    stackTraces: [
      {
        source: "demo_app",
        errorType: "TypeError",
        message: "Cannot read properties of null (reading 'reduce')",
        frames: [
          {
            file: "demo_app/src/orders/build-summary.ts",
            line: 18,
            column: 24,
            function: "buildSummaryTotals"
          }
        ]
      }
    ],
    logs: [
      {
        source: "demo_app",
        observedAt: "2026-04-16T00:00:00.000Z",
        level: "error",
        message: "quote.taxes was null while rendering order summary",
        context: { fixture: "missing-taxes" }
      }
    ],
    metrics: []
  },
  commands: {
    failing: {
      label: "Null taxes summary repro",
      command: "pnpm tsx demo_app/scripts/repro-null-shape.ts --fixture missing-taxes",
      workingDirectory: ".",
      expectedExitCode: 1
    },
    healthy: {
      label: "Complete quote control",
      command: "pnpm tsx demo_app/scripts/repro-null-shape.ts --fixture complete-quote",
      workingDirectory: ".",
      expectedExitCode: 0
    }
  },
  recentChanges: [
    {
      commit: "8f03e33",
      summary: "Remove redundant quote normalization to reduce client-side bundle size",
      author: "ReplayX Demo",
      mergedAt: "2026-04-16T00:00:00.000Z",
      files: [
        "demo_app/src/orders/build-summary.ts",
        "demo_app/src/orders/quote-adapter.ts"
      ]
    }
  ],
  constraints: [],
  acceptanceCriteria: [
    "The failing repro no longer throws when taxes is null.",
    "The healthy complete quote control still passes."
  ]
};

const candidate = (
  overrides: Partial<ReplayXDiagnosisRankedCandidate> & Pick<ReplayXDiagnosisRankedCandidate, "worker_id" | "diagnosis">
): ReplayXDiagnosisRankedCandidate => {
  const { worker_id, diagnosis, ...optionalOverrides } = overrides;

  return {
    rank: 1,
    worker_id,
    specialty: "test specialty",
    diagnosis,
    confidence: 0.9,
    status: "completed",
    candidate_files: ["demo_app/src/orders/build-summary.ts"],
    score: 0.9,
    score_breakdown: {
      status_score: 1,
      confidence_score: 0.9,
      class_affinity_score: 1,
      file_overlap_score: 1,
      observation_score: 0.75,
      command_score: 1,
      total: 0.9
    },
    ...optionalOverrides
  };
};

const diagnosisArena = (
  ranked_shortlist: ReplayXDiagnosisRankedCandidate[]
): ReplayXDiagnosisArenaPhaseOutput => ({
  schemaVersion: 1,
  phase: "diagnosis-arena",
  incidentId: baseIncident.incidentId,
  prompt_version: "test",
  worker_count: ranked_shortlist.length,
  codex_worker_count: 0,
  fallback_worker_count: ranked_shortlist.length,
  repro_summary: {
    repro_confirmed: true,
    verification_status: "confirmed",
    failure_surface:
      "TypeError: Cannot read properties of null (reading 'reduce') when quote.taxes is null.",
    candidate_files: [
      "demo_app/src/orders/build-summary.ts",
      "demo_app/src/orders/quote-adapter.ts"
    ],
    confidence: 0.96
  },
  worker_results: [],
  ranked_shortlist,
  challenger_ready: {
    winning_worker: ranked_shortlist[0]?.worker_id ?? null,
    shortlisted_workers: ranked_shortlist.map((entry) => entry.worker_id),
    candidate_count: ranked_shortlist.length
  }
});

test("challenger rejects broad recent-change diagnosis when a specific null-shape candidate survives", async () => {
  const challenger = await import("../orchestrator/phases/challenger-validation.js");

  assert.equal(typeof challenger.runChallengerValidationPhase, "function");

  const result = challenger.runChallengerValidationPhase(
    baseIncident,
    diagnosisArena([
      candidate({
        rank: 1,
        worker_id: "diagnosis_data_shape",
        diagnosis:
          "buildSummaryTotals assumes quote.taxes is always an array and calls reduce on a nullable field.",
        confidence: 0.98
      }),
      candidate({
        rank: 2,
        worker_id: "diagnosis_recent_change",
        diagnosis:
          "Recent change 8f03e33 changed the failing path and likely introduced the observed regression.",
        confidence: 0.81
      })
    ])
  );

  assert.equal(result.status, "completed");
  assert.equal(result.winner, "diagnosis_data_shape");
  assert.deepEqual(result.validated, ["diagnosis_data_shape"]);
  assert.deepEqual(
    result.rejected.map((entry) => entry.worker),
    ["diagnosis_recent_change"]
  );
  assert.match(result.winning_reason, /survived/i);
});

test("challenger returns no_clear_winner when every candidate fails adversarial checks", async () => {
  const challenger = await import("../orchestrator/phases/challenger-validation.js");

  assert.equal(typeof challenger.runChallengerValidationPhase, "function");

  const result = challenger.runChallengerValidationPhase(
    baseIncident,
    diagnosisArena([
      candidate({
        worker_id: "diagnosis_auth",
        diagnosis: "The current evidence does not primarily resemble an auth bug.",
        confidence: 0.14,
        status: "weak_signal",
        score: 0.14,
        score_breakdown: {
          status_score: 0.35,
          confidence_score: 0.14,
          class_affinity_score: 0,
          file_overlap_score: 0,
          observation_score: 0.25,
          command_score: 0.2,
          total: 0.14
        }
      })
    ])
  );

  assert.equal(result.status, "no_clear_winner");
  assert.equal(result.winner, null);
  assert.deepEqual(result.validated, []);
  assert.deepEqual(result.rejected.map((entry) => entry.worker), ["diagnosis_auth"]);
});
