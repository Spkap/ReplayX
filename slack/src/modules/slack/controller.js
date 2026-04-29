const { sendError } = require("./http-errors");

const EVENT_DEDUPE_TTL_MS = 1000 * 60 * 15;

function buildEventKey(body) {
  if (!body?.event_id) {
    return null;
  }

  return `${body.team_id || "unknown-team"}:${body.event_id}`;
}

function pruneProcessedEvents(processedEvents, now = Date.now()) {
  for (const [eventKey, processedAt] of processedEvents.entries()) {
    if (now - processedAt > EVENT_DEDUPE_TTL_MS) {
      processedEvents.delete(eventKey);
    }
  }
}

function createSlackController({ slackService, bugsChannelId, logger }) {
  const processedEvents = new Map();

  return {
    async handleEvents(req, res) {
      pruneProcessedEvents(processedEvents);
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

      const eventKey = buildEventKey(req.body);

      if (eventKey && processedEvents.has(eventKey)) {
        logger.info("slack.events.completed", {
          eventType: "app_mention",
          outcome: "ignored",
          reason: "duplicate_event",
        });
        return res.status(200).json({ ok: true, ignored: true, reason: "duplicate_event" });
      }

      try {
        const result = await slackService.handleAppMention(req.body.event);
        if (eventKey) {
          processedEvents.set(eventKey, Date.now());
        }
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
          textLength: text.length,
          hasBlocks: Array.isArray(blocks),
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
