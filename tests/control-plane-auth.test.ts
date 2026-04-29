import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

test("run-scoped signed links do not escalate into root operator access", async () => {
  const previousToken = process.env.REPLAYX_INTERNAL_API_TOKEN;
  process.env.REPLAYX_INTERNAL_API_TOKEN = "test-shared-secret";

  try {
    const moduleUrl = `${pathToFileURL(
      path.join(process.cwd(), "dashboard/lib/control-plane-auth.ts")
    ).href}?control-plane-auth=${Date.now()}`;
    const controlPlaneAuth = await import(moduleUrl) as typeof import("../dashboard/lib/control-plane-auth.js");

    const runToken = controlPlaneAuth.buildControlPlaneAccessToken({
      scope: "run",
      runId: "run_test",
      workspaceId: "workspace-default"
    });

    assert.ok(runToken);
    assert.equal(controlPlaneAuth.hasRootControlPlaneAccess(runToken), false);
    assert.equal(
      controlPlaneAuth.isControlPlaneAccessTokenValid(runToken, {
        scope: "run",
        runId: "run_test",
        workspaceId: "workspace-default"
      }),
      true
    );
    assert.equal(
      controlPlaneAuth.isControlPlaneAccessTokenValid(runToken, { scope: "control-plane" }),
      false
    );
  } finally {
    if (previousToken === undefined) {
      delete process.env.REPLAYX_INTERNAL_API_TOKEN;
    } else {
      process.env.REPLAYX_INTERNAL_API_TOKEN = previousToken;
    }
  }
});

test("control-plane auth fails closed in production when no shared token is configured", async () => {
  const previousToken = process.env.REPLAYX_INTERNAL_API_TOKEN;
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.REPLAYX_INTERNAL_API_TOKEN;
  process.env.NODE_ENV = "production";

  try {
    const moduleUrl = `${pathToFileURL(
      path.join(process.cwd(), "dashboard/lib/control-plane-auth.ts")
    ).href}?control-plane-auth-production=${Date.now()}`;
    const controlPlaneAuth = await import(moduleUrl) as typeof import("../dashboard/lib/control-plane-auth.js");

    assert.equal(controlPlaneAuth.controlPlaneAuthRequired(), true);
    assert.equal(
      controlPlaneAuth.isAuthorizedRequest(
        new Request("http://replayx.test/api/replayx/runs"),
        { scope: "workspace", workspaceId: "workspace-default" }
      ),
      false
    );
    assert.equal(
      controlPlaneAuth.isControlPlaneAccessTokenValid(null, { scope: "control-plane" }),
      false
    );
  } finally {
    if (previousToken === undefined) {
      delete process.env.REPLAYX_INTERNAL_API_TOKEN;
    } else {
      process.env.REPLAYX_INTERNAL_API_TOKEN = previousToken;
    }

    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test("authorized paths preserve existing query parameters", async () => {
  const previousToken = process.env.REPLAYX_INTERNAL_API_TOKEN;
  process.env.REPLAYX_INTERNAL_API_TOKEN = "test-shared-secret";

  try {
    const moduleUrl = `${pathToFileURL(
      path.join(process.cwd(), "dashboard/lib/control-plane-auth.ts")
    ).href}?control-plane-auth-paths=${Date.now()}`;
    const controlPlaneAuth = await import(moduleUrl) as typeof import("../dashboard/lib/control-plane-auth.js");
    const token = controlPlaneAuth.buildControlPlaneAccessToken({ scope: "control-plane" });

    assert.ok(token);
    assert.equal(
      controlPlaneAuth.buildAuthorizedPath("/live/run_test?tab=resolution", token),
      `/live/run_test?tab=resolution&access=${encodeURIComponent(token)}`
    );
  } finally {
    if (previousToken === undefined) {
      delete process.env.REPLAYX_INTERNAL_API_TOKEN;
    } else {
      process.env.REPLAYX_INTERNAL_API_TOKEN = previousToken;
    }
  }
});
