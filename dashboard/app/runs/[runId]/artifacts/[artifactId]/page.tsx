import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";

import Link from "next/link";

import { getReplayXRun } from "../../../../../lib/live-runs";
import {
  buildAuthorizedPath,
  controlPlaneAuthRequired,
  isControlPlaneAccessTokenValid
} from "../../../../../lib/control-plane-auth";
import { unauthorizedControlPlaneError } from "../../../../../lib/control-plane-errors";
import { ControlPlaneErrorPanel } from "../../../../../components/control-plane-error-panel";
import { AppFrame, CommandBlock, EmptyState, PageHeader } from "../../../../../components/replayx-ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ArtifactId = "preview" | "diff" | "postmortem" | "skill";

const isArtifactId = (value: string): value is ArtifactId =>
  value === "preview" || value === "diff" || value === "postmortem" || value === "skill";

const resolveDefaultRepoRoot = (startDirectory: string): string => {
  let currentDirectory = path.resolve(startDirectory);

  while (true) {
    if (
      existsSync(path.join(currentDirectory, "incidents")) &&
      existsSync(path.join(currentDirectory, "orchestrator"))
    ) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return path.resolve(startDirectory);
    }
    currentDirectory = parentDirectory;
  }
};

const repoRoot = resolveDefaultRepoRoot(process.cwd());

const resolveArtifact = (run: Awaited<ReturnType<typeof getReplayXRun>>, artifactId: ArtifactId) => {
  switch (artifactId) {
    case "preview":
      return {
        title: "PR Preview",
        path: run.pullRequest.previewPath,
        description: "The operator-facing preview bundle for the current resolution."
      };
    case "diff":
      return {
        title: "Patch Diff",
        path: run.pullRequest.diffPath,
        description: "The validated diff produced by ReplayX for this incident."
      };
    case "postmortem":
      return {
        title: "Postmortem",
        path: run.cards.postmortem.path,
        description: "The incident write-up generated from the validated run."
      };
    case "skill":
      return {
        title: "Reusable Skill",
        path: run.cards.skill.path,
        description: "The skill artifact ReplayX can reuse for future incidents in this class."
      };
  }
};

const assertSafeArtifactPath = async (artifactPath: string): Promise<string> => {
  const resolvedPath = path.isAbsolute(artifactPath)
    ? path.resolve(artifactPath)
    : path.resolve(repoRoot, artifactPath);
  const artifactsRoot = path.resolve(repoRoot, "artifacts");
  const skillsRoot = path.resolve(repoRoot, "skills");
  const withinArtifacts = !path.relative(artifactsRoot, resolvedPath).startsWith("..");
  const withinSkills = !path.relative(skillsRoot, resolvedPath).startsWith("..");

  if (!withinArtifacts && !withinSkills) {
    throw new Error("ReplayX blocked access to an artifact outside the approved workspace.");
  }

  await access(resolvedPath);
  return resolvedPath;
};

const sanitizeArtifactContent = (content: string, artifactId: ArtifactId): string => {
  const repoPrefix = `${repoRoot}${path.sep}`;
  let sanitized = content.split(repoPrefix).join("");

  if (artifactId === "preview") {
    sanitized = sanitized.replace(
      /## Diff Artifact\s+.+$/ms,
      "## Diff Artifact\nOpen the diff from the incident workspace."
    );
  }

  return sanitized;
};

export default async function RunArtifactPage({
  params,
  searchParams
}: {
  params: Promise<{ runId: string; artifactId: string }>;
  searchParams?: Promise<{ access?: string }>;
}) {
  const { runId, artifactId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const accessToken = resolvedSearchParams.access ?? null;

  if (controlPlaneAuthRequired() && !isControlPlaneAccessTokenValid(accessToken, { scope: "run", runId })) {
    return (
      <AppFrame active="artifact" statusDetail="Signed link required">
        <ControlPlaneErrorPanel
          kicker="Unauthorized"
          title="This ReplayX artifact requires a signed operator link"
          problem={unauthorizedControlPlaneError("This ReplayX artifact")}
        />
      </AppFrame>
    );
  }

  if (!isArtifactId(artifactId)) {
    return (
      <AppFrame active="artifact" statusDetail="Artifact unavailable">
        <EmptyState
          title="ReplayX could not find that artifact view"
          body="Use one of the workspace artifact actions instead of guessing a route."
        />
      </AppFrame>
    );
  }

  const run = await getReplayXRun(runId);
  const artifact = resolveArtifact(run, artifactId);
  const livePath = buildAuthorizedPath(`/live/${runId}?tab=resolution`, accessToken);

  if (!artifact.path || artifact.path === "pending") {
    return (
      <AppFrame active="artifact" statusDetail="Artifact pending">
        <article className="workspace-panel">
          <span className="eyebrow">Artifact pending</span>
          <h2>{artifact.title} is not ready yet</h2>
          <p>{artifact.description}</p>
          <div className="rail-actions" style={{ marginTop: "1rem" }}>
            <Link className="ghost-link" href={livePath}>
              Back to incident workspace
            </Link>
          </div>
        </article>
      </AppFrame>
    );
  }

  const safeArtifactPath = await assertSafeArtifactPath(artifact.path);
  const content = sanitizeArtifactContent(await readFile(safeArtifactPath, "utf8"), artifactId);

  return (
    <AppFrame active="artifact" homePath={livePath} statusDetail="Artifact view">
      <PageHeader
        actions={
          <Link className="button button-secondary" href={livePath}>
            Back to workspace
          </Link>
        }
        eyebrow="Incident artifact"
        lead={artifact.description}
        title={artifact.title}
      />

      <section className="artifact-shell fade-in">
        <article className="workspace-panel">
          <CommandBlock>{content}</CommandBlock>
        </article>
      </section>
    </AppFrame>
  );
}
