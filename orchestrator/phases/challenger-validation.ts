import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  NormalizedIncident,
  ReplayXChallengerCandidateCheck,
  ReplayXChallengerCandidateReview,
  ReplayXChallengerRejectedCandidate,
  ReplayXChallengerValidationPhaseOutput,
  ReplayXDiagnosisArenaPhaseOutput,
  ReplayXDiagnosisRankedCandidate,
  ReplayXDiagnosisWorkerId,
  ReplayXIncidentClass,
  ReplayXPhaseDefinition,
  ReplayXRuntimeConfig
} from "../types.js";

const challengerPromptVersion = "2026-04-16.v1";

const classProfiles: Record<
  ReplayXIncidentClass,
  {
    preferredWorker: ReplayXDiagnosisWorkerId;
    supportingWorkers: Partial<Record<ReplayXDiagnosisWorkerId, number>>;
    keywords: string[];
  }
> = {
  "checkout-race-condition": {
    preferredWorker: "diagnosis_concurrency",
    supportingWorkers: {
      diagnosis_database: 0.72,
      diagnosis_state_handoff: 0.7,
      diagnosis_recent_change: 0.55
    },
    keywords: [
      "concurrent",
      "race",
      "inventory",
      "reserve",
      "reservation",
      "stale",
      "snapshot",
      "negative",
      "ordering"
    ]
  },
  "auth-token-session-failure": {
    preferredWorker: "diagnosis_auth",
    supportingWorkers: {
      diagnosis_state_handoff: 0.72,
      diagnosis_recent_change: 0.55
    },
    keywords: [
      "auth",
      "token",
      "session",
      "refresh",
      "401",
      "expired",
      "fingerprint",
      "idle"
    ]
  },
  "null-data-shape-failure": {
    preferredWorker: "diagnosis_data_shape",
    supportingWorkers: {
      diagnosis_recent_change: 0.55
    },
    keywords: [
      "null",
      "undefined",
      "taxes",
      "reduce",
      "array",
      "shape",
      "schema",
      "optional"
    ]
  }
};

const roundScore = (value: number): number => Number(value.toFixed(4));

const uniqueStrings = (values: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();

    if (trimmed === "" || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
};

const lower = (value: string): string => value.toLowerCase();

const countKeywordMatches = (text: string, keywords: string[]): number => {
  const normalizedText = lower(text);

  return keywords.filter((keyword) => normalizedText.includes(lower(keyword))).length;
};

const collectEvidenceText = (
  incident: NormalizedIncident,
  diagnosisResult: ReplayXDiagnosisArenaPhaseOutput
): string =>
  [
    incident.title,
    incident.summary.symptom,
    incident.summary.customerImpact,
    diagnosisResult.repro_summary.failure_surface,
    ...incident.evidence.logs.map((log) => log.message),
    ...incident.evidence.stackTraces.map((trace) => `${trace.errorType}: ${trace.message}`),
    ...incident.acceptanceCriteria,
    ...incident.recentChanges.map((change) => change.summary)
  ].join("\n");

const stackTraceFiles = (incident: NormalizedIncident): string[] =>
  incident.evidence.stackTraces.flatMap((trace) => trace.frames.map((frame) => frame.file));

const scoreFileOverlap = (
  candidate: ReplayXDiagnosisRankedCandidate,
  incident: NormalizedIncident,
  diagnosisResult: ReplayXDiagnosisArenaPhaseOutput
): number => {
  const evidenceFiles = new Set(
    uniqueStrings([
      ...incident.suspectedFiles,
      ...stackTraceFiles(incident),
      ...diagnosisResult.repro_summary.candidate_files
    ])
  );

  if (candidate.candidate_files.length === 0 || evidenceFiles.size === 0) {
    return 0;
  }

  const overlappingFiles = candidate.candidate_files.filter((filePath) => evidenceFiles.has(filePath));

  return roundScore(overlappingFiles.length / candidate.candidate_files.length);
};

const scoreClassSupport = (
  candidate: ReplayXDiagnosisRankedCandidate,
  incidentClass: ReplayXIncidentClass
): number => {
  const profile = classProfiles[incidentClass];

  if (candidate.worker_id === profile.preferredWorker) {
    return 1;
  }

  return profile.supportingWorkers[candidate.worker_id] ?? 0.12;
};

const scoreSpecificity = (
  candidate: ReplayXDiagnosisRankedCandidate,
  incident: NormalizedIncident
): number => {
  const profile = classProfiles[incident.incidentClass];
  const matches = countKeywordMatches(candidate.diagnosis, profile.keywords);

  return roundScore(Math.min(1, matches / 3));
};

const commandSupportScore = (candidate: ReplayXDiagnosisRankedCandidate): number =>
  roundScore(candidate.score_breakdown.command_score);

const scoreCandidateSupport = (
  candidate: ReplayXDiagnosisRankedCandidate,
  incident: NormalizedIncident,
  diagnosisResult: ReplayXDiagnosisArenaPhaseOutput
): number => {
  const statusScore = candidate.status === "completed" ? 1 : candidate.status === "weak_signal" ? 0.25 : 0;
  const confidenceScore = Math.max(0, Math.min(1, candidate.confidence));
  const classSupport = scoreClassSupport(candidate, incident.incidentClass);
  const specificityScore = scoreSpecificity(candidate, incident);
  const fileOverlapScore = scoreFileOverlap(candidate, incident, diagnosisResult);
  const commandScore = commandSupportScore(candidate);

  return roundScore(
    statusScore * 0.22 +
      confidenceScore * 0.18 +
      classSupport * 0.2 +
      specificityScore * 0.18 +
      fileOverlapScore * 0.15 +
      commandScore * 0.07
  );
};

const buildCandidateChecks = (
  candidate: ReplayXDiagnosisRankedCandidate,
  incident: NormalizedIncident,
  diagnosisResult: ReplayXDiagnosisArenaPhaseOutput,
  evidenceText: string
): ReplayXChallengerCandidateCheck[] => {
  const profile = classProfiles[incident.incidentClass];
  const classSupport = scoreClassSupport(candidate, incident.incidentClass);
  const specificityScore = scoreSpecificity(candidate, incident);
  const fileOverlapScore = scoreFileOverlap(candidate, incident, diagnosisResult);
  const evidenceKeywordCount = countKeywordMatches(evidenceText, profile.keywords);

  return [
    {
      name: "worker-status",
      passed: candidate.status === "completed",
      detail:
        candidate.status === "completed"
          ? "Candidate completed its diagnosis workflow."
          : `Candidate status is ${candidate.status}, so the diagnosis did not complete cleanly.`
    },
    {
      name: "incident-class-fit",
      passed: classSupport >= 0.5,
      detail:
        classSupport >= 0.5
          ? `Worker specialty has credible support for ${incident.incidentClass}.`
          : `Worker specialty is weakly aligned with ${incident.incidentClass}.`
    },
    {
      name: "specific-mechanism",
      passed: specificityScore >= 0.34,
      detail:
        specificityScore >= 0.34
          ? "Diagnosis names a mechanism visible in the repro evidence."
          : "Diagnosis stays too broad and does not name enough incident-specific mechanism evidence."
    },
    {
      name: "file-overlap",
      passed: fileOverlapScore >= 0.5,
      detail:
        fileOverlapScore >= 0.5
          ? "Candidate files overlap the repro, stack, or suspected files."
          : "Candidate files do not sufficiently overlap the repro, stack, or suspected files."
    },
    {
      name: "evidence-presence",
      passed: evidenceKeywordCount > 0,
      detail:
        evidenceKeywordCount > 0
          ? "Incident packet contains evidence keywords for this failure class."
          : "Incident packet lacks direct evidence keywords for this failure class."
    }
  ];
};

const findStrongerPreferredCandidate = (
  candidate: ReplayXDiagnosisRankedCandidate,
  candidates: ReplayXDiagnosisRankedCandidate[],
  incident: NormalizedIncident,
  diagnosisResult: ReplayXDiagnosisArenaPhaseOutput
): ReplayXDiagnosisRankedCandidate | null => {
  const preferredWorker = classProfiles[incident.incidentClass].preferredWorker;

  if (candidate.worker_id === preferredWorker) {
    return null;
  }

  const preferred = candidates.find((entry) => entry.worker_id === preferredWorker);

  if (!preferred) {
    return null;
  }

  return scoreCandidateSupport(preferred, incident, diagnosisResult) >
    scoreCandidateSupport(candidate, incident, diagnosisResult)
    ? preferred
    : null;
};

const rejectionReason = (
  candidate: ReplayXDiagnosisRankedCandidate,
  checks: ReplayXChallengerCandidateCheck[],
  supportScore: number,
  candidates: ReplayXDiagnosisRankedCandidate[],
  incident: NormalizedIncident,
  diagnosisResult: ReplayXDiagnosisArenaPhaseOutput
): string | null => {
  if (candidate.status !== "completed") {
    return `Rejected because the candidate status is ${candidate.status}; challenger requires a completed diagnosis before fix selection.`;
  }

  if (candidate.confidence < 0.5) {
    return `Rejected because confidence ${candidate.confidence} is below the challenger acceptance floor of 0.5.`;
  }

  const failedCheck = checks.find((check) => !check.passed);

  if (failedCheck) {
    return `Rejected by ${failedCheck.name}: ${failedCheck.detail}`;
  }

  const strongerPreferred = findStrongerPreferredCandidate(candidate, candidates, incident, diagnosisResult);

  if (candidate.worker_id === "diagnosis_recent_change" && strongerPreferred) {
    return `Rejected because recent-change evidence explains timing but not the concrete failure mechanism; ${strongerPreferred.worker_id} is more specific and better supported.`;
  }

  if (supportScore < 0.62) {
    return `Rejected because adversarial support score ${supportScore} is below the challenger threshold of 0.62.`;
  }

  return null;
};

const winningReason = (
  winner: ReplayXDiagnosisRankedCandidate,
  review: ReplayXChallengerCandidateReview
): string =>
  `${winner.worker_id} survived challenger checks with support score ${review.support_score}: ${winner.diagnosis}`;

const remainingUncertainty = (
  outputStatus: ReplayXChallengerValidationPhaseOutput["status"],
  rejected: ReplayXChallengerRejectedCandidate[]
): string => {
  if (outputStatus === "no_clear_winner") {
    return "No diagnosis survived the adversarial checks; collect stronger repro evidence before fix selection.";
  }

  if (rejected.length === 0) {
    return "No shortlisted candidate was contradicted, so the fix arena should keep verification narrow.";
  }

  return "Rejected candidates were weaker, broader, or less specific, but the fix arena must still prove the selected root cause with regression checks.";
};

export const challengerValidationPhase: ReplayXPhaseDefinition = {
  id: "challenger-validation",
  label: "Challenger Validation",
  goal: "Try to falsify the strongest diagnoses before a winner is accepted.",
  requiredVerificationCommand:
    "tsx orchestrator/main.ts --phase challenger-validation incidents/<incident>.json",
  requiredOutputSchema: "phase.challenger-validation.json",
  artifactOutputs: ["phase.challenger-validation.json", "challenger-validation.log"],
  dependsOn: ["diagnosis-arena"],
  status: "ready",
  implementationNotes:
    "Runs deterministic adversarial checks over the diagnosis shortlist, rejects weak or broad candidates, and emits the winner contract used by the fix arena."
};

export const runChallengerValidationPhase = (
  incident: NormalizedIncident,
  diagnosisResult: ReplayXDiagnosisArenaPhaseOutput
): ReplayXChallengerValidationPhaseOutput => {
  const candidates = diagnosisResult.ranked_shortlist;
  const evidenceText = collectEvidenceText(incident, diagnosisResult);
  const candidateReviews: ReplayXChallengerCandidateReview[] = [];
  const validatedCandidates: ReplayXDiagnosisRankedCandidate[] = [];
  const rejected: ReplayXChallengerRejectedCandidate[] = [];

  for (const candidate of candidates) {
    const checks = buildCandidateChecks(candidate, incident, diagnosisResult, evidenceText);
    const supportScore = scoreCandidateSupport(candidate, incident, diagnosisResult);
    const reason = rejectionReason(
      candidate,
      checks,
      supportScore,
      candidates,
      incident,
      diagnosisResult
    );

    candidateReviews.push({
      worker: candidate.worker_id,
      decision: reason ? "rejected" : "validated",
      support_score: supportScore,
      checks
    });

    if (reason) {
      rejected.push({
        worker: candidate.worker_id,
        reason
      });
      continue;
    }

    validatedCandidates.push(candidate);
  }

  const sortedValidated = [...validatedCandidates].sort(
    (left, right) =>
      scoreCandidateSupport(right, incident, diagnosisResult) -
        scoreCandidateSupport(left, incident, diagnosisResult) ||
      left.rank - right.rank
  );
  const winner = sortedValidated[0] ?? null;
  const status = winner ? "completed" : "no_clear_winner";
  const winnerReview = winner
    ? candidateReviews.find((review) => review.worker === winner.worker_id)
    : null;

  return {
    schemaVersion: 1,
    phase: "challenger-validation",
    incidentId: incident.incidentId,
    prompt_version: challengerPromptVersion,
    winner: winner?.worker_id ?? null,
    validated: sortedValidated.map((candidate) => candidate.worker_id),
    rejected,
    winning_reason:
      winner && winnerReview
        ? winningReason(winner, winnerReview)
        : "No diagnosis survived the challenger checks.",
    remaining_uncertainty: remainingUncertainty(status, rejected),
    status,
    candidate_reviews: candidateReviews
  };
};

export const writeChallengerValidationArtifacts = async (
  runtime: ReplayXRuntimeConfig,
  incident: NormalizedIncident,
  result: ReplayXChallengerValidationPhaseOutput
): Promise<{
  artifactPath: string;
  logPath: string;
}> => {
  const incidentArtifactDirectory = path.join(runtime.artifactsRoot, incident.incidentId);
  const artifactPath = path.join(incidentArtifactDirectory, "phase.challenger-validation.json");
  const logPath = path.join(incidentArtifactDirectory, "challenger-validation.log");

  await mkdir(incidentArtifactDirectory, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(
    logPath,
    `${[
      `Incident: ${incident.incidentId}`,
      `Prompt version: ${result.prompt_version}`,
      `Status: ${result.status}`,
      `Winner: ${result.winner ?? "none"}`,
      `Validated: ${result.validated.length > 0 ? result.validated.join(", ") : "none"}`,
      `Rejected: ${
        result.rejected.length > 0
          ? result.rejected.map((entry) => `${entry.worker} (${entry.reason})`).join("; ")
          : "none"
      }`,
      `Winning reason: ${result.winning_reason}`,
      `Remaining uncertainty: ${result.remaining_uncertainty}`
    ].join("\n")}\n`,
    "utf8"
  );

  return {
    artifactPath,
    logPath
  };
};
