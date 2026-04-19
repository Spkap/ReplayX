import { createServer } from "node:http";
import { URL } from "node:url";

import { runAuthRefreshScenario } from "./src/auth/run-auth-refresh.js";
import { runCheckoutRaceScenario } from "./src/checkout/submit-order.js";
import { renderOrderSummaryPage } from "./src/routes/order-summary.js";

const PORT = Number(process.env.PORT ?? "4311");

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? `127.0.0.1:${PORT}`}`);

  const writeJson = (statusCode: number, payload: unknown): void => {
    response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify(payload, null, 2));
  };

  try {
    if (requestUrl.pathname === "/health") {
      writeJson(200, { ok: true, service: "replayx-demo-app" });
      return;
    }

    if (requestUrl.pathname === "/api/repro/checkout-race") {
      const mode = requestUrl.searchParams.get("mode") === "serial" ? "serial" : "concurrent";
      const orders = await runCheckoutRaceScenario(mode);
      writeJson(200, { ok: true, mode, orders });
      return;
    }

    if (requestUrl.pathname === "/api/repro/auth-refresh") {
      const idleMinutes = Number(requestUrl.searchParams.get("idleMinutes") ?? "30");
      const result = runAuthRefreshScenario(idleMinutes);
      writeJson(200, { ok: true, idleMinutes, result });
      return;
    }

    if (requestUrl.pathname === "/checkout/summary") {
      const fixture =
        requestUrl.searchParams.get("fixture") === "missing-taxes" ? "missing-taxes" : "complete-quote";
      const html = renderOrderSummaryPage(fixture);

      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }

    if (requestUrl.pathname === "/") {
      writeJson(200, {
        ok: true,
        routes: [
          "/health",
          "/api/repro/checkout-race?mode=concurrent",
          "/api/repro/checkout-race?mode=serial",
          "/api/repro/auth-refresh?idleMinutes=30",
          "/checkout/summary?fixture=missing-taxes"
        ]
      });
      return;
    }

    writeJson(404, { ok: false, error: "NotFound" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UnknownError";
    writeJson(500, { ok: false, error: message });
  }
});

server.listen(PORT, () => {
  console.log(`ReplayX demo app listening on http://127.0.0.1:${PORT}`);
});
