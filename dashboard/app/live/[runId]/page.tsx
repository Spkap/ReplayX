import { getReplayXRun } from "../../../lib/live-runs";
import {
  controlPlaneAuthRequired,
  getControlPlaneAccessPayload,
  isControlPlaneAccessTokenValid
} from "../../../lib/control-plane-auth";
import { unauthorizedControlPlaneError } from "../../../lib/control-plane-errors";
import { ControlPlaneErrorPanel } from "../../../components/control-plane-error-panel";
import { AppFrame } from "../../../components/replayx-ui";
import { LiveRunClient } from "./live-run-client";

const isTabId = (value: string | null | undefined): value is Parameters<typeof LiveRunClient>[0]["initialTab"] =>
  value === "overview" ||
  value === "timeline" ||
  value === "evidence" ||
  value === "diagnosis" ||
  value === "patch" ||
  value === "validation" ||
  value === "resolution" ||
  value === "memory";

export default async function LiveRunPage({
  params,
  searchParams
}: {
  params: Promise<{ runId: string }>;
  searchParams?: Promise<{ access?: string; tab?: string }>;
}) {
  const { runId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const accessToken = resolvedSearchParams.access ?? null;
  const initialTab = isTabId(resolvedSearchParams.tab) ? resolvedSearchParams.tab : "overview";

  if (
    controlPlaneAuthRequired() &&
    !isControlPlaneAccessTokenValid(accessToken, { scope: "run", runId })
  ) {
    return (
      <AppFrame active="live" statusDetail="Signed link required">
        <ControlPlaneErrorPanel
          kicker="Unauthorized"
          title="This ReplayX run requires a signed operator link"
          problem={unauthorizedControlPlaneError("This ReplayX run")}
        />
      </AppFrame>
    );
  }

  const initialRun = await getReplayXRun(runId).catch(() => null);
  const controlPlaneAccessToken =
    getControlPlaneAccessPayload(accessToken)?.scope === "control-plane" ? accessToken : null;

  return (
    <LiveRunClient
      runId={runId}
      initialRun={initialRun}
      initialTab={initialTab}
      accessToken={accessToken}
      controlPlaneAccessToken={controlPlaneAccessToken}
    />
  );
}
