import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import liveRunsModule from "../dashboard/lib/live-runs.js";

const {
  archiveReplayXRun,
  cancelReplayXRun,
  createReplayXRun,
  getReplayXAnalytics,
  getReplayXRun,
  listReplayXRuns,
  retryReplayXRun,
  runReplayXLivePipeline
} = liveRunsModule as typeof import("../dashboard/lib/live-runs.js");

test("fresh Slack incidents run realtime investigation without seeded fixture routing", async () => {
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-live-run-"));
  const previousValidationCommand = process.env.REPLAYX_REALTIME_VALIDATION_COMMAND;
  process.env.REPLAYX_REALTIME_VALIDATION_COMMAND = "git status --short";

  try {
    const run = await createReplayXRun(
      {
        source: "slack",
        text: "checkout is overselling inventory when two users buy at the same time",
        channel: "CBUGS123",
        threadTs: "171234.100"
      },
      {
        repoRoot: process.cwd(),
        runStoreRoot: path.join(tempRepo, ".replayx-runs"),
        artifactsRoot: path.join(tempRepo, "artifacts"),
        phaseDelayMs: 0
      }
    );

    assert.equal(run.source, "slack");
    assert.equal(run.origin, "live-run");
    assert.equal(run.executionMode, "realtime");
    assert.equal(run.status, "queued");
    assert.equal(run.workspaceId, "workspace-default");
    assert.equal(run.issue.text.includes("overselling"), true);
    assert.notEqual(run.incidentId, "incident-checkout-race-001");
    assert.equal(run.capability.status, "analysis_only");
    assert.equal(run.phases[0].id, "incident-intake");

    await runReplayXLivePipeline(run.runId, {
      repoRoot: process.cwd(),
      runStoreRoot: path.join(tempRepo, ".replayx-runs"),
      artifactsRoot: path.join(tempRepo, "artifacts"),
      phaseDelayMs: 0
    });

    const completed = await getReplayXRun(run.runId, {
      repoRoot: process.cwd(),
      runStoreRoot: path.join(tempRepo, ".replayx-runs"),
      artifactsRoot: path.join(tempRepo, "artifacts"),
      phaseDelayMs: 0
    });

    assert.equal(completed.status, "blocked");
    assert.equal(completed.currentPhaseId, "review-and-regression");
    assert.equal(completed.phases[0]?.status, "completed");
    assert.equal(completed.phases[5]?.status, "completed");
    assert.equal(completed.phases[6]?.status, "blocked");
    assert.match(completed.cards.winningDiagnosis.diagnosis, /candidate|source|repo/i);
    assert.match(completed.cards.fix.summary, /Investigate|Collect/i);
    assert.match(completed.cards.proof.regression_summary, /Realtime validation baseline/i);
    assert.equal(completed.pullRequest.status, "unavailable");
    assert.match(completed.pullRequest.previewPath ?? "", /realtime-investigation\.md$/);
    assert.ok(completed.events.some((event) => event.kind === "run.realtime_investigation_complete"));
    assert.ok(completed.evidence.some((item) => item.label === "Realtime validation baseline"));
    assert.ok(completed.evidence.some((item) => item.artifactId === "preview" && item.status === "passed"));
    assert.ok(completed.decisions.some((decision) => /Stop before claiming a fix/i.test(decision.decision)));
  } finally {
    if (previousValidationCommand === undefined) {
      delete process.env.REPLAYX_REALTIME_VALIDATION_COMMAND;
    } else {
      process.env.REPLAYX_REALTIME_VALIDATION_COMMAND = previousValidationCommand;
    }
    await rm(tempRepo, { recursive: true, force: true });
  }
});

test("live run defaults resolve the repo root when launched from the dashboard directory", async () => {
  const repoRoot = process.cwd();
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-dashboard-cwd-"));
  const previousCwd = process.cwd();

  try {
    process.chdir(path.join(repoRoot, "dashboard"));

    const moduleUrl = `${pathToFileURL(path.join(repoRoot, "dashboard/lib/live-runs.ts")).href}?dashboard-cwd=${Date.now()}`;
    const liveRuns = await import(moduleUrl) as typeof import("../dashboard/lib/live-runs.js");
    const run = await liveRuns.createReplayXRun(
      {
        source: "slack",
        text: "checkout race condition from Slack",
        incidentId: "incident-checkout-race-001",
        channel: "CBUGS123"
      },
      {
        runStoreRoot: path.join(tempRepo, ".replayx-runs"),
        artifactsRoot: path.join(tempRepo, "artifacts"),
        phaseDelayMs: 0
      }
    );

    assert.equal(run.incidentId, "incident-checkout-race-001");
    assert.equal(run.incidentPath, path.join(repoRoot, "incidents", "checkout-race-condition.json"));
    assert.equal(run.origin, "live-run");
  } finally {
    process.chdir(previousCwd);
    await rm(tempRepo, { recursive: true, force: true });
  }
});

test("analytics snapshot summarizes run health and validation outcomes", async () => {
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-analytics-"));

  try {
    const run = await createReplayXRun(
      {
        source: "manual",
        text: "checkout is overselling inventory when two users buy at the same time",
        incidentId: "incident-checkout-race-001"
      },
      {
        repoRoot: process.cwd(),
        runStoreRoot: path.join(tempRepo, ".replayx-runs"),
        artifactsRoot: path.join(tempRepo, "artifacts"),
        phaseDelayMs: 0
      }
    );

    await runReplayXLivePipeline(run.runId, {
      repoRoot: process.cwd(),
      runStoreRoot: path.join(tempRepo, ".replayx-runs"),
      artifactsRoot: path.join(tempRepo, "artifacts"),
      phaseDelayMs: 0
    });

    const analytics = await getReplayXAnalytics({
      repoRoot: process.cwd(),
      runStoreRoot: path.join(tempRepo, ".replayx-runs"),
      artifactsRoot: path.join(tempRepo, "artifacts"),
      phaseDelayMs: 0
    });

    assert.equal(analytics.totalRuns, 1);
    assert.equal(analytics.activeRuns, 0);
    assert.equal(analytics.validationSuccessRate, 1);
    assert.equal(analytics.prAcceptanceRate, 1);
    assert.equal(analytics.reproSuccessRate, 1);
    assert.equal(analytics.operatorInterventionRate, 0);
    assert.equal(analytics.evidenceBackedRunRate, 1);
    assert.ok(analytics.evidenceRecords >= 7);
    assert.ok(analytics.decisionRecords >= 4);
    assert.equal(analytics.topRecurringIncidentFingerprints[0]?.incidentId, "incident-checkout-race-001");
  } finally {
    await rm(tempRepo, { recursive: true, force: true });
  }
});

test("production-targeted runs pause for approval before execution starts", async () => {
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-approval-"));

  try {
    const run = await createReplayXRun(
      {
        source: "manual",
        text: "checkout is overselling inventory when two users buy at the same time",
        incidentId: "incident-checkout-race-001",
        environmentTarget: "production"
      },
      {
        repoRoot: process.cwd(),
        runStoreRoot: path.join(tempRepo, ".replayx-runs"),
        artifactsRoot: path.join(tempRepo, "artifacts"),
        phaseDelayMs: 0
      }
    );

    assert.equal(run.status, "awaiting_approval");
    assert.equal(run.approvals.length, 1);
    assert.equal(run.approvals[0]?.kind, "production_access");
    assert.match(run.currentBlocker ?? "", /Production-targeted runs require operator approval/i);
    assert.ok(run.evidence.some((item) => item.kind === "policy" && item.status === "blocked"));
  } finally {
    await rm(tempRepo, { recursive: true, force: true });
  }
});

test("live pipeline does not bypass pending production approvals", async () => {
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-approval-gate-"));
  const options = {
    repoRoot: process.cwd(),
    runStoreRoot: path.join(tempRepo, ".replayx-runs"),
    artifactsRoot: path.join(tempRepo, "artifacts"),
    phaseDelayMs: 0
  };

  try {
    const run = await createReplayXRun(
      {
        source: "manual",
        text: "checkout is overselling inventory when two users buy at the same time",
        incidentId: "incident-checkout-race-001",
        environmentTarget: "production"
      },
      options
    );

    const blocked = await runReplayXLivePipeline(run.runId, options);

    assert.equal(blocked.status, "awaiting_approval");
    assert.equal(blocked.approvals.some((approval) => approval.status === "pending"), true);
    assert.equal(blocked.phases.every((phase) => phase.status === "queued"), true);
    assert.equal(blocked.pullRequest.status, "pending");
  } finally {
    await rm(tempRepo, { recursive: true, force: true });
  }
});

test("fresh free-form incidents create realtime analysis runs instead of being rejected or fixture-routed", async () => {
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-unsupported-"));

  try {
    const run = await createReplayXRun(
      {
        source: "manual",
        text: "database deadlock in billing ledger after replica failover"
      },
      {
        repoRoot: process.cwd(),
        runStoreRoot: path.join(tempRepo, ".replayx-runs"),
        artifactsRoot: path.join(tempRepo, "artifacts"),
        phaseDelayMs: 0
      }
    );

    assert.equal(run.status, "queued");
    assert.equal(run.executionMode, "realtime");
    assert.equal(run.capability.status, "analysis_only");
    assert.equal(run.policy.analysisOnly, true);
    assert.equal(run.policy.patchAndValidate, false);
    assert.equal(run.currentBlocker, null);
    assert.match(run.incidentId, /^incident-database-deadlock/);
    assert.match(run.events[0]?.summary ?? "", /accepted the incident/i);
    assert.ok(run.evidence.some((item) => item.kind === "intake" && item.status === "info"));
    assert.ok(run.decisions.some((decision) => decision.status === "accepted"));
  } finally {
    await rm(tempRepo, { recursive: true, force: true });
  }
});

test("realtime analysis runs produce evidence packets and stop before claiming a seeded fix", async () => {
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-capability-limited-"));
  const previousValidationCommand = process.env.REPLAYX_REALTIME_VALIDATION_COMMAND;
  process.env.REPLAYX_REALTIME_VALIDATION_COMMAND = "git status --short";
  const options = {
    repoRoot: process.cwd(),
    runStoreRoot: path.join(tempRepo, ".replayx-runs"),
    artifactsRoot: path.join(tempRepo, "artifacts"),
    phaseDelayMs: 0
  };

  try {
    const run = await createReplayXRun(
      {
        source: "manual",
        text: "database deadlock in billing ledger after replica failover"
      },
      options
    );

    const completed = await runReplayXLivePipeline(run.runId, options);

    assert.equal(completed.executionMode, "realtime");
    assert.equal(completed.capability.status, "analysis_only");
    assert.equal(completed.status, "blocked");
    assert.equal(completed.pullRequest.status, "unavailable");
    assert.match(completed.currentBlocker ?? "", /Bounded Codex patch worker/i);
    assert.equal(completed.phases[0]?.status, "completed");
    assert.equal(completed.phases[1]?.status, "completed");
    assert.equal(completed.phases[5]?.status, "completed");
    assert.equal(completed.phases[6]?.status, "blocked");
    assert.ok(completed.evidence.some((item) => item.label === "Realtime investigation packet"));
    assert.ok(completed.decisions.some((decision) => /Stop before claiming a fix/i.test(decision.decision)));
  } finally {
    if (previousValidationCommand === undefined) {
      delete process.env.REPLAYX_REALTIME_VALIDATION_COMMAND;
    } else {
      process.env.REPLAYX_REALTIME_VALIDATION_COMMAND = previousValidationCommand;
    }
    await rm(tempRepo, { recursive: true, force: true });
  }
});

test("cancelled runs remain cancelled when the live pipeline is invoked again", async () => {
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-cancelled-"));

  try {
    const run = await createReplayXRun(
      {
        source: "manual",
        text: "checkout is overselling inventory when two users buy at the same time",
        incidentId: "incident-checkout-race-001"
      },
      {
        repoRoot: process.cwd(),
        runStoreRoot: path.join(tempRepo, ".replayx-runs"),
        artifactsRoot: path.join(tempRepo, "artifacts"),
        phaseDelayMs: 0
      }
    );

    const cancelled = await cancelReplayXRun(run.runId, {
      repoRoot: process.cwd(),
      runStoreRoot: path.join(tempRepo, ".replayx-runs"),
      artifactsRoot: path.join(tempRepo, "artifacts"),
      phaseDelayMs: 0
    });
    assert.equal(cancelled.status, "cancelled");

    const rerun = await runReplayXLivePipeline(run.runId, {
      repoRoot: process.cwd(),
      runStoreRoot: path.join(tempRepo, ".replayx-runs"),
      artifactsRoot: path.join(tempRepo, "artifacts"),
      phaseDelayMs: 0
    });

    assert.equal(rerun.status, "cancelled");
    assert.equal(rerun.currentBlocker, "Run cancelled by operator.");
  } finally {
    await rm(tempRepo, { recursive: true, force: true });
  }
});

test("archived terminal runs stay readable, disappear from the live fleet, and remain in historical analytics", async () => {
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-archived-"));
  const options = {
    repoRoot: process.cwd(),
    runStoreRoot: path.join(tempRepo, ".replayx-runs"),
    artifactsRoot: path.join(tempRepo, "artifacts"),
    phaseDelayMs: 0
  };

  try {
    const run = await createReplayXRun(
      {
        source: "manual",
        text: "checkout is overselling inventory when two users buy at the same time",
        incidentId: "incident-checkout-race-001"
      },
      options
    );

    await runReplayXLivePipeline(run.runId, options);
    const archivedRun = await archiveReplayXRun(run.runId, options);

    assert.ok(archivedRun.archivedAt);
    assert.equal(archivedRun.archivedBy, "operator");

    const visibleRuns = await listReplayXRuns(options);
    const allRuns = await listReplayXRuns({ ...options, includeArchived: true });
    const analytics = await getReplayXAnalytics(options);
    const storedRun = await getReplayXRun(run.runId, options);

    assert.equal(visibleRuns.length, 0);
    assert.equal(allRuns.length, 1);
    assert.equal(analytics.totalRuns, 1);
    assert.equal(analytics.visibleRuns, 0);
    assert.equal(analytics.archivedRuns, 1);
    assert.ok(storedRun.archivedAt);
  } finally {
    await rm(tempRepo, { recursive: true, force: true });
  }
});

test("archived runs are read-only and cannot be retried", async () => {
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-archived-read-only-"));
  const options = {
    repoRoot: process.cwd(),
    runStoreRoot: path.join(tempRepo, ".replayx-runs"),
    artifactsRoot: path.join(tempRepo, "artifacts"),
    phaseDelayMs: 0
  };

  try {
    const run = await createReplayXRun(
      {
        source: "manual",
        text: "checkout is overselling inventory when two users buy at the same time",
        incidentId: "incident-checkout-race-001"
      },
      options
    );

    await runReplayXLivePipeline(run.runId, options);
    await archiveReplayXRun(run.runId, options);

    await assert.rejects(retryReplayXRun(run.runId, options), /cannot retry an archived run/i);
  } finally {
    await rm(tempRepo, { recursive: true, force: true });
  }
});

test("retry preserves the original full-capability incident selection", async () => {
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-retry-incident-"));
  const options = {
    repoRoot: process.cwd(),
    runStoreRoot: path.join(tempRepo, ".replayx-runs"),
    artifactsRoot: path.join(tempRepo, "artifacts"),
    phaseDelayMs: 0
  };

  try {
    const run = await createReplayXRun(
      {
        source: "manual",
        text: "session expires for idle users after refresh",
        incidentId: "incident-auth-session-002"
      },
      options
    );

    await runReplayXLivePipeline(run.runId, options);
    const retried = await retryReplayXRun(run.runId, options);

    assert.equal(retried.previousRunId, run.runId);
    assert.equal(retried.incidentId, "incident-auth-session-002");
    assert.equal(retried.capability.status, "full");
    assert.match(retried.incidentPath, /auth-token-session-failure\.json$/);
  } finally {
    await rm(tempRepo, { recursive: true, force: true });
  }
});

test("ReplayX rejects archive requests for non-terminal runs", async () => {
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-archive-reject-"));
  const options = {
    repoRoot: process.cwd(),
    runStoreRoot: path.join(tempRepo, ".replayx-runs"),
    artifactsRoot: path.join(tempRepo, "artifacts"),
    phaseDelayMs: 0
  };

  try {
    const run = await createReplayXRun(
      {
        source: "manual",
        text: "checkout is overselling inventory when two users buy at the same time",
        incidentId: "incident-checkout-race-001"
      },
      options
    );

    await assert.rejects(archiveReplayXRun(run.runId, options), /archive only terminal runs/i);
  } finally {
    await rm(tempRepo, { recursive: true, force: true });
  }
});
