import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  NormalizedIncident,
  ReplayXIncidentIntakePhaseOutput,
  ReplayXPhaseDefinition,
  ReplayXRuntimeConfig
} from "../types.js";

export const incidentIntakePhase: ReplayXPhaseDefinition = {
  id: "incident-intake",
  label: "Incident Intake",
  goal: "Normalize the incident bundle into the strict ReplayX input contract.",
  requiredVerificationCommand:
    "tsx orchestrator/main.ts --phase incident-intake incidents/<incident>.json",
  requiredOutputSchema: "phase.incident-intake.json",
  artifactOutputs: ["phase.incident-intake.json", "normalized_incident.json"],
  dependsOn: [],
  status: "ready",
  implementationNotes:
    "Persists the normalized incident artifact used by the replay-safe golden run."
};

export const runIncidentIntakePhase = (
  inputPath: string,
  normalizedPath: string,
  incident: NormalizedIncident
): ReplayXIncidentIntakePhaseOutput => ({
  schemaVersion: 1,
  phase: "incident-intake",
  incidentId: incident.incidentId,
  input_path: inputPath,
  normalized_path: normalizedPath,
  source_kind: "normalized_fixture",
  verification_status: "normalized"
});

export const writeIncidentIntakeArtifacts = async (
  runtime: ReplayXRuntimeConfig,
  incident: NormalizedIncident,
  result: ReplayXIncidentIntakePhaseOutput
): Promise<{
  artifactPath: string;
  normalizedPath: string;
}> => {
  const incidentArtifactDirectory = path.join(runtime.artifactsRoot, incident.incidentId);
  const artifactPath = path.join(incidentArtifactDirectory, "phase.incident-intake.json");
  const normalizedPath = path.join(incidentArtifactDirectory, "normalized_incident.json");

  await mkdir(incidentArtifactDirectory, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(normalizedPath, `${JSON.stringify(incident, null, 2)}\n`, "utf8");

  return { artifactPath, normalizedPath };
};
