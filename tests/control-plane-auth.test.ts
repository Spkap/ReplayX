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
