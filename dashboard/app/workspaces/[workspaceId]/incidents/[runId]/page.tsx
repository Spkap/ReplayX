import { getReplayXRun } from "../../../../../lib/live-runs";
import {
  controlPlaneAuthRequired,
  isControlPlaneAccessTokenValid
} from "../../../../../lib/control-plane-auth";
import { LiveRunClient } from "../../../../live/[runId]/live-run-client";

export default async function WorkspaceIncidentPage({
  params,
  searchParams
}: {
  params: Promise<{ workspaceId: string; runId: string }>;
  searchParams?: Promise<{ access?: string }>;
}) {
  const { workspaceId, runId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const accessToken = resolvedSearchParams.access ?? null;

  if (
    controlPlaneAuthRequired() &&
    !isControlPlaneAccessTokenValid(accessToken, { scope: "run", runId, workspaceId })
  ) {
    return (
      <main className="shell replay-shell">
        <article className="workspace-panel">
          <span className="section-kicker">Unauthorized</span>
          <h2>This incident workspace requires a signed operator link</h2>
          <p className="ghost-text">Open the workspace from Slack or another authenticated ReplayX entrypoint.</p>
        </article>
      </main>
    );
  }

  const initialRun = await getReplayXRun(runId).catch(() => null);

  return (
    <LiveRunClient
      runId={runId}
      workspaceId={workspaceId}
      initialRun={initialRun}
      accessToken={accessToken}
    />
  );
}
