import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
  NormalizedIncident,
  ReplayXPhaseDefinition,
  ReplayXRuntimeConfig,
  ReplayXSkillMatchPhaseOutput
} from "../types.js";

type ReplayXSkillCatalogEntry = {
  id: string | null;
  service: string | null;
  incidentClass: string | null;
  path: string;
};

export const skillMatchPhase: ReplayXPhaseDefinition = {
  id: "skill-match",
  label: "Fast-Path Skill Match",
  goal: "Check whether an existing ReplayX skill can handle the incident without a full arena run.",
  requiredVerificationCommand:
    "tsx orchestrator/main.ts --phase skill-match incidents/<incident>.json",
  requiredOutputSchema: "phase.skill-match.json",
  artifactOutputs: ["phase.skill-match.json"],
  dependsOn: ["incident-intake"],
  status: "ready",
  implementationNotes:
    "Scans reusable skills from skills/ and previously emitted artifact skills, then records whether a fast path is available."
};

const parseSkillField = (content: string, field: string): string | null => {
  const match = content.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : null;
};

const parseSkillMatchField = (content: string, field: string): string | null => {
  const match = content.match(new RegExp(`^\\s+${field}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : null;
};

const loadSkillCatalogEntries = async (runtime: ReplayXRuntimeConfig): Promise<ReplayXSkillCatalogEntry[]> => {
  const skillDirectories = [
    path.join(runtime.repoRoot, "skills"),
    path.join(runtime.repoRoot, "artifacts")
  ];
  const entries: ReplayXSkillCatalogEntry[] = [];

  for (const directory of skillDirectories) {
    let dirEntries;

    try {
      dirEntries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of dirEntries) {
      if (directory.endsWith("skills")) {
        if (!entry.isFile() || !entry.name.endsWith(".yaml")) {
          continue;
        }

        const filePath = path.join(directory, entry.name);
        const content = await readFile(filePath, "utf8");

        entries.push({
          id: parseSkillField(content, "id"),
          service: parseSkillMatchField(content, "service"),
          incidentClass: parseSkillMatchField(content, "incident_class"),
          path: filePath
        });
        continue;
      }

      if (!entry.isDirectory()) {
        continue;
      }

      const filePath = path.join(directory, entry.name, "skill.yaml");

      try {
        const content = await readFile(filePath, "utf8");

        entries.push({
          id: parseSkillField(content, "id"),
          service: parseSkillMatchField(content, "service"),
          incidentClass: parseSkillMatchField(content, "incident_class"),
          path: filePath
        });
      } catch {
        continue;
      }
    }
  }

  return entries;
};

const scoreSkillMatch = (incident: NormalizedIncident, skill: ReplayXSkillCatalogEntry): number => {
  const incidentClassMatch = skill.incidentClass === incident.incidentClass ? 0.65 : 0;
  const serviceMatch = skill.service === incident.service ? 0.25 : 0;
  const idMatch = skill.id === incident.incidentId ? 0.1 : 0;

  return Number((incidentClassMatch + serviceMatch + idMatch).toFixed(4));
};

export const runSkillMatchPhase = async (
  runtime: ReplayXRuntimeConfig,
  incident: NormalizedIncident
): Promise<ReplayXSkillMatchPhaseOutput> => {
  const skills = await loadSkillCatalogEntries(runtime);
  const ranked = skills
    .map((skill) => ({
      skill,
      score: scoreSkillMatch(incident, skill)
    }))
    .sort((left, right) => right.score - left.score);
  const winner = ranked[0];
  const matched = Boolean(winner && winner.score >= 0.85);

  return {
    schemaVersion: 1,
    phase: "skill-match",
    incidentId: incident.incidentId,
    matched,
    match_confidence: winner?.score ?? 0,
    matched_skill_path: matched ? winner?.skill.path ?? null : null,
    matched_skill_id: matched ? winner?.skill.id ?? null : null,
    decision: matched ? "fast_path_available" : "continue_to_repro",
    rationale: matched
      ? `A reusable skill matches ${incident.service}/${incident.incidentClass} strongly enough to short-circuit the arena.`
      : "No reusable skill clears the fast-path threshold, so ReplayX should continue into repro and diagnosis."
  };
};

export const writeSkillMatchArtifacts = async (
  runtime: ReplayXRuntimeConfig,
  incident: NormalizedIncident,
  result: ReplayXSkillMatchPhaseOutput
): Promise<{
  artifactPath: string;
}> => {
  const incidentArtifactDirectory = path.join(runtime.artifactsRoot, incident.incidentId);
  const artifactPath = path.join(incidentArtifactDirectory, "phase.skill-match.json");

  await mkdir(incidentArtifactDirectory, { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  return { artifactPath };
};
