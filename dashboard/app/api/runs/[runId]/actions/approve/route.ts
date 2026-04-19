import {
  approveReplayXRunAction,
  startReplayXLivePipeline,
  startReplayXLivePipelineDetached
} from "../../../../../../lib/live-runs";
import {
  buildAuthorizedPath,
  buildControlPlaneAccessToken,
  isAuthorizedRequest
} from "../../../../../../lib/control-plane-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  if (!isAuthorizedRequest(_request, { scope: "run", runId })) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const run = await approveReplayXRunAction(runId);

  if (!run.approvals.some((approval) => approval.status === "pending") && !run.currentPhaseId) {
    try {
      startReplayXLivePipelineDetached(run.runId);
    } catch {
      startReplayXLivePipeline(run.runId);
    }
  }

  const accessToken = buildControlPlaneAccessToken({
    scope: "run",
    runId: run.runId,
    workspaceId: run.workspaceId
  });

  return Response.json({
    ok: true,
    run,
    accessToken,
    workspacePath: buildAuthorizedPath(`/workspaces/${run.workspaceId}/incidents/${run.runId}`, accessToken)
  });
}
