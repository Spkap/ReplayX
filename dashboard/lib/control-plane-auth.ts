import { createHmac, timingSafeEqual } from "node:crypto";

type RunScope = {
  scope: "run";
  runId: string;
  workspaceId?: string | null;
};

type WorkspaceScope = {
  scope: "workspace";
  workspaceId: string;
};

type ControlPlaneScope = RunScope | WorkspaceScope;

type AccessPayload = ControlPlaneScope & {
  exp: number;
};

const ACCESS_QUERY_PARAM = "access";
const ACCESS_TTL_MS = 1000 * 60 * 60 * 12;

const base64UrlEncode = (value: string): string => Buffer.from(value, "utf8").toString("base64url");

const base64UrlDecode = (value: string): string => Buffer.from(value, "base64url").toString("utf8");

const getSharedSecret = (): string | null => {
  const token = process.env.REPLAYX_INTERNAL_API_TOKEN?.trim();
  return token ? token : null;
};

const signValue = (value: string, secret: string): string =>
  createHmac("sha256", secret).update(value).digest("base64url");

const parsePayload = (token: string): AccessPayload | null => {
  const [encodedPayload] = token.split(".", 1);

  if (!encodedPayload) {
    return null;
  }

  try {
    return JSON.parse(base64UrlDecode(encodedPayload)) as AccessPayload;
  } catch {
    return null;
  }
};

const scopesMatch = (payload: AccessPayload, expected: ControlPlaneScope): boolean => {
  if (payload.scope !== expected.scope) {
    return false;
  }

  if (expected.scope === "run") {
    return (
      payload.scope === "run" &&
      payload.runId === expected.runId &&
      (expected.workspaceId === undefined || payload.workspaceId === expected.workspaceId)
    );
  }

  return payload.scope === "workspace" && payload.workspaceId === expected.workspaceId;
};

export const controlPlaneAuthRequired = (): boolean => getSharedSecret() !== null;

export const buildControlPlaneAccessToken = (scope: ControlPlaneScope): string | null => {
  const secret = getSharedSecret();

  if (!secret) {
    return null;
  }

  const payload: AccessPayload = {
    ...scope,
    exp: Date.now() + ACCESS_TTL_MS
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
};

export const isControlPlaneAccessTokenValid = (
  token: string | null | undefined,
  expected: ControlPlaneScope
): boolean => {
  const secret = getSharedSecret();

  if (!secret) {
    return true;
  }

  if (!token) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".", 2);

  if (!encodedPayload || !signature) {
    return false;
  }

  const expectedSignature = signValue(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return false;
  }

  const payload = parsePayload(token);

  if (!payload || payload.exp < Date.now()) {
    return false;
  }

  return scopesMatch(payload, expected);
};

export const isAuthorizedRequest = (request: Request, expected: ControlPlaneScope): boolean => {
  const secret = getSharedSecret();

  if (!secret) {
    return true;
  }

  if (request.headers.get("authorization") === `Bearer ${secret}`) {
    return true;
  }

  const url = new URL(request.url);
  return isControlPlaneAccessTokenValid(url.searchParams.get(ACCESS_QUERY_PARAM), expected);
};

export const getAccessQueryParam = (accessToken: string | null): string =>
  accessToken ? `?${ACCESS_QUERY_PARAM}=${encodeURIComponent(accessToken)}` : "";

export const buildAuthorizedPath = (pathname: string, accessToken: string | null): string =>
  accessToken ? `${pathname}${getAccessQueryParam(accessToken)}` : pathname;
