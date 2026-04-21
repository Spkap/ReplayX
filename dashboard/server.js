const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const crypto = require("node:crypto");
const next = require("next");
const { DatabaseSync } = require("node:sqlite");
const { WebSocketServer } = require("ws");

const dev = process.env.NODE_ENV !== "production";
const args = process.argv.slice(2);
const readCliFlag = (flagName) => {
  const index = args.findIndex((arg) => arg === flagName);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
};

const hostname = readCliFlag("--hostname") || process.env.HOSTNAME || "0.0.0.0";
const port = Number.parseInt(readCliFlag("--port") || process.env.PORT || "3000", 10);
const app = next({ dev, dir: __dirname, hostname, port });
const handle = app.getRequestHandler();

const repoRoot = path.resolve(__dirname, "..");
const runStoreRoot = path.join(repoRoot, ".replayx-control-plane");
const runStoreDbPath = path.join(runStoreRoot, "replayx-control-plane.db");
const wsRoutePattern = /^\/api\/replayx\/runs\/([^/]+)\/ws$/;
const isTerminalStatus = (status) =>
  status === "resolved_to_pr" || status === "blocked" || status === "failed" || status === "cancelled";

function getSharedSecret() {
  const token = process.env.REPLAYX_INTERNAL_API_TOKEN?.trim();
  return token || null;
}

function signValue(value, secret) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function isAuthorizedWebsocket(url, requestRunId) {
  const secret = getSharedSecret();

  if (!secret) {
    return true;
  }

  const token = url.searchParams.get("access");

  if (!token) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".", 2);

  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = signValue(encodedPayload, secret);
  const received = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    return payload.scope === "run" && payload.runId === requestRunId && payload.exp >= Date.now();
  } catch {
    return false;
  }
}

function readRunPayload(runId) {
  try {
    fs.mkdirSync(runStoreRoot, { recursive: true });
    const db = new DatabaseSync(runStoreDbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        status TEXT NOT NULL,
        origin TEXT NOT NULL,
        incident_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT,
        pull_request_status TEXT,
        payload TEXT NOT NULL
      );
    `);
    const row = db.prepare("SELECT payload FROM runs WHERE run_id = ?").get(runId);
    db.close();

    if (!row || !row.payload) {
      return JSON.stringify({
        ok: false,
        error: `ReplayX could not find run ${runId}.`,
        cause:
          "The run id is stale, the control-plane store was reset, or this dashboard is pointing at a different .replayx-control-plane database than the link expects.",
        fix:
          "Open the Featured Proof or create a fresh run. In local dev, verify that you are still in the same repo and using the expected control-plane store.",
        docsPath: "/help/troubleshooting#run-not-found"
      });
    }

    return JSON.stringify({ ok: true, run: JSON.parse(row.payload) });
  } catch (error) {
    return JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : "Unable to load run"
    });
  }
}

app.prepare().then(() => {
  const server = http.createServer((req, res) => handle(req, res));
  const wss = new WebSocketServer({ noServer: true });
  const nextUpgradeHandler = app.getUpgradeHandler();

  wss.on("connection", (socket, request, runId) => {
    let closed = false;
    let closeTimer = null;

    const sendSnapshot = () => {
      if (closed || socket.readyState !== socket.OPEN) {
        return;
      }

      const payload = readRunPayload(runId);
      socket.send(payload);

      try {
        const parsed = JSON.parse(payload);
        if (parsed.ok && isTerminalStatus(parsed.run.status)) {
          closeTimer = setTimeout(() => {
            if (!closed && socket.readyState === socket.OPEN) {
              socket.close();
            }
          }, 250);
        }
      } catch {
        // Ignore malformed payload parsing here; client will surface it.
      }
    };

    sendSnapshot();

    const pollId = setInterval(sendSnapshot, 750);
    const watcher = { close: () => clearInterval(pollId) };

    const cleanup = () => {
      if (closed) {
        return;
      }

      closed = true;

      if (closeTimer) {
        clearTimeout(closeTimer);
      }

      watcher?.close?.();
    };

    socket.on("close", cleanup);
    socket.on("error", cleanup);
    request.on("close", cleanup);
  });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const match = url.pathname.match(wsRoutePattern);

    if (!match) {
      nextUpgradeHandler(request, socket, head);
      return;
    }

    const runId = decodeURIComponent(match[1]);

    if (!isAuthorizedWebsocket(url, runId)) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, runId);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> ReplayX dashboard listening on http://${hostname}:${port}`);
  });
});
