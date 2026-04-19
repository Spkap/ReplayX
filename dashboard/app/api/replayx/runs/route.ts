import {
  createReplayXRun,
  startReplayXLivePipeline,
  startReplayXLivePipelineDetached
} from "../../../../lib/live-runs";
import { buildAuthorizedPath, buildControlPlaneAccessToken, isAuthorizedRequest } from "../../../../lib/control-plane-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAuthorizedRequest(request, { scope: "workspace", workspaceId: "workspace-default" })) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    source?: "slack" | "manual";
    text?: string;
    workspaceId?: string;
    incidentId?: string;
    owner?: string;
    repoTarget?: string;
    environmentTarget?: string;
    serviceTarget?: string;
    severity?: string;
    channel?: string;
    threadTs?: string;
    user?: string;
  } | null;

  if (!body?.text || typeof body.text !== "string") {
    return Response.json({ error: "text is required" }, { status: 400 });
  }

  let run: Awaited<ReturnType<typeof createReplayXRun>>;

  try {
    run = await createReplayXRun({
      source: body.source ?? "manual",
      text: body.text,
      incidentId: body.incidentId,
      workspaceId: body.workspaceId,
      owner: body.owner,
      repoTarget: body.repoTarget,
      environmentTarget: body.environmentTarget,
      serviceTarget: body.serviceTarget,
      severity: body.severity,
      channel: body.channel,
      threadTs: body.threadTs,
      user: body.user
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create ReplayX run";
    return Response.json({ error: message }, { status: 400 });
  }

  if (!run.approvals.some((approval) => approval.status === "pending")) {
    try {
      startReplayXLivePipelineDetached(run.runId);
    } catch {
      // Fallback for environments where detached process spawn is unavailable.
      startReplayXLivePipeline(run.runId);
    }
  }

  const accessToken = buildControlPlaneAccessToken({
    scope: "run",
    runId: run.runId,
    workspaceId: run.workspaceId
  });

  return Response.json(
    {
      ok: true,
      run,
      runId: run.runId,
      livePath: buildAuthorizedPath(`/live/${run.runId}`, accessToken),
      workspacePath: buildAuthorizedPath(`/workspaces/${run.workspaceId}/incidents/${run.runId}`, accessToken),
      incidentWorkspacePath: buildAuthorizedPath(`/workspaces/${run.workspaceId}/incidents/${run.runId}`, accessToken),
      actionPaths: {
        approve: buildAuthorizedPath(`/runs/${run.runId}/actions/approve`, accessToken),
        retry: buildAuthorizedPath(`/runs/${run.runId}/actions/retry`, accessToken),
        cancel: buildAuthorizedPath(`/runs/${run.runId}/actions/cancel`, accessToken)
      }
    },
    { status: 201 }
  );
}
