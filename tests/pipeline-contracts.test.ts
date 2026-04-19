import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  runIncidentIntakePhase
} from "../orchestrator/phases/incident-intake.js";
import { runReviewAndRegressionPhase } from "../orchestrator/phases/review-and-regression.js";
import { runSkillMatchPhase } from "../orchestrator/phases/skill-match.js";
import type {
  NormalizedIncident,
  ReplayXDiagnosisArenaPhaseOutput,
  ReplayXFixArenaPhaseOutput,
  ReplayXRuntimeConfig
} from "../orchestrator/types.js";

const baseIncident: NormalizedIncident = {
  schemaVersion: 1,
  incidentId: "incident-null-shape-003",
  title: "Null taxes crash in order summary",
  incidentClass: "null-data-shape-failure",
  service: "order-summary",
  environment: "development",
  severity: "sev-2",
  repoRoot: ".",
  summary: {
    symptom: "The order summary page throws when quote taxes are null.",
    customerImpact: "Customers cannot review order totals.",
    firstObservedAt: "2026-04-16T00:00:00.000Z",
    customerVisible: true
  },
  suspectedFiles: ["demo_app/src/orders/build-summary.ts"],
  evidence: {
    stackTraces: [
      {
        source: "demo_app",
        errorType: "TypeError",
        message: "Cannot read properties of null (reading 'reduce')",
        frames: [
          {
            file: "demo_app/src/orders/build-summary.ts",
            line: 5,
            column: 12,
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
    metrics: [
      {
        name: "order_summary.render_errors",
        unit: "count",
        value: 3,
        observedAt: "2026-04-16T00:00:00.000Z",
        baselineValue: 0
      }
    ]
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
      summary: "Remove redundant quote normalization",
      author: "ReplayX Demo",
      mergedAt: "2026-04-16T00:00:00.000Z",
      files: ["demo_app/src/orders/build-summary.ts"]
    }
  ],
  constraints: ["Keep the fix limited to summary and quote-shape handling."],
  acceptanceCriteria: ["The failing repro no longer throws when taxes is null."]
};

test("incident intake records the normalized artifact path", () => {
  const result = runIncidentIntakePhase(
    "/repo/incidents/null-data-shape-failure.json",
    "/repo/artifacts/incident-null-shape-003/normalized_incident.json",
    baseIncident
  );

  assert.equal(result.phase, "incident-intake");
  assert.equal(result.verification_status, "normalized");
  assert.equal(result.normalized_path, "/repo/artifacts/incident-null-shape-003/normalized_incident.json");
});

test("skill match finds a canonical skill when service and incident class align", async () => {
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-skill-match-"));
  const runtime: ReplayXRuntimeConfig = {
    repoRoot: tempRepo,
    artifactsRoot: path.join(tempRepo, "artifacts"),
    defaultModel: "gpt-5-codex",
    maxParallelWorkers: 1,
    codexReproWorkerEnabled: false,
    codexReproWorkerTimeoutMs: 1,
    codexDiagnosisWorkersEnabled: false,
    codexDiagnosisWorkerTimeoutMs: 1
  };

  try {
    await mkdir(path.join(tempRepo, "skills"), { recursive: true });
    await writeFile(
      path.join(tempRepo, "skills", "incident-null-shape-003.yaml"),
      [
        "id: incident-null-shape-003",
        "title: Null taxes crash in order summary",
        "match:",
        "  service: order-summary",
        "  incident_class: null-data-shape-failure",
        "  winning_worker: diagnosis_data_shape",
        "fix_strategy: safe_fix"
      ].join("\n"),
      "utf8"
    );

    const result = await runSkillMatchPhase(runtime, baseIncident);

    assert.equal(result.matched, true);
    assert.equal(result.decision, "fast_path_available");
    assert.match(result.matched_skill_path ?? "", /skills\/incident-null-shape-003\.yaml$/);
  } finally {
    await rm(tempRepo, { recursive: true, force: true });
  }
});

test("review phase stays planned until a real patch execution loop exists", () => {
  const diagnosisResult: ReplayXDiagnosisArenaPhaseOutput = {
    schemaVersion: 1,
    phase: "diagnosis-arena",
    incidentId: baseIncident.incidentId,
    prompt_version: "test",
    worker_count: 1,
    codex_worker_count: 0,
    fallback_worker_count: 1,
    repro_summary: {
      repro_confirmed: true,
      verification_status: "confirmed",
      failure_surface: baseIncident.summary.symptom,
      candidate_files: baseIncident.suspectedFiles,
      confidence: 0.95
    },
    worker_results: [],
    ranked_shortlist: [],
    challenger_ready: {
      winning_worker: null,
      shortlisted_workers: [],
      candidate_count: 0
    }
  };
  void diagnosisResult;

  const fixResult: ReplayXFixArenaPhaseOutput = {
    schemaVersion: 1,
    phase: "fix-arena",
    incidentId: baseIncident.incidentId,
    prompt_version: "test",
    selected_diagnosis_worker: "diagnosis_data_shape",
    selected_diagnosis: "quote.taxes is null",
    worker_results: [],
    winner: "safe_fix",
    winner_summary: "Propose normalizing optional tax fields before rendering.",
    winner_changed_files: [
      "demo_app/src/orders/quote-adapter.ts",
      "demo_app/src/orders/build-summary.ts"
    ],
    ranking: [],
    demo_summary: "Best proposal for the seeded null-shape incident."
  };

  const result = runReviewAndRegressionPhase(baseIncident, fixResult);

  assert.equal(result.review_verdict, "planned");
  assert.match(result.regression_proof.demo_summary, /Planned verification should show/i);
});
