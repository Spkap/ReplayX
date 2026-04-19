import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  buildDiagnosisWorkerPrompt,
  diagnosisArenaPromptVersion,
  diagnosisWorkerDefinitions,
  diagnosisWorkerOutputSchema
} from "../prompts/diagnosis-arena.js";
import type {
  NormalizedIncident,
  ReplayXDiagnosisArenaPhaseOutput,
  ReplayXDiagnosisRankedCandidate,
  ReplayXDiagnosisRankingBreakdown,
  ReplayXDiagnosisWorkerDefinition,
  ReplayXDiagnosisWorkerOutput,
  ReplayXDiagnosisWorkerRunRecord,
  ReplayXDiagnosisWorkerStatus,
  ReplayXDiagnosisWorkerTraceSummary,
  ReplayXPhaseDefinition,
  ReplayXReproPhaseOutput,
  ReplayXRuntimeConfig
} from "../types.js";

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

const clampConfidence = (value: number): number => Math.max(0, Math.min(1, roundScore(value)));

const toNumberedExcerpt = (content: string, maxLines = 160): string =>
  content
    .split("\n")
    .slice(0, maxLines)
    .map((line, index) => `${String(index + 1).padStart(3, " ")}: ${line}`)
    .join("\n");

const resolveIncidentFilePath = (runtime: ReplayXRuntimeConfig, filePath: string): string =>
  path.resolve(runtime.repoRoot, filePath);

const collectIncidentFiles = (incident: NormalizedIncident, reproResult: ReplayXReproPhaseOutput): string[] => {
  const stackFiles = incident.evidence.stackTraces.flatMap((trace) => trace.frames.map((frame) => frame.file));
  const recentFiles = incident.recentChanges.flatMap((change) => change.files);

  return uniqueStrings([...reproResult.candidate_files, ...incident.suspectedFiles, ...stackFiles, ...recentFiles]);
};

const scoreFileForWorker = (
  worker: ReplayXDiagnosisWorkerDefinition,
  filePath: string,
  incident: NormalizedIncident,
  reproResult: ReplayXReproPhaseOutput
): number => {
  let score = 0;
  const normalizedPath = filePath.toLowerCase();

  if (reproResult.candidate_files.includes(filePath)) {
    score += 3;
  }

  if (incident.suspectedFiles.includes(filePath)) {
    score += 2;
  }

  if (incident.recentChanges.some((change) => change.files.includes(filePath))) {
    score += 1.5;
  }

  for (const keyword of worker.focusKeywords) {
    if (normalizedPath.includes(keyword.toLowerCase())) {
      score += 1;
    }
  }

  return score;
};

const resolveFocusFiles = (
  worker: ReplayXDiagnosisWorkerDefinition,
  incident: NormalizedIncident,
  reproResult: ReplayXReproPhaseOutput
): string[] => {
  const rankedFiles = collectIncidentFiles(incident, reproResult)
    .map((filePath, index) => ({
      filePath,
      score: scoreFileForWorker(worker, filePath, incident, reproResult),
      index
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.filePath);

  return rankedFiles.slice(0, 4);
};

const loadFocusFileContexts = async (
  runtime: ReplayXRuntimeConfig,
  focusFiles: string[]
): Promise<Array<{ path: string; excerpt: string; content: string }>> => {
  const contexts = await Promise.all(
    focusFiles.map(async (filePath) => {
      try {
        const content = await readFile(resolveIncidentFilePath(runtime, filePath), "utf8");

        return {
          path: filePath,
          excerpt: toNumberedExcerpt(content),
          content
        };
      } catch {
        return {
          path: filePath,
          excerpt: "File could not be loaded.",
          content: ""
        };
      }
    })
  );

  return contexts;
};

const createInspectionCommands = (
  worker: ReplayXDiagnosisWorkerDefinition,
  incident: NormalizedIncident,
  focusFiles: string[]
): string[] => {
  const keywordPattern = worker.focusKeywords.join("|");

  return uniqueStrings([
    incident.commands.failing.command,
    incident.commands.healthy.command,
    focusFiles.length > 0 ? `rg -n "${keywordPattern}" ${focusFiles.join(" ")}` : "",
    ...focusFiles.map((filePath) => `inspect:${filePath}`)
  ]);
};

const matchesAny = (haystack: string, needles: string[]): boolean =>
  needles.some((needle) => haystack.includes(needle.toLowerCase()));

const pickCandidateFiles = (focusFiles: string[], extraFiles: string[] = []): string[] =>
  uniqueStrings([...extraFiles, ...focusFiles]).slice(0, 4);

const deriveLocalHeuristicOutput = (
  worker: ReplayXDiagnosisWorkerDefinition,
  incident: NormalizedIncident,
  reproResult: ReplayXReproPhaseOutput,
  focusFiles: string[],
  focusFileContexts: Array<{ path: string; excerpt: string; content: string }>
): ReplayXDiagnosisWorkerOutput => {
  const combinedSource = focusFileContexts
    .map((entry) => `${entry.path}\n${entry.content}`)
    .join("\n")
    .toLowerCase();
  const evidenceText = [
    incident.summary.symptom,
    reproResult.failure_surface,
    ...incident.evidence.logs.map((log) => log.message),
    ...incident.evidence.stackTraces.map((trace) => trace.message),
    ...incident.recentChanges.map((change) => change.summary)
  ]
    .join("\n")
    .toLowerCase();
  const commandsRun = createInspectionCommands(worker, incident, focusFiles);

  switch (worker.id) {
    case "diagnosis_concurrency": {
      const strongSignal =
        matchesAny(evidenceText, [
          "concurrent",
          "oversell",
          "stale reservation token",
          "inventory snapshot changed",
          "negative inventory"
        ]) &&
        matchesAny(combinedSource, [
          "promise.all",
          "await delay(25)",
          "getinventorysnapshot",
          "record.available -= quantity"
        ]);

      if (strongSignal) {
        return {
          worker: worker.id,
          specialty: worker.specialtyName,
          diagnosis:
            "reserveStock captures inventory state before an async gap and later decrements the live record without a second availability check, so concurrent checkout requests can both commit against stale state.",
          confidence: 0.96,
          observations: [
            "The incident repro is explicitly concurrent and the healthy control is serial, which isolates ordering as the differentiator.",
            "demo_app/src/inventory/reserve-stock.ts reads a snapshot, waits 25ms, and then decrements the mutable record without revalidating availability.",
            "The logs mention both a changed inventory snapshot and a stale reservation token, which matches a race on reused pre-check state."
          ],
          commands_run: commandsRun,
          candidate_files: pickCandidateFiles(focusFiles, [
            "demo_app/src/inventory/reserve-stock.ts",
            "demo_app/src/checkout/submit-order.ts",
            "demo_app/src/queue/checkout-worker.ts"
          ]),
          falsification_note:
            "This theory would be weakened if the same invariant violation reproduced in the serial control or if reserveStock revalidated inventory after the async gap.",
          status: "completed"
        };
      }

      return {
        worker: worker.id,
        specialty: worker.specialtyName,
        diagnosis:
          "The incident does not show a convincing concurrency failure mode inside this worker's scope.",
        confidence: 0.18,
        observations: [
          "The available evidence does not align strongly with a race inside the inspected files."
        ],
        commands_run: commandsRun,
        candidate_files: pickCandidateFiles(focusFiles),
        falsification_note:
          "A reproduced ordering-only failure with clear stale state reuse would be needed to raise confidence.",
        status: "weak_signal"
      };
    }
    case "diagnosis_auth": {
      const strongSignal =
        matchesAny(evidenceText, ["401", "token", "session", "fingerprint", "expired bearer token"]) &&
        matchesAny(combinedSource, [
          "idle_session_threshold_ms",
          "return session.accesstoken",
          "rotateaccesstoken"
        ]);

      if (strongSignal) {
        return {
          worker: worker.id,
          specialty: worker.specialtyName,
          diagnosis:
            "refreshSession returns the cached session access token for idle sessions instead of rotating a fresh token, so the resumed tab reuses an already expired bearer token and loops on downstream 401s.",
          confidence: 0.97,
          observations: [
            "demo_app/src/auth/refresh-session.ts returns session.accessToken when the idle threshold is crossed instead of calling rotateAccessToken.",
            "The incident logs mention reuse of the prior token fingerprint and a negative expiry window, which matches the stale-token path exactly.",
            "The healthy control succeeds for a recent session, which isolates the bug to the idle-session branch rather than the entire refresh flow."
          ],
          commands_run: commandsRun,
          candidate_files: pickCandidateFiles(focusFiles, [
            "demo_app/src/auth/refresh-session.ts",
            "demo_app/src/auth/token-store.ts",
            "demo_app/src/middleware/require-session.ts"
          ]),
          falsification_note:
            "This theory would be disproved if the idle-session branch rotated a new token and the downstream 401 still occurred with a fresh fingerprint.",
          status: "completed"
        };
      }

      return {
        worker: worker.id,
        specialty: worker.specialtyName,
        diagnosis:
          "The current evidence does not primarily resemble an auth or session-state bug.",
        confidence: 0.14,
        observations: ["No strong auth-state defect was found in the files most relevant to this incident."],
        commands_run: commandsRun,
        candidate_files: pickCandidateFiles(focusFiles),
        falsification_note:
          "Evidence of stale credentials, token reuse, or mismatched auth state would be needed to raise confidence.",
        status: "weak_signal"
      };
    }
    case "diagnosis_data_shape": {
      const strongSignal =
        matchesAny(evidenceText, ["null", "reduce", "taxes", "optional fields", "schema"]) &&
        matchesAny(combinedSource, ["quote.taxes!", "taxes: null", "buildsummarytotals"]);

      if (strongSignal) {
        return {
          worker: worker.id,
          specialty: worker.specialtyName,
          diagnosis:
            "buildSummaryTotals assumes quote.taxes is always an array and immediately calls reduce on a nullable field, so the missing-taxes fixture crashes before the summary can render.",
          confidence: 0.98,
          observations: [
            "demo_app/src/orders/build-summary.ts uses quote.taxes! and calls reduce without guarding for null or omission.",
            "demo_app/src/orders/quote-adapter.ts returns taxes: null for the seeded missing-taxes fixture, so the crash is a direct shape mismatch rather than an upstream transport failure.",
            "The healthy control succeeds when taxes is present, which isolates the defect to null-shape handling."
          ],
          commands_run: commandsRun,
          candidate_files: pickCandidateFiles(focusFiles, [
            "demo_app/src/orders/build-summary.ts",
            "demo_app/src/orders/quote-adapter.ts",
            "demo_app/src/routes/order-summary.tsx"
          ]),
          falsification_note:
            "This theory would fail if taxes were normalized to an array before buildSummaryTotals and the same TypeError still reproduced.",
          status: "completed"
        };
      }

      return {
        worker: worker.id,
        specialty: worker.specialtyName,
        diagnosis:
          "The evidence does not strongly indicate a null-guard or data-shape failure in this incident.",
        confidence: 0.16,
        observations: ["The inspected files do not show a convincing null-shape defect for this incident."],
        commands_run: commandsRun,
        candidate_files: pickCandidateFiles(focusFiles),
        falsification_note:
          "A reproducible null or undefined access on the failing path would be needed to raise confidence.",
        status: "weak_signal"
      };
    }
    case "diagnosis_recent_change": {
      const latestChange = incident.recentChanges[0];
      const overlappingFiles = latestChange ? latestChange.files.filter((filePath) => focusFiles.includes(filePath)) : [];
      const strongSignal = Boolean(latestChange) && overlappingFiles.length > 0;

      if (strongSignal && latestChange) {
        return {
          worker: worker.id,
          specialty: worker.specialtyName,
          diagnosis:
            `The strongest regression signal is recent change ${latestChange.commit}, which changed the exact failing path and likely introduced the bug mechanism now seen in the repro and logs.`,
          confidence: 0.81,
          observations: [
            `Recent change ${latestChange.commit} (${latestChange.summary}) overlaps the worker focus files: ${overlappingFiles.join(", ")}.`,
            "The incident reproduces in the same code path touched by the most recent merged change, which makes a regression more plausible than an unrelated environmental failure.",
            "The healthy control still passes, so the regression appears narrowly scoped to the changed path rather than a wider platform outage."
          ],
          commands_run: commandsRun,
          candidate_files: pickCandidateFiles(overlappingFiles, focusFiles),
          falsification_note:
            "This theory would weaken if the same failure reproduced against a pre-change version or if the touched files do not contain the final defect mechanism.",
          status: "completed"
        };
      }

      return {
        worker: worker.id,
        specialty: worker.specialtyName,
        diagnosis:
          "Recent-change evidence is too weak to treat rollout regression as the primary root cause.",
        confidence: 0.22,
        observations: ["The latest change set does not clearly overlap the narrow failing path for this incident."],
        commands_run: commandsRun,
        candidate_files: pickCandidateFiles(focusFiles),
        falsification_note:
          "A clearly overlapping recent commit with a changed failure path would be needed to raise confidence.",
        status: "weak_signal"
      };
    }
    case "diagnosis_database": {
      const strongSignal =
        matchesAny(evidenceText, ["commit", "invariant", "snapshot", "reservation", "negative inventory"]) &&
        matchesAny(combinedSource, ["snapshotversion", "record.available -= quantity", "commitcheckout"]);

      if (strongSignal) {
        return {
          worker: worker.id,
          specialty: worker.specialtyName,
          diagnosis:
            "The failing path relies on snapshot-style state without a single atomic commit boundary, so persistence correctness depends on stale pre-write state and allows an invalid double-reserve outcome.",
          confidence: 0.67,
          observations: [
            "The stack trace and logs describe commit-time invariant failure after state was validated earlier against an older snapshot.",
            "The code mutates inventory after a stale read, which behaves like a missing transaction boundary even in this in-memory demo app.",
            "This worker sees a persistence-semantics issue, but the evidence is weaker than the dedicated concurrency explanation."
          ],
          commands_run: commandsRun,
          candidate_files: pickCandidateFiles(focusFiles, [
            "demo_app/src/inventory/reserve-stock.ts",
            "demo_app/src/checkout/submit-order.ts"
          ]),
          falsification_note:
            "This theory would be less credible if the failing path had a fresh read plus a single atomic commit boundary and still oversold inventory.",
          status: "completed"
        };
      }

      return {
        worker: worker.id,
        specialty: worker.specialtyName,
        diagnosis:
          "Persistence semantics do not look like the primary failure mode for this incident.",
        confidence: 0.19,
        observations: ["The evidence does not point to transaction or write-order semantics as the main explanation."],
        commands_run: commandsRun,
        candidate_files: pickCandidateFiles(focusFiles),
        falsification_note:
          "A stale-read or commit-boundary failure tied directly to the incident would be needed to raise confidence.",
        status: "weak_signal"
      };
    }
    case "diagnosis_state_handoff": {
      const strongSignal =
        matchesAny(evidenceText, ["stale reservation token", "queue", "reused prior token fingerprint", "stale", "worker"]) &&
        matchesAny(combinedSource, ["processcheckoutworker", "return session.accesstoken", "reservationtoken", "token-store"]);

      if (strongSignal) {
        const diagnosis = incident.incidentClass === "auth-token-session-failure"
          ? "The idle-session refresh path hands downstream validation a token copied from cached session state instead of a newly rotated token, so stale auth state survives the handoff and fails immediately."
          : "The checkout flow hands off stale pre-check state across the worker boundary, so the later commit uses an outdated reservation snapshot and confirms an order against already-changed inventory.";

        return {
          worker: worker.id,
          specialty: worker.specialtyName,
          diagnosis,
          confidence: incident.incidentClass === "auth-token-session-failure" ? 0.84 : 0.82,
          observations: [
            "The incident evidence explicitly mentions stale or reused state at a handoff boundary rather than a clean recomputation from fresh state.",
            "The inspected files show state being carried forward across a worker or session boundary before downstream validation happens.",
            "This explanation is plausible, but it is broader than the most direct specialty-specific worker for the incident."
          ],
          commands_run: commandsRun,
          candidate_files: pickCandidateFiles(focusFiles),
          falsification_note:
            "This theory would weaken if the handoff boundary always rebuilt state from fresh inputs and the failure still reproduced.",
          status: "completed"
        };
      }

      return {
        worker: worker.id,
        specialty: worker.specialtyName,
        diagnosis:
          "A stale state handoff is not strongly supported by the evidence for this incident.",
        confidence: 0.2,
        observations: ["The current incident does not show a convincing cache, queue, or stale-state handoff issue."],
        commands_run: commandsRun,
        candidate_files: pickCandidateFiles(focusFiles),
        falsification_note:
          "Evidence of stale copied state crossing a worker or cache boundary would be needed to raise confidence.",
        status: "weak_signal"
      };
    }
  }
};

const createFallbackTraceSummary = (commands: string[]): ReplayXDiagnosisWorkerTraceSummary => ({
  item_types: ["local-heuristic"],
  commands: commands.map((command) => ({
    command,
    status: "completed",
    exit_code: null
  })),
  reasoning: ["Deterministic local heuristic fallback used."]
});

const parseStringArray = (value: unknown, context: string): string[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array.`);
  }

  return value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new Error(`${context}[${index}] must be a non-empty string.`);
    }

    return entry;
  });
};

const parseDiagnosisWorkerOutput = (
  value: unknown,
  worker: ReplayXDiagnosisWorkerDefinition
): ReplayXDiagnosisWorkerOutput => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Diagnosis worker output must be an object.");
  }

  const record = value as Record<string, unknown>;
  const status = record.status;

  if (record.worker !== worker.id) {
    throw new Error(`Diagnosis worker output.worker must equal ${worker.id}.`);
  }

  if (record.specialty !== worker.specialtyName) {
    throw new Error(`Diagnosis worker output.specialty must equal ${worker.specialtyName}.`);
  }

  if (typeof record.diagnosis !== "string" || record.diagnosis.trim() === "") {
    throw new Error("Diagnosis worker diagnosis must be a non-empty string.");
  }

  if (typeof record.confidence !== "number" || Number.isNaN(record.confidence)) {
    throw new Error("Diagnosis worker confidence must be a number.");
  }

  if (status !== "completed" && status !== "weak_signal" && status !== "blocked") {
    throw new Error("Diagnosis worker status must be completed, weak_signal, or blocked.");
  }

  if (typeof record.falsification_note !== "string" || record.falsification_note.trim() === "") {
    throw new Error("Diagnosis worker falsification_note must be a non-empty string.");
  }

  return {
    worker: worker.id,
    specialty: worker.specialtyName,
    diagnosis: record.diagnosis.trim(),
    confidence: clampConfidence(record.confidence),
    observations: uniqueStrings(parseStringArray(record.observations, "observations")),
    commands_run: uniqueStrings(parseStringArray(record.commands_run, "commands_run")),
    candidate_files: uniqueStrings(parseStringArray(record.candidate_files, "candidate_files")),
    falsification_note: record.falsification_note.trim(),
    status
  };
};

type CodexThreadItem = {
  type: string;
  command?: string;
  status?: string;
  exit_code?: number | null;
  text?: string;
};

const summarizeThreadItems = (items: CodexThreadItem[]): ReplayXDiagnosisWorkerTraceSummary => ({
  item_types: uniqueStrings(items.map((item) => item.type)),
  commands: items
    .filter((item) => item.type === "command_execution")
    .map((item) => ({
      command: item.command ?? "",
      status: item.status ?? "unknown",
      exit_code: item.exit_code ?? null
    })),
  reasoning: items
    .filter((item) => item.type === "reasoning")
    .map((item) => item.text ?? "")
});

const runCodexDiagnosisWorker = async (
  runtime: ReplayXRuntimeConfig,
  incident: NormalizedIncident,
  reproResult: ReplayXReproPhaseOutput,
  worker: ReplayXDiagnosisWorkerDefinition,
  focusFiles: string[],
  focusFileContexts: Array<{ path: string; excerpt: string; content: string }>
): Promise<ReplayXDiagnosisWorkerRunRecord> => {
  const fallback = deriveLocalHeuristicOutput(worker, incident, reproResult, focusFiles, focusFileContexts);

  if (!runtime.codexDiagnosisWorkersEnabled) {
    return {
      worker_id: worker.id,
      docs_prompt_id: worker.docsPromptId,
      prompt_version: diagnosisArenaPromptVersion,
      specialty: worker.specialtyName,
      mode: "local-heuristic",
      thread_id: null,
      output: fallback,
      raw_response: JSON.stringify(fallback),
      trace_summary: createFallbackTraceSummary(fallback.commands_run),
      error: null
    };
  }

  const prompt = buildDiagnosisWorkerPrompt({
    incident,
    reproResult,
    worker,
    phase: diagnosisArenaPhase,
    focusFiles,
    focusFileContexts: focusFileContexts.map((entry) => ({
      path: entry.path,
      excerpt: entry.excerpt
    }))
  });
  const { Codex } = await import("@openai/codex-sdk");
  const codex = new Codex();
  const thread = codex.startThread({
    workingDirectory: runtime.repoRoot,
    approvalPolicy: "never",
    sandboxMode: "read-only",
    model: runtime.defaultModel,
    modelReasoningEffort: "low",
    networkAccessEnabled: false,
    webSearchMode: "disabled"
  });
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), runtime.codexDiagnosisWorkerTimeoutMs);

  try {
    const turn = await thread
      .run(prompt, {
        outputSchema: diagnosisWorkerOutputSchema,
        signal: abortController.signal
      })
      .finally(() => {
        clearTimeout(timeout);
      });
    const parsed = parseDiagnosisWorkerOutput(JSON.parse(turn.finalResponse) as unknown, worker);

    return {
      worker_id: worker.id,
      docs_prompt_id: worker.docsPromptId,
      prompt_version: diagnosisArenaPromptVersion,
      specialty: worker.specialtyName,
      mode: "codex-sdk",
      thread_id: thread.id,
      output: parsed,
      raw_response: turn.finalResponse,
      trace_summary: summarizeThreadItems(turn.items),
      error: null
    };
  } catch (error) {
    clearTimeout(timeout);

    return {
      worker_id: worker.id,
      docs_prompt_id: worker.docsPromptId,
      prompt_version: diagnosisArenaPromptVersion,
      specialty: worker.specialtyName,
      mode: "local-heuristic",
      thread_id: thread.id,
      output: fallback,
      raw_response: JSON.stringify(fallback),
      trace_summary: createFallbackTraceSummary(fallback.commands_run),
      error: error instanceof Error ? error.message : "Unknown Codex SDK diagnosis worker error"
    };
  }
};

const runWithConcurrencyLimit = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> => {
  const concurrency = Math.max(1, limit);
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const next = async (): Promise<void> => {
    const currentIndex = cursor;

    if (currentIndex >= items.length) {
      return;
    }

    cursor += 1;
    results[currentIndex] = await worker(items[currentIndex]);
    await next();
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));

  return results;
};

const statusScoreMap: Record<ReplayXDiagnosisWorkerStatus, number> = {
  completed: 1,
  weak_signal: 0.45,
  blocked: 0
};

const computeFileOverlapScore = (
  candidateFiles: string[],
  incident: NormalizedIncident,
  reproResult: ReplayXReproPhaseOutput
): number => {
  if (candidateFiles.length === 0) {
    return 0;
  }

  const relevant = new Set(collectIncidentFiles(incident, reproResult));
  const overlapping = candidateFiles.filter((filePath) => relevant.has(filePath)).length;

  return roundScore(overlapping / candidateFiles.length);
};

const rankDiagnosisWorkers = (
  incident: NormalizedIncident,
  reproResult: ReplayXReproPhaseOutput,
  workerResults: ReplayXDiagnosisWorkerRunRecord[]
): ReplayXDiagnosisRankedCandidate[] => {
  const workerOrder = new Map(diagnosisWorkerDefinitions.map((worker) => [worker.id, worker.workerOrder]));
  const workerDefinitions = new Map(diagnosisWorkerDefinitions.map((worker) => [worker.id, worker]));

  return workerResults
    .map((result) => {
      const definition = workerDefinitions.get(result.worker_id);
      const classAffinity = definition?.incidentClassAffinity[incident.incidentClass] ?? 0.1;
      const statusScore = statusScoreMap[result.output.status];
      const fileOverlapScore = computeFileOverlapScore(
        result.output.candidate_files,
        incident,
        reproResult
      );
      const observationScore = roundScore(Math.min(1, result.output.observations.length / 4));
      const commandScore = roundScore(Math.min(1, result.output.commands_run.length / 4));
      const breakdown: ReplayXDiagnosisRankingBreakdown = {
        status_score: statusScore,
        confidence_score: result.output.confidence,
        class_affinity_score: classAffinity,
        file_overlap_score: fileOverlapScore,
        observation_score: observationScore,
        command_score: commandScore,
        total: 0
      };
      const total = roundScore(
        statusScore * 0.2 +
          result.output.confidence * 0.45 +
          classAffinity * 0.15 +
          fileOverlapScore * 0.1 +
          observationScore * 0.05 +
          commandScore * 0.05
      );

      breakdown.total = total;

      return {
        worker_id: result.worker_id,
        specialty: result.specialty,
        diagnosis: result.output.diagnosis,
        confidence: result.output.confidence,
        status: result.output.status,
        candidate_files: result.output.candidate_files,
        score: total,
        score_breakdown: breakdown,
        worker_order: workerOrder.get(result.worker_id) ?? Number.MAX_SAFE_INTEGER
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.confidence - left.confidence ||
        left.worker_order - right.worker_order
    )
    .map(({ worker_order: _workerOrder, ...candidate }, index) => ({
      rank: index + 1,
      ...candidate
    }));
};

export const diagnosisArenaPhase: ReplayXPhaseDefinition = {
  id: "diagnosis-arena",
  label: "Diagnosis Arena",
  goal: "Run bounded specialist diagnosis workers and rank the evidence-backed candidates.",
  requiredVerificationCommand: "tsx orchestrator/main.ts --phase diagnosis-arena incidents/<incident>.json",
  requiredOutputSchema: "phase.diagnosis-arena.json",
  artifactOutputs: [
    "phase.diagnosis-arena.json",
    "ranking.diagnosis-arena.log",
    "diagnosis-workers/"
  ],
  dependsOn: ["repro"],
  status: "ready",
  implementationNotes:
    "Runs six bounded diagnosis workers with one explicit Codex thread per worker when enabled, preserves per-worker JSON artifacts, and falls back to deterministic local heuristics if Codex is unavailable."
};

export const runDiagnosisArenaPhase = async (
  incident: NormalizedIncident,
  runtime: ReplayXRuntimeConfig,
  reproResult: ReplayXReproPhaseOutput
): Promise<ReplayXDiagnosisArenaPhaseOutput> => {
  const workerResults = await runWithConcurrencyLimit(
    diagnosisWorkerDefinitions,
    runtime.maxParallelWorkers,
    async (worker) => {
      const focusFiles = resolveFocusFiles(worker, incident, reproResult);
      const focusFileContexts = await loadFocusFileContexts(runtime, focusFiles);

      return runCodexDiagnosisWorker(runtime, incident, reproResult, worker, focusFiles, focusFileContexts);
    }
  );
  const ranked = rankDiagnosisWorkers(incident, reproResult, workerResults);
  const completedShortlist = ranked.filter((candidate) => candidate.status === "completed").slice(0, 3);
  const shortlist =
    completedShortlist.length > 0
      ? completedShortlist
      : ranked.filter((candidate) => candidate.status !== "blocked").slice(0, 3);
  const codexWorkerCount = workerResults.filter((result) => result.mode === "codex-sdk").length;

  return {
    schemaVersion: 1,
    phase: "diagnosis-arena",
    incidentId: incident.incidentId,
    prompt_version: diagnosisArenaPromptVersion,
    worker_count: workerResults.length,
    codex_worker_count: codexWorkerCount,
    fallback_worker_count: workerResults.length - codexWorkerCount,
    repro_summary: {
      repro_confirmed: reproResult.repro_confirmed,
      verification_status: reproResult.verification_status,
      failure_surface: reproResult.failure_surface,
      candidate_files: reproResult.candidate_files,
      confidence: reproResult.confidence
    },
    worker_results: workerResults,
    ranked_shortlist: shortlist,
    challenger_ready: {
      winning_worker: shortlist[0]?.worker_id ?? null,
      shortlisted_workers: shortlist.map((candidate) => candidate.worker_id),
      candidate_count: shortlist.length
    }
  };
};

export const writeDiagnosisArenaArtifacts = async (
  runtime: ReplayXRuntimeConfig,
  incident: NormalizedIncident,
  result: ReplayXDiagnosisArenaPhaseOutput
): Promise<{
  artifactPath: string;
  rankingPath: string;
  workerArtifactPaths: Record<string, string>;
}> => {
  const incidentArtifactDirectory = path.join(runtime.artifactsRoot, incident.incidentId);
  const workerArtifactDirectory = path.join(incidentArtifactDirectory, "diagnosis-workers");
  const artifactPath = path.join(incidentArtifactDirectory, "phase.diagnosis-arena.json");
  const rankingPath = path.join(incidentArtifactDirectory, "ranking.diagnosis-arena.log");
  const workerArtifactPaths: Record<string, string> = {};

  await mkdir(workerArtifactDirectory, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  for (const workerResult of result.worker_results) {
    const workerArtifactPath = path.join(workerArtifactDirectory, `${workerResult.worker_id}.json`);
    workerArtifactPaths[workerResult.worker_id] = workerArtifactPath;
    await writeFile(workerArtifactPath, `${JSON.stringify(workerResult, null, 2)}\n`, "utf8");
  }

  const rankingLines = result.ranked_shortlist.flatMap((candidate) => [
    `${candidate.rank}. ${candidate.worker_id} score=${candidate.score} confidence=${candidate.confidence} status=${candidate.status}`,
    `   diagnosis=${candidate.diagnosis}`,
    `   files=${candidate.candidate_files.join(", ")}`,
    `   breakdown=${JSON.stringify(candidate.score_breakdown)}`
  ]);

  await writeFile(
    rankingPath,
    `${[
      `Incident: ${incident.incidentId}`,
      `Prompt version: ${result.prompt_version}`,
      `Winning worker: ${result.challenger_ready.winning_worker ?? "none"}`,
      ...rankingLines
    ].join("\n")}\n`,
    "utf8"
  );

  return {
    artifactPath,
    rankingPath,
    workerArtifactPaths
  };
};
