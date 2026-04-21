import { retryReplayXRun, startReplayXLivePipeline, startReplayXLivePipelineDetached } from "../../../../../../lib/live-runs";
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
      unauthorizedControlPlaneError("ReplayX retry actions"),
      401
    );
  }

  try {
    const run = await retryReplayXRun(runId);

    try {
      startReplayXLivePipelineDetached(run.runId);
    } catch {
      startReplayXLivePipeline(run.runId);
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
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return buildControlPlaneErrorResponse(runNotFoundControlPlaneError(runId), 404);
    }

    return buildControlPlaneErrorResponse(
      {
        error: error instanceof Error ? error.message : "Unable to retry run.",
        cause: "ReplayX retries only terminal, non-archived runs because archived history is intentionally read-only.",
        fix: "Retry from an unarchived terminal run, or create a fresh run instead.",
        docsPath: "/help/troubleshooting#archived-runs"
      },
      409
    );
  }
}
