import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { spawn } from "node:child_process";

import type { NormalizedIncident } from "../../orchestrator/types.js";

export type SandboxCommandResult = {
  command: string;
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type PatchValidationResult = {
  status: "validated" | "blocked";
  summary: string;
  changedFiles: string[];
  validationResults: {
    failing: SandboxCommandResult;
    healthy: SandboxCommandResult;
  };
  branchName: string | null;
  prTitle: string | null;
  prBody: string | null;
  prPreviewPath: string | null;
  diffPath: string | null;
  prUrl: string | null;
  rollbackNote: string;
  blocker: string | null;
  evidenceRefs: string[];
};

const TEMP_DIR_PREFIX = "replayx-sandbox-";

const execShell = async (command: string, cwd: string): Promise<SandboxCommandResult> =>
  new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn("/bin/zsh", ["-lc", command], {
      cwd,
      env: {
        ...process.env,
        FORCE_COLOR: "0"
      }
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (exitCode) => {
      resolve({
        command,
        cwd,
        exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt
      });
    });
  });

const writeFileReplacing = async (
  filePath: string,
  replacement: (source: string) => string
): Promise<void> => {
  const source = await fs.readFile(filePath, "utf8");
  const next = replacement(source);

  if (source === next) {
    throw new Error(`Patch template did not change ${filePath}`);
  }

  await fs.writeFile(filePath, next, "utf8");
};

const applyCheckoutRacePatch = async (sandboxRoot: string): Promise<{ changedFiles: string[]; rollbackNote: string }> => {
  const reserveStockPath = path.join(sandboxRoot, "demo_app/src/inventory/reserve-stock.ts");
  await writeFileReplacing(reserveStockPath, (source) =>
    source
      .replace(
        `  const record = getInventoryRecord(sku);
  record.available -= quantity;
  record.snapshotVersion += 1;
`,
        `  const record = getInventoryRecord(sku);

  if (record.available < quantity) {
    throw new Error(\`OutOfStock: \${sku}\`);
  }

  record.available -= quantity;
  record.snapshotVersion += 1;
`
      )
      .replace(
        `    reservationToken: \`res_\${requestId}_\${snapshot.snapshotVersion}\`,
    snapshotVersion: snapshot.snapshotVersion,
`,
        `    reservationToken: \`res_\${requestId}_\${record.snapshotVersion}\`,
    snapshotVersion: record.snapshotVersion,
`
      )
  );

  const checkoutPath = path.join(sandboxRoot, "demo_app/src/checkout/submit-order.ts");
  await writeFileReplacing(checkoutPath, (source) =>
    source.replace(
      `  return Promise.all(requests.map((request) => processCheckoutWorker(request)));
`,
      `  const settled = await Promise.allSettled(requests.map((request) => processCheckoutWorker(request)));

  const hardFailure = settled.find(
    (result) =>
      result.status === "rejected" &&
      !(result.reason instanceof Error && result.reason.message.startsWith("OutOfStock:"))
  );

  if (hardFailure && hardFailure.status === "rejected") {
    throw hardFailure.reason;
  }

  return settled.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
`
    )
  );

  return {
    changedFiles: [
      "demo_app/src/inventory/reserve-stock.ts",
      "demo_app/src/checkout/submit-order.ts"
    ],
    rollbackNote: "Revert the live inventory guard and concurrent checkout settlement handling."
  };
};

const applyAuthRefreshPatch = async (sandboxRoot: string): Promise<{ changedFiles: string[]; rollbackNote: string }> => {
  const filePath = path.join(sandboxRoot, "demo_app/src/auth/refresh-session.ts");
  await writeFileReplacing(filePath, (source) =>
    source.replace(
      `    // Intentional bug: stale idle sessions reuse the expired token instead of rotating one.
    return session.accessToken;
`,
      `    return rotateAccessToken(session, now);
`
    )
  );

  return {
    changedFiles: ["demo_app/src/auth/refresh-session.ts"],
    rollbackNote: "Revert idle-session token rotation inside refresh-session."
  };
};

const applyNullShapePatch = async (sandboxRoot: string): Promise<{ changedFiles: string[]; rollbackNote: string }> => {
  const filePath = path.join(sandboxRoot, "demo_app/src/orders/build-summary.ts");
  await writeFileReplacing(filePath, (source) =>
    source.replace(
      `  const taxes = quote.taxes!.reduce((total, line) => total + line.amount, 0);
`,
      `  const taxes = (quote.taxes ?? []).reduce((total, line) => total + line.amount, 0);
`
    )
  );

  return {
    changedFiles: ["demo_app/src/orders/build-summary.ts"],
    rollbackNote: "Revert null-safe tax normalization inside build-summary."
  };
};

const applySeededPatch = async (
  incident: NormalizedIncident,
  sandboxRoot: string
): Promise<{ changedFiles: string[]; rollbackNote: string }> => {
  switch (incident.incidentClass) {
    case "checkout-race-condition":
      return applyCheckoutRacePatch(sandboxRoot);
    case "auth-token-session-failure":
      return applyAuthRefreshPatch(sandboxRoot);
    case "null-data-shape-failure":
      return applyNullShapePatch(sandboxRoot);
    default:
      throw new Error(`ReplayX does not have a seeded patch template for ${incident.incidentClass}`);
  }
};

const isIgnoredPath = (source: string): boolean => {
  const basename = path.basename(source);
  return (
    basename === ".git" ||
    basename === "node_modules" ||
    basename === ".next" ||
    basename === ".replayx-runs" ||
    basename === "artifacts"
  );
};

const cloneWorkspaceForSandbox = async (repoRoot: string): Promise<{ sandboxRoot: string; cleanupRoot: string }> => {
  const cleanupRoot = await fs.mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
  const sandboxRoot = path.join(cleanupRoot, "workspace");
  const remoteUrlResult = await execShell("git remote get-url origin", repoRoot);
  const cloneResult = await execShell(
    `git clone --quiet ${JSON.stringify(repoRoot)} ${JSON.stringify(sandboxRoot)}`,
    cleanupRoot
  );

  if (cloneResult.exitCode !== 0) {
    throw new Error(`Unable to clone sandbox workspace: ${cloneResult.stderr || cloneResult.stdout}`);
  }

  if (remoteUrlResult.exitCode === 0 && remoteUrlResult.stdout.trim()) {
    await execShell(`git remote set-url origin ${JSON.stringify(remoteUrlResult.stdout.trim())}`, sandboxRoot);
  }

  const sharedNodeModules = path.join(repoRoot, "node_modules");

  try {
    await fs.access(sharedNodeModules);
    await fs.symlink(sharedNodeModules, path.join(sandboxRoot, "node_modules"), "dir");
  } catch {
    // Best-effort: commands may still work if the environment has global tooling.
  }

  return { sandboxRoot, cleanupRoot };
};

export const shouldCreateLivePullRequest = ({
  env = process.env,
  execArgv = process.execArgv
}: {
  env?: NodeJS.ProcessEnv;
  execArgv?: string[];
} = {}): boolean => {
  const runningUnderNodeTest =
    env.NODE_ENV === "test" ||
    env.NODE_TEST_CONTEXT !== undefined ||
    execArgv.some((argument) => argument === "--test" || argument.startsWith("--test-"));

  if (runningUnderNodeTest) {
    return false;
  }

  return env.REPLAYX_GITHUB_PR_MODE === "live";
};

const createGithubPullRequest = async ({
  sandboxRoot,
  branchName,
  title,
  body,
  changedFiles
}: {
  sandboxRoot: string;
  branchName: string;
  title: string;
  body: string;
  changedFiles: string[];
}): Promise<{ url: string | null; blocker: string | null }> => {
  const baseBranchResult = await execShell("git rev-parse --abbrev-ref HEAD", sandboxRoot);
  const baseBranch = baseBranchResult.stdout.trim() || "main";

  const steps = [
    `git checkout -b ${JSON.stringify(branchName)}`,
    `git config user.name ${JSON.stringify("ReplayX Bot")}`,
    `git config user.email ${JSON.stringify("replayx-bot@users.noreply.github.com")}`,
    `git add ${changedFiles.map((file) => JSON.stringify(file)).join(" ")}`,
    `git commit -m ${JSON.stringify(title)}`,
    `git push -u origin ${JSON.stringify(branchName)}`
  ];

  for (const step of steps) {
    const result = await execShell(step, sandboxRoot);
    if (result.exitCode !== 0) {
      return {
        url: null,
        blocker: `GitHub handoff failed while running: ${step}`
      };
    }
  }

  const bodyFilePath = path.join(sandboxRoot, ".replayx-pr-body.md");
  await fs.writeFile(bodyFilePath, body, "utf8");

  const createResult = await execShell(
    `gh pr create --title ${JSON.stringify(title)} --body-file ${JSON.stringify(bodyFilePath)} --base ${JSON.stringify(baseBranch)} --head ${JSON.stringify(branchName)}`,
    sandboxRoot
  );

  if (createResult.exitCode !== 0) {
    return {
      url: null,
      blocker: "ReplayX validated the patch, but GitHub PR creation failed."
    };
  }

  const url = createResult.stdout.split(/\s+/).find((token) => token.startsWith("https://github.com/")) ?? null;
  return { url, blocker: null };
};

const buildDiffArtifact = async (
  repoRoot: string,
  sandboxRoot: string,
  changedFiles: string[]
): Promise<string> => {
  const diffChunks: string[] = [];

  for (const changedFile of changedFiles) {
    const original = path.join(repoRoot, changedFile);
    const modified = path.join(sandboxRoot, changedFile);
    const diffResult = await execShell(
      `git diff --no-index --no-color ${JSON.stringify(original)} ${JSON.stringify(modified)} || true`,
      repoRoot
    );

    if (diffResult.stdout.trim()) {
      diffChunks.push(diffResult.stdout.trimEnd());
    }
  }

  return diffChunks.join("\n\n");
};

const buildPullRequestBody = (
  incident: NormalizedIncident,
  changedFiles: string[],
  validationResults: PatchValidationResult["validationResults"],
  rollbackNote: string
): string =>
  [
    `## Summary`,
    ``,
    `Resolve \`${incident.incidentClass}\` for \`${incident.service}\` with a validated ReplayX patch candidate.`,
    ``,
    `## Changed Files`,
    ``,
    ...changedFiles.map((file) => `- ${file}`),
    ``,
    `## Validation`,
    ``,
    `- ${incident.commands.failing.label}: exit ${validationResults.failing.exitCode ?? "unknown"}`,
    `- ${incident.commands.healthy.label}: exit ${validationResults.healthy.exitCode ?? "unknown"}`,
    ``,
    `## Rollback`,
    ``,
    rollbackNote
  ].join("\n");

export const runSeededPatchValidation = async ({
  incident,
  repoRoot,
  artifactsRoot
}: {
  incident: NormalizedIncident;
  repoRoot: string;
  artifactsRoot: string;
}): Promise<PatchValidationResult> => {
  const { sandboxRoot, cleanupRoot } = await cloneWorkspaceForSandbox(repoRoot);
  const incidentArtifactsDirectory = path.join(artifactsRoot, incident.incidentId);

  try {
    const { changedFiles, rollbackNote } = await applySeededPatch(incident, sandboxRoot);
    const failing = await execShell(incident.commands.failing.command, sandboxRoot);
    const healthy = await execShell(incident.commands.healthy.command, sandboxRoot);
    const passed = failing.exitCode === 0 && healthy.exitCode === 0;

    await fs.mkdir(incidentArtifactsDirectory, { recursive: true });

    const diffBody = await buildDiffArtifact(repoRoot, sandboxRoot, changedFiles);
    const diffPath = path.join(incidentArtifactsDirectory, "patch.diff");
    const prPreviewPath = path.join(incidentArtifactsDirectory, "pr-preview.md");
    const branchName = `replayx/${incident.incidentId}-${Date.now().toString(36)}`;
    const prTitle = `fix(${incident.service}): resolve ${incident.incidentClass}`;
    const prBody = buildPullRequestBody(incident, changedFiles, { failing, healthy }, rollbackNote);

    await fs.writeFile(diffPath, `${diffBody}\n`, "utf8");
    await fs.writeFile(
      prPreviewPath,
      [`# ${prTitle}`, "", prBody, "", "## Diff Artifact", "", diffPath].join("\n"),
      "utf8"
    );

    if (!passed) {
      return {
        status: "blocked",
        summary:
          "ReplayX generated a seeded patch candidate, but the validation loop did not produce a verified PR-ready outcome.",
        changedFiles,
        validationResults: { failing, healthy },
        branchName: null,
        prTitle: null,
        prBody: null,
        prPreviewPath: null,
        diffPath,
        prUrl: null,
        rollbackNote,
        blocker: "Validation failed after applying the seeded patch candidate.",
        evidenceRefs: [diffPath]
      };
    }

    let prUrl: string | null = null;
    let blocker: string | null = null;

    if (shouldCreateLivePullRequest()) {
      const githubResult = await createGithubPullRequest({
        sandboxRoot,
        branchName,
        title: prTitle,
        body: prBody,
        changedFiles
      });
      prUrl = githubResult.url;
      blocker = githubResult.blocker;
    }

    return {
      status: "validated",
      summary:
        blocker === null
          ? prUrl
            ? "ReplayX validated the seeded patch candidate and opened a GitHub pull request."
            : "ReplayX validated the seeded patch candidate and prepared a PR-ready bundle."
          : blocker,
      changedFiles,
      validationResults: { failing, healthy },
      branchName,
      prTitle,
      prBody,
      prPreviewPath,
      diffPath,
      prUrl,
      rollbackNote,
      blocker,
      evidenceRefs: [diffPath, prPreviewPath, ...(prUrl ? [prUrl] : [])]
    };
  } finally {
    await fs.rm(cleanupRoot, { recursive: true, force: true });
  }
};
