import { getReplayXRun } from "../../../../../lib/live-runs";
import {
  controlPlaneAuthRequired,
  getControlPlaneAccessPayload,
  isControlPlaneAccessTokenValid
} from "../../../../../lib/control-plane-auth";
import {
  runNotFoundControlPlaneError,
  unauthorizedControlPlaneError
} from "../../../../../lib/control-plane-errors";
import { ControlPlaneErrorPanel } from "../../../../../components/control-plane-error-panel";
import { ActionPageClient } from "./action-page-client";

const allowedActions = new Set(["approve", "retry", "cancel", "archive"]);

export default async function RunActionPage({
  params,
  searchParams
}: {
  params: Promise<{ runId: string; action: "approve" | "retry" | "cancel" | "archive" }>;
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
        <ControlPlaneErrorPanel
          kicker="Unauthorized"
          title="This ReplayX action requires a signed operator link"
          problem={unauthorizedControlPlaneError("This ReplayX action")}
        />
      </main>
    );
  }

  const run = await getReplayXRun(runId).catch(() => null);
  const controlPlaneAccessToken =
    getControlPlaneAccessPayload(accessToken)?.scope === "control-plane" ? accessToken : null;

  if (!run) {
    return (
      <main className="shell replay-shell">
        <ControlPlaneErrorPanel
          kicker="Missing run"
          title="ReplayX could not find that run"
          problem={runNotFoundControlPlaneError(runId)}
        />
      </main>
    );
  }

  return (
    <ActionPageClient
      action={action}
      run={run}
      accessToken={accessToken}
      controlPlaneAccessToken={controlPlaneAccessToken}
    />
  );
}
