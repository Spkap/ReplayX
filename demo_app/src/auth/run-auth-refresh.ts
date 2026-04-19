import { createSession, resetSessions } from "./token-store.js";
import { refreshSession } from "./refresh-session.js";
import { requireSession } from "../middleware/require-session.js";

export const runAuthRefreshScenario = (idleMinutes: number): { sessionId: string; refreshed: boolean } => {
  const issuedAt = Date.parse("2026-04-15T07:12:00Z");
  const now = issuedAt + idleMinutes * 60 * 1000 + 24_000;

  resetSessions();
  const session = createSession("user_108", issuedAt);
  const token = refreshSession(session.sessionId, now);
  requireSession(token, now);

  return {
    sessionId: session.sessionId,
    refreshed: true
  };
};
