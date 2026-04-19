import { getReplayXRun } from "../../../../../../lib/live-runs";
import { isAuthorizedRequest } from "../../../../../../lib/control-plane-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const isTerminalStatus = (status: string): boolean =>
  status === "resolved_to_pr" || status === "blocked" || status === "failed" || status === "cancelled";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;

  if (!isAuthorizedRequest(request, { scope: "run", runId })) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      request.signal.addEventListener("abort", close);

      const push = async () => {
        while (!closed) {
          try {
            const run = await getReplayXRun(runId);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ ok: true, run })}\n\n`));

            if (isTerminalStatus(run.status)) {
              close();
              return;
            }
          } catch (error) {
            const nodeError = error as NodeJS.ErrnoException;
            if (nodeError.code === "ENOENT") {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ ok: false, error: "Run not found" })}\n\n`)
              );
            } else {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    ok: false,
                    error: nodeError.message ?? "Unable to stream run"
                  })}\n\n`
                )
              );
            }

            close();
            return;
          }

          await sleep(600);
        }
      };

      void push();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
