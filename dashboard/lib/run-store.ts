import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

type RunLike = {
  runId: string;
  workspaceId: string;
  status: string;
  origin?: string;
  incidentId: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  pullRequest?: {
    status?: string;
  };
};

const DB_FILENAME = "replayx-control-plane.db";
const dbCache = new Map<string, DatabaseSync>();

const ensureSchema = (db: DatabaseSync): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      run_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      status TEXT NOT NULL,
      origin TEXT NOT NULL,
      incident_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      pull_request_status TEXT,
      payload TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS runs_status_idx ON runs(status);
    CREATE INDEX IF NOT EXISTS runs_workspace_idx ON runs(workspace_id);
    CREATE INDEX IF NOT EXISTS runs_created_idx ON runs(created_at DESC);

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
};

const importLegacyRuns = (db: DatabaseSync, directory: string): void => {
  if (!existsSync(directory)) {
    return;
  }

  for (const entry of readdirSync(directory)) {
    if (!entry.endsWith(".json")) {
      continue;
    }

    const absolutePath = path.join(directory, entry);

    try {
      const run = JSON.parse(readFileSync(absolutePath, "utf8")) as RunLike;
      upsertRun(db, run);
    } catch {
      // Ignore malformed legacy files during migration.
    }
  }
};

const migrateLegacyJsonOnce = (
  db: DatabaseSync,
  storeRoot: string,
  legacyRunStoreRoot: string | null
): void => {
  const metadata = db.prepare("SELECT value FROM metadata WHERE key = ?").get("legacy-json-imported") as
    | { value: string }
    | undefined;

  if (metadata?.value === "1") {
    return;
  }

  importLegacyRuns(db, storeRoot);

  if (legacyRunStoreRoot && legacyRunStoreRoot !== storeRoot) {
    importLegacyRuns(db, legacyRunStoreRoot);
  }

  db.prepare(
    "INSERT INTO metadata(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run("legacy-json-imported", "1");
};

export const resolveRunStoreDbPath = (storeRoot: string): string => path.join(storeRoot, DB_FILENAME);

export const getRunStore = (storeRoot: string, legacyRunStoreRoot: string | null = null): DatabaseSync => {
  const dbPath = resolveRunStoreDbPath(storeRoot);
  const cached = dbCache.get(dbPath);

  if (cached) {
    return cached;
  }

  mkdirSync(storeRoot, { recursive: true });
  const db = new DatabaseSync(dbPath);
  ensureSchema(db);
  migrateLegacyJsonOnce(db, storeRoot, legacyRunStoreRoot);
  dbCache.set(dbPath, db);
  return db;
};

export const upsertRun = (db: DatabaseSync, run: RunLike): void => {
  db.prepare(
    `
      INSERT INTO runs (
        run_id,
        workspace_id,
        status,
        origin,
        incident_id,
        created_at,
        updated_at,
        completed_at,
        pull_request_status,
        payload
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id) DO UPDATE SET
        workspace_id = excluded.workspace_id,
        status = excluded.status,
        origin = excluded.origin,
        incident_id = excluded.incident_id,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at,
        pull_request_status = excluded.pull_request_status,
        payload = excluded.payload
    `
  ).run(
    run.runId,
    run.workspaceId,
    run.status,
    run.origin ?? "live-run",
    run.incidentId,
    run.createdAt,
    run.updatedAt,
    run.completedAt,
    run.pullRequest?.status ?? null,
    JSON.stringify(run)
  );
};

export const getSerializedRun = (db: DatabaseSync, runId: string): string | null => {
  const row = db.prepare("SELECT payload FROM runs WHERE run_id = ?").get(runId) as { payload: string } | undefined;
  return row?.payload ?? null;
};

export const listSerializedRuns = (db: DatabaseSync): string[] => {
  const rows = db.prepare("SELECT payload FROM runs ORDER BY created_at DESC").all() as Array<{ payload: string }>;
  return rows.map((row) => row.payload);
};
