const { sendError } = require("./http-errors");

function createSlackController({ slackService, bugsChannelId, logger }) {
  return {
    async handleEvents(req, res) {
      logger.info("slack.events.received", {
        requestType: req.body?.type,
        eventType: req.body?.event?.type,
        eventId: req.body?.event_id,
        channel: req.body?.event?.channel,
        user: req.body?.event?.user,
        ts: req.body?.event?.ts,
        threadTs: req.body?.event?.thread_ts,
      });

      if (req.body.type === "url_verification") {
        logger.info("slack.events.completed", {
          eventType: "url_verification",
          outcome: "handled",
        });
        return res.type("text/plain").send(req.body.challenge);
      }

      if (req.body.type !== "event_callback") {
        logger.info("slack.events.completed", {
          eventType: req.body?.event?.type,
          outcome: "ignored",
          reason: "unsupported_request_type",
        });
        return res.status(200).json({ ok: true, ignored: true });
      }

      if (req.body.event?.type !== "app_mention") {
        logger.info("slack.events.completed", {
          eventType: req.body?.event?.type,
          outcome: "ignored",
          reason: "unsupported_event_type",
        });
        return res.status(200).json({ ok: true, ignored: true });
      }

      try {
        const result = await slackService.handleAppMention(req.body.event);
        logger.info("slack.events.completed", {
          eventType: "app_mention",
          outcome: result?.ignored ? "ignored" : "handled",
          reason: result?.reason,
        });
        return res.status(200).json({ ok: true, result });
      } catch (error) {
        logger.error("slack.events.failed", {
          eventType: "app_mention",
          message: error.message,
          details: error.details,
        });
        return sendError(res, error);
      }
    },

    async postMessage(req, res) {
      const { channel, text, threadTs, blocks } = req.body || {};
      const targetChannel = channel || bugsChannelId;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "text is required" });
      }

      try {
        logger.info("slack.post_message.attempt", {
          channel: targetChannel,
          threadTs,
          text,
        });
        const result = await slackService.postMessage({
          channel: targetChannel,
          text,
          threadTs,
          ...(blocks ? { blocks } : {}),
        });

        logger.info("slack.post_message.success", {
          channel: targetChannel,
          threadTs,
          ts: result?.ts,
        });
        return res.status(200).json({ ok: true, result });
      } catch (error) {
        logger.error("slack.post_message.failed", {
          channel: targetChannel,
          threadTs,
          message: error.message,
          details: error.details,
        });
        return sendError(res, error);
      }
    },
  };
}

module.exports = {
  createSlackController,
};
