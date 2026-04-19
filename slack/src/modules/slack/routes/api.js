const crypto = require("node:crypto");
const express = require("express");

function createInternalApiAuthMiddleware(internalApiToken) {
  return (req, res, next) => {
    if (!internalApiToken) {
      return res.status(503).json({ error: "Internal Slack API is disabled" });
    }

    const authorization = req.get("Authorization") || "";
    const expected = `Bearer ${internalApiToken}`;
    const actualBuffer = Buffer.from(authorization, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");

    if (
      actualBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    return next();
  };
}

function createSlackApiRouter({ controller, internalApiToken }) {
  const router = express.Router();

  router.post(
    "/post-message",
    express.json(),
    createInternalApiAuthMiddleware(internalApiToken),
    controller.postMessage,
  );

  return router;
}

module.exports = {
  createSlackApiRouter,
};
