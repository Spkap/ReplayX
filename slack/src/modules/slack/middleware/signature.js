const { verifySlackRequest } = require("../signature");

function captureRawBody(req, res, buffer) {
  req.rawBody = buffer.toString("utf8");
}

function createSlackSignatureMiddleware({ logger, signingSecret, now }) {
  return (req, res, next) => {
    const signature = req.get("X-Slack-Signature");
    const timestamp = req.get("X-Slack-Request-Timestamp");
    const rawBody = req.rawBody || JSON.stringify(req.body || {});

    if (
      !verifySlackRequest({
        signingSecret,
        timestamp,
        signature,
        rawBody,
        now: now(),
      })
    ) {
      logger.warn("slack.signature.invalid", {
        path: req.path,
        timestamp,
      });
      return res.status(401).json({ error: "Invalid Slack signature" });
    }

    return next();
  };
}

module.exports = {
  captureRawBody,
  createSlackSignatureMiddleware,
};
