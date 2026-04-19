import type {
  NormalizedIncident,
  ReplayXDiagnosisWorkerDefinition,
  ReplayXDiagnosisWorkerOutput,
  ReplayXPhaseDefinition,
  ReplayXReproPhaseOutput
} from "../types.js";

export const diagnosisArenaPromptVersion = "2026-04-16.v1";

export const diagnosisWorkerOutputSchema = {
  type: "object",
  properties: {
    worker: { type: "string" },
    specialty: { type: "string" },
    diagnosis: { type: "string" },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    observations: {
      type: "array",
      items: { type: "string" }
    },
    commands_run: {
      type: "array",
      items: { type: "string" }
    },
    candidate_files: {
      type: "array",
      items: { type: "string" }
    },
    falsification_note: { type: "string" },
    status: {
      type: "string",
      enum: ["completed", "weak_signal", "blocked"]
    }
  },
  required: [
    "worker",
    "specialty",
    "diagnosis",
    "confidence",
    "observations",
    "commands_run",
    "candidate_files",
    "falsification_note",
    "status"
  ],
  additionalProperties: false
} as const;

export const diagnosisWorkerSystemPrompt = `Role:
You are a ReplayX diagnosis worker.

Mission:
Test one bounded incident hypothesis and determine whether it is the most plausible root cause.

Non-goals:
- Do not behave like a generic consultant.
- Do not widen the task beyond your assigned failure mode.
- Do not return free-form prose instead of evidence-backed structured output.

Rules:
- Stay inside your assigned failure mode.
- Run concrete checks.
- Distinguish observed facts from inference.
- Prefer disproof over vague suspicion.
- If your specialty clearly does not fit, say so with low confidence.
- Do not edit files.
- Do not produce free-form prose; return the required JSON.
- If the repro phase already narrowed the failure surface, build on it instead of restating the incident.`;

export const diagnosisWorkerDefinitions: ReplayXDiagnosisWorkerDefinition[] = [
  {
    id: "diagnosis_concurrency",
    docsPromptId: "Prompt 03A",
    docsSectionTitle: "Concurrency and Race Worker",
    specialtyName: "concurrency, locking, ordering, and race conditions",
    extraInstructions:
      "Look for non-atomic read-modify-write flows, missing transaction boundaries, missing locks, duplicate processing, retry races, and idempotency gaps.",
    focusKeywords: ["concurrent", "race", "reservation", "snapshot", "inventory", "queue"],
    incidentClassAffinity: {
      "checkout-race-condition": 1,
      "auth-token-session-failure": 0.2,
      "null-data-shape-failure": 0.1
    },
    workerOrder: 1
  },
  {
    id: "diagnosis_auth",
    docsPromptId: "Prompt 03B",
    docsSectionTitle: "Auth and Session Worker",
    specialtyName: "auth, session, token, and identity failures",
    extraInstructions:
      "Look for token expiry, inconsistent auth state, session invalidation, clock skew, cookie issues, and permission mismatch.",
    focusKeywords: ["auth", "session", "token", "refresh", "fingerprint", "401"],
    incidentClassAffinity: {
      "checkout-race-condition": 0.1,
      "auth-token-session-failure": 1,
      "null-data-shape-failure": 0.05
    },
    workerOrder: 2
  },
  {
    id: "diagnosis_data_shape",
    docsPromptId: "Prompt 03C",
    docsSectionTitle: "Data Shape and Null Worker",
    specialtyName: "null access, schema mismatch, undefined data, and missing guard failures",
    extraInstructions:
      "Look for empty query results, unchecked properties, missing guards, stale schema assumptions, and invalid payload expectations.",
    focusKeywords: ["null", "undefined", "shape", "schema", "reduce", "optional"],
    incidentClassAffinity: {
      "checkout-race-condition": 0.05,
      "auth-token-session-failure": 0.1,
      "null-data-shape-failure": 1
    },
    workerOrder: 3
  },
  {
    id: "diagnosis_recent_change",
    docsPromptId: "Prompt 03D",
    docsSectionTitle: "Recent Change Regression Worker",
    specialtyName: "recent diff regression, changed code path behavior, and rollout-introduced bugs",
    extraInstructions:
      "Focus on recent commits, removed normalization, newly unified code paths, and regressions introduced by the latest change set touching the incident path.",
    focusKeywords: ["recent", "commit", "merged", "changed", "refactor", "regression"],
    incidentClassAffinity: {
      "checkout-race-condition": 0.8,
      "auth-token-session-failure": 0.8,
      "null-data-shape-failure": 0.8
    },
    workerOrder: 4
  },
  {
    id: "diagnosis_database",
    docsPromptId: "Prompt 03E",
    docsSectionTitle: "Persistence and Transaction Worker",
    specialtyName: "query semantics, transaction bugs, locking, and persistence correctness",
    extraInstructions:
      "Inspect read/write sequencing, transaction boundaries, uniqueness assumptions, stale snapshots, and any persistence semantics implied by the failing flow.",
    focusKeywords: ["transaction", "commit", "snapshot", "write", "persist", "invariant"],
    incidentClassAffinity: {
      "checkout-race-condition": 0.7,
      "auth-token-session-failure": 0.3,
      "null-data-shape-failure": 0.15
    },
    workerOrder: 5
  },
  {
    id: "diagnosis_state_handoff",
    docsPromptId: "Prompt 03F",
    docsSectionTitle: "State Handoff Worker",
    specialtyName: "queue handoff, cache semantics, stale state reuse, and eventual consistency gaps",
    extraInstructions:
      "Look for stale reads, delayed workers, repeated job execution, reused session state, and handoff boundaries where state is copied and later committed.",
    focusKeywords: ["queue", "cache", "stale", "handoff", "worker", "reuse"],
    incidentClassAffinity: {
      "checkout-race-condition": 0.85,
      "auth-token-session-failure": 0.75,
      "null-data-shape-failure": 0.2
    },
    workerOrder: 6
  }
];

const renderEvidenceBlock = (title: string, value: string): string => {
  if (value.trim() === "") {
    return `${title}: none`;
  }

  return `${title}:\n\`\`\`text\n${value}\n\`\`\``;
};

const renderFileContext = (focusFileContexts: Array<{ path: string; excerpt: string }>): string => {
  if (focusFileContexts.length === 0) {
    return "No file context available.";
  }

  return focusFileContexts
    .map(
      (entry) =>
        `<file path="${entry.path}">\n\`\`\`ts\n${entry.excerpt}\n\`\`\`\n</file>`
    )
    .join("\n\n");
};

const renderOutputContract = (): string => JSON.stringify(diagnosisWorkerOutputSchema, null, 2);

export const buildDiagnosisWorkerPrompt = ({
  incident,
  reproResult,
  worker,
  phase,
  focusFiles,
  focusFileContexts
}: {
  incident: NormalizedIncident;
  reproResult: ReplayXReproPhaseOutput;
  worker: ReplayXDiagnosisWorkerDefinition;
  phase: ReplayXPhaseDefinition;
  focusFiles: string[];
  focusFileContexts: Array<{ path: string; excerpt: string }>;
}): string => {
  const stackTraceText = incident.evidence.stackTraces
    .map((trace) => {
      const frames = trace.frames
        .map((frame) => `- ${frame.file}:${frame.line}:${frame.column} in ${frame.function}`)
        .join("\n");

      return `${trace.source}: ${trace.errorType}: ${trace.message}\n${frames}`;
    })
    .join("\n\n");
  const logsText = incident.evidence.logs
    .map(
      (log) =>
        `${log.observedAt} [${log.level}] ${log.source}: ${log.message} ${JSON.stringify(log.context)}`
    )
    .join("\n");
  const metricsText = incident.evidence.metrics
    .map(
      (metric) =>
        `${metric.name}=${metric.value}${metric.unit} observed=${metric.observedAt} baseline=${metric.baselineValue ?? "n/a"}`
    )
    .join("\n");
  const recentChangeText = incident.recentChanges
    .map(
      (change) =>
        `${change.commit} ${change.summary} (files: ${change.files.join(", ")}) merged=${change.mergedAt} by ${change.author}`
    )
    .join("\n");

  return [
    diagnosisWorkerSystemPrompt,
    "",
    `Prompt version: ${diagnosisArenaPromptVersion}`,
    `Docs mapping: ${worker.docsPromptId} - ${worker.docsSectionTitle}`,
    "",
    "# ReplayX Incident Packet",
    "",
    "## Incident",
    `- Incident ID: ${incident.incidentId}`,
    `- Service: ${incident.service}`,
    `- Environment: ${incident.environment}`,
    `- Severity: ${incident.severity}`,
    `- User-visible symptom: ${incident.summary.symptom}`,
    "",
    "## Repro Summary",
    `- Repro confirmed: ${reproResult.repro_confirmed}`,
    `- Verification status: ${reproResult.verification_status}`,
    `- Failure surface: ${reproResult.failure_surface}`,
    `- Repro command: ${reproResult.repro_command}`,
    `- Healthy control: ${incident.commands.healthy.command}`,
    `- Repro candidate files: ${reproResult.candidate_files.join(", ")}`,
    "",
    "## Primary Evidence",
    renderEvidenceBlock("- Stack trace", stackTraceText),
    "",
    renderEvidenceBlock("- Logs", logsText),
    "",
    renderEvidenceBlock("- Metrics summary", metricsText),
    "",
    renderEvidenceBlock("- Recent change summary", recentChangeText),
    "",
    "## Code Context",
    `- Focus files: ${focusFiles.join(", ")}`,
    renderFileContext(focusFileContexts),
    "",
    "## Your specialty",
    worker.specialtyName,
    "",
    "## Phase goal",
    phase.goal,
    "",
    "## Exact scope",
    `- Stay inside worker ${worker.id}.`,
    `- Inspect only the most relevant files first: ${focusFiles.join(", ")}.`,
    "- Diagnosis only. Do not edit code or propose a patch.",
    "- Preserve uncertainty honestly if your specialty does not fit.",
    "",
    "## Required verification command",
    `- Primary repro: ${incident.commands.failing.command}`,
    `- Control: ${incident.commands.healthy.command}`,
    "",
    "## Extra instructions",
    worker.extraInstructions,
    "",
    "## Required workflow",
    "1. Inspect the code paths most relevant to your specialty.",
    "2. Run the narrowest checks that can confirm or falsify your theory.",
    "3. Identify candidate files and the likely defect mechanism.",
    "4. Explain what would falsify your theory.",
    "5. Prefer a disproof if your specialty does not hold.",
    "6. Keep the diagnosis sentence concrete enough to guide a later fix worker.",
    "",
    "## Output schema",
    "```json",
    renderOutputContract(),
    "```",
    "",
    "Return only JSON that matches the schema."
  ].join("\n");
};

export const createEmptyDiagnosisOutput = (
  worker: ReplayXDiagnosisWorkerDefinition,
  note: string
): ReplayXDiagnosisWorkerOutput => ({
  worker: worker.id,
  specialty: worker.specialtyName,
  diagnosis: note,
  confidence: 0,
  observations: [],
  commands_run: [],
  candidate_files: [],
  falsification_note: note,
  status: "blocked"
});
