import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import type {
  NormalizedIncident,
  ReplayXCommandExecutionResult,
  ReplayXCodexWorkerResult,
  ReplayXPhaseDefinition,
  ReplayXReproPhaseOutput,
  ReplayXReproSignals,
  ReplayXReproWorkerSummary,
  ReplayXRuntimeConfig
} from "../types.js";

const reproWorkerOutputSchema = {
  type: "object",
  properties: {
    failure_surface: { type: "string" },
    candidate_files: {
      type: "array",
      items: { type: "string" }
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    }
  },
  required: ["failure_surface", "candidate_files", "confidence"],
  additionalProperties: false
} as const;

export const reproPhase: ReplayXPhaseDefinition = {
  id: "repro",
  label: "Repro And Environment Verification",
  goal: "Confirm the failure surface or record why reproduction is currently blocked.",
  requiredVerificationCommand:
    "tsx orchestrator/main.ts --phase repro incidents/<incident>.json",
  requiredOutputSchema: "phase.repro.json",
  artifactOutputs: ["phase.repro.json", "verification.repro.log"],
  dependsOn: ["incident-intake", "skill-match"],
  status: "ready",
  implementationNotes:
    "Runs the incident's failing and healthy commands locally and can optionally use a Codex SDK worker to summarize the failure surface."
};

const resolveWorkingDirectory = (
  runtime: ReplayXRuntimeConfig,
  incident: NormalizedIncident,
  commandWorkingDirectory: string
): string => {
  const incidentRoot = path.resolve(runtime.repoRoot, incident.repoRoot);

  if (commandWorkingDirectory === ".") {
    return runtime.repoRoot;
  }

  if (commandWorkingDirectory.startsWith("demo_app")) {
    return path.resolve(runtime.repoRoot, commandWorkingDirectory);
  }

  return path.resolve(incidentRoot, commandWorkingDirectory);
};

const runCommand = async (
  runtime: ReplayXRuntimeConfig,
  incident: NormalizedIncident,
  commandSpec: NormalizedIncident["commands"]["failing"]
): Promise<ReplayXCommandExecutionResult> => {
  const workingDirectory = resolveWorkingDirectory(runtime, incident, commandSpec.workingDirectory);
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const child = spawn(commandSpec.command, {
      cwd: workingDirectory,
      env: process.env,
      shell: true
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
        label: commandSpec.label,
        command: commandSpec.command,
        workingDirectory,
        expectedExitCode: commandSpec.expectedExitCode,
        actualExitCode: exitCode,
        matchedExpectation: exitCode === commandSpec.expectedExitCode,
        durationMs: Date.now() - startedAt,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });

    child.on("error", (error) => {
      resolve({
        label: commandSpec.label,
        command: commandSpec.command,
        workingDirectory,
        expectedExitCode: commandSpec.expectedExitCode,
        actualExitCode: null,
        matchedExpectation: false,
        durationMs: Date.now() - startedAt,
        stdout: stdout.trim(),
        stderr: [stderr, error.message].filter(Boolean).join("\n").trim()
      });
    });
  });
};

const collectSignals = (incident: NormalizedIncident): ReplayXReproSignals => ({
  stackTraceSources: [...new Set(incident.evidence.stackTraces.map((trace) => trace.source))],
  recentChangeCommits: [...new Set(incident.recentChanges.map((change) => change.commit))],
  logSources: [...new Set(incident.evidence.logs.map((log) => log.source))]
});

const buildFallbackFailureSurface = (
  incident: NormalizedIncident,
  failingResult: ReplayXCommandExecutionResult,
  healthyResult: ReplayXCommandExecutionResult
): ReplayXReproWorkerSummary => {
  const stackFrameFiles = incident.evidence.stackTraces.flatMap((trace) =>
    trace.frames.map((frame) => frame.file)
  );
  const candidateFiles = [...new Set([...incident.suspectedFiles, ...stackFrameFiles])];
  const confirmedByHealthyControl = healthyResult.matchedExpectation
    ? "The healthy control passed, which isolates the failure to the intended repro path."
    : "The healthy control did not match expectation, so the failure surface is only partially isolated.";

  return {
    failure_surface: `${incident.summary.symptom} Repro command "${incident.commands.failing.command}" returned ${failingResult.actualExitCode}. ${confirmedByHealthyControl}`,
    candidate_files: candidateFiles,
    confidence: failingResult.matchedExpectation && healthyResult.matchedExpectation ? 0.96 : 0.74
  };
};

const attemptCodexWorker = async (
  runtime: ReplayXRuntimeConfig,
  incident: NormalizedIncident,
  failingResult: ReplayXCommandExecutionResult,
  healthyResult: ReplayXCommandExecutionResult,
  fallback: ReplayXReproWorkerSummary
): Promise<ReplayXCodexWorkerResult> => {
  if (!runtime.codexReproWorkerEnabled) {
    return {
      attempted: false,
      mode: "local-heuristic",
      status: "skipped",
      threadId: null,
      output: fallback,
      error: null
    };
  }

  const workerPrompt = [
    "You are the ReplayX repro phase worker.",
    "Return only the structured JSON requested by the output schema.",
    "Summarize the narrowest confirmed failure surface from the incident and command results.",
    "",
    `Incident ID: ${incident.incidentId}`,
    `Incident class: ${incident.incidentClass}`,
    `Symptom: ${incident.summary.symptom}`,
    `Failing command: ${incident.commands.failing.command}`,
    `Failing command matched expectation: ${failingResult.matchedExpectation}`,
    `Failing command stderr/stdout: ${(failingResult.stderr || failingResult.stdout).slice(0, 1200)}`,
    `Healthy command: ${incident.commands.healthy.command}`,
    `Healthy command matched expectation: ${healthyResult.matchedExpectation}`,
    `Healthy command stderr/stdout: ${(healthyResult.stderr || healthyResult.stdout).slice(0, 1200)}`,
    `Suspected files: ${incident.suspectedFiles.join(", ")}`,
    `Top stack trace files: ${incident.evidence.stackTraces
      .flatMap((trace) => trace.frames.map((frame) => frame.file))
      .slice(0, 6)
      .join(", ")}`,
    "",
    "Keep the failure surface concise and operational for later diagnosis workers."
  ].join("\n");

  try {
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
    const timeout = setTimeout(() => abortController.abort(), runtime.codexReproWorkerTimeoutMs);
    const turn = await thread
      .run(workerPrompt, {
        outputSchema: reproWorkerOutputSchema,
        signal: abortController.signal
      })
      .finally(() => {
        clearTimeout(timeout);
      });
    const parsed = JSON.parse(turn.finalResponse) as ReplayXReproWorkerSummary;

    return {
      attempted: true,
      mode: "codex-sdk",
      status: "completed",
      threadId: thread.id,
      output: parsed,
      error: null
    };
  } catch (error) {
    return {
      attempted: true,
      mode: "codex-sdk",
      status: "failed",
      threadId: null,
      output: fallback,
      error: error instanceof Error ? error.message : "Unknown Codex SDK worker error"
    };
  }
};

const determineVerificationStatus = (
  failingResult: ReplayXCommandExecutionResult,
  healthyResult: ReplayXCommandExecutionResult
): ReplayXReproPhaseOutput["verification_status"] => {
  if (failingResult.matchedExpectation && healthyResult.matchedExpectation) {
    return "confirmed";
  }

  if (failingResult.matchedExpectation) {
    return "partially_confirmed";
  }

  return "blocked";
};

const buildBlockedReason = (
  verificationStatus: ReplayXReproPhaseOutput["verification_status"],
  failingResult: ReplayXCommandExecutionResult,
  healthyResult: ReplayXCommandExecutionResult
): string | null => {
  if (verificationStatus === "confirmed") {
    return null;
  }

  if (verificationStatus === "partially_confirmed") {
    return `Failing repro matched expectation, but healthy control did not. Healthy command exit code was ${healthyResult.actualExitCode}.`;
  }

  return `Failing repro did not match expectation. Expected ${failingResult.expectedExitCode} but saw ${failingResult.actualExitCode}.`;
};

export const runReproPhase = async (
  incident: NormalizedIncident,
  runtime: ReplayXRuntimeConfig
): Promise<ReplayXReproPhaseOutput> => {
  const failingResult = await runCommand(runtime, incident, incident.commands.failing);
  const healthyResult = await runCommand(runtime, incident, incident.commands.healthy);
  const fallback = buildFallbackFailureSurface(incident, failingResult, healthyResult);
  const codexWorker = await attemptCodexWorker(runtime, incident, failingResult, healthyResult, fallback);
  const workerOutput = codexWorker.output ?? fallback;
  const verificationStatus = determineVerificationStatus(failingResult, healthyResult);

  return {
    schemaVersion: 1,
    phase: "repro",
    incidentId: incident.incidentId,
    repro_confirmed: verificationStatus !== "blocked",
    verification_status: verificationStatus,
    failure_surface: workerOutput.failure_surface,
    repro_command: incident.commands.failing.command,
    candidate_files: workerOutput.candidate_files,
    confidence: workerOutput.confidence,
    blocked_reason: buildBlockedReason(verificationStatus, failingResult, healthyResult),
    command_results: {
      failing: failingResult,
      healthy: healthyResult
    },
    observed_signals: collectSignals(incident),
    codex_worker: codexWorker
  };
};

export const writeReproArtifacts = async (
  runtime: ReplayXRuntimeConfig,
  incident: NormalizedIncident,
  result: ReplayXReproPhaseOutput
): Promise<{ artifactPath: string; logPath: string }> => {
  const incidentArtifactDirectory = path.join(runtime.artifactsRoot, incident.incidentId);
  const artifactPath = path.join(incidentArtifactDirectory, "phase.repro.json");
  const logPath = path.join(incidentArtifactDirectory, "verification.repro.log");
  const logLines = [
    `Incident: ${incident.incidentId}`,
    `Status: ${result.verification_status}`,
    `Repro confirmed: ${result.repro_confirmed}`,
    "",
    "[failing]",
    `command=${result.command_results.failing.command}`,
    `expected=${result.command_results.failing.expectedExitCode}`,
    `actual=${result.command_results.failing.actualExitCode}`,
    result.command_results.failing.stdout,
    result.command_results.failing.stderr,
    "",
    "[healthy]",
    `command=${result.command_results.healthy.command}`,
    `expected=${result.command_results.healthy.expectedExitCode}`,
    `actual=${result.command_results.healthy.actualExitCode}`,
    result.command_results.healthy.stdout,
    result.command_results.healthy.stderr
  ]
    .filter((line) => line !== "")
    .join("\n");

  await mkdir(incidentArtifactDirectory, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(logPath, `${logLines}\n`, "utf8");

  return { artifactPath, logPath };
};
