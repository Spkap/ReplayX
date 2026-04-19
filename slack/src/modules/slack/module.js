const { createSlackController } = require("./controller");
const { createSlackApiRouter } = require("./routes/api");
const { createSlackEventsRouter } = require("./routes/events");
const { SlackClient } = require("./client");
const { createLogger } = require("./logger");
const { createSlackService } = require("./service");
const { ReplayXClient } = require("../replayx/client");

function createSlackModule({
  signingSecret = process.env.SLACK_SIGNING_SECRET,
  bugsChannelId = process.env.SLACK_BUGS_CHANNEL_ID,
  dashboardBaseUrl = process.env.REPLAYX_DASHBOARD_URL,
  goldenIncidentId = process.env.REPLAYX_GOLDEN_INCIDENT_ID,
  orchestratorBaseUrl = process.env.REPLAYX_ORCHESTRATOR_URL,
  internalApiToken = process.env.REPLAYX_INTERNAL_API_TOKEN,
  slackService,
  slackClient,
  replayXClient,
  logger,
  now = Date.now,
} = {}) {
  const effectiveLogger = createLogger(logger);
  const effectiveSlackClient =
    slackClient || new SlackClient({ botToken: process.env.SLACK_BOT_TOKEN });
  const effectiveReplayXClient =
    replayXClient ||
    new ReplayXClient({
      baseUrl: orchestratorBaseUrl,
      internalApiToken,
    });
  const effectiveSlackService =
    slackService ||
    createSlackService({
      slackClient: effectiveSlackClient,
      bugsChannelId,
      dashboardBaseUrl,
      goldenIncidentId,
      replayXClient: effectiveReplayXClient,
      logger: effectiveLogger,
    });
  const controller = createSlackController({
    slackService: effectiveSlackService,
    bugsChannelId,
    logger: effectiveLogger,
  });

  return {
    eventsRouter: createSlackEventsRouter({
      controller,
      logger: effectiveLogger,
      signingSecret,
      now,
    }),
    apiRouter: createSlackApiRouter({ controller, internalApiToken }),
  };
}

module.exports = {
  createSlackModule,
};
