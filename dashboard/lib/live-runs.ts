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
import { runSeededPatchValidation } from "./live-run-resolution";
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

export type LiveRunApproval = {
  id: string;
  kind: "pr_creation" | "production_access" | "memory_promotion";
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  updatedAt: string;
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
  demoSummary: string;
};

export type ReplayXLiveRun = {
  schemaVersion: 2;
  origin: "live-run" | "legacy-import";
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
  error: string | null;
  policy: WorkspacePolicy;
  phases: LiveRunPhase[];
  events: LiveRunEvent[];
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
};

type ResolvedLiveRunOptions = {
  repoRoot: string;
  runStoreRoot: string;
  legacyRunStoreRoot: string | null;
  artifactsRoot: string;
  phaseDelayMs: number;
};

export type ReplayXAnalyticsSnapshot = {
  totalRuns: number;
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
  topRecurringIncidentFingerprints: Array<{ incidentId: string; count: number }>;
  topFailingIntegrations: Array<{ integration: string; count: number }>;
};

type IncidentSelection = {
  incidentId: string;
  incidentPath: string;
  confidence: number;
  matchedBy: "explicit" | "keyword";
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
    currentPhaseId: (run.currentPhaseId as ReplayXPhaseId | null) ?? null,
    currentBlocker: normalizedCurrentBlocker,
    issue,
    createdAt: typeof run.createdAt === "string" ? run.createdAt : nowIso(),
    updatedAt: typeof run.updatedAt === "string" ? run.updatedAt : nowIso(),
    completedAt: typeof run.completedAt === "string" ? run.completedAt : null,
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
  demoSummary: "ReplayX live run is queued."
});

const nowIso = (): string => new Date().toISOString();

const createEventId = (): string =>
  `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

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
    phaseDelayMs: options.phaseDelayMs ?? Number(process.env.REPLAYX_LIVE_PHASE_DELAY_MS ?? "800")
  };
};

const sleep = (ms: number): Promise<void> =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

const createRunId = (): string =>
  `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const isTerminalStatus = (status: LiveRunStatus): boolean =>
  status === "resolved_to_pr" || status === "blocked" || status === "failed" || status === "cancelled";

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

const resolveIncidentSelection = (
  repoRoot: string,
  input: Pick<CreateReplayXRunInput, "incidentId" | "text">
): IncidentSelection => {
  const explicitIncidentId = input.incidentId?.trim() ?? "";

  if (explicitIncidentId) {
    const entry = incidentCatalog[explicitIncidentId as keyof typeof incidentCatalog];

    if (!entry) {
      throw new Error(
        `Unsupported incidentId "${explicitIncidentId}". ReplayX live mode currently supports only seeded incidents.`
      );
    }

    return {
      incidentId: explicitIncidentId,
      incidentPath: path.join(repoRoot, "incidents", entry.path),
      confidence: 1,
      matchedBy: "explicit"
    };
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
    throw new Error(
      "ReplayX live mode currently supports only the seeded checkout, auth-session, and null-shape incidents. Please pass an explicit incidentId for the intended seeded incident."
    );
  }

  return {
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

const buildControlPlaneActionUrl = (run: ReplayXLiveRun, action: "approve" | "retry" | "cancel"): string | null => {
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
    const retryUrl = buildControlPlaneActionUrl(run, "retry");

    if (retryUrl) {
      actionElements.push({
        type: "button",
        text: { type: "plain_text", text: "Retry Run" },
        url: retryUrl
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
        : run.pullRequest.previewPath
          ? `PR preview: ${run.pullRequest.previewPath}`
          : "PR preview was not generated."
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

const createInitialApprovals = (
  environmentTarget: string,
  policy: WorkspacePolicy
): LiveRunApproval[] => {
  const requestedAt = nowIso();
  const approvals: LiveRunApproval[] = [];

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

export const createReplayXRun = async (
  input: CreateReplayXRunInput,
  rawOptions: LiveRunOptions = {}
): Promise<ReplayXLiveRun> => {
  const options = resolveOptions(rawOptions);
  const incidentSelection = resolveIncidentSelection(options.repoRoot, input);
  const incident = await loadNormalizedIncidentFile(incidentSelection.incidentPath);
  const timestamp = nowIso();
  const policy = createDefaultPolicy();
  const approvals = createInitialApprovals(input.environmentTarget ?? incident.environment, policy);
  let run: ReplayXLiveRun = {
    schemaVersion: 2,
    origin: "live-run",
    version: 1,
    runId: createRunId(),
    previousRunId: null,
    workspaceId: input.workspaceId ?? defaultWorkspaceId,
    owner: input.owner ?? input.user ?? "unassigned",
    source: input.source,
    status: approvals.length > 0 ? "awaiting_approval" : "queued",
    severity: input.severity ?? incident.severity,
    repoTarget: input.repoTarget ?? incident.repoRoot,
    serviceTarget: input.serviceTarget ?? incident.service,
    environmentTarget: input.environmentTarget ?? incident.environment,
    incidentId: incident.incidentId,
    incidentPath: incidentSelection.incidentPath,
    currentPhaseId: null,
    currentBlocker: approvals[0]?.summary ?? null,
    issue: {
      text: input.text,
      channel: input.channel ?? null,
      threadTs: input.threadTs ?? null,
      user: input.user ?? null
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
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
    summary: `ReplayX accepted the incident for ${run.repoTarget} in ${run.environmentTarget} via ${incidentSelection.matchedBy} incident selection (${incidentSelection.confidence}).`,
    phaseId: null,
    evidenceRefs: []
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

    return runs.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const average = (values: number[]): number | null => {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
};

export const getReplayXAnalytics = async (rawOptions: LiveRunOptions = {}): Promise<ReplayXAnalyticsSnapshot> => {
  const runs = (await listReplayXRuns(rawOptions)).filter((run) => run.origin === "live-run");
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

  const completedDurations = runs
    .filter((run) => run.pullRequest.status === "ready" && run.completedAt)
    .map((run) => (Date.parse(run.completedAt as string) - Date.parse(run.createdAt)) / 60_000);
  const reproSuccesses = runs.filter((run) =>
    run.phases.find((phase) => phase.id === "repro" && phase.status === "completed")
  ).length;
  const validationSuccesses = runs.filter((run) => run.pullRequest.status === "ready").length;
  const operatorInterventions = runs.filter(
    (run) =>
      run.approvals.length > 0 ||
      run.events.some((event) => event.actor === "operator" && event.kind !== "run.created")
  ).length;
  const skillPromotions = runs.filter(
    (run) => run.pullRequest.status === "ready" && run.cards.skill.path && run.cards.skill.path !== "pending"
  ).length;
  const incidentCounts = new Map<string, number>();
  const integrationFailureCounts = new Map<string, number>();
  const phaseTimings = new Map<string, number[]>();

  for (const run of runs) {
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
    totalRuns: runs.length,
    activeRuns: runs.filter((run) => activeStatuses.includes(run.status)).length,
    blockedRuns: runs.filter((run) => run.status === "blocked" || run.status === "failed").length,
    approvalQueue: runs.flatMap((run) => run.approvals).filter((approval) => approval.status === "pending").length,
    mttrMinutes: average(completedDurations),
    phaseTimingMinutes: Object.fromEntries(
      [...phaseTimings.entries()].map(([phaseId, durations]) => [phaseId, Number((average(durations) ?? 0).toFixed(2))])
    ),
    reproSuccessRate: runs.length === 0 ? 0 : reproSuccesses / runs.length,
    validationSuccessRate: runs.length === 0 ? 0 : validationSuccesses / runs.length,
    prAcceptanceRate: runs.length === 0 ? 0 : validationSuccesses / runs.length,
    operatorInterventionRate: runs.length === 0 ? 0 : operatorInterventions / runs.length,
    skillReuseRate: runs.length === 0 ? 0 : skillPromotions / runs.length,
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

  run = await writeRun(run, options);
  return run;
};

export const cancelReplayXRun = async (
  runId: string,
  rawOptions: LiveRunOptions = {}
): Promise<ReplayXLiveRun> => {
  const options = resolveOptions(rawOptions);
  let run = await readRun(runId, options);

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

export const retryReplayXRun = async (
  runId: string,
  rawOptions: LiveRunOptions = {}
): Promise<ReplayXLiveRun> => {
  const options = resolveOptions(rawOptions);
  const previousRun = await readRun(runId, options);

  const nextRun = await createReplayXRun(
    {
      source: previousRun.source,
      text: previousRun.issue.text,
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

export const runReplayXLivePipeline = async (
  runId: string,
  rawOptions: LiveRunOptions = {}
): Promise<ReplayXLiveRun> => {
  const options = resolveOptions(rawOptions);
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

  let run = await readRun(runId, options);
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
            "ReplayX is applying the seeded patch candidate inside an isolated sandbox and rerunning validations."
        }
      }
    };
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
        demoSummary: replay.demo_summary
      }
    };
    completedRun = appendEvent(completedRun, {
      actor: "system",
      kind: "run.resolved_to_pr",
      title: "Verified PR-ready outcome",
      summary: "ReplayX validated the seeded patch candidate and finalized a PR-ready incident bundle.",
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
