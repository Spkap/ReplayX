import { getReplayXRun } from "../../../../../lib/live-runs";
import {
  controlPlaneAuthRequired,
  getControlPlaneAccessPayload,
  isControlPlaneAccessTokenValid
} from "../../../../../lib/control-plane-auth";
import { unauthorizedControlPlaneError } from "../../../../../lib/control-plane-errors";
import { ControlPlaneErrorPanel } from "../../../../../components/control-plane-error-panel";
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
        <ControlPlaneErrorPanel
          kicker="Unauthorized"
          title="This incident workspace requires a signed operator link"
          problem={unauthorizedControlPlaneError("This incident workspace")}
        />
      </main>
    );
  }

  const initialRun = await getReplayXRun(runId).catch(() => null);
  const controlPlaneAccessToken =
    getControlPlaneAccessPayload(accessToken)?.scope === "control-plane" ? accessToken : null;

  return (
    <LiveRunClient
      runId={runId}
      workspaceId={workspaceId}
      initialRun={initialRun}
      accessToken={accessToken}
      controlPlaneAccessToken={controlPlaneAccessToken}
    />
  );
}
