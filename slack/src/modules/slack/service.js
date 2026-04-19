function stripMentionPrefix(text = "") {
  return text.replace(/^<@[^>]+>\s*/, "").trim();
}

const DEFAULT_GOLDEN_INCIDENT_ID = "incident-checkout-race-001";

function normalizeBaseUrl(url) {
  return typeof url === "string" ? url.trim().replace(/\/+$/, "") : "";
}

function buildReplayPath(goldenIncidentId) {
  return `/replay/${encodeURIComponent(goldenIncidentId)}`;
}

function buildHandoffTarget({ dashboardBaseUrl, goldenIncidentId }) {
  const replayPath = buildReplayPath(goldenIncidentId);
  const normalizedBaseUrl = normalizeBaseUrl(dashboardBaseUrl);

  return normalizedBaseUrl ? `${normalizedBaseUrl}${replayPath}` : replayPath;
}

function buildLiveHandoffTarget({ dashboardBaseUrl, livePath }) {
  const normalizedBaseUrl = normalizeBaseUrl(dashboardBaseUrl);

  return normalizedBaseUrl ? `${normalizedBaseUrl}${livePath}` : livePath;
}

function buildControlPlaneActionTarget({ dashboardBaseUrl, runId, action }) {
  const normalizedBaseUrl = normalizeBaseUrl(dashboardBaseUrl);
  const actionPath = `/runs/${encodeURIComponent(runId)}/actions/${encodeURIComponent(action)}`;
  return normalizedBaseUrl ? `${normalizedBaseUrl}${actionPath}` : actionPath;
}

function buildWorkspaceTarget({ dashboardBaseUrl, workspaceId, runId }) {
  const normalizedBaseUrl = normalizeBaseUrl(dashboardBaseUrl);
  const workspacePath = `/workspaces/${encodeURIComponent(workspaceId)}/incidents/${encodeURIComponent(runId)}`;
  return normalizedBaseUrl ? `${normalizedBaseUrl}${workspacePath}` : workspacePath;
}

function buildAppMentionReply({ cleanedText, goldenIncidentId, handoffTarget, runId }) {
  const bugSummary = cleanedText || "No bug details were included.";
  const runLine = runId
    ? `ReplayX started live orchestration run \`${runId}\`.`
    : `Next: routing it into the ReplayX incident flow for \`${goldenIncidentId}\`.`;

  return [
    `ReplayX logged this bug report: ${bugSummary}`,
    runLine,
    `Dashboard handoff: ${handoffTarget}`,
  ].join("\n");
}

function buildActionBlocks({ runId, workspaceId, dashboardBaseUrl, approvalPending, actionPaths, workspaceTargetOverride }) {
  if (!runId) {
    return undefined;
  }

  const workspaceTarget = workspaceTargetOverride || buildWorkspaceTarget({
    dashboardBaseUrl,
    workspaceId: workspaceId || "workspace-default",
    runId,
  });

  const buttons = [
    {
      type: "button",
      text: { type: "plain_text", text: "Open Incident Workspace" },
      url: workspaceTarget,
      style: "primary",
    },
  ];

  if (approvalPending) {
    buttons.push(
      {
        type: "button",
        text: { type: "plain_text", text: "Approve Run" },
        url: actionPaths?.approve || buildControlPlaneActionTarget({ dashboardBaseUrl, runId, action: "approve" }),
      },
      {
        type: "button",
        text: { type: "plain_text", text: "Cancel Run" },
        url: actionPaths?.cancel || buildControlPlaneActionTarget({ dashboardBaseUrl, runId, action: "cancel" }),
        style: "danger",
      }
    );
  } else {
    buttons.push({
      type: "button",
      text: { type: "plain_text", text: "Retry Run" },
      url: actionPaths?.retry || buildControlPlaneActionTarget({ dashboardBaseUrl, runId, action: "retry" }),
    });
  }

  return [
    {
      type: "actions",
      elements: buttons,
    },
  ];
}

function createSlackService({
  slackClient,
  bugsChannelId,
  dashboardBaseUrl,
  goldenIncidentId = DEFAULT_GOLDEN_INCIDENT_ID,
  replayXClient,
  logger,
}) {
  return {
    async handleAppMention(event) {
      if (bugsChannelId && event.channel !== bugsChannelId) {
        logger.info("slack.app_mention.ignored", {
          channel: event.channel,
          expectedChannel: bugsChannelId,
          reason: "channel_not_enabled",
        });
        return { ignored: true, reason: "channel_not_enabled" };
      }

      const cleanedText = stripMentionPrefix(event.text);
      let runId;
      let workspaceId;
      let approvalPending = false;
      let actionPaths;
      const threadTs = event.thread_ts || event.ts;
      let handoffTarget = buildHandoffTarget({
        dashboardBaseUrl,
        goldenIncidentId,
      });

      if (replayXClient?.isConfigured?.()) {
        try {
          const runResult = await replayXClient.createRun({
            text: cleanedText || "No bug details were included.",
            channel: event.channel,
            threadTs,
            user: event.user,
          });
          runId = runResult.runId;
          workspaceId = runResult.run?.workspaceId;
          actionPaths = runResult.actionPaths;
          approvalPending = Boolean(runResult.run?.approvals?.some((approval) => approval.status === "pending"));
          handoffTarget = buildLiveHandoffTarget({
            dashboardBaseUrl,
            livePath:
              runResult.incidentWorkspacePath ||
              runResult.livePath ||
              `/workspaces/${encodeURIComponent(workspaceId || "workspace-default")}/incidents/${encodeURIComponent(runId)}`,
          });
          logger.info("slack.replayx_run.created", {
            channel: event.channel,
            threadTs: event.thread_ts,
            runId,
            handoffTarget,
          });
        } catch (error) {
          logger.error("slack.replayx_run.failed", {
            channel: event.channel,
            threadTs: event.thread_ts,
            message: error.message,
            details: error.details,
          });
        }
      }

      const replyText = buildAppMentionReply({
        cleanedText,
        goldenIncidentId,
        handoffTarget,
        runId,
      });
      const blocks = buildActionBlocks({
        runId,
        workspaceId,
        dashboardBaseUrl,
        approvalPending,
        actionPaths,
        workspaceTargetOverride: handoffTarget,
      });

      logger.info("slack.app_mention.reply.attempt", {
        channel: event.channel,
        threadTs,
        cleanedText,
        goldenIncidentId,
        runId,
        handoffTarget,
      });

      const result = await slackClient.postMessage({
        channel: event.channel,
        text: replyText,
        threadTs,
        ...(blocks ? { blocks } : {}),
      });

      logger.info("slack.app_mention.reply.success", {
        channel: event.channel,
        threadTs,
        ts: result?.ts,
      });

      return {
        ...result,
        incidentId: goldenIncidentId,
        runId,
        handoffTarget,
      };
    },

    async postMessage({ channel, text, threadTs, blocks }) {
      const targetChannel = channel || bugsChannelId;

      if (!targetChannel) {
        const error = new Error("A Slack channel is required.");
        error.statusCode = 400;
        throw error;
      }

      return slackClient.postMessage({
        channel: targetChannel,
        text,
        threadTs,
        ...(blocks ? { blocks } : {}),
      });
    },
  };
}

module.exports = {
  DEFAULT_GOLDEN_INCIDENT_ID,
  buildAppMentionReply,
  buildLiveHandoffTarget,
  buildWorkspaceTarget,
  buildHandoffTarget,
  createSlackService,
  buildReplayPath,
};
