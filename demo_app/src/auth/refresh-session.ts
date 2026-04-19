import { getSession, rotateAccessToken } from "./token-store.js";
import type { AccessToken } from "../types.js";

const IDLE_SESSION_THRESHOLD_MS = 30 * 60 * 1000;

export const refreshSession = (sessionId: string, now: number): AccessToken => {
  const session = getSession(sessionId);
  const idleDuration = now - session.lastActiveAt;

  if (idleDuration >= IDLE_SESSION_THRESHOLD_MS) {
    session.lastActiveAt = now;

    // Intentional bug: stale idle sessions reuse the expired token instead of rotating one.
    return session.accessToken;
  }

  return rotateAccessToken(session, now);
};
