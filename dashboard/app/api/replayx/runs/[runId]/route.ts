import { getReplayXRun } from "../../../../../lib/live-runs";
import { isAuthorizedRequest } from "../../../../../lib/control-plane-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  if (!isAuthorizedRequest(_request, { scope: "run", runId })) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const run = await getReplayXRun(runId);
    return Response.json({ ok: true, run });
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "ENOENT") {
      return Response.json({ error: "Run not found" }, { status: 404 });
    }

    throw error;
  }
}
