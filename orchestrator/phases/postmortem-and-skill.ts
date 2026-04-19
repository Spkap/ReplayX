import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  NormalizedIncident,
  ReplayXChallengerValidationPhaseOutput,
  ReplayXDashboardReplayArtifact,
  ReplayXDemoScriptArtifact,
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
    "demo-script.json",
    "slack-intake.json"
  ],
  dependsOn: ["review-and-regression"],
  status: "ready",
  implementationNotes:
    "Compiles the golden-run artifacts needed by the dashboard, Slack handoff, and demo script."
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
        summary: reviewResult.regression_proof.demo_summary,
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
      regression_summary: reviewResult.regression_proof.demo_summary
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
      after: reviewResult.regression_proof.demo_summary
    },
    demo_summary:
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

export const buildDemoScriptArtifact = (
  incident: NormalizedIncident,
  replayArtifact: ReplayXDashboardReplayArtifact
): ReplayXDemoScriptArtifact => ({
  schemaVersion: 1,
  incidentId: incident.incidentId,
  beats: [
    {
      timestamp: "00:00-00:10",
      screen: "Title card + one-line problem statement",
      narration:
        "Production incident response is slow and manual. ReplayX turns an incident bundle into a ranked diagnosis, fix path, proof, and reusable knowledge.",
      proof_point: "Judges understand the product before any technical detail appears."
    },
    {
      timestamp: "00:10-00:25",
      screen: "Broken demo app state or failing signal",
      narration: "Here is the broken app state for the golden incident. The bug is concrete and user-visible.",
      proof_point: incident.summary.symptom
    },
    {
      timestamp: "00:25-00:40",
      screen: "Slack intake trigger",
      narration:
        "A bug report arrives in Slack. ReplayX acknowledges it and hands off into the incident replay flow.",
      proof_point: "Slack is the intake trigger into the product, not just a side integration."
    },
    {
      timestamp: "00:40-01:05",
      screen: "ReplayX dashboard diagnosis worker fan-out",
      narration:
        "ReplayX fans out Codex specialists, compares competing explanations, and surfaces the strongest diagnosis.",
      proof_point: replayArtifact.winner_card.winning_reason
    },
    {
      timestamp: "01:05-01:30",
      screen: "Fix and proof cards",
      narration:
        "ReplayX selects the safest winning fix proposal and shows the verification plan needed to trust it, not just a claim.",
      proof_point: replayArtifact.fix_card.summary
    },
    {
      timestamp: "01:30-01:50",
      screen: "Before/after and artifact cards",
      narration:
        "ReplayX packages the run into a postmortem and a reusable skill so the next incident starts with more context.",
      proof_point: replayArtifact.before_after.after
    },
    {
      timestamp: "01:50-02:00",
      screen: "ReplayX final product screen",
      narration:
        "ReplayX is built on Codex as the debugging brain: bounded specialists, code-aware fixes, proof, and reusable incident memory.",
      proof_point: "This is only possible because Codex is the reasoning and coding engine inside the workflow."
    }
  ],
  closing_line: "ReplayX: incident response built on Codex."
});

const buildPostmortemMarkdown = (
  incident: NormalizedIncident,
  challengerResult: ReplayXChallengerValidationPhaseOutput,
  fixResult: ReplayXFixArenaPhaseOutput,
  reviewResult: ReplayXReviewAndRegressionPhaseOutput
): string => `# ReplayX Postmortem\n\n## Summary\n${incident.summary.symptom}\n\n## Root Cause\n${challengerResult.winning_reason}\n\n## Proposed Fix\n${fixResult.winner_summary}\n\n## Verification Plan\n${reviewResult.regression_proof.demo_summary}\n\n## Residual Risk\n${reviewResult.residual_risk}\n`;

const buildSkillYaml = (
  incident: NormalizedIncident,
  challengerResult: ReplayXChallengerValidationPhaseOutput,
  fixResult: ReplayXFixArenaPhaseOutput
): string => `id: ${incident.incidentId}\ntitle: ${incident.title}\nmatch:\n  service: ${incident.service}\n  incident_class: ${incident.incidentClass}\n  winning_worker: ${challengerResult.winner ?? "unknown"}\nfix_strategy: ${fixResult.winner ?? "unknown"}\ndemo_summary: ${fixResult.demo_summary}\n`;

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
  const demoScriptPath = path.join(incidentArtifactDirectory, "demo-script.json");

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
  const demoScriptArtifact = buildDemoScriptArtifact(incident, replayArtifact);

  await Promise.all([
    writeFile(postmortemPath, postmortemMarkdown, "utf8"),
    writeFile(skillPath, skillYaml, "utf8"),
    writeFile(canonicalSkillPath, skillYaml, "utf8"),
    writeFile(replayArtifactPath, `${JSON.stringify(replayArtifact, null, 2)}\n`, "utf8"),
    writeFile(slackArtifactPath, `${JSON.stringify(slackArtifact, null, 2)}\n`, "utf8"),
    writeFile(demoScriptPath, `${JSON.stringify(demoScriptArtifact, null, 2)}\n`, "utf8")
  ]);

  return {
    schemaVersion: 1,
    phase: "postmortem-and-skill",
    incidentId: incident.incidentId,
    postmortem_path: postmortemPath,
    postmortem_summary: postmortemSummary,
    skill_path: skillPath,
    skill_summary: skillSummary,
    demo_summary: replayArtifact.demo_summary
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
