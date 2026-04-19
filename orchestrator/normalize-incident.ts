import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import {
  replayXIncidentClasses,
  replayXIncidentEnvironments,
  replayXIncidentSeverities,
  replayXLogLevels,
  type NormalizedIncident,
  type ReplayXCommandSpec,
  type ReplayXLogExcerpt,
  type ReplayXMetricSnapshot,
  type ReplayXRecentChange,
  type ReplayXStackFrame,
  type ReplayXStackTrace
} from "./types.js";

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const expectRecord = (value: unknown, context: string): JsonRecord => {
  if (!isRecord(value)) {
    throw new Error(`${context} must be an object.`);
  }

  return value;
};

const expectExactKeys = (value: JsonRecord, keys: string[], context: string): void => {
  const allowed = new Set(keys);
  const actual = Object.keys(value);
  const extras = actual.filter((key) => !allowed.has(key));
  const missing = keys.filter((key) => !(key in value));

  if (missing.length > 0) {
    throw new Error(`${context} is missing required keys: ${missing.join(", ")}.`);
  }

  if (extras.length > 0) {
    throw new Error(`${context} has unsupported keys: ${extras.join(", ")}.`);
  }
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

const expectBoolean = (value: unknown, context: string): boolean => {
  if (typeof value !== "boolean") {
    throw new Error(`${context} must be a boolean.`);
  }

  return value;
};

const expectIsoDateString = (value: unknown, context: string): string => {
  const parsed = expectString(value, context);

  if (Number.isNaN(Date.parse(parsed))) {
    throw new Error(`${context} must be a valid ISO-8601 date or datetime string.`);
  }

  return parsed;
};

const expectEnum = <T extends readonly string[]>(
  value: unknown,
  allowed: T,
  context: string
): T[number] => {
  const parsed = expectString(value, context);

  if (!allowed.includes(parsed)) {
    throw new Error(`${context} must be one of: ${allowed.join(", ")}.`);
  }

  return parsed as T[number];
};

const expectStringArray = (value: unknown, context: string): string[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array.`);
  }

  return value.map((entry, index) => expectString(entry, `${context}[${index}]`));
};

const expectContextRecord = (value: unknown, context: string): Record<string, boolean | number | string | null> => {
  const parsed = expectRecord(value, context);
  const normalized: Record<string, boolean | number | string | null> = {};

  for (const [key, entry] of Object.entries(parsed)) {
    if (
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean" ||
      entry === null
    ) {
      normalized[key] = entry;
      continue;
    }

    throw new Error(`${context}.${key} must be a string, number, boolean, or null.`);
  }

  return normalized;
};

const parseStackFrame = (value: unknown, context: string): ReplayXStackFrame => {
  const parsed = expectRecord(value, context);
  expectExactKeys(parsed, ["file", "line", "column", "function"], context);

  return {
    file: expectString(parsed.file, `${context}.file`),
    line: expectNumber(parsed.line, `${context}.line`),
    column: expectNumber(parsed.column, `${context}.column`),
    function: expectString(parsed.function, `${context}.function`)
  };
};

const parseStackTrace = (value: unknown, context: string): ReplayXStackTrace => {
  const parsed = expectRecord(value, context);
  expectExactKeys(parsed, ["source", "errorType", "message", "frames"], context);

  if (!Array.isArray(parsed.frames) || parsed.frames.length === 0) {
    throw new Error(`${context}.frames must be a non-empty array.`);
  }

  return {
    source: expectString(parsed.source, `${context}.source`),
    errorType: expectString(parsed.errorType, `${context}.errorType`),
    message: expectString(parsed.message, `${context}.message`),
    frames: parsed.frames.map((entry, index) => parseStackFrame(entry, `${context}.frames[${index}]`))
  };
};

const parseLogExcerpt = (value: unknown, context: string): ReplayXLogExcerpt => {
  const parsed = expectRecord(value, context);
  expectExactKeys(parsed, ["source", "observedAt", "level", "message", "context"], context);

  return {
    source: expectString(parsed.source, `${context}.source`),
    observedAt: expectIsoDateString(parsed.observedAt, `${context}.observedAt`),
    level: expectEnum(parsed.level, replayXLogLevels, `${context}.level`),
    message: expectString(parsed.message, `${context}.message`),
    context: expectContextRecord(parsed.context, `${context}.context`)
  };
};

const parseMetricSnapshot = (value: unknown, context: string): ReplayXMetricSnapshot => {
  const parsed = expectRecord(value, context);
  const allowedKeys = ["name", "unit", "value", "observedAt", "baselineValue"];
  expectExactKeys(parsed, Object.keys(parsed).includes("baselineValue") ? allowedKeys : allowedKeys.slice(0, 4), context);

  return {
    name: expectString(parsed.name, `${context}.name`),
    unit: expectString(parsed.unit, `${context}.unit`),
    value: expectNumber(parsed.value, `${context}.value`),
    observedAt: expectIsoDateString(parsed.observedAt, `${context}.observedAt`),
    ...(parsed.baselineValue === undefined
      ? {}
      : { baselineValue: expectNumber(parsed.baselineValue, `${context}.baselineValue`) })
  };
};

const parseCommandSpec = (value: unknown, context: string): ReplayXCommandSpec => {
  const parsed = expectRecord(value, context);
  expectExactKeys(parsed, ["label", "command", "workingDirectory", "expectedExitCode"], context);

  return {
    label: expectString(parsed.label, `${context}.label`),
    command: expectString(parsed.command, `${context}.command`),
    workingDirectory: expectString(parsed.workingDirectory, `${context}.workingDirectory`),
    expectedExitCode: expectNumber(parsed.expectedExitCode, `${context}.expectedExitCode`)
  };
};

const parseRecentChange = (value: unknown, context: string): ReplayXRecentChange => {
  const parsed = expectRecord(value, context);
  expectExactKeys(parsed, ["commit", "summary", "author", "mergedAt", "files"], context);

  return {
    commit: expectString(parsed.commit, `${context}.commit`),
    summary: expectString(parsed.summary, `${context}.summary`),
    author: expectString(parsed.author, `${context}.author`),
    mergedAt: expectIsoDateString(parsed.mergedAt, `${context}.mergedAt`),
    files: expectStringArray(parsed.files, `${context}.files`)
  };
};

export const parseNormalizedIncident = (input: unknown): NormalizedIncident => {
  const parsed = expectRecord(input, "NormalizedIncident");
  expectExactKeys(
    parsed,
    [
      "schemaVersion",
      "incidentId",
      "title",
      "incidentClass",
      "service",
      "environment",
      "severity",
      "repoRoot",
      "summary",
      "suspectedFiles",
      "evidence",
      "commands",
      "recentChanges",
      "constraints",
      "acceptanceCriteria"
    ],
    "NormalizedIncident"
  );

  if (parsed.schemaVersion !== 1) {
    throw new Error("NormalizedIncident.schemaVersion must equal 1.");
  }

  const summary = expectRecord(parsed.summary, "NormalizedIncident.summary");
  expectExactKeys(
    summary,
    ["symptom", "customerImpact", "firstObservedAt", "customerVisible"],
    "NormalizedIncident.summary"
  );

  const evidence = expectRecord(parsed.evidence, "NormalizedIncident.evidence");
  expectExactKeys(evidence, ["stackTraces", "logs", "metrics"], "NormalizedIncident.evidence");

  const commands = expectRecord(parsed.commands, "NormalizedIncident.commands");
  expectExactKeys(commands, ["failing", "healthy"], "NormalizedIncident.commands");

  if (!Array.isArray(evidence.stackTraces) || evidence.stackTraces.length === 0) {
    throw new Error("NormalizedIncident.evidence.stackTraces must be a non-empty array.");
  }

  if (!Array.isArray(evidence.logs) || evidence.logs.length === 0) {
    throw new Error("NormalizedIncident.evidence.logs must be a non-empty array.");
  }

  if (!Array.isArray(evidence.metrics) || evidence.metrics.length === 0) {
    throw new Error("NormalizedIncident.evidence.metrics must be a non-empty array.");
  }

  if (!Array.isArray(parsed.recentChanges) || parsed.recentChanges.length === 0) {
    throw new Error("NormalizedIncident.recentChanges must be a non-empty array.");
  }

  return {
    schemaVersion: 1,
    incidentId: expectString(parsed.incidentId, "NormalizedIncident.incidentId"),
    title: expectString(parsed.title, "NormalizedIncident.title"),
    incidentClass: expectEnum(
      parsed.incidentClass,
      replayXIncidentClasses,
      "NormalizedIncident.incidentClass"
    ),
    service: expectString(parsed.service, "NormalizedIncident.service"),
    environment: expectEnum(
      parsed.environment,
      replayXIncidentEnvironments,
      "NormalizedIncident.environment"
    ),
    severity: expectEnum(parsed.severity, replayXIncidentSeverities, "NormalizedIncident.severity"),
    repoRoot: expectString(parsed.repoRoot, "NormalizedIncident.repoRoot"),
    summary: {
      symptom: expectString(summary.symptom, "NormalizedIncident.summary.symptom"),
      customerImpact: expectString(summary.customerImpact, "NormalizedIncident.summary.customerImpact"),
      firstObservedAt: expectIsoDateString(
        summary.firstObservedAt,
        "NormalizedIncident.summary.firstObservedAt"
      ),
      customerVisible: expectBoolean(
        summary.customerVisible,
        "NormalizedIncident.summary.customerVisible"
      )
    },
    suspectedFiles: expectStringArray(parsed.suspectedFiles, "NormalizedIncident.suspectedFiles"),
    evidence: {
      stackTraces: evidence.stackTraces.map((entry, index) =>
        parseStackTrace(entry, `NormalizedIncident.evidence.stackTraces[${index}]`)
      ),
      logs: evidence.logs.map((entry, index) =>
        parseLogExcerpt(entry, `NormalizedIncident.evidence.logs[${index}]`)
      ),
      metrics: evidence.metrics.map((entry, index) =>
        parseMetricSnapshot(entry, `NormalizedIncident.evidence.metrics[${index}]`)
      )
    },
    commands: {
      failing: parseCommandSpec(commands.failing, "NormalizedIncident.commands.failing"),
      healthy: parseCommandSpec(commands.healthy, "NormalizedIncident.commands.healthy")
    },
    recentChanges: parsed.recentChanges.map((entry, index) =>
      parseRecentChange(entry, `NormalizedIncident.recentChanges[${index}]`)
    ),
    constraints: expectStringArray(parsed.constraints, "NormalizedIncident.constraints"),
    acceptanceCriteria: expectStringArray(
      parsed.acceptanceCriteria,
      "NormalizedIncident.acceptanceCriteria"
    )
  };
};

export const loadNormalizedIncident = async (filePath: string): Promise<NormalizedIncident> => {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;

  return parseNormalizedIncident(parsed);
};

export const loadSeededIncidents = async (fixturesDir: string): Promise<NormalizedIncident[]> => {
  const entries = await readdir(fixturesDir, { withFileTypes: true });
  const fixturePaths = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.join(fixturesDir, entry.name))
    .sort();

  return Promise.all(fixturePaths.map((fixturePath) => loadNormalizedIncident(fixturePath)));
};
