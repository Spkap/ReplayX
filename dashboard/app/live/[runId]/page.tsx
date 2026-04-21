import { getReplayXRun } from "../../../lib/live-runs";
import {
  controlPlaneAuthRequired,
  getControlPlaneAccessPayload,
  isControlPlaneAccessTokenValid
} from "../../../lib/control-plane-auth";
import { unauthorizedControlPlaneError } from "../../../lib/control-plane-errors";
import { ControlPlaneErrorPanel } from "../../../components/control-plane-error-panel";
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
        <ControlPlaneErrorPanel
          kicker="Unauthorized"
          title="This ReplayX run requires a signed operator link"
          problem={unauthorizedControlPlaneError("This ReplayX run")}
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
      initialRun={initialRun}
      accessToken={accessToken}
      controlPlaneAccessToken={controlPlaneAccessToken}
    />
  );
}
