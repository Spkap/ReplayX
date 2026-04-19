import { getReplayXRun } from "../../../../../lib/live-runs";
import {
  controlPlaneAuthRequired,
  isControlPlaneAccessTokenValid
} from "../../../../../lib/control-plane-auth";
import { ActionPageClient } from "./action-page-client";

const allowedActions = new Set(["approve", "retry", "cancel"]);

export default async function RunActionPage({
  params,
  searchParams
}: {
  params: Promise<{ runId: string; action: "approve" | "retry" | "cancel" }>;
  searchParams?: Promise<{ access?: string }>;
}) {
  const { runId, action } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const accessToken = resolvedSearchParams.access ?? null;

  if (!allowedActions.has(action)) {
    return (
      <main className="shell replay-shell">
        <article className="workspace-panel">
          <span className="section-kicker">Invalid action</span>
          <h2>ReplayX cannot perform that action</h2>
        </article>
      </main>
    );
  }

  if (
    controlPlaneAuthRequired() &&
    !isControlPlaneAccessTokenValid(accessToken, { scope: "run", runId })
  ) {
    return (
      <main className="shell replay-shell">
        <article className="workspace-panel">
          <span className="section-kicker">Unauthorized</span>
          <h2>This ReplayX action requires a signed operator link</h2>
          <p className="ghost-text">Open the action from Slack or another authenticated ReplayX entrypoint.</p>
        </article>
      </main>
    );
  }

  const run = await getReplayXRun(runId).catch(() => null);

  if (!run) {
    return (
      <main className="shell replay-shell">
        <article className="workspace-panel">
          <span className="section-kicker">Missing run</span>
          <h2>ReplayX could not find that run</h2>
        </article>
      </main>
    );
  }

  return <ActionPageClient action={action} run={run} accessToken={accessToken} />;
}
