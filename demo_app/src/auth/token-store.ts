import type { AccessToken, SessionRecord } from "../types.js";

const sessions = new Map<string, SessionRecord>();

const makeAccessToken = (sessionId: string, issuedAt: number): AccessToken => ({
  value: `token_${sessionId}_${issuedAt}`,
  fingerprint: `fp_${sessionId}_${issuedAt}`,
  expiresAt: issuedAt + 5 * 60 * 1000
});

export const resetSessions = (): void => {
  sessions.clear();
};

export const createSession = (userId: string, now: number): SessionRecord => {
  const sessionId = "sess_c83a";
  const session: SessionRecord = {
    sessionId,
    userId,
    lastActiveAt: now,
    accessToken: makeAccessToken(sessionId, now)
  };

  sessions.set(sessionId, session);

  return session;
};

export const getSession = (sessionId: string): SessionRecord => {
  const session = sessions.get(sessionId);

  if (!session) {
    throw new Error(`Unknown session: ${sessionId}`);
  }

  return session;
};

export const rotateAccessToken = (session: SessionRecord, now: number): AccessToken => {
  session.lastActiveAt = now;
  session.accessToken = makeAccessToken(session.sessionId, now);
  return session.accessToken;
};
