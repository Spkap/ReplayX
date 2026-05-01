import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  NormalizedIncident,
  ReplayXChallengerValidationPhaseOutput,
  ReplayXDashboardReplayArtifact,
  ReplayXOperatorBriefArtifact,
  ReplayXDiagnosisArenaPhaseOutput,
  ReplayXFixArenaPhaseOutput,
  ReplayXPhaseDefinition,
  ReplayXPostmortemAndSkillPhaseOutput,
  ReplayXReviewAndRegressionPhaseOutput,
  ReplayXRuntimeConfig,
  ReplayXSlackIntakeArtifact
} from "../types.js";

export const postmortemAndSkillPhase: ReplayXPhaseDefinition = {
  id: "postmortem-and-skill",
  label: "Postmortem And Skill Writer",
  goal: "Emit human-readable incident artifacts and a reusable ReplayX skill.",
  requiredVerificationCommand:
    "tsx orchestrator/main.ts --phase golden-run incidents/<incident>.json",
  requiredOutputSchema: "phase.postmortem-and-skill.json",
  artifactOutputs: [
    "phase.postmortem-and-skill.json",
    "postmortem.md",
    "skill.yaml",
    "dashboard-replay.json",
    "operator-brief.json",
    "slack-intake.json"
  ],
  dependsOn: ["review-and-regression"],
  status: "ready",
  implementationNotes:
    "Compiles the golden-run artifacts needed by the dashboard, Slack handoff, and operator review."
};

export const buildDashboardReplayArtifact = (
  incident: NormalizedIncident,
  diagnosisResult: ReplayXDiagnosisArenaPhaseOutput,
  challengerResult: ReplayXChallengerValidationPhaseOutput,
  fixResult: ReplayXFixArenaPhaseOutput,
  reviewResult: ReplayXReviewAndRegressionPhaseOutput,
  postmortemSummary: string,
  skillSummary: string,
  postmortemPath: string,
  skillPath: string
): ReplayXDashboardReplayArtifact => {
  const winningWorker =
    diagnosisResult.worker_results.find((worker) => worker.worker_id === challengerResult.winner) ??
    diagnosisResult.worker_results[0];
  const fixWinner =
    fixResult.worker_results.find((worker) => worker.strategy === fixResult.winner) ??
    fixResult.worker_results[0];

  return {
    schemaVersion: 1,
    incidentId: incident.incidentId,
    incident_card: {
      title: incident.title,
      service: incident.service,
      severity: incident.severity,
      symptom: incident.summary.symptom,
      customerImpact: incident.summary.customerImpact
    },
    timeline: [
      {
        step: "1",
        title: "Incident intake",
        summary: incident.summary.symptom,
        status: "completed"
      },
      {
        step: "2",
        title: "Repro",
        summary: diagnosisResult.repro_summary.failure_surface,
        status: "completed"
      },
      {
        step: "3",
        title: "Diagnosis arena",
        summary: challengerResult.winning_reason,
        status: "completed"
      },
      {
        step: "4",
        title: "Fix arena",
        summary: fixResult.winner_summary,
        status: "completed"
      },
      {
        step: "5",
        title: "Proof",
        summary: reviewResult.regression_proof.operator_summary,
        status: "highlighted"
      }
    ],
    worker_cards: diagnosisResult.worker_results.map((worker) => ({
      worker: worker.worker_id,
      specialty: worker.specialty,
      diagnosis: worker.output.diagnosis,
      confidence: worker.output.confidence,
      status: worker.output.status
    })),
    winner_card: {
      worker: winningWorker?.worker_id ?? "none",
      diagnosis: winningWorker?.output.diagnosis ?? incident.summary.symptom,
      confidence: winningWorker?.output.confidence ?? 0,
      winning_reason: challengerResult.winning_reason
    },
    fix_card: {
      strategy: fixWinner?.strategy ?? "none",
      summary: fixWinner?.output.summary ?? "No fix winner available.",
      changed_files: fixResult.winner_changed_files,
      verification_result: fixWinner?.output.verification_result ?? "No verification result available."
    },
    proof_card: {
      review_verdict: reviewResult.review_verdict,
      regression_command: reviewResult.regression_proof.verification_command,
      regression_summary: reviewResult.regression_proof.operator_summary
    },
    postmortem_card: {
      summary: postmortemSummary,
      path: postmortemPath
    },
    skill_card: {
      summary: skillSummary,
      path: skillPath
    },
    before_after: {
      before: incident.summary.symptom,
      after: reviewResult.regression_proof.operator_summary
    },
    operator_summary:
      "ReplayX ingests the incident, shows bounded worker fan-out, ranks a fix proposal, outlines verification, and emits reusable incident knowledge."
  };
};

export const buildSlackIntakeArtifact = (
  incident: NormalizedIncident
): ReplayXSlackIntakeArtifact => ({
  schemaVersion: 1,
  incidentId: incident.incidentId,
  acknowledgement_message: `ReplayX received your bug report for ${incident.service}. Opening the ${incident.incidentId} replay flow now.`,
  incident_summary: incident.summary.symptom,
  handoff_target: "dashboard",
  replay_target: `/replay/${incident.incidentId}`
});

export const buildOperatorBriefArtifact = (
  incident: NormalizedIncident,
  replayArtifact: ReplayXDashboardReplayArtifact
): ReplayXOperatorBriefArtifact => ({
  schemaVersion: 1,
  incidentId: incident.incidentId,
  sections: [
    {
      section: "Problem",
      surface: "Incident overview",
      summary:
        "Production incident response is slow and manual. ReplayX turns an incident bundle into a ranked diagnosis, fix path, proof, and reusable knowledge.",
      evidence_point: incident.summary.customerImpact
    },
    {
      section: "Failure",
      surface: "Target app or failing signal",
      summary: "The incident starts from a concrete, user-visible failure.",
      evidence_point: incident.summary.symptom
    },
    {
      section: "Intake",
      surface: "Slack intake",
      summary:
        "A bug report arrives in Slack. ReplayX acknowledges it and hands off into the incident replay flow.",
      evidence_point: "Slack is the intake trigger into the product, not just a side integration."
    },
    {
      section: "Diagnosis",
      surface: "ReplayX dashboard",
      summary:
        "ReplayX fans out Codex specialists, compares competing explanations, and surfaces the strongest diagnosis.",
      evidence_point: replayArtifact.winner_card.winning_reason
    },
    {
      section: "Fix Path",
      surface: "Fix and proof cards",
      summary:
        "ReplayX selects the safest fix proposal and shows the verification plan needed to trust it, not just a claim.",
      evidence_point: replayArtifact.fix_card.summary
    },
    {
      section: "Memory",
      surface: "Postmortem and skill artifacts",
      summary:
        "ReplayX packages the run into a postmortem and a reusable skill so the next incident starts with more context.",
      evidence_point: replayArtifact.before_after.after
    },
    {
      section: "System",
      surface: "ReplayX final product state",
      summary:
        "ReplayX is built on Codex as the debugging brain: bounded specialists, code-aware fixes, proof, and reusable incident memory.",
      evidence_point: "Codex provides repo-aware reasoning inside a bounded proof workflow."
    }
  ],
  closing_summary: "ReplayX turns incident repair into an evidence-backed, replayable workflow."
});

const buildPostmortemMarkdown = (
  incident: NormalizedIncident,
  challengerResult: ReplayXChallengerValidationPhaseOutput,
  fixResult: ReplayXFixArenaPhaseOutput,
  reviewResult: ReplayXReviewAndRegressionPhaseOutput
): string => `# ReplayX Postmortem\n\n## Summary\n${incident.summary.symptom}\n\n## Root Cause\n${challengerResult.winning_reason}\n\n## Proposed Fix\n${fixResult.winner_summary}\n\n## Verification Plan\n${reviewResult.regression_proof.operator_summary}\n\n## Residual Risk\n${reviewResult.residual_risk}\n`;

const buildSkillYaml = (
  incident: NormalizedIncident,
  challengerResult: ReplayXChallengerValidationPhaseOutput,
  fixResult: ReplayXFixArenaPhaseOutput
): string => `id: ${incident.incidentId}\ntitle: ${incident.title}\nmatch:\n  service: ${incident.service}\n  incident_class: ${incident.incidentClass}\n  winning_worker: ${challengerResult.winner ?? "unknown"}\nfix_strategy: ${fixResult.winner ?? "unknown"}\noperator_summary: ${fixResult.operator_summary}\n`;

export const runPostmortemAndSkillPhase = async (
  runtime: ReplayXRuntimeConfig,
  incident: NormalizedIncident,
  diagnosisResult: ReplayXDiagnosisArenaPhaseOutput,
  challengerResult: ReplayXChallengerValidationPhaseOutput,
  fixResult: ReplayXFixArenaPhaseOutput,
  reviewResult: ReplayXReviewAndRegressionPhaseOutput
): Promise<ReplayXPostmortemAndSkillPhaseOutput> => {
  const incidentArtifactDirectory = path.join(runtime.artifactsRoot, incident.incidentId);
  const postmortemPath = path.join(incidentArtifactDirectory, "postmortem.md");
  const skillPath = path.join(incidentArtifactDirectory, "skill.yaml");
  const canonicalSkillPath = path.join(runtime.repoRoot, "skills", `${incident.incidentId}.yaml`);
  const replayArtifactPath = path.join(incidentArtifactDirectory, "dashboard-replay.json");
  const slackArtifactPath = path.join(incidentArtifactDirectory, "slack-intake.json");
  const operatorBriefPath = path.join(incidentArtifactDirectory, "operator-brief.json");

  await mkdir(incidentArtifactDirectory, { recursive: true });
  await mkdir(path.join(runtime.repoRoot, "skills"), { recursive: true });

  const postmortemMarkdown = buildPostmortemMarkdown(
    incident,
    challengerResult,
    fixResult,
    reviewResult
  );
  const skillYaml = buildSkillYaml(incident, challengerResult, fixResult);
  const postmortemSummary = challengerResult.winning_reason;
  const skillSummary = `ReplayX can fast-path ${incident.incidentClass} using ${fixResult.winner ?? "the selected fix strategy"} once a real patch loop validates it.`;
  const replayArtifact = buildDashboardReplayArtifact(
    incident,
    diagnosisResult,
    challengerResult,
    fixResult,
    reviewResult,
    postmortemSummary,
    skillSummary,
    postmortemPath,
    skillPath
  );
  const slackArtifact = buildSlackIntakeArtifact(incident);
  const operatorBriefArtifact = buildOperatorBriefArtifact(incident, replayArtifact);

  await Promise.all([
    writeFile(postmortemPath, postmortemMarkdown, "utf8"),
    writeFile(skillPath, skillYaml, "utf8"),
    writeFile(canonicalSkillPath, skillYaml, "utf8"),
    writeFile(replayArtifactPath, `${JSON.stringify(replayArtifact, null, 2)}\n`, "utf8"),
    writeFile(slackArtifactPath, `${JSON.stringify(slackArtifact, null, 2)}\n`, "utf8"),
    writeFile(operatorBriefPath, `${JSON.stringify(operatorBriefArtifact, null, 2)}\n`, "utf8")
  ]);

  return {
    schemaVersion: 1,
    phase: "postmortem-and-skill",
    incidentId: incident.incidentId,
    postmortem_path: postmortemPath,
    postmortem_summary: postmortemSummary,
    skill_path: skillPath,
    skill_summary: skillSummary,
    operator_summary: replayArtifact.operator_summary
  };
};

export const writePostmortemAndSkillArtifacts = async (
  runtime: ReplayXRuntimeConfig,
  incident: NormalizedIncident,
  result: ReplayXPostmortemAndSkillPhaseOutput
): Promise<{
  artifactPath: string;
}> => {
  const incidentArtifactDirectory = path.join(runtime.artifactsRoot, incident.incidentId);
  const artifactPath = path.join(incidentArtifactDirectory, "phase.postmortem-and-skill.json");

  await mkdir(incidentArtifactDirectory, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  return { artifactPath };
};
