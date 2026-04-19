import { getReplayXRun } from "../../../lib/live-runs";
import {
  controlPlaneAuthRequired,
  isControlPlaneAccessTokenValid
} from "../../../lib/control-plane-auth";
import { LiveRunClient } from "./live-run-client";

export default async function LiveRunPage({
  params,
  searchParams
}: {
  params: Promise<{ runId: string }>;
  searchParams?: Promise<{ access?: string }>;
}) {
  const { runId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const accessToken = resolvedSearchParams.access ?? null;

  if (
    controlPlaneAuthRequired() &&
    !isControlPlaneAccessTokenValid(accessToken, { scope: "run", runId })
  ) {
    return (
      <main className="shell replay-shell">
        <article className="workspace-panel">
          <span className="section-kicker">Unauthorized</span>
          <h2>This ReplayX run requires a signed operator link</h2>
          <p className="ghost-text">Open the run from Slack or an authenticated internal control-plane link.</p>
        </article>
      </main>
    );
  }

  const initialRun = await getReplayXRun(runId).catch(() => null);

  return <LiveRunClient runId={runId} initialRun={initialRun} accessToken={accessToken} />;
}
