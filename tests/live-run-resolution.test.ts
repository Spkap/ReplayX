import assert from "node:assert/strict";
import test from "node:test";

import liveRunResolutionModule from "../dashboard/lib/live-run-resolution.js";

const { shouldCreateLivePullRequest } =
  liveRunResolutionModule as typeof import("../dashboard/lib/live-run-resolution.js");

test("PR creation defaults to preview mode outside explicit live configuration", () => {
  assert.equal(
    shouldCreateLivePullRequest({
      env: {},
      execArgv: []
    }),
    false
  );
});

test("PR creation enables live GitHub handoff only when explicitly configured", () => {
  assert.equal(
    shouldCreateLivePullRequest({
      env: { REPLAYX_GITHUB_PR_MODE: "live" },
      execArgv: []
    }),
    true
  );

  assert.equal(
    shouldCreateLivePullRequest({
      env: { REPLAYX_GITHUB_PR_MODE: "preview" },
      execArgv: []
    }),
    false
  );
});

test("Node test execution always disables live GitHub handoff", () => {
  assert.equal(
    shouldCreateLivePullRequest({
      env: { REPLAYX_GITHUB_PR_MODE: "live", NODE_TEST_CONTEXT: "child-v8" },
      execArgv: ["--test"]
    }),
    false
  );
});
