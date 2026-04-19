import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import liveRunsModule from "../dashboard/lib/live-runs.js";

const { cancelReplayXRun, createReplayXRun, getReplayXAnalytics, getReplayXRun, runReplayXLivePipeline } =
  liveRunsModule as typeof import("../dashboard/lib/live-runs.js");

test("live run store creates a Slack-sourced run and completes the ReplayX phase flow", async () => {
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-live-run-"));

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
    assert.equal(run.status, "queued");
    assert.equal(run.workspaceId, "workspace-default");
    assert.equal(run.issue.text.includes("overselling"), true);
    assert.equal(run.incidentId, "incident-checkout-race-001");
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

    assert.equal(completed.status, "resolved_to_pr");
    assert.equal(completed.currentPhaseId, "postmortem-and-skill");
    assert.equal(completed.phases.every((phase) => phase.status === "completed"), true);
    assert.match(completed.cards.winningDiagnosis.diagnosis, /inventory|checkout|race/i);
    assert.match(completed.cards.fix.summary, /stock|reservation|checkout/i);
    assert.match(completed.cards.skill.summary, /fast-path|checkout-race-condition/i);
    assert.equal(completed.pullRequest.status, "ready");
    assert.match(completed.pullRequest.previewPath ?? "", /pr-preview\.md$/);
    assert.ok(completed.events.length >= 8);
  } finally {
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
        text: "checkout is overselling inventory when two users buy at the same time"
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
  } finally {
    await rm(tempRepo, { recursive: true, force: true });
  }
});

test("unsupported free-form incidents are rejected instead of silently mapped to a seeded checkout incident", async () => {
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-unsupported-"));

  try {
    await assert.rejects(
      createReplayXRun(
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
      ),
      /supports only the seeded/i
    );
  } finally {
    await rm(tempRepo, { recursive: true, force: true });
  }
});

test("cancelled runs remain cancelled when the live pipeline is invoked again", async () => {
  const tempRepo = await mkdtemp(path.join(os.tmpdir(), "replayx-cancelled-"));

  try {
    const run = await createReplayXRun(
      {
        source: "manual",
        text: "checkout is overselling inventory when two users buy at the same time"
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
