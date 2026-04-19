import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  NormalizedIncident,
  ReplayXFixArenaPhaseOutput,
  ReplayXPhaseDefinition,
  ReplayXReviewAndRegressionPhaseOutput,
  ReplayXReviewFinding,
  ReplayXRuntimeConfig
} from "../types.js";

const reviewPromptVersion = "2026-04-16.v1";

export const reviewAndRegressionPhase: ReplayXPhaseDefinition = {
  id: "review-and-regression",
  label: "Review And Regression Proof",
  goal: "Review the winning patch and verify the incident is actually addressed.",
  requiredVerificationCommand:
    "tsx orchestrator/main.ts --phase review-and-regression incidents/<incident>.json",
  requiredOutputSchema: "phase.review-and-regression.json",
  artifactOutputs: ["phase.review-and-regression.json", "verification.review.log"],
  dependsOn: ["fix-arena"],
  status: "ready",
  implementationNotes:
    "Produces replay-safe review and regression proof artifacts for the golden incident."
};

const buildFindings = (
  incident: NormalizedIncident,
  fixResult: ReplayXFixArenaPhaseOutput
): ReplayXReviewFinding[] => {
  if (!fixResult.winner) {
    return [
      {
        severity: "critical",
        file: "orchestrator/phases/fix-arena.ts",
        issue: "No completed fix strategy was available, so the review phase cannot approve a winner."
      }
    ];
  }

  if (fixResult.winner === "durable_fix") {
    return [
      {
        severity: "suggestion",
        file: fixResult.winner_changed_files[0] ?? "demo_app/",
        issue: "The durable strategy changes more files than the safest demo path and should be justified clearly in narration."
      }
    ];
  }

  return [];
};

export const runReviewAndRegressionPhase = (
  incident: NormalizedIncident,
  fixResult: ReplayXFixArenaPhaseOutput
): ReplayXReviewAndRegressionPhaseOutput => {
  const findings = buildFindings(incident, fixResult);
  const reviewVerdict = findings.some((finding) => finding.severity === "critical")
    ? "blocked"
    : "planned";
  const regressionCommand = `${incident.commands.failing.command} && ${incident.commands.healthy.command}`;
  const regressionSummary =
    reviewVerdict === "planned"
      ? `Planned verification should show ${incident.commands.failing.label} succeeds after applying the chosen patch while ${incident.commands.healthy.label} stays green.`
      : "No reviewable fix proposal exists, so verification remains blocked.";

  return {
    schemaVersion: 1,
    phase: "review-and-regression",
    incidentId: incident.incidentId,
    review_verdict: reviewVerdict,
    findings,
    residual_risk:
      reviewVerdict === "planned"
        ? "ReplayX has a reviewable fix proposal, but it does not yet execute and verify a real patch in the repository."
        : "A critical issue blocked the review verdict, so the demo must not present the fix proposal as accepted.",
    regression_proof: {
      test_type: "script",
      target_files: fixResult.winner_changed_files,
      why_this_test:
        "The demo relies on a future execution step proving that the seeded failure disappears while the healthy control still passes.",
      verification_command: regressionCommand,
      demo_summary: regressionSummary
    },
    demo_summary:
      reviewVerdict === "planned"
        ? "ReplayX produced a reviewed verification plan, but the fix is still a proposal until a real patch loop runs."
        : "Review is blocked; the dashboard must show the fix as unapproved."
  };
};

export const writeReviewAndRegressionArtifacts = async (
  runtime: ReplayXRuntimeConfig,
  incident: NormalizedIncident,
  result: ReplayXReviewAndRegressionPhaseOutput
): Promise<{
  artifactPath: string;
  logPath: string;
}> => {
  const incidentArtifactDirectory = path.join(runtime.artifactsRoot, incident.incidentId);
  const artifactPath = path.join(incidentArtifactDirectory, "phase.review-and-regression.json");
  const logPath = path.join(incidentArtifactDirectory, "verification.review.log");

  await mkdir(incidentArtifactDirectory, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(
    logPath,
    `${[
      `Incident: ${incident.incidentId}`,
      `Review verdict: ${result.review_verdict}`,
      `Findings: ${result.findings.length > 0 ? result.findings.map((f) => `${f.severity}:${f.file}`).join("; ") : "none"}`,
      `Regression command: ${result.regression_proof.verification_command}`,
      `Demo summary: ${result.demo_summary}`
    ].join("\n")}\n`,
    "utf8"
  );

  return { artifactPath, logPath };
};
