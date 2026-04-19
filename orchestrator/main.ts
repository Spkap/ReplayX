import path from "node:path";
import process from "node:process";

import { loadNormalizedIncident } from "./normalize-incident.js";
import { replayXPhases } from "./phases/index.js";
import {
  runChallengerValidationPhase,
  writeChallengerValidationArtifacts
} from "./phases/challenger-validation.js";
import {
  runDiagnosisArenaPhase,
  writeDiagnosisArenaArtifacts
} from "./phases/diagnosis-arena.js";
import { runFixArenaPhase, writeFixArenaArtifacts } from "./phases/fix-arena.js";
import {
  runIncidentIntakePhase,
  writeIncidentIntakeArtifacts
} from "./phases/incident-intake.js";
import {
  runPostmortemAndSkillPhase,
  writePostmortemAndSkillArtifacts
} from "./phases/postmortem-and-skill.js";
import { runReproPhase, writeReproArtifacts } from "./phases/repro.js";
import {
  runReviewAndRegressionPhase,
  writeReviewAndRegressionArtifacts
} from "./phases/review-and-regression.js";
import { runSkillMatchPhase, writeSkillMatchArtifacts } from "./phases/skill-match.js";
import type { ReplayXIncidentPointer, ReplayXRunPlan, ReplayXRuntimeConfig } from "./types.js";

const defaultRuntimeConfig = (repoRoot: string): ReplayXRuntimeConfig => ({
  repoRoot,
  artifactsRoot: path.join(repoRoot, "artifacts"),
  defaultModel: process.env.REPLAYX_CODEX_MODEL ?? "gpt-5-codex",
  maxParallelWorkers: Number(process.env.REPLAYX_MAX_PARALLEL_WORKERS ?? "4"),
  codexReproWorkerEnabled: process.env.REPLAYX_USE_CODEX_REPRO_WORKER !== "0",
  codexReproWorkerTimeoutMs: Number(process.env.REPLAYX_CODEX_REPRO_TIMEOUT_MS ?? "30000"),
  codexDiagnosisWorkersEnabled: process.env.REPLAYX_USE_CODEX_DIAGNOSIS_WORKERS !== "0",
  codexDiagnosisWorkerTimeoutMs: Number(process.env.REPLAYX_CODEX_DIAGNOSIS_TIMEOUT_MS ?? "45000")
});

const deriveIncidentPointer = (repoRoot: string, incidentArg?: string): ReplayXIncidentPointer => {
  const incidentId = incidentArg ? path.basename(incidentArg, path.extname(incidentArg)) : "seeded-incident";
  const inputPath = incidentArg ? path.resolve(repoRoot, incidentArg) : path.join(repoRoot, "incidents");

  return {
    incidentId,
    inputPath,
    normalizedPath: path.join(repoRoot, "artifacts", incidentId, "normalized_incident.json")
  };
};

export const buildReplayXRunPlan = (incidentArg?: string): ReplayXRunPlan => {
  const repoRoot = process.cwd();

  return {
    incident: deriveIncidentPointer(repoRoot, incidentArg),
    runtime: defaultRuntimeConfig(repoRoot),
    phases: replayXPhases
  };
};

const renderRunPlan = (plan: ReplayXRunPlan): string => {
  const phaseLines = plan.phases.map((phase, index) => {
    const dependencyLabel = phase.dependsOn.length > 0 ? phase.dependsOn.join(", ") : "none";

    return `${index + 1}. ${phase.label} [${phase.id}] -> depends on: ${dependencyLabel}`;
  });

  return [
    "ReplayX phase runner is ready.",
    `Incident input: ${plan.incident.inputPath}`,
    `Artifacts root: ${plan.runtime.artifactsRoot}`,
    `Default model: ${plan.runtime.defaultModel}`,
    "",
    "Planned phases:",
    ...phaseLines,
    "",
    "Run a phase with: tsx orchestrator/main.ts --phase <phase-id> incidents/<incident>.json",
    "Run the replay-safe demo flow with: tsx orchestrator/main.ts --phase golden-run incidents/<incident>.json"
  ].join("\n");
};

const parseCliArguments = (
  argv: string[]
): {
  phase: string | null;
  incidentPath: string | null;
} => {
  let phase: string | null = null;
  let incidentPath: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--phase" && argv[index + 1]) {
      phase = argv[index + 1];
      index += 1;
      continue;
    }

    if (argument.startsWith("--phase=")) {
      phase = argument.split("=")[1] ?? null;
      continue;
    }

    if (!argument.startsWith("--") && incidentPath === null) {
      incidentPath = argument;
    }
  }

  return { phase, incidentPath };
};

export const main = async (): Promise<void> => {
  const { phase, incidentPath } = parseCliArguments(process.argv.slice(2));

  if (phase === "incident-intake") {
    if (!incidentPath) {
      throw new Error("Phase 'incident-intake' requires a path to a normalized incident JSON file.");
    }

    const repoRoot = process.cwd();
    const runtime = defaultRuntimeConfig(repoRoot);
    const absoluteIncidentPath = path.resolve(repoRoot, incidentPath);
    const incident = await loadNormalizedIncident(absoluteIncidentPath);
    const normalizedPath = path.join(runtime.artifactsRoot, incident.incidentId, "normalized_incident.json");
    const result = runIncidentIntakePhase(absoluteIncidentPath, normalizedPath, incident);
    const artifacts = await writeIncidentIntakeArtifacts(runtime, incident, result);

    console.log(JSON.stringify({ ...result, artifact_paths: artifacts }, null, 2));
    return;
  }

  if (phase === "skill-match") {
    if (!incidentPath) {
      throw new Error("Phase 'skill-match' requires a path to a normalized incident JSON file.");
    }

    const repoRoot = process.cwd();
    const runtime = defaultRuntimeConfig(repoRoot);
    const incident = await loadNormalizedIncident(path.resolve(repoRoot, incidentPath));
    const result = await runSkillMatchPhase(runtime, incident);
    const artifacts = await writeSkillMatchArtifacts(runtime, incident, result);

    console.log(JSON.stringify({ ...result, artifact_paths: artifacts }, null, 2));
    return;
  }

  if (phase === "repro") {
    if (!incidentPath) {
      throw new Error("Phase 'repro' requires a path to a normalized incident JSON file.");
    }

    const repoRoot = process.cwd();
    const runtime = defaultRuntimeConfig(repoRoot);
    const incident = await loadNormalizedIncident(path.resolve(repoRoot, incidentPath));
    const result = await runReproPhase(incident, runtime);
    const artifacts = await writeReproArtifacts(runtime, incident, result);

    console.log(
      JSON.stringify(
        {
          ...result,
          artifact_paths: artifacts
        },
        null,
        2
      )
    );
    return;
  }

  if (phase === "diagnosis-arena") {
    if (!incidentPath) {
      throw new Error("Phase 'diagnosis-arena' requires a path to a normalized incident JSON file.");
    }

    const repoRoot = process.cwd();
    const runtime = defaultRuntimeConfig(repoRoot);
    const incident = await loadNormalizedIncident(path.resolve(repoRoot, incidentPath));
    const reproResult = await runReproPhase(incident, runtime);
    const reproArtifacts = await writeReproArtifacts(runtime, incident, reproResult);
    const diagnosisResult = await runDiagnosisArenaPhase(incident, runtime, reproResult);
    const diagnosisArtifacts = await writeDiagnosisArenaArtifacts(runtime, incident, diagnosisResult);

    console.log(
      JSON.stringify(
        {
          ...diagnosisResult,
          artifact_paths: {
            repro: reproArtifacts,
            diagnosis: diagnosisArtifacts
          }
        },
        null,
        2
      )
    );
    return;
  }

  if (phase === "challenger-validation" || phase === "challenger") {
    if (!incidentPath) {
      throw new Error(
        "Phase 'challenger-validation' requires a path to a normalized incident JSON file."
      );
    }

    const repoRoot = process.cwd();
    const runtime = defaultRuntimeConfig(repoRoot);
    const incident = await loadNormalizedIncident(path.resolve(repoRoot, incidentPath));
    const reproResult = await runReproPhase(incident, runtime);
    const reproArtifacts = await writeReproArtifacts(runtime, incident, reproResult);
    const diagnosisResult = await runDiagnosisArenaPhase(incident, runtime, reproResult);
    const diagnosisArtifacts = await writeDiagnosisArenaArtifacts(runtime, incident, diagnosisResult);
    const challengerResult = runChallengerValidationPhase(incident, diagnosisResult);
    const challengerArtifacts = await writeChallengerValidationArtifacts(
      runtime,
      incident,
      challengerResult
    );

    console.log(
      JSON.stringify(
        {
          ...challengerResult,
          artifact_paths: {
            repro: reproArtifacts,
            diagnosis: diagnosisArtifacts,
            challenger: challengerArtifacts
          }
        },
        null,
        2
      )
    );
    return;
  }

  if (phase === "fix-arena") {
    if (!incidentPath) {
      throw new Error("Phase 'fix-arena' requires a path to a normalized incident JSON file.");
    }

    const repoRoot = process.cwd();
    const runtime = defaultRuntimeConfig(repoRoot);
    const incident = await loadNormalizedIncident(path.resolve(repoRoot, incidentPath));
    const reproResult = await runReproPhase(incident, runtime);
    const reproArtifacts = await writeReproArtifacts(runtime, incident, reproResult);
    const diagnosisResult = await runDiagnosisArenaPhase(incident, runtime, reproResult);
    const diagnosisArtifacts = await writeDiagnosisArenaArtifacts(runtime, incident, diagnosisResult);
    const challengerResult = runChallengerValidationPhase(incident, diagnosisResult);
    const challengerArtifacts = await writeChallengerValidationArtifacts(
      runtime,
      incident,
      challengerResult
    );
    const fixResult = runFixArenaPhase(incident, diagnosisResult, challengerResult);
    const fixArtifacts = await writeFixArenaArtifacts(runtime, incident, fixResult);

    console.log(
      JSON.stringify(
        {
          ...fixResult,
          artifact_paths: {
            repro: reproArtifacts,
            diagnosis: diagnosisArtifacts,
            challenger: challengerArtifacts,
            fix: fixArtifacts
          }
        },
        null,
        2
      )
    );
    return;
  }

  if (phase === "review-and-regression") {
    if (!incidentPath) {
      throw new Error(
        "Phase 'review-and-regression' requires a path to a normalized incident JSON file."
      );
    }

    const repoRoot = process.cwd();
    const runtime = defaultRuntimeConfig(repoRoot);
    const incident = await loadNormalizedIncident(path.resolve(repoRoot, incidentPath));
    const reproResult = await runReproPhase(incident, runtime);
    const reproArtifacts = await writeReproArtifacts(runtime, incident, reproResult);
    const diagnosisResult = await runDiagnosisArenaPhase(incident, runtime, reproResult);
    const diagnosisArtifacts = await writeDiagnosisArenaArtifacts(runtime, incident, diagnosisResult);
    const challengerResult = runChallengerValidationPhase(incident, diagnosisResult);
    const challengerArtifacts = await writeChallengerValidationArtifacts(
      runtime,
      incident,
      challengerResult
    );
    const fixResult = runFixArenaPhase(incident, diagnosisResult, challengerResult);
    const fixArtifacts = await writeFixArenaArtifacts(runtime, incident, fixResult);
    const reviewResult = runReviewAndRegressionPhase(incident, fixResult);
    const reviewArtifacts = await writeReviewAndRegressionArtifacts(runtime, incident, reviewResult);

    console.log(
      JSON.stringify(
        {
          ...reviewResult,
          artifact_paths: {
            repro: reproArtifacts,
            diagnosis: diagnosisArtifacts,
            challenger: challengerArtifacts,
            fix: fixArtifacts,
            review: reviewArtifacts
          }
        },
        null,
        2
      )
    );
    return;
  }

  if (phase === "postmortem-and-skill" || phase === "golden-run") {
    if (!incidentPath) {
      throw new Error(
        "Phase 'postmortem-and-skill' requires a path to a normalized incident JSON file."
      );
    }

    const repoRoot = process.cwd();
    const runtime = defaultRuntimeConfig(repoRoot);
    const absoluteIncidentPath = path.resolve(repoRoot, incidentPath);
    const incident = await loadNormalizedIncident(absoluteIncidentPath);
    const normalizedPath = path.join(runtime.artifactsRoot, incident.incidentId, "normalized_incident.json");
    const intakeResult = runIncidentIntakePhase(absoluteIncidentPath, normalizedPath, incident);
    const intakeArtifacts = await writeIncidentIntakeArtifacts(runtime, incident, intakeResult);
    const skillMatchResult = await runSkillMatchPhase(runtime, incident);
    const skillMatchArtifacts = await writeSkillMatchArtifacts(runtime, incident, skillMatchResult);
    const reproResult = await runReproPhase(incident, runtime);
    const reproArtifacts = await writeReproArtifacts(runtime, incident, reproResult);
    const diagnosisResult = await runDiagnosisArenaPhase(incident, runtime, reproResult);
    const diagnosisArtifacts = await writeDiagnosisArenaArtifacts(runtime, incident, diagnosisResult);
    const challengerResult = runChallengerValidationPhase(incident, diagnosisResult);
    const challengerArtifacts = await writeChallengerValidationArtifacts(
      runtime,
      incident,
      challengerResult
    );
    const fixResult = runFixArenaPhase(incident, diagnosisResult, challengerResult);
    const fixArtifacts = await writeFixArenaArtifacts(runtime, incident, fixResult);
    const reviewResult = runReviewAndRegressionPhase(incident, fixResult);
    const reviewArtifacts = await writeReviewAndRegressionArtifacts(runtime, incident, reviewResult);
    const artifactResult = await runPostmortemAndSkillPhase(
      runtime,
      incident,
      diagnosisResult,
      challengerResult,
      fixResult,
      reviewResult
    );
    const artifactPaths = await writePostmortemAndSkillArtifacts(runtime, incident, artifactResult);

    console.log(
      JSON.stringify(
        {
          ...artifactResult,
          artifact_paths: {
            incident_intake: intakeArtifacts,
            skill_match: skillMatchArtifacts,
            repro: reproArtifacts,
            diagnosis: diagnosisArtifacts,
            challenger: challengerArtifacts,
            fix: fixArtifacts,
            review: reviewArtifacts,
            final: artifactPaths
          }
        },
        null,
        2
      )
    );
    return;
  }

  const runPlan = buildReplayXRunPlan(incidentPath ?? undefined);
  console.log(renderRunPlan(runPlan));
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(message);
    process.exit(1);
  });
}
