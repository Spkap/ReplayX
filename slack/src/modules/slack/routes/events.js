const express = require("express");

const {
  captureRawBody,
  createSlackSignatureMiddleware,
} = require("../middleware/signature");

function createSlackEventsRouter({ controller, logger, signingSecret, now }) {
  const router = express.Router();

  router.post(
    "/events",
    express.json({ verify: captureRawBody }),
    createSlackSignatureMiddleware({ logger, signingSecret, now }),
    controller.handleEvents,
  );

  return router;
}

module.exports = {
  createSlackEventsRouter,
};
