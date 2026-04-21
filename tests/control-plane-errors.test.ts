import assert from "node:assert/strict";
import test from "node:test";

import controlPlaneErrorsModule from "../dashboard/lib/control-plane-errors.js";

const {
  archivedRunReadOnlyControlPlaneError,
  invalidRunRequestControlPlaneError,
  runNotFoundControlPlaneError,
  unauthorizedControlPlaneError
} = controlPlaneErrorsModule as typeof import("../dashboard/lib/control-plane-errors.js");

test("signed-link errors include cause, fix, and troubleshooting docs", () => {
  const payload = unauthorizedControlPlaneError("ReplayX analytics");

  assert.match(payload.error, /signed operator link/i);
  assert.match(payload.cause, /REPLAYX_INTERNAL_API_TOKEN/i);
  assert.match(payload.fix, /same REPLAYX_INTERNAL_API_TOKEN|Re-open this surface/i);
  assert.equal(payload.docsPath, "/help/troubleshooting#signed-links");
});

test("run-not-found and archived errors point to concrete remediation", () => {
  const missingRun = runNotFoundControlPlaneError("run_test");
  const archived = archivedRunReadOnlyControlPlaneError();
  const invalidRequest = invalidRunRequestControlPlaneError();

  assert.match(missingRun.error, /run_test/);
  assert.equal(missingRun.docsPath, "/help/troubleshooting#run-not-found");

  assert.match(archived.error, /read-only incident records/i);
  assert.equal(archived.docsPath, "/help/troubleshooting#archived-runs");

  assert.match(invalidRequest.fix, /text/i);
  assert.equal(invalidRequest.docsPath, "/help/troubleshooting#invalid-run-request");
});
