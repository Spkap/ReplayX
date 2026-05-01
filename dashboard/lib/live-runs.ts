import { existsSync, promises as fs } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type {
  ReplayXDashboardReplayArtifact,
  NormalizedIncident,
  ReplayXPhaseId,
  ReplayXRuntimeConfig
} from "../../orchestrator/types.js";
import { buildAuthorizedPath, buildControlPlaneAccessToken } from "./control-plane-auth";
import { runSeededPatchValidation, type PatchValidationResult } from "./live-run-resolution";
import { getRunStore, getSerializedRun, listSerializedRuns, upsertRun } from "./run-store";

export type LiveRunStatus =
  | "queued"
  | "triaging"
  | "reproducing"
  | "diagnosing"
  | "patching"
  | "validating"
  | "awaiting_approval"
  | "opening_pr"
  | "resolved_to_pr"
  | "blocked"
  | "failed"
  | "cancelled";

export type LivePhaseStatus = "queued" | "running" | "completed" | "blocked" | "failed" | "cancelled";

export type LiveRunEvent = {
  id: string;
  at: string;
  actor: "system" | "slack" | "operator" | "agent";
  kind: string;
  title: string;
  summary: string;
  phaseId: ReplayXPhaseId | null;
  status: LiveRunStatus;
  evidenceRefs: string[];
};

export type LiveRunEvidenceStatus = "info" | "passed" | "failed" | "blocked";

export type LiveRunEvidenceItem = {
  id: string;
  at: string;
  phaseId: ReplayXPhaseId | null;
  kind: "intake" | "command" | "artifact" | "policy" | "decision" | "handoff";
  status: LiveRunEvidenceStatus;
  label: string;
  summary: string;
  actor: "system" | "slack" | "operator" | "agent";
  command: string | null;
  exitCode: number | null;
  durationMs: number | null;
  artifactPath: string | null;
  artifactId: "preview" | "diff" | "postmortem" | "skill" | null;
};

export type LiveRunDecisionRecord = {
  id: string;
  at: string;
  phaseId: ReplayXPhaseId | null;
  status: "accepted" | "validated" | "blocked";
  decision: string;
  rationale: string;
  evidenceItemIds: string[];
};

export type LiveRunApproval = {
  id: string;
  kind: "pr_creation" | "production_access" | "memory_promotion";
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  updatedAt: string;
  summary: string;
};

export type LiveRunCapabilityStatus = "full" | "analysis_only" | "manual_fix_required";

export type LiveRunCapability = {
  id: string | null;
  status: LiveRunCapabilityStatus;
  summary: string;
};

export type LiveRunPullRequest = {
  status: "pending" | "ready" | "unavailable";
  branchName: string | null;
  title: string | null;
  summary: string | null;
  url: string | null;
  changedFiles: string[];
  previewPath: string | null;
  diffPath: string | null;
  rollbackNote: string | null;
};

export type IntegrationHealthSignal = {
  integration: "slack" | "executor" | "memory";
  status: "healthy" | "degraded" | "failed";
  summary: string;
};

export type WorkspacePolicy = {
  analysisOnly: boolean;
  patchAndValidate: boolean;
  prCreation: boolean;
  allowProductionAccess: boolean;
  allowMemoryPromotion: boolean;
};

export type LiveRunPhase = {
  id: ReplayXPhaseId;
  label: string;
  status: LivePhaseStatus;
  startedAt: string | null;
  completedAt: string | null;
  summary: string;
};

export type CreateReplayXRunInput = {
  source: "slack" | "manual";
  text: string;
  incidentId?: string | null;
  workspaceId?: string;
  owner?: string | null;
  repoTarget?: string | null;
  environmentTarget?: string | null;
  serviceTarget?: string | null;
  severity?: string | null;
  channel?: string | null;
  threadTs?: string | null;
  user?: string | null;
};

export type LiveRunCards = {
  workerCards: ReplayXDashboardReplayArtifact["worker_cards"];
  winningDiagnosis: ReplayXDashboardReplayArtifact["winner_card"];
  fix: ReplayXDashboardReplayArtifact["fix_card"];
  proof: ReplayXDashboardReplayArtifact["proof_card"];
  postmortem: ReplayXDashboardReplayArtifact["postmortem_card"];
  skill: ReplayXDashboardReplayArtifact["skill_card"];
  beforeAfter: ReplayXDashboardReplayArtifact["before_after"];
  operatorSummary: string;
};

export type ReplayXLiveRun = {
  schemaVersion: 2;
  origin: "live-run" | "legacy-import";
  executionMode: "realtime" | "fixture";
  version: number;
  runId: string;
  previousRunId: string | null;
  workspaceId: string;
  owner: string;
  source: "slack" | "manual";
  status: LiveRunStatus;
  severity: string;
  repoTarget: string;
  serviceTarget: string;
  environmentTarget: string;
  incidentId: string;
  incidentPath: string;
  capability: LiveRunCapability;
  currentPhaseId: ReplayXPhaseId | null;
  currentBlocker: string | null;
  issue: {
    text: string;
    channel: string | null;
    threadTs: string | null;
    user: string | null;
  };
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  archivedBy: "operator" | "system" | null;
  error: string | null;
  policy: WorkspacePolicy;
  phases: LiveRunPhase[];
  events: LiveRunEvent[];
  evidence: LiveRunEvidenceItem[];
  decisions: LiveRunDecisionRecord[];
  approvals: LiveRunApproval[];
  integrations: IntegrationHealthSignal[];
  pullRequest: LiveRunPullRequest;
  cards: LiveRunCards;
};

export type LiveRunOptions = {
  repoRoot?: string;
  runStoreRoot?: string;
  legacyRunStoreRoot?: string;
  artifactsRoot?: string;
  phaseDelayMs?: number;
  includeArchived?: boolean;
};

type ResolvedLiveRunOptions = {
  repoRoot: string;
  runStoreRoot: string;
  legacyRunStoreRoot: string | null;
  artifactsRoot: string;
  phaseDelayMs: number;
  includeArchived: boolean;
};

export type ReplayXAnalyticsSnapshot = {
  totalRuns: number;
  visibleRuns: number;
  archivedRuns: number;
  activeRuns: number;
  blockedRuns: number;
  approvalQueue: number;
  mttrMinutes: number | null;
  phaseTimingMinutes: Record<string, number>;
  reproSuccessRate: number;
  validationSuccessRate: number;
  prAcceptanceRate: number;
  operatorInterventionRate: number;
  skillReuseRate: number;
  evidenceBackedRunRate: number;
  evidenceRecords: number;
  decisionRecords: number;
  topRecurringIncidentFingerprints: Array<{ incidentId: string; count: number }>;
  topFailingIntegrations: Array<{ integration: string; count: number }>;
};

type IncidentSelection = {
  capability: LiveRunCapability;
  executionMode: ReplayXLiveRun["executionMode"];
  incidentId: string;
  incidentPath: string;
  confidence: number;
  matchedBy: "explicit" | "keyword" | "realtime" | "unmatched";
};

const normalizeLegacyRun = (rawRun: ReplayXLiveRun | (Record<string, unknown> & { runId: string })): ReplayXLiveRun => {
  const run = rawRun as Record<string, unknown>;
  const status = typeof run.status === "string" ? run.status : "queued";
  const issue =
    typeof run.issue === "object" && run.issue !== null
      ? (run.issue as ReplayXLiveRun["issue"])
      : { text: "Legacy ReplayX run", channel: null, threadTs: null, user: null };

  const normalizedPullRequest =
      (run.pullRequest as LiveRunPullRequest | undefined) ?? {
        status: "pending",
        branchName: null,
        title: null,
        summary: null,
        url: null,
        changedFiles: [],
        previewPath: null,
        diffPath: null,
      rollbackNote: null
    };

  const normalizedStatus: LiveRunStatus =
    status === "completed"
      ? normalizedPullRequest.status === "ready"
        ? "resolved_to_pr"
        : "blocked"
      : (status as LiveRunStatus);

  const normalizedCurrentBlocker =
    typeof run.currentBlocker === "string"
      ? run.currentBlocker
      : status === "completed" && normalizedPullRequest.status !== "ready"
        ? "Legacy run completed without a validated PR-ready bundle."
        : null;

  return {
    schemaVersion: 2,
    origin: run.origin === "live-run" ? "live-run" : "legacy-import",
    executionMode:
      run.executionMode === "fixture"
        ? "fixture"
        : run.executionMode === "realtime"
          ? "realtime"
          : typeof run.incidentPath === "string" && run.incidentPath
            ? "fixture"
            : "realtime",
    version: typeof run.version === "number" && Number.isFinite(run.version) ? run.version : 1,
    runId: String(run.runId),
    previousRunId: typeof run.previousRunId === "string" ? run.previousRunId : null,
    workspaceId: typeof run.workspaceId === "string" ? run.workspaceId : defaultWorkspaceId,
    owner: typeof run.owner === "string" ? run.owner : issue.user ?? "unassigned",
    source: run.source === "slack" ? "slack" : "manual",
    status: normalizedStatus,
    severity: typeof run.severity === "string" ? run.severity : "sev-2",
    repoTarget: typeof run.repoTarget === "string" ? run.repoTarget : "demo_app/",
    serviceTarget: typeof run.serviceTarget === "string" ? run.serviceTarget : "checkout-api",
    environmentTarget: typeof run.environmentTarget === "string" ? run.environmentTarget : "staging",
    incidentId: typeof run.incidentId === "string" ? run.incidentId : "incident-checkout-race-001",
    incidentPath: typeof run.incidentPath === "string" ? run.incidentPath : "",
    capability:
      typeof run.capability === "object" && run.capability !== null
        ? (run.capability as LiveRunCapability)
        : typeof run.incidentPath === "string" && run.incidentPath
          ? defaultFixtureCapability()
          : {
              id: "capability:realtime-investigation",
              status: "analysis_only",
              summary: "ReplayX will inspect the live repo state without a seeded fixture."
            },
    currentPhaseId: (run.currentPhaseId as ReplayXPhaseId | null) ?? null,
    currentBlocker: normalizedCurrentBlocker,
    issue,
    createdAt: typeof run.createdAt === "string" ? run.createdAt : nowIso(),
    updatedAt: typeof run.updatedAt === "string" ? run.updatedAt : nowIso(),
    completedAt: typeof run.completedAt === "string" ? run.completedAt : null,
    archivedAt: typeof run.archivedAt === "string" ? run.archivedAt : null,
    archivedBy: run.archivedBy === "operator" || run.archivedBy === "system" ? run.archivedBy : null,
    error: typeof run.error === "string" ? run.error : null,
    policy: (run.policy as WorkspacePolicy | undefined) ?? createDefaultPolicy(),
    phases:
      (run.phases as LiveRunPhase[] | undefined) ??
      livePhaseDefinitions.map((phase) => ({
        ...phase,
        status: "queued",
        startedAt: null,
        completedAt: null,
        summary: "Waiting to start."
      })),
    events: (run.events as LiveRunEvent[] | undefined) ?? [],
    evidence: (run.evidence as LiveRunEvidenceItem[] | undefined) ?? [],
    decisions: (run.decisions as LiveRunDecisionRecord[] | undefined) ?? [],
    approvals: (run.approvals as LiveRunApproval[] | undefined) ?? [],
    integrations: (run.integrations as IntegrationHealthSignal[] | undefined) ?? createDefaultIntegrations(),
    pullRequest: normalizedPullRequest,
    cards: (run.cards as LiveRunCards | undefined) ?? pendingCards(issue.text)
  };
};

const resolveDefaultRepoRoot = (startDirectory: string): string => {
  let currentDirectory = path.resolve(startDirectory);

  while (true) {
    if (
      existsSync(path.join(currentDirectory, "incidents")) &&
      existsSync(path.join(currentDirectory, "orchestrator"))
    ) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return path.resolve(startDirectory);
    }

    currentDirectory = parentDirectory;
  }
};

const defaultRepoRoot = resolveDefaultRepoRoot(process.cwd());

const livePhaseDefinitions: Array<{ id: ReplayXPhaseId; label: string }> = [
  { id: "incident-intake", label: "Incident intake" },
  { id: "skill-match", label: "Routing and fast-path skill match" },
  { id: "repro", label: "Repro and environment verification" },
  { id: "diagnosis-arena", label: "Diagnosis arena" },
  { id: "challenger-validation", label: "Challenger validation" },
  { id: "fix-arena", label: "Patch generation" },
  { id: "review-and-regression", label: "Validation and regression checks" },
  { id: "postmortem-and-skill", label: "Resolution and memory promotion" }
];

const pendingCards = (issueText: string): LiveRunCards => ({
  workerCards: [],
  winningDiagnosis: {
    worker: "pending",
    diagnosis: "ReplayX is preparing the worker arena.",
    confidence: 0,
    winning_reason: "Waiting for diagnosis workers to produce evidence."
  },
  fix: {
    strategy: "pending",
    summary: "Patch generation has not started yet.",
    changed_files: [],
    verification_result: "Validation evidence will appear after the patch loop runs."
  },
  proof: {
    review_verdict: "pending",
    regression_command: "pending",
    regression_summary: "Regression evidence will appear once ReplayX runs the validation loop."
  },
  postmortem: {
    summary: "Postmortem will be written after the run resolves.",
    path: "pending"
  },
  skill: {
    summary: `ReplayX is learning from: ${issueText}`,
    path: "pending"
  },
  beforeAfter: {
    before: issueText,
    after: "ReplayX will attach the validated outcome here."
  },
  operatorSummary: "ReplayX live run is queued."
});

const nowIso = (): string => new Date().toISOString();

const createEventId = (): string =>
  `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const createEvidenceId = (): string =>
  `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const createDecisionId = (): string =>
  `dec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const resolveOptions = (options: LiveRunOptions = {}) => {
  const repoRoot = options.repoRoot ?? defaultRepoRoot;

  return {
    repoRoot,
    runStoreRoot: options.runStoreRoot ?? path.join(repoRoot, ".replayx-control-plane"),
    legacyRunStoreRoot:
      options.legacyRunStoreRoot !== undefined
        ? options.legacyRunStoreRoot
        : options.runStoreRoot
          ? null
          : path.join(repoRoot, ".replayx-runs"),
    artifactsRoot: options.artifactsRoot ?? path.join(repoRoot, "artifacts"),
    phaseDelayMs: options.phaseDelayMs ?? Number(process.env.REPLAYX_LIVE_PHASE_DELAY_MS ?? "800"),
    includeArchived: options.includeArchived ?? false
  };
};

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

const createRunId = (): string =>
  `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const isTerminalStatus = (status: LiveRunStatus): boolean =>
  status === "resolved_to_pr" || status === "blocked" || status === "failed" || status === "cancelled";

const isArchivedRun = (run: ReplayXLiveRun): boolean => run.archivedAt !== null;

const assertRunMutable = (
  run: ReplayXLiveRun,
  action: "approve" | "cancel" | "retry"
): void => {
  if (isArchivedRun(run)) {
    throw new Error(
      `ReplayX cannot ${action} an archived run. Archived runs are read-only incident records.`
    );
  }
};

const compareRunsByRecency = (left: ReplayXLiveRun, right: ReplayXLiveRun): number => {
  const leftKey = left.completedAt ?? left.updatedAt ?? left.createdAt;
  const rightKey = right.completedAt ?? right.updatedAt ?? right.createdAt;
  return rightKey.localeCompare(leftKey);
};

const phaseStatusToRunStatus = (phaseId: ReplayXPhaseId, phaseStatus: LivePhaseStatus): LiveRunStatus => {
  if (phaseStatus === "failed") {
    return "failed";
  }
  if (phaseStatus === "blocked") {
    return "blocked";
  }
  if (phaseStatus === "cancelled") {
    return "cancelled";
  }
  if (phaseStatus !== "running") {
    return "queued";
  }

  switch (phaseId) {
    case "incident-intake":
    case "skill-match":
      return "triaging";
    case "repro":
      return "reproducing";
    case "diagnosis-arena":
    case "challenger-validation":
      return "diagnosing";
    case "fix-arena":
      return "patching";
    case "review-and-regression":
      return "validating";
    case "postmortem-and-skill":
      return "opening_pr";
    default:
      return "queued";
  }
};

const incidentCatalog = {
  "incident-checkout-race-001": {
    path: "checkout-race-condition.json",
    keywords: ["checkout", "inventory", "oversell", "race", "reservation", "sku"]
  },
  "incident-auth-session-002": {
    path: "auth-token-session-failure.json",
    keywords: ["auth", "token", "session", "401", "idle", "refresh", "bearer"]
  },
  "incident-null-shape-003": {
    path: "null-data-shape-failure.json",
    keywords: ["null", "tax", "taxes", "summary", "quote", "reduce", "shape"]
  }
} satisfies Record<string, { path: string; keywords: string[] }>;

const buildIncidentFingerprint = (text: string): string => {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .filter(Boolean)
    .slice(0, 6)
    .join("-");

  return slug || "manual-investigation";
};

const defaultFixtureCapability = (): LiveRunCapability => ({
  id: "capability:fixture-eval",
  status: "full",
  summary: "ReplayX can run the explicit fixture/eval path for this incident class."
});

const buildRealtimeSelection = (
  input: Pick<CreateReplayXRunInput, "incidentId" | "text">
): IncidentSelection => {
  const explicitIncidentId = input.incidentId?.trim();

  return {
    capability: {
      id: "capability:realtime-investigation",
      status: "analysis_only",
      summary: explicitIncidentId
        ? `ReplayX accepted ${explicitIncidentId} as a realtime incident. No fixture answer key will be used. ReplayX will inspect the live repo state, run validation, and produce an evidence-backed investigation packet.`
        : "ReplayX accepted this as a realtime incident. No fixture answer key will be used. ReplayX will inspect the live repo state, run validation, and produce an evidence-backed investigation packet."
    },
    executionMode: "realtime",
    incidentId: explicitIncidentId || `incident-${buildIncidentFingerprint(input.text)}`,
    incidentPath: "",
    confidence: 0,
    matchedBy: "realtime"
  };
};

const resolveIncidentSelection = (
  repoRoot: string,
  input: Pick<CreateReplayXRunInput, "incidentId" | "text">
): IncidentSelection => {
  const explicitIncidentId = input.incidentId?.trim() ?? "";

  if (explicitIncidentId) {
    const entry = incidentCatalog[explicitIncidentId as keyof typeof incidentCatalog];

    if (!entry) {
      return buildRealtimeSelection(input);
    }

    return {
      capability: defaultFixtureCapability(),
      executionMode: "fixture",
      incidentId: explicitIncidentId,
      incidentPath: path.join(repoRoot, "incidents", entry.path),
      confidence: 1,
      matchedBy: "explicit"
    };
  }

  if (process.env.REPLAYX_ALLOW_SEEDED_KEYWORD_MATCH !== "1") {
    return buildRealtimeSelection(input);
  }

  const normalized = input.text.toLowerCase();
  const ranked = Object.entries(incidentCatalog)
    .map(([incidentId, entry]) => {
      const matches = entry.keywords.filter((keyword) => normalized.includes(keyword)).length;
      return {
        incidentId,
        incidentPath: path.join(repoRoot, "incidents", entry.path),
        score: matches / entry.keywords.length
      };
    })
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  const secondBest = ranked[1];

  if (!best || best.score < 0.3 || (secondBest && best.score - secondBest.score < 0.15)) {
    return buildRealtimeSelection(input);
  }

  return {
    capability: defaultFixtureCapability(),
    executionMode: "fixture",
    incidentId: best.incidentId,
    incidentPath: best.incidentPath,
    confidence: Number(best.score.toFixed(2)),
    matchedBy: "keyword"
  };
};

const expectRecord = (value: unknown, context: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }

  return value as Record<string, unknown>;
};

const expectString = (value: unknown, context: string): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context} must be a non-empty string.`);
  }

  return value;
};

const expectNumber = (value: unknown, context: string): number => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${context} must be a number.`);
  }

  return value;
};

const expectStringArray = (value: unknown, context: string): string[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array.`);
  }

  return value.map((entry, index) => expectString(entry, `${context}[${index}]`));
};

const parseLiveRunIncident = (value: unknown): NormalizedIncident => {
  const incident = expectRecord(value, "NormalizedIncident");
  const summary = expectRecord(incident.summary, "NormalizedIncident.summary");
  const commands = expectRecord(incident.commands, "NormalizedIncident.commands");
  const failing = expectRecord(commands.failing, "NormalizedIncident.commands.failing");
  const healthy = expectRecord(commands.healthy, "NormalizedIncident.commands.healthy");

  if (incident.schemaVersion !== 1) {
    throw new Error("NormalizedIncident.schemaVersion must equal 1.");
  }

  expectString(incident.incidentId, "NormalizedIncident.incidentId");
  expectString(incident.title, "NormalizedIncident.title");
  expectString(incident.incidentClass, "NormalizedIncident.incidentClass");
  expectString(incident.service, "NormalizedIncident.service");
  expectString(incident.environment, "NormalizedIncident.environment");
  expectString(incident.severity, "NormalizedIncident.severity");
  expectString(incident.repoRoot, "NormalizedIncident.repoRoot");
  expectString(summary.symptom, "NormalizedIncident.summary.symptom");
  expectString(summary.customerImpact, "NormalizedIncident.summary.customerImpact");
  expectString(summary.firstObservedAt, "NormalizedIncident.summary.firstObservedAt");
  expectStringArray(incident.suspectedFiles, "NormalizedIncident.suspectedFiles");
  expectString(failing.label, "NormalizedIncident.commands.failing.label");
  expectString(failing.command, "NormalizedIncident.commands.failing.command");
  expectString(failing.workingDirectory, "NormalizedIncident.commands.failing.workingDirectory");
  expectNumber(failing.expectedExitCode, "NormalizedIncident.commands.failing.expectedExitCode");
  expectString(healthy.label, "NormalizedIncident.commands.healthy.label");
  expectString(healthy.command, "NormalizedIncident.commands.healthy.command");
  expectString(healthy.workingDirectory, "NormalizedIncident.commands.healthy.workingDirectory");
  expectNumber(healthy.expectedExitCode, "NormalizedIncident.commands.healthy.expectedExitCode");
  expectStringArray(incident.constraints, "NormalizedIncident.constraints");
  expectStringArray(incident.acceptanceCriteria, "NormalizedIncident.acceptanceCriteria");
  expectRecord(incident.evidence, "NormalizedIncident.evidence");

  return incident as unknown as NormalizedIncident;
};

const loadNormalizedIncidentFile = async (incidentPath: string): Promise<NormalizedIncident> => {
  const text = await fs.readFile(incidentPath, "utf8");
  return parseLiveRunIncident(JSON.parse(text) as unknown);
};

const importRepoModule = async <T>(repoRoot: string, modulePath: string): Promise<T> => {
  const absolutePath = path.join(repoRoot, modulePath);
  return import(/* webpackIgnore: true */ pathToFileURL(absolutePath).href) as Promise<T>;
};

const readRun = async (runId: string, options: ResolvedLiveRunOptions): Promise<ReplayXLiveRun> => {
  const db = getRunStore(options.runStoreRoot, options.legacyRunStoreRoot ?? null);
  const text = getSerializedRun(db, runId);

  if (!text) {
    const error = new Error("Run not found") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    throw error;
  }

  return normalizeLegacyRun(JSON.parse(text) as ReplayXLiveRun);
};

const writeRun = async (run: ReplayXLiveRun, options: ResolvedLiveRunOptions): Promise<ReplayXLiveRun> => {
  const db = getRunStore(options.runStoreRoot, options.legacyRunStoreRoot ?? null);
  const existingText = getSerializedRun(db, run.runId);

  if (!existingText) {
    upsertRun(db, run);
    return run;
  }

  const latest = normalizeLegacyRun(JSON.parse(existingText) as ReplayXLiveRun);

  if (isTerminalStatus(latest.status) && latest.status !== run.status) {
    return latest;
  }

  const nextRun: ReplayXLiveRun = {
    ...run,
    version: Math.max(latest.version, run.version) + 1
  };
  upsertRun(db, nextRun);
  return nextRun;
};

const appendEvent = (
  run: ReplayXLiveRun,
  event: Omit<LiveRunEvent, "id" | "at" | "status"> & { status?: LiveRunStatus }
): ReplayXLiveRun => {
  const nextEvent: LiveRunEvent = {
    id: createEventId(),
    at: nowIso(),
    actor: event.actor,
    kind: event.kind,
    title: event.title,
    summary: event.summary,
    phaseId: event.phaseId,
    status: event.status ?? run.status,
    evidenceRefs: event.evidenceRefs
  };

  return {
    ...run,
    updatedAt: nextEvent.at,
    events: [...run.events, nextEvent]
  };
};

const appendEvidence = (
  run: ReplayXLiveRun,
  evidence: Omit<LiveRunEvidenceItem, "id" | "at">
): ReplayXLiveRun => {
  const nextEvidence: LiveRunEvidenceItem = {
    id: createEvidenceId(),
    at: nowIso(),
    ...evidence
  };

  return {
    ...run,
    updatedAt: nextEvidence.at,
    evidence: [...run.evidence, nextEvidence]
  };
};

const appendDecision = (
  run: ReplayXLiveRun,
  decision: Omit<LiveRunDecisionRecord, "id" | "at">
): ReplayXLiveRun => {
  const nextDecision: LiveRunDecisionRecord = {
    id: createDecisionId(),
    at: nowIso(),
    ...decision
  };

  return {
    ...run,
    updatedAt: nextDecision.at,
    decisions: [...run.decisions, nextDecision]
  };
};

const summarizeApprovalQueue = (approvals: LiveRunApproval[]): string | null => {
  const pending = approvals.filter((approval) => approval.status === "pending");
  if (pending.length === 0) {
    return null;
  }

  return pending.map((approval) => approval.summary).join(" ");
};

const normalizeBaseUrl = (value: string | undefined): string =>
  typeof value === "string" ? value.trim().replace(/\/+$/, "") : "";

const buildWorkspaceUrl = (run: ReplayXLiveRun): string | null => {
  const dashboardBaseUrl = normalizeBaseUrl(process.env.REPLAYX_DASHBOARD_URL);

  if (!dashboardBaseUrl) {
    return null;
  }

  const accessToken = buildControlPlaneAccessToken({
    scope: "run",
    runId: run.runId,
    workspaceId: run.workspaceId
  });

  return `${dashboardBaseUrl}${buildAuthorizedPath(
    `/workspaces/${encodeURIComponent(run.workspaceId)}/incidents/${encodeURIComponent(run.runId)}`,
    accessToken
  )}`;
};

const buildControlPlaneActionUrl = (
  run: ReplayXLiveRun,
  action: "approve" | "retry" | "cancel" | "archive"
): string | null => {
  const dashboardBaseUrl = normalizeBaseUrl(process.env.REPLAYX_DASHBOARD_URL);

  if (!dashboardBaseUrl) {
    return null;
  }

  const accessToken = buildControlPlaneAccessToken({
    scope: "run",
    runId: run.runId,
    workspaceId: run.workspaceId
  });

  return `${dashboardBaseUrl}${buildAuthorizedPath(
    `/runs/${encodeURIComponent(run.runId)}/actions/${action}`,
    accessToken
  )}`;
};

const buildSlackBlocks = (run: ReplayXLiveRun) => {
  const workspaceUrl = buildWorkspaceUrl(run);
  const blocks: Array<Record<string, unknown>> = [];
  const actionElements: Array<Record<string, unknown>> = [];

  if (workspaceUrl) {
    actionElements.push({
      type: "button",
      text: { type: "plain_text", text: "Open Incident Workspace" },
      url: workspaceUrl,
      style: "primary"
    });
  }

  if (run.approvals.some((approval) => approval.status === "pending")) {
    const approveUrl = buildControlPlaneActionUrl(run, "approve");
    const cancelUrl = buildControlPlaneActionUrl(run, "cancel");

    if (approveUrl) {
      actionElements.push({
        type: "button",
        text: { type: "plain_text", text: "Approve Run" },
        url: approveUrl
      });
    }

    if (cancelUrl) {
      actionElements.push({
        type: "button",
        text: { type: "plain_text", text: "Cancel Run" },
        url: cancelUrl,
        style: "danger"
      });
    }
  } else if (isTerminalStatus(run.status)) {
    const retryUrl = !isArchivedRun(run) ? buildControlPlaneActionUrl(run, "retry") : null;
    const archiveUrl = !isArchivedRun(run) ? buildControlPlaneActionUrl(run, "archive") : null;

    if (retryUrl) {
      actionElements.push({
        type: "button",
        text: { type: "plain_text", text: "Retry Run" },
        url: retryUrl
      });
    }

    if (archiveUrl) {
      actionElements.push({
        type: "button",
        text: { type: "plain_text", text: "Archive Run" },
        url: archiveUrl
      });
    }
  }

  if (run.pullRequest.url) {
    actionElements.push({
      type: "button",
      text: { type: "plain_text", text: "Open Pull Request" },
      url: run.pullRequest.url
    });
  }

  if (actionElements.length > 0) {
    blocks.push({
      type: "actions",
      elements: actionElements
    });
  }

  return blocks.length > 0 ? blocks : undefined;
};

const buildApprovalSlackSummary = (run: ReplayXLiveRun): string =>
  [
    `ReplayX accepted run \`${run.runId}\` for workspace \`${run.workspaceId}\`.`,
    `Status: awaiting approval.`,
    run.currentBlocker ?? "An operator must approve the next action before ReplayX can continue."
  ].join("\n");

const postSlackUpdate = async (run: ReplayXLiveRun, text: string): Promise<void> => {
  const slackApiBaseUrl = process.env.REPLAYX_SLACK_API_URL?.trim().replace(/\/+$/, "");
  const internalApiToken = process.env.REPLAYX_INTERNAL_API_TOKEN;

  if (!slackApiBaseUrl || !internalApiToken || !run.issue.channel) {
    return;
  }

  await fetch(`${slackApiBaseUrl}/api/slack/post-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${internalApiToken}`
    },
    body: JSON.stringify({
      channel: run.issue.channel,
      threadTs: run.issue.threadTs,
      text,
      blocks: buildSlackBlocks(run)
    })
  }).catch(() => undefined);
};

const buildFinalSlackSummary = (run: ReplayXLiveRun): string => {
  const resultLine =
    run.status === "resolved_to_pr"
      ? `ReplayX resolved this run to a verified PR-ready bundle.`
      : `ReplayX could not complete this run automatically.`;
  const prLine =
    run.pullRequest.status === "ready"
      ? run.pullRequest.url
        ? `Pull request: ${run.pullRequest.url}`
        : "PR preview bundle is available in the incident workspace."
      : "PR was not created.";
  const blockerLine = run.currentBlocker ? `Blocker: ${run.currentBlocker}` : `Status: ${run.status.replaceAll("_", " ")}.`;

  return [
    `ReplayX run \`${run.runId}\` finished for workspace \`${run.workspaceId}\`.`,
    resultLine,
    blockerLine,
    `Winning diagnosis: ${run.cards.winningDiagnosis.diagnosis}`,
    `Validation: ${run.cards.proof.regression_summary}`,
    prLine
  ].join("\n");
};

const commandEvidenceStatus = (exitCode: number | null): LiveRunEvidenceStatus =>
  exitCode === 0 ? "passed" : "failed";

const validationEvidenceFromPatchResult = (
  incident: NormalizedIncident,
  patchValidation: PatchValidationResult
): Array<Omit<LiveRunEvidenceItem, "id" | "at">> => [
  {
    phaseId: "review-and-regression",
    kind: "command",
    status: commandEvidenceStatus(patchValidation.validationResults.failing.exitCode),
    label: incident.commands.failing.label,
    summary:
      patchValidation.validationResults.failing.exitCode === 0
        ? "Previously failing path passed after ReplayX applied the patch candidate."
        : "Previously failing path still failed after ReplayX applied the patch candidate.",
    actor: "agent",
    command: patchValidation.validationResults.failing.command,
    exitCode: patchValidation.validationResults.failing.exitCode,
    durationMs: patchValidation.validationResults.failing.durationMs,
    artifactPath: null,
    artifactId: null
  },
  {
    phaseId: "review-and-regression",
    kind: "command",
    status: commandEvidenceStatus(patchValidation.validationResults.healthy.exitCode),
    label: incident.commands.healthy.label,
    summary:
      patchValidation.validationResults.healthy.exitCode === 0
        ? "Healthy control stayed green after the patch candidate."
        : "Healthy control regressed after the patch candidate.",
    actor: "agent",
    command: patchValidation.validationResults.healthy.command,
    exitCode: patchValidation.validationResults.healthy.exitCode,
    durationMs: patchValidation.validationResults.healthy.durationMs,
    artifactPath: null,
    artifactId: null
  },
  {
    phaseId: "review-and-regression",
    kind: "artifact",
    status: patchValidation.status === "validated" ? "passed" : "blocked",
    label: "Validated patch diff",
    summary: "ReplayX preserved the exact diff reviewed by the sandbox validation loop.",
    actor: "agent",
    command: null,
    exitCode: null,
    durationMs: null,
    artifactPath: patchValidation.diffPath,
    artifactId: "diff"
  },
  ...(patchValidation.prPreviewPath
    ? [
        {
          phaseId: "review-and-regression" as ReplayXPhaseId,
          kind: "artifact" as const,
          status: patchValidation.status === "validated" ? ("passed" as const) : ("blocked" as const),
          label: "PR preview bundle",
          summary: "ReplayX packaged the change summary, validation commands, and rollback note for operator review.",
          actor: "agent" as const,
          command: null,
          exitCode: null,
          durationMs: null,
          artifactPath: patchValidation.prPreviewPath,
          artifactId: "preview" as const
        }
      ]
    : [])
];

const updatePhase = async (
  run: ReplayXLiveRun,
  phaseId: ReplayXPhaseId,
  status: LivePhaseStatus,
  summary: string,
  options: ResolvedLiveRunOptions,
  extra: { blocker?: string | null; evidenceRefs?: string[] } = {}
): Promise<ReplayXLiveRun> => {
  const timestamp = nowIso();
  const phases = run.phases.map((phase) => {
    if (phase.id !== phaseId) {
      return phase;
    }

    return {
      ...phase,
      status,
      summary,
      startedAt: status === "running" && !phase.startedAt ? timestamp : phase.startedAt,
      completedAt:
        status === "completed" || status === "blocked" || status === "failed" || status === "cancelled"
          ? timestamp
          : phase.completedAt
    };
  });

  const nextStatus =
    status === "completed"
      ? run.status
      : phaseStatusToRunStatus(phaseId, status);

  let nextRun: ReplayXLiveRun = {
    ...run,
    status: nextStatus,
    currentPhaseId: phaseId,
    currentBlocker: extra.blocker ?? (status === "blocked" ? summary : summarizeApprovalQueue(run.approvals)),
    updatedAt: timestamp,
    phases
  };

  nextRun = appendEvent(nextRun, {
    actor: "agent",
    kind: `phase.${phaseId}.${status}`,
    title: `${livePhaseDefinitions.find((phase) => phase.id === phaseId)?.label ?? phaseId} ${status}`,
    summary,
    phaseId,
    status: nextRun.status,
    evidenceRefs: extra.evidenceRefs ?? []
  });

  nextRun = await writeRun(nextRun, options);
  await sleep(options.phaseDelayMs);
  return nextRun;
};

const createDefaultPolicy = (): WorkspacePolicy => ({
  analysisOnly: false,
  patchAndValidate: true,
  prCreation: true,
  allowProductionAccess: false,
  allowMemoryPromotion: true
});

const createPolicyForCapability = (capability: LiveRunCapability): WorkspacePolicy =>
  capability.status === "full"
    ? createDefaultPolicy()
    : {
        analysisOnly: true,
        patchAndValidate: false,
        prCreation: false,
        allowProductionAccess: false,
        allowMemoryPromotion: false
      };

const createInitialApprovals = (
  environmentTarget: string,
  policy: WorkspacePolicy
): LiveRunApproval[] => {
  const requestedAt = nowIso();
  const approvals: LiveRunApproval[] = [];

  if (!policy.patchAndValidate) {
    return approvals;
  }

  if (environmentTarget === "production" && !policy.allowProductionAccess) {
    approvals.push({
      id: `approval_${Math.random().toString(36).slice(2, 8)}`,
      kind: "production_access",
      status: "pending",
      requestedAt,
      updatedAt: requestedAt,
      summary: "Production-targeted runs require operator approval before ReplayX can touch the environment."
    });
  }

  if (!policy.prCreation) {
    approvals.push({
      id: `approval_${Math.random().toString(36).slice(2, 8)}`,
      kind: "pr_creation",
      status: "pending",
      requestedAt,
      updatedAt: requestedAt,
      summary: "This workspace blocks PR creation by default. Approve the run before ReplayX can continue."
    });
  }

  return approvals;
};

const createDefaultIntegrations = (): IntegrationHealthSignal[] => [
  { integration: "slack", status: "healthy", summary: "Slack intake and closure updates are available." },
  { integration: "executor", status: "healthy", summary: "Sandbox patch validation is ready." },
  { integration: "memory", status: "healthy", summary: "Validated runs can promote reusable skills." }
];

const defaultWorkspaceId = process.env.REPLAYX_DEFAULT_WORKSPACE_ID ?? "workspace-default";

type RealtimeCommandResult = {
  command: string;
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
};

const REALTIME_STOPWORDS = new Set([
  "after",
  "again",
  "because",
  "before",
  "being",
  "cannot",
  "could",
  "error",
  "failed",
  "from",
  "have",
  "into",
  "issue",
  "just",
  "like",
  "only",
  "that",
  "their",
  "there",
  "this",
  "when",
  "with",
  "would"
]);

const truncateText = (value: string, maxLength = 1800): string =>
  value.length > maxLength ? `${value.slice(0, maxLength)}\n... truncated ...` : value;

const shellQuote = (value: string): string => JSON.stringify(value);

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const extractRealtimeSearchTerms = (text: string): string[] => {
  const terms = text
    .toLowerCase()
    .match(/[a-z0-9_/-]{4,}/g)
    ?.map((term) => term.replace(/^\/+|\/+$/g, ""))
    .filter((term) => term && !REALTIME_STOPWORDS.has(term)) ?? [];

  return [...new Set(terms)].slice(0, 10);
};

const execRealtimeCommand = async (command: string, cwd: string): Promise<RealtimeCommandResult> =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn("/bin/zsh", ["-lc", command], {
      cwd,
      env: {
        ...process.env,
        FORCE_COLOR: "0"
      }
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (exitCode) => {
      resolve({
        command,
        cwd,
        exitCode,
        stdout: truncateText(stdout),
        stderr: truncateText(stderr),
        durationMs: Date.now() - startedAt
      });
    });
  });

const detectPackageManager = async (repoRoot: string): Promise<"pnpm" | "npm"> => {
  try {
    await fs.access(path.join(repoRoot, "pnpm-lock.yaml"));
    return "pnpm";
  } catch {
    return "npm";
  }
};

const resolveRealtimeValidationCommand = async (repoRoot: string): Promise<string> => {
  const configured = process.env.REPLAYX_REALTIME_VALIDATION_COMMAND?.trim();

  if (configured) {
    return configured;
  }

  try {
    const packageJson = JSON.parse(await fs.readFile(path.join(repoRoot, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const packageManager = await detectPackageManager(repoRoot);
    const script = packageJson.scripts?.test
      ? "test"
      : packageJson.scripts?.typecheck
        ? "typecheck"
        : packageJson.scripts?.build
          ? "build"
          : null;

    if (script) {
      return `${packageManager} ${script}`;
    }
  } catch {
    // Fall through to a read-only repo state check.
  }

  return "git status --short";
};

const createRealtimeSearchCommand = (terms: string[]): string => {
  if (terms.length === 0) {
    return "git status --short";
  }

  const pattern = terms.map(escapeRegExp).join("|");
  return [
    "rg",
    "-n",
    "-i",
    "-m",
    "6",
    "--glob",
    shellQuote("!node_modules"),
    "--glob",
    shellQuote("!.next"),
    "--glob",
    shellQuote("!artifacts"),
    "--glob",
    shellQuote("!.replayx-control-plane"),
    "--glob",
    shellQuote("!pnpm-lock.yaml"),
    shellQuote(pattern),
    ".",
    "|",
    "head",
    "-120"
  ].join(" ");
};

const parseCandidateFilesFromSearch = (searchOutput: string): string[] =>
  [
    ...new Set(
      searchOutput
        .split("\n")
        .map((line) => line.split(":", 1)[0]?.replace(/^\.\//, "").trim())
        .filter((file): file is string => Boolean(file && file.includes(".")))
    )
  ].slice(0, 8);

const formatRealtimeCommandSummary = (result: RealtimeCommandResult): string => {
  if (result.exitCode === 0) {
    return `Command passed: ${result.command}`;
  }

  const output = result.stderr || result.stdout;
  return output
    ? `Command exited ${result.exitCode}: ${truncateText(output, 360)}`
    : `Command exited ${result.exitCode}.`;
};

const writeRealtimePreviewArtifact = async ({
  run,
  options,
  validation,
  search,
  recentChanges,
  candidateFiles
}: {
  run: ReplayXLiveRun;
  options: ResolvedLiveRunOptions;
  validation: RealtimeCommandResult;
  search: RealtimeCommandResult;
  recentChanges: RealtimeCommandResult;
  candidateFiles: string[];
}): Promise<string> => {
  const artifactDirectory = path.join(options.artifactsRoot, run.runId);
  await fs.mkdir(artifactDirectory, { recursive: true });
  const artifactPath = path.join(artifactDirectory, "realtime-investigation.md");
  const content = [
    `# ReplayX Realtime Investigation`,
    "",
    `## Incident`,
    run.issue.text,
    "",
    `## Target`,
    `- Repo: ${run.repoTarget}`,
    `- Service: ${run.serviceTarget}`,
    `- Environment: ${run.environmentTarget}`,
    `- Mode: realtime, no seeded fixture`,
    "",
    `## Validation Signal`,
    `Command: \`${validation.command}\``,
    `Exit: ${validation.exitCode}`,
    "",
    "```text",
    truncateText(validation.stderr || validation.stdout || "No output captured.", 2400),
    "```",
    "",
    `## Candidate Files`,
    ...(candidateFiles.length > 0 ? candidateFiles.map((file) => `- ${file}`) : ["- No strong file candidates found from text search."]),
    "",
    `## Code Search Signal`,
    `Command: \`${search.command}\``,
    "",
    "```text",
    truncateText(search.stdout || search.stderr || "No matching source lines found.", 2400),
    "```",
    "",
    `## Recent Change Signal`,
    "```text",
    truncateText(recentChanges.stdout || recentChanges.stderr || "No recent change signal captured.", 1600),
    "```",
    "",
    `## Next Move`,
    "ReplayX has not applied a patch yet. The next product slice is a bounded Codex patch worker that edits a sandbox branch, reruns the validation command, and only then prepares a PR."
  ].join("\n");

  await fs.writeFile(artifactPath, `${content}\n`, "utf8");
  return artifactPath;
};

export const createReplayXRun = async (
  input: CreateReplayXRunInput,
  rawOptions: LiveRunOptions = {}
): Promise<ReplayXLiveRun> => {
  const options = resolveOptions(rawOptions);
  const incidentSelection = resolveIncidentSelection(options.repoRoot, input);
  const incident =
    incidentSelection.capability.status === "full"
      ? await loadNormalizedIncidentFile(incidentSelection.incidentPath)
      : null;
  const timestamp = nowIso();
  const policy = createPolicyForCapability(incidentSelection.capability);
  const approvals = createInitialApprovals(
    input.environmentTarget ?? incident?.environment ?? "staging",
    policy
  );
  let run: ReplayXLiveRun = {
    schemaVersion: 2,
    origin: "live-run",
    executionMode: incidentSelection.executionMode,
    version: 1,
    runId: createRunId(),
    previousRunId: null,
    workspaceId: input.workspaceId ?? defaultWorkspaceId,
    owner: input.owner ?? input.user ?? "unassigned",
    source: input.source,
    status: approvals.length > 0 ? "awaiting_approval" : "queued",
    severity: input.severity ?? incident?.severity ?? "sev-2",
    repoTarget: input.repoTarget ?? incident?.repoRoot ?? "repo://operator-supplied",
    serviceTarget: input.serviceTarget ?? incident?.service ?? "unclassified-service",
    environmentTarget: input.environmentTarget ?? incident?.environment ?? "staging",
    incidentId: incident?.incidentId ?? incidentSelection.incidentId,
    incidentPath: incidentSelection.incidentPath,
    capability: incidentSelection.capability,
    currentPhaseId: null,
    currentBlocker:
      approvals[0]?.summary ??
      (incidentSelection.capability.status === "manual_fix_required" ? incidentSelection.capability.summary : null),
    issue: {
      text: input.text,
      channel: input.channel ?? null,
      threadTs: input.threadTs ?? null,
      user: input.user ?? null
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    archivedAt: null,
    archivedBy: null,
    error: null,
    policy,
    phases: livePhaseDefinitions.map((phase) => ({
      ...phase,
      status: "queued",
      startedAt: null,
      completedAt: null,
      summary: "Waiting to start."
    })),
    events: [],
    evidence: [],
    decisions: [],
    approvals,
    integrations: createDefaultIntegrations(),
    pullRequest: {
      status: "pending",
      branchName: null,
      title: null,
      summary: null,
      url: null,
      changedFiles: [],
      previewPath: null,
      diffPath: null,
      rollbackNote: null
    },
    cards: pendingCards(input.text)
  };

  run = appendEvent(run, {
    actor: input.source === "slack" ? "slack" : "operator",
    kind: "run.created",
    title: "Incident accepted",
      summary:
      incidentSelection.capability.status === "full"
        ? `ReplayX accepted the incident for ${run.repoTarget} in ${run.environmentTarget} via explicit fixture/eval selection.`
        : `ReplayX accepted the incident for ${run.repoTarget} in ${run.environmentTarget} and routed it into an assisted execution path. ${incidentSelection.capability.summary}`,
    phaseId: null,
    evidenceRefs: []
  });
  run = appendEvidence(run, {
    phaseId: null,
    kind: "intake",
    status: incidentSelection.capability.status === "full" ? "passed" : "info",
    label: "Incident intake packet",
    summary:
      incidentSelection.capability.status === "full"
        ? `Matched ${run.incidentId} through ${incidentSelection.matchedBy} routing at ${incidentSelection.confidence} confidence.`
        : incidentSelection.capability.summary,
    actor: input.source === "slack" ? "slack" : "operator",
    command: null,
    exitCode: null,
    durationMs: null,
    artifactPath: incidentSelection.incidentPath || null,
    artifactId: null
  });
  run = appendDecision(run, {
    phaseId: null,
    status: incidentSelection.capability.status === "manual_fix_required" ? "blocked" : "accepted",
    decision:
      incidentSelection.capability.status === "full"
        ? "ReplayX can enter the explicit fixture/eval loop."
        : "ReplayX can enter realtime investigation without a fixture answer key.",
    rationale:
      incidentSelection.capability.status === "full"
        ? "The operator supplied an explicit fixture id with a normalized incident, repro command, and bounded patch path."
        : incidentSelection.capability.summary,
    evidenceItemIds: run.evidence.slice(-1).map((item) => item.id)
  });

  if (approvals.length > 0) {
    for (const approval of approvals) {
      run = appendEvent(run, {
        actor: "system",
        kind: "approval.requested",
        title: "Approval requested",
        summary: approval.summary,
        phaseId: null,
        status: "awaiting_approval",
        evidenceRefs: []
      });
      run = appendEvidence(run, {
        phaseId: null,
        kind: "policy",
        status: "blocked",
        label: "Operator approval gate",
        summary: approval.summary,
        actor: "system",
        command: null,
        exitCode: null,
        durationMs: null,
        artifactPath: null,
        artifactId: null
      });
    }
  }

  run = await writeRun(run, options);

  if (approvals.length > 0) {
    await postSlackUpdate(run, buildApprovalSlackSummary(run));
  }

  return run;
};

export const getReplayXRun = async (
  runId: string,
  rawOptions: LiveRunOptions = {}
): Promise<ReplayXLiveRun> => readRun(runId, resolveOptions(rawOptions));

export const listReplayXRuns = async (rawOptions: LiveRunOptions = {}): Promise<ReplayXLiveRun[]> => {
  const options = resolveOptions(rawOptions);

  try {
    const db = getRunStore(options.runStoreRoot, options.legacyRunStoreRoot ?? null);
    const runs = listSerializedRuns(db).map((text) => normalizeLegacyRun(JSON.parse(text) as ReplayXLiveRun));

    return runs
      .filter((run) => options.includeArchived || !isArchivedRun(run))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

export const selectFeaturedProofRun = (
  runs: ReplayXLiveRun[]
): ReplayXLiveRun | null => {
  const visibleLiveRuns = runs.filter((run) => run.origin === "live-run" && !isArchivedRun(run));
  const validatedRun = visibleLiveRuns
    .filter((run) => run.pullRequest.status === "ready")
    .sort(compareRunsByRecency)[0];

  if (validatedRun) {
    return validatedRun;
  }

  return visibleLiveRuns.filter((run) => isTerminalStatus(run.status)).sort(compareRunsByRecency)[0] ?? null;
};

export const getFeaturedProofRun = async (
  rawOptions: LiveRunOptions = {}
): Promise<ReplayXLiveRun | null> => {
  const runs = await listReplayXRuns(rawOptions);
  return selectFeaturedProofRun(runs);
};

const average = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
};

export const getReplayXAnalytics = async (rawOptions: LiveRunOptions = {}): Promise<ReplayXAnalyticsSnapshot> => {
  const historicalRuns = (await listReplayXRuns({ ...rawOptions, includeArchived: true })).filter(
    (run) => run.origin === "live-run"
  );
  const visibleRuns = historicalRuns.filter((run) => !isArchivedRun(run));
  const activeStatuses: LiveRunStatus[] = [
    "queued",
    "triaging",
    "reproducing",
    "diagnosing",
    "patching",
    "validating",
    "awaiting_approval",
    "opening_pr"
  ];

  const completedDurations = historicalRuns
    .filter((run) => run.pullRequest.status === "ready" && run.completedAt)
    .map((run) => (Date.parse(run.completedAt as string) - Date.parse(run.createdAt)) / 60_000);
  const reproSuccesses = historicalRuns.filter((run) =>
    run.phases.find((phase) => phase.id === "repro" && phase.status === "completed")
  ).length;
  const validationSuccesses = historicalRuns.filter((run) => run.pullRequest.status === "ready").length;
  const operatorInterventions = historicalRuns.filter(
    (run) =>
      run.approvals.length > 0 ||
      run.events.some((event) => event.actor === "operator" && event.kind !== "run.created")
  ).length;
  const skillPromotions = historicalRuns.filter(
    (run) => run.pullRequest.status === "ready" && run.cards.skill.path && run.cards.skill.path !== "pending"
  ).length;
  const evidenceBackedRuns = historicalRuns.filter(
    (run) => run.evidence.length > 0 && run.decisions.length > 0
  ).length;
  const evidenceRecords = historicalRuns.reduce((total, run) => total + run.evidence.length, 0);
  const decisionRecords = historicalRuns.reduce((total, run) => total + run.decisions.length, 0);
  const incidentCounts = new Map<string, number>();
  const integrationFailureCounts = new Map<string, number>();
  const phaseTimings = new Map<string, number[]>();

  for (const run of historicalRuns) {
    incidentCounts.set(run.incidentId, (incidentCounts.get(run.incidentId) ?? 0) + 1);

    for (const integration of run.integrations) {
      if (integration.status !== "healthy") {
        integrationFailureCounts.set(
          integration.integration,
          (integrationFailureCounts.get(integration.integration) ?? 0) + 1
        );
      }
    }

    for (const phase of run.phases) {
      if (!phase.startedAt || !phase.completedAt) {
        continue;
      }

      const duration = (Date.parse(phase.completedAt) - Date.parse(phase.startedAt)) / 60_000;
      const existing = phaseTimings.get(phase.id) ?? [];
      existing.push(duration);
      phaseTimings.set(phase.id, existing);
    }
  }

  return {
    totalRuns: historicalRuns.length,
    visibleRuns: visibleRuns.length,
    archivedRuns: historicalRuns.length - visibleRuns.length,
    activeRuns: visibleRuns.filter((run) => activeStatuses.includes(run.status)).length,
    blockedRuns: visibleRuns.filter((run) => run.status === "blocked" || run.status === "failed").length,
    approvalQueue: visibleRuns
      .flatMap((run) => run.approvals)
      .filter((approval) => approval.status === "pending").length,
    mttrMinutes: average(completedDurations),
    phaseTimingMinutes: Object.fromEntries(
      [...phaseTimings.entries()].map(([phaseId, durations]) => [phaseId, Number((average(durations) ?? 0).toFixed(2))])
    ),
    reproSuccessRate: historicalRuns.length === 0 ? 0 : reproSuccesses / historicalRuns.length,
    validationSuccessRate: historicalRuns.length === 0 ? 0 : validationSuccesses / historicalRuns.length,
    prAcceptanceRate: historicalRuns.length === 0 ? 0 : validationSuccesses / historicalRuns.length,
    operatorInterventionRate:
      historicalRuns.length === 0 ? 0 : operatorInterventions / historicalRuns.length,
    skillReuseRate: historicalRuns.length === 0 ? 0 : skillPromotions / historicalRuns.length,
    evidenceBackedRunRate: historicalRuns.length === 0 ? 0 : evidenceBackedRuns / historicalRuns.length,
    evidenceRecords,
    decisionRecords,
    topRecurringIncidentFingerprints: [...incidentCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([incidentId, count]) => ({ incidentId, count })),
    topFailingIntegrations: [...integrationFailureCounts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([integration, count]) => ({ integration, count }))
  };
};

export const approveReplayXRunAction = async (
  runId: string,
  rawOptions: LiveRunOptions = {}
): Promise<ReplayXLiveRun> => {
  const options = resolveOptions(rawOptions);
  let run = await readRun(runId, options);
  const timestamp = nowIso();

  assertRunMutable(run, "approve");

  if (!run.approvals.some((approval) => approval.status === "pending")) {
    throw new Error("ReplayX has no pending approval for this run.");
  }

  run = {
    ...run,
    approvals: run.approvals.map((approval) =>
      approval.status === "pending"
        ? {
            ...approval,
            status: "approved",
            updatedAt: timestamp
          }
        : approval
    ),
    status: run.status === "awaiting_approval" ? "queued" : run.status,
    currentBlocker: null,
    updatedAt: timestamp
  };
  run = appendEvent(run, {
    actor: "operator",
    kind: "run.approved",
    title: "Approval granted",
    summary: "ReplayX can continue the gated workflow.",
    phaseId: run.currentPhaseId,
    evidenceRefs: []
  });
  run = appendEvidence(run, {
    phaseId: run.currentPhaseId,
    kind: "policy",
    status: "passed",
    label: "Approval granted",
    summary: "Operator approved the gated workflow and ReplayX can continue.",
    actor: "operator",
    command: null,
    exitCode: null,
    durationMs: null,
    artifactPath: null,
    artifactId: null
  });

  run = await writeRun(run, options);
  return run;
};

export const cancelReplayXRun = async (
  runId: string,
  rawOptions: LiveRunOptions = {}
): Promise<ReplayXLiveRun> => {
  const options = resolveOptions(rawOptions);
  let run = await readRun(runId, options);

  assertRunMutable(run, "cancel");

  if (isTerminalStatus(run.status)) {
    throw new Error("ReplayX can cancel only active runs.");
  }

  run = {
    ...run,
    status: "cancelled",
    currentBlocker: "Run cancelled by operator.",
    completedAt: nowIso(),
    updatedAt: nowIso()
  };
  run = appendEvent(run, {
    actor: "operator",
    kind: "run.cancelled",
    title: "Run cancelled",
    summary: "ReplayX stopped the live run at the operator's request.",
    phaseId: run.currentPhaseId,
    evidenceRefs: []
  });

  run = await writeRun(run, options);
  await postSlackUpdate(run, buildFinalSlackSummary(run));
  return run;
};

export const archiveReplayXRun = async (
  runId: string,
  rawOptions: LiveRunOptions = {}
): Promise<ReplayXLiveRun> => {
  const options = resolveOptions(rawOptions);
  let run = await readRun(runId, options);

  if (!isTerminalStatus(run.status)) {
    throw new Error("ReplayX can archive only terminal runs.");
  }

  if (isArchivedRun(run)) {
    return run;
  }

  run = {
    ...run,
    archivedAt: nowIso(),
    archivedBy: "operator",
    updatedAt: nowIso()
  };
  run = appendEvent(run, {
    actor: "operator",
    kind: "run.archived",
    title: "Run archived",
    summary: "ReplayX archived this incident from live fleet and analytics views while preserving the audit trail.",
    phaseId: run.currentPhaseId,
    evidenceRefs: []
  });

  return writeRun(run, options);
};

export const retryReplayXRun = async (
  runId: string,
  rawOptions: LiveRunOptions = {}
): Promise<ReplayXLiveRun> => {
  const options = resolveOptions(rawOptions);
  const previousRun = await readRun(runId, options);

  assertRunMutable(previousRun, "retry");

  if (!isTerminalStatus(previousRun.status)) {
    throw new Error("ReplayX can retry only terminal runs.");
  }

  const nextRun = await createReplayXRun(
    {
	      source: previousRun.source,
	      text: previousRun.issue.text,
	      incidentId: previousRun.incidentId,
	      workspaceId: previousRun.workspaceId,
      owner: previousRun.owner,
      repoTarget: previousRun.repoTarget,
      environmentTarget: previousRun.environmentTarget,
      serviceTarget: previousRun.serviceTarget,
      severity: previousRun.severity,
      channel: previousRun.issue.channel,
      threadTs: previousRun.issue.threadTs,
      user: previousRun.issue.user
    },
    {
      repoRoot: options.repoRoot,
      runStoreRoot: options.runStoreRoot,
      ...(options.legacyRunStoreRoot ? { legacyRunStoreRoot: options.legacyRunStoreRoot } : {}),
      artifactsRoot: options.artifactsRoot,
      phaseDelayMs: options.phaseDelayMs
    }
  );

  const hydratedRun: ReplayXLiveRun = {
    ...nextRun,
    previousRunId: previousRun.runId
  };
  const run = appendEvent(hydratedRun, {
    actor: "operator",
    kind: "run.retried",
    title: "Run retried",
    summary: `ReplayX created a retry run from ${previousRun.runId}.`,
    phaseId: null,
    evidenceRefs: []
  });

  return writeRun(run, options);
};

const stopIfTerminal = (run: ReplayXLiveRun): ReplayXLiveRun | null =>
  isTerminalStatus(run.status) ? run : null;

const hasPendingApproval = (run: ReplayXLiveRun): boolean =>
  run.approvals.some((approval) => approval.status === "pending");

const runRealtimeInvestigationPipeline = async (
  initialRun: ReplayXLiveRun,
  options: ResolvedLiveRunOptions
): Promise<ReplayXLiveRun> => {
  let run = initialRun;
  const searchTerms = extractRealtimeSearchTerms(run.issue.text);
  const validationCommand = await resolveRealtimeValidationCommand(options.repoRoot);
  const searchCommand = createRealtimeSearchCommand(searchTerms);
  const recentChangeCommand = "git log --oneline -8 --decorate --date=relative";

  run = await updatePhase(
    run,
    "incident-intake",
    "running",
    "ReplayX is capturing a fresh incident packet from the live intake path.",
    options
  );
  if (stopIfTerminal(run)) {
    return run;
  }

  run = appendEvidence(run, {
    phaseId: "incident-intake",
    kind: "intake",
    status: "info",
    label: "Realtime intake",
    summary: "Fresh Slack/API incident accepted. No seeded fixture or answer key is attached to this run.",
    actor: run.source === "slack" ? "slack" : "operator",
    command: null,
    exitCode: null,
    durationMs: null,
    artifactPath: null,
    artifactId: null
  });
  run = await writeRun(run, options);

  run = await updatePhase(
    run,
    "incident-intake",
    "completed",
    "Realtime incident packet captured.",
    options
  );
  if (stopIfTerminal(run)) {
    return run;
  }

  run = await updatePhase(
    run,
    "skill-match",
    "running",
    "ReplayX is checking reusable memory without falling back to fixture matching.",
    options
  );
  if (stopIfTerminal(run)) {
    return run;
  }

  run = appendDecision(run, {
    phaseId: "skill-match",
    status: "accepted",
    decision: "Use realtime investigation mode.",
    rationale:
      "Fresh incident text must not be auto-routed into seeded fixtures. Fixture paths remain available only when an explicit fixture id is supplied.",
    evidenceItemIds: run.evidence.slice(-1).map((item) => item.id)
  });
  run = await writeRun(run, options);

  run = await updatePhase(
    run,
    "skill-match",
    "completed",
    "No fixture route used. ReplayX will inspect the current repo state.",
    options
  );
  if (stopIfTerminal(run)) {
    return run;
  }

  run = await updatePhase(
    run,
    "repro",
    "running",
    `ReplayX is running the repo validation command: ${validationCommand}`,
    options
  );
  if (stopIfTerminal(run)) {
    return run;
  }

  const validation = await execRealtimeCommand(validationCommand, options.repoRoot);
  run = appendEvidence(run, {
    phaseId: "repro",
    kind: "command",
    status: commandEvidenceStatus(validation.exitCode),
    label: "Realtime validation baseline",
    summary: formatRealtimeCommandSummary(validation),
    actor: "agent",
    command: validation.command,
    exitCode: validation.exitCode,
    durationMs: validation.durationMs,
    artifactPath: null,
    artifactId: null
  });
  run = await writeRun(run, options);

  run = await updatePhase(
    run,
    "repro",
    "completed",
    validation.exitCode === 0
      ? "Baseline validation passed. ReplayX will inspect source and recent changes for the reported incident."
      : "Baseline validation produced a failing signal for the investigation.",
    options
  );
  if (stopIfTerminal(run)) {
    return run;
  }

  run = await updatePhase(
    run,
    "diagnosis-arena",
    "running",
    "ReplayX is searching the live repo for incident-specific code and ownership signals.",
    options
  );
  if (stopIfTerminal(run)) {
    return run;
  }

  const [search, recentChanges] = await Promise.all([
    execRealtimeCommand(searchCommand, options.repoRoot),
    execRealtimeCommand(recentChangeCommand, options.repoRoot)
  ]);
  const candidateFiles = parseCandidateFilesFromSearch(search.stdout);
  const candidateSummary =
    candidateFiles.length > 0
      ? `Strongest candidate files: ${candidateFiles.slice(0, 4).join(", ")}.`
      : "No strong file candidates found from incident text. ReplayX needs a bounded patch worker or richer telemetry.";

  run = appendEvidence(run, {
    phaseId: "diagnosis-arena",
    kind: "command",
    status: search.exitCode === 0 ? "passed" : "info",
    label: "Realtime code search",
    summary: candidateSummary,
    actor: "agent",
    command: search.command,
    exitCode: search.exitCode,
    durationMs: search.durationMs,
    artifactPath: null,
    artifactId: null
  });
  run = appendEvidence(run, {
    phaseId: "diagnosis-arena",
    kind: "command",
    status: recentChanges.exitCode === 0 ? "passed" : "info",
    label: "Recent change scan",
    summary: recentChanges.exitCode === 0 ? "Recent git history captured for diagnosis." : "Recent git history could not be read.",
    actor: "agent",
    command: recentChanges.command,
    exitCode: recentChanges.exitCode,
    durationMs: recentChanges.durationMs,
    artifactPath: null,
    artifactId: null
  });
  run = {
    ...run,
    cards: {
      ...run.cards,
      workerCards: [
        {
          worker: "realtime_repo_scanner",
          specialty: "Live repo search and validation baseline",
          diagnosis:
            candidateFiles.length > 0
              ? `The incident text maps to ${candidateFiles.length} source candidates in the current repo.`
              : "ReplayX found no direct source-text match and needs richer telemetry or a Codex patch worker.",
          confidence: candidateFiles.length > 0 ? 0.62 : 0.34,
          status: candidateFiles.length > 0 ? "completed" : "weak_signal"
        }
      ],
      winningDiagnosis: {
        worker: "realtime_repo_scanner",
        diagnosis: candidateSummary,
        confidence: candidateFiles.length > 0 ? 0.62 : 0.34,
        winning_reason:
          validation.exitCode === 0
            ? "Validation is currently green, so ReplayX treated the incident as a source investigation rather than a reproduced failure."
            : "Validation produced a failing signal and source search identified the first candidate area to inspect."
      }
    }
  };
  run = await writeRun(run, options);

  run = await updatePhase(run, "diagnosis-arena", "completed", candidateSummary, options);
  if (stopIfTerminal(run)) {
    return run;
  }

  run = await updatePhase(
    run,
    "challenger-validation",
    "running",
    "ReplayX is checking whether the evidence is strong enough to authorize patching.",
    options
  );
  if (stopIfTerminal(run)) {
    return run;
  }

  run = appendDecision(run, {
    phaseId: "challenger-validation",
    status: candidateFiles.length > 0 ? "accepted" : "blocked",
    decision: candidateFiles.length > 0 ? "Proceed to patch planning." : "Do not pretend to patch without stronger evidence.",
    rationale: candidateSummary,
    evidenceItemIds: run.evidence.slice(-2).map((item) => item.id)
  });
  run = await writeRun(run, options);

  run = await updatePhase(
    run,
    "challenger-validation",
    "completed",
    candidateFiles.length > 0
      ? "Realtime evidence is strong enough for a patch plan."
      : "Realtime evidence is not strong enough for autonomous patching.",
    options
  );
  if (stopIfTerminal(run)) {
    return run;
  }

  run = await updatePhase(
    run,
    "fix-arena",
    "running",
    "ReplayX is writing a patch plan from live evidence instead of using a seeded template.",
    options
  );
  if (stopIfTerminal(run)) {
    return run;
  }

  const previewPath = await writeRealtimePreviewArtifact({
    run,
    options,
    validation,
    search,
    recentChanges,
    candidateFiles
  });
  run = {
    ...run,
    cards: {
      ...run.cards,
      fix: {
        strategy: "realtime_patch_plan",
        summary:
          candidateFiles.length > 0
            ? `Investigate and patch the highest-signal files: ${candidateFiles.slice(0, 4).join(", ")}.`
            : "Collect stronger runtime evidence before patching.",
        changed_files: candidateFiles,
        verification_result:
          "ReplayX created a realtime investigation packet. No seeded patch was applied."
      },
      proof: {
        review_verdict: "needs_patch_worker",
        regression_command: validation.command,
        regression_summary:
          "Realtime validation baseline captured. A bounded Codex patch worker must apply changes in sandbox before ReplayX can claim resolution."
      },
      postmortem: {
        summary: "Realtime postmortem remains pending until a patch validates.",
        path: "pending"
      },
      skill: {
        summary: "Realtime memory promotion remains pending until a patch validates.",
        path: "pending"
      },
      beforeAfter: {
        before: run.issue.text,
        after: "Realtime evidence packet created. Patch validation is the next gate."
      },
      operatorSummary: "Realtime investigation completed without using seeded fixtures."
    },
    pullRequest: {
      ...run.pullRequest,
      status: "unavailable",
      title: `ReplayX realtime investigation: ${run.issue.text.slice(0, 72)}`,
      summary: "Realtime investigation packet created. No PR-ready patch yet.",
      changedFiles: candidateFiles,
      previewPath,
      rollbackNote: "No code was changed by realtime investigation mode."
    }
  };
  run = appendEvidence(run, {
    phaseId: "fix-arena",
    kind: "artifact",
    status: "passed",
    label: "Realtime investigation packet",
    summary: "ReplayX preserved validation, search, and recent-change evidence for operator review.",
    actor: "agent",
    command: null,
    exitCode: null,
    durationMs: null,
    artifactPath: previewPath,
    artifactId: "preview"
  });
  run = appendDecision(run, {
    phaseId: "fix-arena",
    status: "blocked",
    decision: "Stop before claiming a fix.",
    rationale:
      "ReplayX must not present a seeded or unvalidated patch as realtime resolution. This run needs the bounded Codex patch worker before PR packaging.",
    evidenceItemIds: run.evidence.slice(-1).map((item) => item.id)
  });
  run = await writeRun(run, options);

  run = await updatePhase(
    run,
    "fix-arena",
    "completed",
    "Realtime patch plan created without seeded templates.",
    options
  );
  if (stopIfTerminal(run)) {
    return run;
  }

  run = {
    ...(await updatePhase(
      run,
      "review-and-regression",
      "blocked",
      "Realtime investigation is complete, but no sandbox patch has been applied or validated yet.",
      options,
      {
        blocker: "Bounded Codex patch worker is required before ReplayX can claim PR-ready resolution.",
        evidenceRefs: run.evidence.slice(-3).map((item) => item.id)
      }
    )),
    status: "blocked",
    completedAt: nowIso(),
    currentBlocker: "Bounded Codex patch worker is required before ReplayX can claim PR-ready resolution."
  };
  run = appendEvent(run, {
    actor: "system",
    kind: "run.realtime_investigation_complete",
    title: "Realtime investigation complete",
    summary: "ReplayX created a live evidence packet and stopped before unvalidated patching.",
    phaseId: "review-and-regression",
    status: "blocked",
    evidenceRefs: run.evidence.slice(-3).map((item) => item.id)
  });
  run = await writeRun(run, options);
  await postSlackUpdate(run, buildFinalSlackSummary(run));
  return run;
};

export const runReplayXLivePipeline = async (
  runId: string,
  rawOptions: LiveRunOptions = {}
): Promise<ReplayXLiveRun> => {
  const options = resolveOptions(rawOptions);
  let run = await readRun(runId, options);

  if (hasPendingApproval(run)) {
    return run;
  }

  if (run.capability.status === "analysis_only") {
    return runRealtimeInvestigationPipeline(run, options);
  }

  if (run.capability.status !== "full") {
    run = await updatePhase(
      run,
      "incident-intake",
      "running",
      "ReplayX normalized the intake packet and captured the operator-supplied context.",
      options
    );
    if (stopIfTerminal(run)) {
      return run;
    }

    run = await updatePhase(
      run,
      "incident-intake",
      "completed",
      "Incident intake is complete and the handoff packet is ready.",
      options
    );
    if (stopIfTerminal(run)) {
      return run;
    }

    run = await updatePhase(
      run,
      "skill-match",
      "running",
      "ReplayX checked the current automation registry before entering the execution loop.",
      options
    );
    if (stopIfTerminal(run)) {
      return run;
    }

    run = {
      ...(await updatePhase(
        run,
        "skill-match",
        "completed",
        run.capability.summary,
        options
      )),
      cards: {
        ...run.cards,
        winningDiagnosis: {
          worker: "assisted-routing",
          diagnosis: "ReplayX captured the incident but needs an operator-authored remediation path for this class.",
          confidence: 0.42,
          winning_reason: run.capability.summary
        },
        fix: {
          strategy: "operator_handoff",
          summary: run.capability.summary,
          changed_files: [],
          verification_result: "ReplayX stopped before automated patch generation because this incident class is not yet in the automation registry."
        },
        proof: {
          review_verdict: "operator_handoff",
          regression_command: "pending operator-authored remediation",
          regression_summary:
            "ReplayX preserved the intake packet and routed the incident into an assisted execution path."
        },
        postmortem: {
          summary: "Postmortem capture will resume after a human-authored fix lands.",
          path: "pending"
        },
        skill: {
          summary: "Memory promotion remains off until ReplayX sees a validated outcome for this incident class.",
          path: "pending"
        },
        beforeAfter: {
          before: run.issue.text,
          after: "Operator-authored remediation required before ReplayX can validate an outcome."
        },
        operatorSummary: "ReplayX routed this incident into an assisted execution path."
      }
    };
    run = appendEvidence(run, {
      phaseId: "skill-match",
      kind: "handoff",
      status: "blocked",
      label: "Capability boundary reached",
      summary: run.capability.summary,
      actor: "system",
      command: null,
      exitCode: null,
      durationMs: null,
      artifactPath: null,
      artifactId: null
    });
    run = appendDecision(run, {
      phaseId: "skill-match",
      status: "blocked",
      decision: "Stop before automated patch generation.",
      rationale:
        "ReplayX did not find a validated incident capability, so it preserved the intake and requested an operator-authored remediation path instead of pretending to fix it.",
      evidenceItemIds: run.evidence.slice(-1).map((item) => item.id)
    });
    run = await writeRun(run, options);

    run = {
      ...(await updatePhase(
        run,
        "repro",
        "blocked",
        run.capability.summary,
        options,
        { blocker: run.capability.summary }
      )),
      status: "blocked",
      currentBlocker: run.capability.summary,
      pullRequest: {
        ...run.pullRequest,
        status: "unavailable"
      }
    };
    run = appendEvent(run, {
      actor: "system",
      kind: "run.operator_handoff",
      title: "Operator handoff required",
      summary: run.capability.summary,
      phaseId: "repro",
      status: "blocked",
      evidenceRefs: []
    });
    run = await writeRun(run, options);
    await postSlackUpdate(run, buildFinalSlackSummary(run));
    return run;
  }

  type IncidentIntakeModule = typeof import("../../orchestrator/phases/incident-intake.js");
  type SkillMatchModule = typeof import("../../orchestrator/phases/skill-match.js");
  type ReproModule = typeof import("../../orchestrator/phases/repro.js");
  type DiagnosisArenaModule = typeof import("../../orchestrator/phases/diagnosis-arena.js");
  type ChallengerValidationModule = typeof import("../../orchestrator/phases/challenger-validation.js");
  type FixArenaModule = typeof import("../../orchestrator/phases/fix-arena.js");
  type ReviewAndRegressionModule = typeof import("../../orchestrator/phases/review-and-regression.js");
  type PostmortemAndSkillModule = typeof import("../../orchestrator/phases/postmortem-and-skill.js");

  const [
    incidentIntake,
    skillMatch,
    repro,
    diagnosisArena,
    challengerValidation,
    fixArena,
    reviewAndRegression,
    postmortemAndSkill
  ] = await Promise.all([
    importRepoModule<IncidentIntakeModule>(options.repoRoot, "orchestrator/phases/incident-intake.ts"),
    importRepoModule<SkillMatchModule>(options.repoRoot, "orchestrator/phases/skill-match.ts"),
    importRepoModule<ReproModule>(options.repoRoot, "orchestrator/phases/repro.ts"),
    importRepoModule<DiagnosisArenaModule>(options.repoRoot, "orchestrator/phases/diagnosis-arena.ts"),
    importRepoModule<ChallengerValidationModule>(options.repoRoot, "orchestrator/phases/challenger-validation.ts"),
    importRepoModule<FixArenaModule>(options.repoRoot, "orchestrator/phases/fix-arena.ts"),
    importRepoModule<ReviewAndRegressionModule>(options.repoRoot, "orchestrator/phases/review-and-regression.ts"),
    importRepoModule<PostmortemAndSkillModule>(options.repoRoot, "orchestrator/phases/postmortem-and-skill.ts")
  ]);

  const incident = await loadNormalizedIncidentFile(run.incidentPath);
  const runtime: ReplayXRuntimeConfig = {
    repoRoot: options.repoRoot,
    artifactsRoot: options.artifactsRoot,
    defaultModel: process.env.REPLAYX_CODEX_MODEL ?? "gpt-5.4",
    maxParallelWorkers: 4,
    codexReproWorkerEnabled: process.env.REPLAYX_LIVE_USE_CODEX_WORKERS === "1",
    codexReproWorkerTimeoutMs: Number(process.env.REPLAYX_CODEX_REPRO_TIMEOUT_MS ?? "30000"),
    codexDiagnosisWorkersEnabled: process.env.REPLAYX_LIVE_USE_CODEX_WORKERS === "1",
    codexDiagnosisWorkerTimeoutMs: Number(process.env.REPLAYX_CODEX_DIAGNOSIS_TIMEOUT_MS ?? "45000")
  };

  try {
    const normalizedPath = path.join(runtime.artifactsRoot, incident.incidentId, "normalized_incident.json");

    run = await updatePhase(
      run,
      "incident-intake",
      "running",
      "ReplayX normalized the incident intake packet from Slack and pinned the target repo context.",
      options
    );
    if (stopIfTerminal(run)) {
      return run;
    }
    const intakeResult = incidentIntake.runIncidentIntakePhase(run.incidentPath, normalizedPath, incident);
    await incidentIntake.writeIncidentIntakeArtifacts(runtime, incident, intakeResult);
    run = await updatePhase(run, "incident-intake", "completed", "Incident contract normalized.", options);
    if (stopIfTerminal(run)) {
      return run;
    }

    run = await updatePhase(
      run,
      "skill-match",
      "running",
      "ReplayX checked for a validated reusable skill before agent fan-out.",
      options
    );
    if (stopIfTerminal(run)) {
      return run;
    }
    const skillMatchResult = await skillMatch.runSkillMatchPhase(runtime, incident);
    await skillMatch.writeSkillMatchArtifacts(runtime, incident, skillMatchResult);
    run = await updatePhase(run, "skill-match", "completed", skillMatchResult.rationale, options);
    if (stopIfTerminal(run)) {
      return run;
    }

    run = await updatePhase(
      run,
      "repro",
      "running",
      "ReplayX is reproducing the failure and confirming the healthy control.",
      options
    );
    if (stopIfTerminal(run)) {
      return run;
    }
    const reproResult = await repro.runReproPhase(incident, runtime);
    await repro.writeReproArtifacts(runtime, incident, reproResult);
    run = await updatePhase(run, "repro", "completed", reproResult.failure_surface, options);
    if (stopIfTerminal(run)) {
      return run;
    }

    run = await updatePhase(
      run,
      "diagnosis-arena",
      "running",
      "ReplayX launched bounded diagnosis agents against the repo-backed failure surface.",
      options
    );
    if (stopIfTerminal(run)) {
      return run;
    }
    const diagnosisResult = await diagnosisArena.runDiagnosisArenaPhase(incident, runtime, reproResult);
    await diagnosisArena.writeDiagnosisArenaArtifacts(runtime, incident, diagnosisResult);
    run = {
      ...(await updatePhase(
        run,
        "diagnosis-arena",
        "completed",
        `${diagnosisResult.worker_count} diagnosis workers produced a ranked shortlist.`,
        options
      )),
      cards: {
        ...run.cards,
        workerCards: diagnosisResult.worker_results.map((worker) => ({
          worker: worker.worker_id,
          specialty: worker.specialty,
          diagnosis: worker.output.diagnosis,
          confidence: worker.output.confidence,
          status: worker.output.status
        }))
      }
    };
    run = await writeRun(run, options);
    if (stopIfTerminal(run)) {
      return run;
    }

    run = await updatePhase(
      run,
      "challenger-validation",
      "running",
      "ReplayX is falsifying the strongest diagnosis candidates before patch generation.",
      options
    );
    if (stopIfTerminal(run)) {
      return run;
    }
    const challengerResult = challengerValidation.runChallengerValidationPhase(incident, diagnosisResult);
    await challengerValidation.writeChallengerValidationArtifacts(runtime, incident, challengerResult);
    run = {
      ...(await updatePhase(
        run,
        "challenger-validation",
        "completed",
        challengerResult.winning_reason,
        options
      )),
      cards: {
        ...run.cards,
        winningDiagnosis: {
          worker: challengerResult.winner ?? "no_clear_winner",
          diagnosis: diagnosisResult.ranked_shortlist[0]?.diagnosis ?? incident.summary.symptom,
          confidence: diagnosisResult.ranked_shortlist[0]?.confidence ?? 0,
          winning_reason: challengerResult.winning_reason
        }
      }
    };
    run = appendEvidence(run, {
      phaseId: "challenger-validation",
      kind: "decision",
      status: "passed",
      label: "Winning diagnosis selected",
      summary: challengerResult.winning_reason,
      actor: "agent",
      command: null,
      exitCode: null,
      durationMs: null,
      artifactPath: null,
      artifactId: null
    });
    run = appendDecision(run, {
      phaseId: "challenger-validation",
      status: "accepted",
      decision: `${challengerResult.winner ?? "No clear winner"} is the active diagnosis.`,
      rationale: challengerResult.winning_reason,
      evidenceItemIds: run.evidence.slice(-1).map((item) => item.id)
    });
    run = await writeRun(run, options);
    if (stopIfTerminal(run)) {
      return run;
    }

    run = await updatePhase(
      run,
      "fix-arena",
      "running",
      "ReplayX is generating the narrowest viable patch candidate before validation.",
      options
    );
    if (stopIfTerminal(run)) {
      return run;
    }
    const fixResult = fixArena.runFixArenaPhase(incident, diagnosisResult, challengerResult);
    await fixArena.writeFixArenaArtifacts(runtime, incident, fixResult);
    run = {
      ...(await updatePhase(run, "fix-arena", "completed", fixResult.winner_summary, options)),
      cards: {
        ...run.cards,
        fix: {
          strategy: fixResult.winner ?? "pending",
          summary: fixResult.winner_summary,
          changed_files: fixResult.winner_changed_files ?? [],
          verification_result:
            "ReplayX is applying the proposed patch inside an isolated sandbox and rerunning validations."
        }
      }
    };
    run = appendEvidence(run, {
      phaseId: "fix-arena",
      kind: "decision",
      status: "passed",
      label: "Patch strategy selected",
      summary: fixResult.winner_summary,
      actor: "agent",
      command: null,
      exitCode: null,
      durationMs: null,
      artifactPath: null,
      artifactId: null
    });
    run = appendDecision(run, {
      phaseId: "fix-arena",
      status: "accepted",
      decision: `${fixResult.winner ?? "Patch candidate"} moves into sandbox validation.`,
      rationale: fixResult.winner_summary,
      evidenceItemIds: run.evidence.slice(-1).map((item) => item.id)
    });
    run = await writeRun(run, options);
    if (stopIfTerminal(run)) {
      return run;
    }

    run = await updatePhase(
      run,
      "review-and-regression",
      "running",
      "ReplayX is applying the patch in sandbox and validating it with failing, healthy, and regression checks.",
      options
    );
    if (stopIfTerminal(run)) {
      return run;
    }
    const reviewResult = reviewAndRegression.runReviewAndRegressionPhase(incident, fixResult);
    await reviewAndRegression.writeReviewAndRegressionArtifacts(runtime, incident, reviewResult);
    const patchValidation = await runSeededPatchValidation({
      incident,
      repoRoot: runtime.repoRoot,
      artifactsRoot: runtime.artifactsRoot
    });

    if (patchValidation.status === "blocked" || (patchValidation.blocker && !patchValidation.prUrl)) {
      run = {
        ...(await updatePhase(
          run,
          "review-and-regression",
          "blocked",
          patchValidation.summary,
          options,
          {
            blocker: patchValidation.blocker,
            evidenceRefs: patchValidation.evidenceRefs
          }
        )),
        status: "blocked",
        currentBlocker: patchValidation.blocker,
        pullRequest: {
          ...run.pullRequest,
          status: "unavailable",
          url: null,
          changedFiles: patchValidation.changedFiles,
          diffPath: patchValidation.diffPath,
          rollbackNote: patchValidation.rollbackNote
        },
        cards: {
          ...run.cards,
          fix: {
            ...run.cards.fix,
            changed_files: patchValidation.changedFiles,
            verification_result: patchValidation.summary
          },
          proof: {
            review_verdict: "blocked",
            regression_command: `${incident.commands.failing.command}\n${incident.commands.healthy.command}`,
            regression_summary: patchValidation.summary
          }
        }
      };
      const validationEvidence = validationEvidenceFromPatchResult(incident, patchValidation);
      for (const evidence of validationEvidence) {
        run = appendEvidence(run, evidence);
      }
      run = appendDecision(run, {
        phaseId: "review-and-regression",
        status: "blocked",
        decision: "Do not prepare a PR-ready outcome.",
        rationale: patchValidation.summary,
        evidenceItemIds: run.evidence.slice(-validationEvidence.length).map((item) => item.id)
      });
      run = await writeRun(run, options);
      await postSlackUpdate(run, buildFinalSlackSummary(run));
      return run;
    }

    run = {
      ...(await updatePhase(
        run,
        "review-and-regression",
        "completed",
        "ReplayX validated the patch candidate in sandbox and prepared a PR-ready bundle.",
        options,
        { evidenceRefs: patchValidation.evidenceRefs }
      )),
      cards: {
        ...run.cards,
        fix: {
          strategy: fixResult.winner ?? "validated_patch",
          summary: fixResult.winner_summary,
          changed_files: patchValidation.changedFiles,
          verification_result: patchValidation.summary
        },
        proof: {
          review_verdict: "verified",
          regression_command: `${incident.commands.failing.command}\n${incident.commands.healthy.command}`,
          regression_summary: patchValidation.summary
        },
        beforeAfter: {
          before: incident.summary.symptom,
          after: patchValidation.summary
        }
      },
      pullRequest: {
        status: "ready",
        branchName: patchValidation.branchName,
        title: patchValidation.prTitle,
        summary: patchValidation.summary,
        url: patchValidation.prUrl,
        changedFiles: patchValidation.changedFiles,
        previewPath: patchValidation.prPreviewPath,
        diffPath: patchValidation.diffPath,
        rollbackNote: patchValidation.rollbackNote
      }
    };
    const validationEvidence = validationEvidenceFromPatchResult(incident, patchValidation);
    for (const evidence of validationEvidence) {
      run = appendEvidence(run, evidence);
    }
    run = appendDecision(run, {
      phaseId: "review-and-regression",
      status: "validated",
      decision: "Patch is safe to package for operator review.",
      rationale: patchValidation.summary,
      evidenceItemIds: run.evidence.slice(-validationEvidence.length).map((item) => item.id)
    });
    run = await writeRun(run, options);
    if (stopIfTerminal(run)) {
      return run;
    }

    run = await updatePhase(
      run,
      "postmortem-and-skill",
      "running",
      "ReplayX is packaging the validated run into resolution artifacts and reusable memory.",
      options
    );
    if (stopIfTerminal(run)) {
      return run;
    }
    const artifactResult = await postmortemAndSkill.runPostmortemAndSkillPhase(
      runtime,
      incident,
      diagnosisResult,
      challengerResult,
      fixResult,
      reviewResult
    );
    await postmortemAndSkill.writePostmortemAndSkillArtifacts(runtime, incident, artifactResult);

    const replayText = await fs.readFile(
      path.join(runtime.artifactsRoot, incident.incidentId, "dashboard-replay.json"),
      "utf8"
    );
    const replay = JSON.parse(replayText) as ReplayXDashboardReplayArtifact;
    run = await updatePhase(run, "postmortem-and-skill", "completed", artifactResult.skill_summary, options);
    if (stopIfTerminal(run)) {
      return run;
    }

    let completedRun: ReplayXLiveRun = {
      ...run,
      status: "resolved_to_pr",
      currentPhaseId: "postmortem-and-skill",
      currentBlocker: null,
      updatedAt: nowIso(),
      completedAt: nowIso(),
      cards: {
        workerCards: replay.worker_cards,
        winningDiagnosis: replay.winner_card,
        fix: {
          ...replay.fix_card,
          changed_files: patchValidation.changedFiles,
          verification_result: patchValidation.summary
        },
        proof: {
          review_verdict: "verified",
          regression_command: `${incident.commands.failing.command}\n${incident.commands.healthy.command}`,
          regression_summary: patchValidation.summary
        },
        postmortem: replay.postmortem_card,
        skill: replay.skill_card,
        beforeAfter: {
          before: replay.before_after.before,
          after: patchValidation.summary
        },
        operatorSummary: replay.operator_summary
      }
    };
    completedRun = appendEvidence(completedRun, {
      phaseId: "postmortem-and-skill",
      kind: "artifact",
      status: "passed",
      label: "Postmortem artifact",
      summary: replay.postmortem_card.summary,
      actor: "agent",
      command: null,
      exitCode: null,
      durationMs: null,
      artifactPath: replay.postmortem_card.path,
      artifactId: "postmortem"
    });
    completedRun = appendEvidence(completedRun, {
      phaseId: "postmortem-and-skill",
      kind: "artifact",
      status: "passed",
      label: "Reusable incident skill",
      summary: replay.skill_card.summary,
      actor: "agent",
      command: null,
      exitCode: null,
      durationMs: null,
      artifactPath: replay.skill_card.path,
      artifactId: "skill"
    });
    completedRun = appendDecision(completedRun, {
      phaseId: "postmortem-and-skill",
      status: "validated",
      decision: "Promote validated incident memory.",
      rationale:
        "ReplayX reached a verified patch outcome, then wrote the postmortem and reusable skill from the validated run artifacts.",
      evidenceItemIds: completedRun.evidence.slice(-2).map((item) => item.id)
    });
    completedRun = appendEvent(completedRun, {
      actor: "system",
      kind: "run.resolved_to_pr",
      title: "Verified PR-ready outcome",
      summary: "ReplayX validated the proposed patch and finalized a PR-ready incident bundle.",
      phaseId: "postmortem-and-skill",
      status: "resolved_to_pr",
      evidenceRefs: patchValidation.evidenceRefs
    });

    completedRun = await writeRun(completedRun, options);
    await postSlackUpdate(completedRun, buildFinalSlackSummary(completedRun));
    return completedRun;
  } catch (error) {
    let failedRun = await readRun(runId, options);

    if (isTerminalStatus(failedRun.status)) {
      return failedRun;
    }

    failedRun = {
      ...failedRun,
      status: "failed",
      updatedAt: nowIso(),
      completedAt: nowIso(),
      currentBlocker: error instanceof Error ? error.message : "Unknown ReplayX live run failure",
      error: error instanceof Error ? error.message : "Unknown ReplayX live run failure",
      integrations: failedRun.integrations.map((integration) =>
        integration.integration === "executor"
          ? { ...integration, status: "failed", summary: "Sandbox execution failed during the live run." }
          : integration
      )
    };
    failedRun = appendEvent(failedRun, {
      actor: "system",
      kind: "run.failed",
      title: "Run failed",
      summary: failedRun.error ?? "Unknown ReplayX live run failure",
      phaseId: failedRun.currentPhaseId,
      status: "failed",
      evidenceRefs: []
    });
    failedRun = await writeRun(failedRun, options);
    await postSlackUpdate(failedRun, buildFinalSlackSummary(failedRun));
    return failedRun;
  }
};

export const startReplayXLivePipeline = (runId: string, options: LiveRunOptions = {}): void => {
  void runReplayXLivePipeline(runId, options);
};

export const startReplayXLivePipelineDetached = (
  runId: string,
  options: LiveRunOptions = {}
): void => {
  const resolved = resolveOptions(options);
  const moduleUrl = pathToFileURL(path.join(resolved.repoRoot, "dashboard/lib/live-runs.ts")).href;
  const optionsJson = JSON.stringify(options);
  const runIdJson = JSON.stringify(runId);
  const script = [
    `import * as moduleExports from ${JSON.stringify(moduleUrl)};`,
    "const api = moduleExports.default ?? moduleExports;",
    `await api.runReplayXLivePipeline(${runIdJson}, ${optionsJson});`
  ].join(" ");

  const child = spawn(process.execPath, ["--import", "tsx", "-e", script], {
    cwd: resolved.repoRoot,
    detached: true,
    stdio: "ignore"
  });

  child.unref();
};
