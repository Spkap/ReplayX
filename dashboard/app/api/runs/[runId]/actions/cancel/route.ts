import { cancelReplayXRun } from "../../../../../../lib/live-runs";
import {
  buildAuthorizedPath,
  buildControlPlaneAccessToken,
  isAuthorizedRequest
} from "../../../../../../lib/control-plane-auth";
import {
  buildControlPlaneErrorResponse,
  runNotFoundControlPlaneError,
  unauthorizedControlPlaneError
} from "../../../../../../lib/control-plane-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  if (!isAuthorizedRequest(_request, { scope: "run", runId })) {
    return buildControlPlaneErrorResponse(
      unauthorizedControlPlaneError("ReplayX cancel actions"),
      401
    );
  }

  try {
    const run = await cancelReplayXRun(runId);
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
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return buildControlPlaneErrorResponse(runNotFoundControlPlaneError(runId), 404);
    }

    return buildControlPlaneErrorResponse(
      {
        error: error instanceof Error ? error.message : "Unable to cancel run.",
        cause: "ReplayX can cancel only active, non-archived runs.",
        fix: "Open the incident workspace and confirm the run is still active before cancelling it.",
        docsPath: "/help/troubleshooting#archived-runs"
      },
      409
    );
  }
}
