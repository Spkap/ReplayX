export const replayXPhaseIds = [
  "incident-intake",
  "skill-match",
  "repro",
  "diagnosis-arena",
  "challenger-validation",
  "fix-arena",
  "review-and-regression",
  "postmortem-and-skill"
] as const;

export type ReplayXPhaseId = (typeof replayXPhaseIds)[number];

export type ReplayXPhaseStatus = "pending" | "blocked" | "ready";

export const replayXDiagnosisWorkerIds = [
  "diagnosis_concurrency",
  "diagnosis_auth",
  "diagnosis_data_shape",
  "diagnosis_recent_change",
  "diagnosis_database",
  "diagnosis_state_handoff"
] as const;

export type ReplayXDiagnosisWorkerId = (typeof replayXDiagnosisWorkerIds)[number];

export const replayXDiagnosisWorkerStatuses = ["completed", "weak_signal", "blocked"] as const;

export type ReplayXDiagnosisWorkerStatus = (typeof replayXDiagnosisWorkerStatuses)[number];

export const replayXFixStrategyIds = ["minimal_fix", "safe_fix", "durable_fix"] as const;

export type ReplayXFixStrategyId = (typeof replayXFixStrategyIds)[number];

export const replayXFixWorkerStatuses = ["completed", "blocked", "verification_failed"] as const;

export type ReplayXFixWorkerStatus = (typeof replayXFixWorkerStatuses)[number];

export const replayXIncidentClasses = [
  "checkout-race-condition",
  "auth-token-session-failure",
  "null-data-shape-failure"
] as const;

export type ReplayXIncidentClass = (typeof replayXIncidentClasses)[number];

export const replayXIncidentEnvironments = ["development", "staging", "production"] as const;

export type ReplayXIncidentEnvironment = (typeof replayXIncidentEnvironments)[number];

export const replayXIncidentSeverities = ["sev-1", "sev-2", "sev-3", "sev-4"] as const;

export type ReplayXIncidentSeverity = (typeof replayXIncidentSeverities)[number];

export const replayXLogLevels = ["info", "warn", "error"] as const;

export type ReplayXLogLevel = (typeof replayXLogLevels)[number];

export interface ReplayXIncidentSummary {
  symptom: string;
  customerImpact: string;
  firstObservedAt: string;
  customerVisible: boolean;
}

export interface ReplayXMetricSnapshot {
  name: string;
  unit: string;
  value: number;
  observedAt: string;
  baselineValue?: number;
}

export interface ReplayXLogExcerpt {
  source: string;
  observedAt: string;
  level: ReplayXLogLevel;
  message: string;
  context: Record<string, boolean | number | string | null>;
}

export interface ReplayXStackFrame {
  file: string;
  line: number;
  column: number;
  function: string;
}

export interface ReplayXStackTrace {
  source: string;
  errorType: string;
  message: string;
  frames: ReplayXStackFrame[];
}

export interface ReplayXCommandSpec {
  label: string;
  command: string;
  workingDirectory: string;
  expectedExitCode: number;
}

export interface ReplayXRecentChange {
  commit: string;
  summary: string;
  author: string;
  mergedAt: string;
  files: string[];
}

export interface NormalizedIncident {
  schemaVersion: 1;
  incidentId: string;
  title: string;
  incidentClass: ReplayXIncidentClass;
  service: string;
  environment: ReplayXIncidentEnvironment;
  severity: ReplayXIncidentSeverity;
  repoRoot: string;
  summary: ReplayXIncidentSummary;
  suspectedFiles: string[];
  evidence: {
    stackTraces: ReplayXStackTrace[];
    logs: ReplayXLogExcerpt[];
    metrics: ReplayXMetricSnapshot[];
  };
  commands: {
    failing: ReplayXCommandSpec;
    healthy: ReplayXCommandSpec;
  };
  recentChanges: ReplayXRecentChange[];
  constraints: string[];
  acceptanceCriteria: string[];
}

export interface ReplayXCommandExecutionResult {
  label: string;
  command: string;
  workingDirectory: string;
  expectedExitCode: number;
  actualExitCode: number | null;
  matchedExpectation: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
}

export interface ReplayXReproSignals {
  stackTraceSources: string[];
  recentChangeCommits: string[];
  logSources: string[];
}

export interface ReplayXReproWorkerSummary {
  failure_surface: string;
  candidate_files: string[];
  confidence: number;
}

export interface ReplayXCodexWorkerResult {
  attempted: boolean;
  mode: "codex-sdk" | "local-heuristic";
  status: "completed" | "skipped" | "failed";
  threadId: string | null;
  output: ReplayXReproWorkerSummary | null;
  error: string | null;
}

export interface ReplayXReproPhaseOutput {
  schemaVersion: 1;
  phase: "repro";
  incidentId: string;
  repro_confirmed: boolean;
  verification_status: "confirmed" | "partially_confirmed" | "blocked";
  failure_surface: string;
  repro_command: string;
  candidate_files: string[];
  confidence: number;
  blocked_reason: string | null;
  command_results: {
    failing: ReplayXCommandExecutionResult;
    healthy: ReplayXCommandExecutionResult;
  };
  observed_signals: ReplayXReproSignals;
  codex_worker: ReplayXCodexWorkerResult;
}

export interface ReplayXIncidentPointer {
  incidentId: string;
  inputPath: string;
  normalizedPath: string;
}

export interface ReplayXIncidentIntakePhaseOutput {
  schemaVersion: 1;
  phase: "incident-intake";
  incidentId: string;
  input_path: string;
  normalized_path: string;
  source_kind: "normalized_fixture";
  verification_status: "normalized";
}

export interface ReplayXSkillMatchPhaseOutput {
  schemaVersion: 1;
  phase: "skill-match";
  incidentId: string;
  matched: boolean;
  match_confidence: number;
  matched_skill_path: string | null;
  matched_skill_id: string | null;
  decision: "continue_to_repro" | "fast_path_available";
  rationale: string;
}

export interface ReplayXRuntimeConfig {
  repoRoot: string;
  artifactsRoot: string;
  defaultModel: string;
  maxParallelWorkers: number;
  codexReproWorkerEnabled: boolean;
  codexReproWorkerTimeoutMs: number;
  codexDiagnosisWorkersEnabled: boolean;
  codexDiagnosisWorkerTimeoutMs: number;
}

export interface ReplayXPhaseDefinition {
  id: ReplayXPhaseId;
  label: string;
  goal: string;
  requiredVerificationCommand: string;
  requiredOutputSchema: string;
  artifactOutputs: string[];
  dependsOn: ReplayXPhaseId[];
  status: ReplayXPhaseStatus;
  implementationNotes?: string;
}

export interface ReplayXDiagnosisWorkerDefinition {
  id: ReplayXDiagnosisWorkerId;
  docsPromptId: string;
  docsSectionTitle: string;
  specialtyName: string;
  extraInstructions: string;
  focusKeywords: string[];
  incidentClassAffinity: Partial<Record<ReplayXIncidentClass, number>>;
  workerOrder: number;
}

export interface ReplayXDiagnosisWorkerOutput {
  worker: ReplayXDiagnosisWorkerId;
  specialty: string;
  diagnosis: string;
  confidence: number;
  observations: string[];
  commands_run: string[];
  candidate_files: string[];
  falsification_note: string;
  status: ReplayXDiagnosisWorkerStatus;
}

export interface ReplayXDiagnosisWorkerTraceSummary {
  item_types: string[];
  commands: Array<{
    command: string;
    status: string;
    exit_code: number | null;
  }>;
  reasoning: string[];
}

export interface ReplayXDiagnosisWorkerRunRecord {
  worker_id: ReplayXDiagnosisWorkerId;
  docs_prompt_id: string;
  prompt_version: string;
  specialty: string;
  mode: "codex-sdk" | "local-heuristic";
  thread_id: string | null;
  output: ReplayXDiagnosisWorkerOutput;
  raw_response: string | null;
  trace_summary: ReplayXDiagnosisWorkerTraceSummary;
  error: string | null;
}

export interface ReplayXDiagnosisRankingBreakdown {
  status_score: number;
  confidence_score: number;
  class_affinity_score: number;
  file_overlap_score: number;
  observation_score: number;
  command_score: number;
  total: number;
}

export interface ReplayXDiagnosisRankedCandidate {
  rank: number;
  worker_id: ReplayXDiagnosisWorkerId;
  specialty: string;
  diagnosis: string;
  confidence: number;
  status: ReplayXDiagnosisWorkerStatus;
  candidate_files: string[];
  score: number;
  score_breakdown: ReplayXDiagnosisRankingBreakdown;
}

export interface ReplayXDiagnosisArenaPhaseOutput {
  schemaVersion: 1;
  phase: "diagnosis-arena";
  incidentId: string;
  prompt_version: string;
  worker_count: number;
  codex_worker_count: number;
  fallback_worker_count: number;
  repro_summary: {
    repro_confirmed: boolean;
    verification_status: ReplayXReproPhaseOutput["verification_status"];
    failure_surface: string;
    candidate_files: string[];
    confidence: number;
  };
  worker_results: ReplayXDiagnosisWorkerRunRecord[];
  ranked_shortlist: ReplayXDiagnosisRankedCandidate[];
  challenger_ready: {
    winning_worker: ReplayXDiagnosisWorkerId | null;
    shortlisted_workers: ReplayXDiagnosisWorkerId[];
    candidate_count: number;
  };
}

export type ReplayXChallengerValidationStatus = "completed" | "no_clear_winner";

export interface ReplayXChallengerRejectedCandidate {
  worker: ReplayXDiagnosisWorkerId;
  reason: string;
}

export interface ReplayXChallengerCandidateCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface ReplayXChallengerCandidateReview {
  worker: ReplayXDiagnosisWorkerId;
  decision: "validated" | "rejected";
  support_score: number;
  checks: ReplayXChallengerCandidateCheck[];
}

export interface ReplayXChallengerValidationPhaseOutput {
  schemaVersion: 1;
  phase: "challenger-validation";
  incidentId: string;
  prompt_version: string;
  winner: ReplayXDiagnosisWorkerId | null;
  validated: ReplayXDiagnosisWorkerId[];
  rejected: ReplayXChallengerRejectedCandidate[];
  winning_reason: string;
  remaining_uncertainty: string;
  status: ReplayXChallengerValidationStatus;
  candidate_reviews: ReplayXChallengerCandidateReview[];
}

export interface ReplayXRunPlan {
  incident: ReplayXIncidentPointer;
  runtime: ReplayXRuntimeConfig;
  phases: ReplayXPhaseDefinition[];
}

export interface ReplayXFixWorkerOutput {
  strategy: ReplayXFixStrategyId;
  status: ReplayXFixWorkerStatus;
  summary: string;
  files_changed: string[];
  verification_command: string;
  verification_result: string;
  blast_radius: "low" | "medium" | "high";
  rollback_note: string;
  risk_note: string;
  score: number;
  demo_summary: string;
}

export interface ReplayXFixWorkerRunRecord {
  strategy: ReplayXFixStrategyId;
  mode: "codex-sdk" | "local-heuristic";
  thread_id: string | null;
  output: ReplayXFixWorkerOutput;
  raw_response: string | null;
  error: string | null;
}

export interface ReplayXFixArenaPhaseOutput {
  schemaVersion: 1;
  phase: "fix-arena";
  incidentId: string;
  prompt_version: string;
  selected_diagnosis_worker: ReplayXDiagnosisWorkerId | null;
  selected_diagnosis: string;
  worker_results: ReplayXFixWorkerRunRecord[];
  winner: ReplayXFixStrategyId | null;
  winner_summary: string;
  winner_changed_files: string[];
  ranking: Array<{
    rank: number;
    strategy: ReplayXFixStrategyId;
    score: number;
    status: ReplayXFixWorkerStatus;
  }>;
  demo_summary: string;
}

export interface ReplayXReviewFinding {
  severity: "critical" | "important" | "suggestion";
  file: string;
  issue: string;
}

export interface ReplayXRegressionProof {
  test_type: "unit" | "integration" | "script" | "manual_check";
  target_files: string[];
  why_this_test: string;
  verification_command: string;
  demo_summary: string;
}

export interface ReplayXReviewAndRegressionPhaseOutput {
  schemaVersion: 1;
  phase: "review-and-regression";
  incidentId: string;
  review_verdict: "verified" | "blocked" | "planned";
  findings: ReplayXReviewFinding[];
  residual_risk: string;
  regression_proof: ReplayXRegressionProof;
  demo_summary: string;
}

export interface ReplayXPostmortemAndSkillPhaseOutput {
  schemaVersion: 1;
  phase: "postmortem-and-skill";
  incidentId: string;
  postmortem_path: string;
  postmortem_summary: string;
  skill_path: string;
  skill_summary: string;
  demo_summary: string;
}

export interface ReplayXDashboardReplayArtifact {
  schemaVersion: 1;
  incidentId: string;
  incident_card: {
    title: string;
    service: string;
    severity: string;
    symptom: string;
    customerImpact: string;
  };
  timeline: Array<{
    step: string;
    title: string;
    summary: string;
    status: "completed" | "highlighted";
  }>;
  worker_cards: Array<{
    worker: string;
    specialty: string;
    diagnosis: string;
    confidence: number;
    status: string;
  }>;
  winner_card: {
    worker: string;
    diagnosis: string;
    confidence: number;
    winning_reason: string;
  };
  fix_card: {
    strategy: string;
    summary: string;
    changed_files: string[];
    verification_result: string;
  };
  proof_card: {
    review_verdict: string;
    regression_command: string;
    regression_summary: string;
  };
  postmortem_card: {
    summary: string;
    path: string;
  };
  skill_card: {
    summary: string;
    path: string;
  };
  before_after: {
    before: string;
    after: string;
  };
  demo_summary: string;
}

export interface ReplayXSlackIntakeArtifact {
  schemaVersion: 1;
  incidentId: string;
  acknowledgement_message: string;
  incident_summary: string;
  handoff_target: string;
  replay_target: string;
}

export interface ReplayXDemoScriptBeat {
  timestamp: string;
  screen: string;
  narration: string;
  proof_point: string;
}

export interface ReplayXDemoScriptArtifact {
  schemaVersion: 1;
  incidentId: string;
  beats: ReplayXDemoScriptBeat[];
  closing_line: string;
}
