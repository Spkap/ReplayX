import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  NormalizedIncident,
  ReplayXChallengerValidationPhaseOutput,
  ReplayXDiagnosisArenaPhaseOutput,
  ReplayXFixArenaPhaseOutput,
  ReplayXFixStrategyId,
  ReplayXFixWorkerOutput,
  ReplayXFixWorkerRunRecord,
  ReplayXPhaseDefinition,
  ReplayXRuntimeConfig
} from "../types.js";

const fixArenaPromptVersion = "2026-04-16.v1";

const strategyOrder: ReplayXFixStrategyId[] = ["minimal_fix", "safe_fix", "durable_fix"];

export const fixArenaPhase: ReplayXPhaseDefinition = {
  id: "fix-arena",
  label: "Fix Arena",
  goal: "Generate bounded patch candidates and retain the safest verified option.",
  requiredVerificationCommand: "tsx orchestrator/main.ts --phase fix-arena incidents/<incident>.json",
  requiredOutputSchema: "phase.fix-arena.json",
  artifactOutputs: ["phase.fix-arena.json", "fix-arena.log"],
  dependsOn: ["challenger-validation"],
  status: "ready",
  implementationNotes:
    "Builds replay-safe fix strategy artifacts for the golden incident and later dashboard use."
};

const determineWinningDiagnosis = (
  diagnosisResult: ReplayXDiagnosisArenaPhaseOutput,
  challengerResult: ReplayXChallengerValidationPhaseOutput
) => {
  const preferredWorker = challengerResult.winner ?? diagnosisResult.challenger_ready.winning_worker ?? null;
  const fallback = diagnosisResult.ranked_shortlist[0] ?? null;

  if (!preferredWorker) {
    return fallback;
  }

  return (
    diagnosisResult.ranked_shortlist.find((candidate) => candidate.worker_id === preferredWorker) ?? fallback
  );
};

const selectFixStrategyOutputs = (
  incident: NormalizedIncident,
  diagnosis: ReturnType<typeof determineWinningDiagnosis>
): ReplayXFixWorkerOutput[] => {
  const verificationCommand = incident.commands.healthy.command;
  const diagnosisText = diagnosis?.diagnosis ?? incident.summary.symptom;

  switch (incident.incidentClass) {
    case "checkout-race-condition":
      return [
        {
          strategy: "minimal_fix",
          status: "completed",
          summary:
            "Propose revalidating inventory after the async gap and short-circuiting when the live available count changed before decrement.",
          files_changed: ["demo_app/src/inventory/reserve-stock.ts"],
          verification_command: verificationCommand,
          verification_result:
            "Verification plan: apply the candidate patch, then confirm the concurrent oversell path is blocked while the serial control still stays green.",
          blast_radius: "low",
          rollback_note: "Revert reserve-stock live revalidation logic.",
          risk_note: "Prevents the seeded race but still leaves the flow dependent on in-memory ordering.",
          score: 0.79,
          demo_summary: "Smallest proposed patch with the lowest blast radius."
        },
        {
          strategy: "safe_fix",
          status: "completed",
          summary:
            "Propose moving reservation to a single live inventory guard with explicit stale-state rejection before checkout worker commit.",
          files_changed: [
            "demo_app/src/inventory/reserve-stock.ts",
            "demo_app/src/queue/checkout-worker.ts"
          ],
          verification_command: verificationCommand,
          verification_result:
            "Verification plan: apply this candidate to checkout/inventory modules, rerun the concurrent checkout scenario, and confirm the serial control still passes.",
          blast_radius: "low",
          rollback_note: "Revert reservation guard and worker stale-state checks.",
          risk_note: "Best demo option, but still a bounded in-memory fix rather than a production-grade transaction boundary.",
          score: 0.94,
          demo_summary: "Best balance of safety and clarity among the proposed fixes."
        },
        {
          strategy: "durable_fix",
          status: "completed",
          summary:
            "Propose restructuring checkout so reservation and commit operate on one deterministic inventory state contract with explicit worker handoff validation.",
          files_changed: [
            "demo_app/src/checkout/submit-order.ts",
            "demo_app/src/inventory/reserve-stock.ts",
            "demo_app/src/queue/checkout-worker.ts"
          ],
          verification_command: verificationCommand,
          verification_result:
            "Verification plan: apply the broader state-contract change and rerun both the concurrent and serial checkout paths before accepting it.",
          blast_radius: "medium",
          rollback_note: "Revert the coordinated checkout/inventory flow changes.",
          risk_note: "Clearer long-term shape, but higher change surface than the safe fix.",
          score: 0.86,
          demo_summary: "Most durable proposal, but broader than needed for the demo."
        }
      ];
    case "auth-token-session-failure":
      return [
        {
          strategy: "minimal_fix",
          status: "completed",
          summary:
            "Propose rotating a new token in the idle-session branch instead of returning the cached expired access token.",
          files_changed: ["demo_app/src/auth/refresh-session.ts"],
          verification_command: verificationCommand,
          verification_result:
            "Verification plan: apply the idle-session token rotation, then rerun the idle and recent-session auth scenarios.",
          blast_radius: "low",
          rollback_note: "Restore the old idle-session branch.",
          risk_note: "Fixes the bug directly but does not add stronger state-handoff visibility.",
          score: 0.91,
          demo_summary: "Fastest clear proposal for the seeded auth incident."
        },
        {
          strategy: "safe_fix",
          status: "completed",
          summary:
            "Propose rotating a fresh token and adding an explicit stale-token guard before downstream validation.",
          files_changed: [
            "demo_app/src/auth/refresh-session.ts",
            "demo_app/src/middleware/require-session.ts"
          ],
          verification_command: verificationCommand,
          verification_result:
            "Verification plan: apply the refresh and stale-token guard changes, then rerun idle and fresh-session auth checks.",
          blast_radius: "low",
          rollback_note: "Revert the idle refresh and stale-token guard changes.",
          risk_note: "Best demo-safe path with better proof than the minimal fix.",
          score: 0.95,
          demo_summary: "Best combination of clear fix scope and explicit verification plan."
        },
        {
          strategy: "durable_fix",
          status: "completed",
          summary:
            "Propose refactoring session refresh and token-store ownership so all downstream checks consume freshly rotated auth state.",
          files_changed: [
            "demo_app/src/auth/refresh-session.ts",
            "demo_app/src/auth/token-store.ts",
            "demo_app/src/middleware/require-session.ts"
          ],
          verification_command: verificationCommand,
          verification_result:
            "Verification plan: apply the broader auth-state refactor and rerun idle-session plus fresh-session auth checks.",
          blast_radius: "medium",
          rollback_note: "Revert the coordinated auth-state refactor.",
          risk_note: "Broader changes increase explanation cost during the demo.",
          score: 0.83,
          demo_summary: "Most comprehensive auth proposal, but broader than needed."
        }
      ];
    case "null-data-shape-failure":
      return [
        {
          strategy: "minimal_fix",
          status: "completed",
          summary: "Propose guarding `quote.taxes` with a null-safe default before calling reduce.",
          files_changed: ["demo_app/src/orders/build-summary.ts"],
          verification_command: verificationCommand,
          verification_result:
            "Verification plan: apply the null-safe summary change, then rerun the missing-taxes and complete-quote fixtures.",
          blast_radius: "low",
          rollback_note: "Restore direct reduce call on quote.taxes.",
          risk_note: "Fastest fix, but leaves normalization responsibility scattered.",
          score: 0.9,
          demo_summary: "One-line null-safe proposal with a clear verification plan."
        },
        {
          strategy: "safe_fix",
          status: "completed",
          summary:
            "Propose normalizing optional tax fields in the quote adapter and keeping build-summary null-safe.",
          files_changed: [
            "demo_app/src/orders/quote-adapter.ts",
            "demo_app/src/orders/build-summary.ts"
          ],
          verification_command: verificationCommand,
          verification_result:
            "Verification plan: apply quote normalization plus null-safe rendering, then rerun missing and healthy quote fixtures.",
          blast_radius: "low",
          rollback_note: "Revert quote normalization and null-safe summary handling.",
          risk_note: "Best demo-safe fix because it shows both local safety and upstream normalization.",
          score: 0.96,
          demo_summary: "Best mix of clear fix scope and robust shape handling."
        },
        {
          strategy: "durable_fix",
          status: "completed",
          summary:
            "Propose a stricter quote-shape contract between adapter and renderer so optional fields are normalized before UI logic.",
          files_changed: [
            "demo_app/src/orders/quote-adapter.ts",
            "demo_app/src/orders/build-summary.ts",
            "demo_app/src/routes/order-summary.tsx"
          ],
          verification_command: verificationCommand,
          verification_result:
            "Verification plan: apply the broader quote-shape contract and rerun both summary fixtures before accepting it.",
          blast_radius: "medium",
          rollback_note: "Revert the quote-shape contract changes.",
          risk_note: "Good long-term direction, but slightly heavier than the safest demo path.",
          score: 0.84,
          demo_summary: "Most durable shape contract proposal, but broader than necessary."
        }
      ];
  }

  return strategyOrder.map((strategy, index) => ({
    strategy,
    status: "blocked",
    summary: `No seeded fix strategy template is defined for diagnosis: ${diagnosisText}`,
    files_changed: [],
    verification_command: verificationCommand,
    verification_result: "Fix arena has no deterministic template for this incident yet.",
    blast_radius: index === 0 ? "low" : index === 1 ? "medium" : "high",
    rollback_note: "No-op.",
    risk_note: "The fix arena needs a seeded strategy template for this incident class.",
    score: 0,
    demo_summary: "No demo-safe fix strategy is available yet."
  }));
};

const rankStrategies = (workerOutputs: ReplayXFixWorkerOutput[]) =>
  [...workerOutputs]
    .sort((left, right) => right.score - left.score || strategyOrder.indexOf(left.strategy) - strategyOrder.indexOf(right.strategy))
    .map((output, index) => ({
      rank: index + 1,
      strategy: output.strategy,
      score: output.score,
      status: output.status
    }));

export const runFixArenaPhase = (
  incident: NormalizedIncident,
  diagnosisResult: ReplayXDiagnosisArenaPhaseOutput,
  challengerResult: ReplayXChallengerValidationPhaseOutput
): ReplayXFixArenaPhaseOutput => {
  const selectedDiagnosis = determineWinningDiagnosis(diagnosisResult, challengerResult);
  const workerOutputs = selectFixStrategyOutputs(incident, selectedDiagnosis);
  const workerResults: ReplayXFixWorkerRunRecord[] = workerOutputs.map((output) => ({
    strategy: output.strategy,
    mode: "local-heuristic",
    thread_id: null,
    output,
    raw_response: null,
    error: null
  }));
  const ranking = rankStrategies(workerOutputs);
  const winnerRecord = ranking.find((entry) => entry.status === "completed") ?? null;
  const winnerOutput = winnerRecord
    ? workerOutputs.find((output) => output.strategy === winnerRecord.strategy) ?? null
    : null;

  return {
    schemaVersion: 1,
    phase: "fix-arena",
    incidentId: incident.incidentId,
    prompt_version: fixArenaPromptVersion,
    selected_diagnosis_worker: selectedDiagnosis?.worker_id ?? null,
    selected_diagnosis: selectedDiagnosis?.diagnosis ?? incident.summary.symptom,
    worker_results: workerResults,
    winner: winnerOutput?.strategy ?? null,
    winner_summary: winnerOutput?.summary ?? "No completed fix strategy was available.",
    winner_changed_files: winnerOutput?.files_changed ?? [],
    ranking,
    demo_summary:
      winnerOutput?.demo_summary ??
      "Fix arena could not produce a stable winner for the golden incident."
  };
};

export const writeFixArenaArtifacts = async (
  runtime: ReplayXRuntimeConfig,
  incident: NormalizedIncident,
  result: ReplayXFixArenaPhaseOutput
): Promise<{
  artifactPath: string;
  logPath: string;
}> => {
  const incidentArtifactDirectory = path.join(runtime.artifactsRoot, incident.incidentId);
  const artifactPath = path.join(incidentArtifactDirectory, "phase.fix-arena.json");
  const logPath = path.join(incidentArtifactDirectory, "fix-arena.log");

  await mkdir(incidentArtifactDirectory, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(
    logPath,
    `${[
      `Incident: ${incident.incidentId}`,
      `Prompt version: ${result.prompt_version}`,
      `Selected diagnosis worker: ${result.selected_diagnosis_worker ?? "none"}`,
      `Winner: ${result.winner ?? "none"}`,
      `Winner summary: ${result.winner_summary}`,
      `Ranking: ${result.ranking.map((entry) => `${entry.rank}. ${entry.strategy} (${entry.score})`).join("; ")}`
    ].join("\n")}\n`,
    "utf8"
  );

  return { artifactPath, logPath };
};
