const crypto = require("node:crypto");

const FIVE_MINUTES_IN_SECONDS = 60 * 5;

function buildSlackSignatureBaseString(timestamp, rawBody) {
  return `v0:${timestamp}:${rawBody}`;
}

function createSlackSignature(signingSecret, timestamp, rawBody) {
  const hmac = crypto.createHmac("sha256", signingSecret);
  hmac.update(buildSlackSignatureBaseString(timestamp, rawBody));

  return `v0=${hmac.digest("hex")}`;
}

function timingSafeCompare(a, b) {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function verifySlackRequest({
  signingSecret,
  timestamp,
  signature,
  rawBody,
  now = Date.now(),
}) {
  if (!signingSecret || !timestamp || !signature || typeof rawBody !== "string") {
    return false;
  }

  const parsedTimestamp = Number(timestamp);
  if (!Number.isFinite(parsedTimestamp)) {
    return false;
  }

  const ageInSeconds = Math.abs(Math.floor(now / 1000) - parsedTimestamp);
  if (ageInSeconds > FIVE_MINUTES_IN_SECONDS) {
    return false;
  }

  const expectedSignature = createSlackSignature(
    signingSecret,
    timestamp,
    rawBody,
  );

  return timingSafeCompare(expectedSignature, signature);
}

module.exports = {
  createSlackSignature,
  verifySlackRequest,
};
