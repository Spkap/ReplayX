function stripMentionPrefix(text = "") {
  return text.replace(/^<@[^>]+>\s*/, "").trim();
}

const { createHmac } = require("node:crypto");

const ACCESS_TTL_MS = 1000 * 60 * 60 * 12;

function normalizeBaseUrl(url) {
  return typeof url === "string" ? url.trim().replace(/\/+$/, "") : "";
}

function buildNewRunPath() {
  return "/new";
}

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signValue(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function buildControlPlaneAccessToken(internalApiToken) {
  if (!internalApiToken) {
    return null;
  }

  const encodedPayload = base64UrlEncode(JSON.stringify({
    scope: "control-plane",
    exp: Date.now() + ACCESS_TTL_MS,
  }));
  return `${encodedPayload}.${signValue(encodedPayload, internalApiToken)}`;
}

function appendAccessToken(path, accessToken) {
  if (!accessToken) {
    return path;
  }

  return `${path}${path.includes("?") ? "&" : "?"}access=${encodeURIComponent(accessToken)}`;
}

function buildHandoffTarget({ dashboardBaseUrl, internalApiToken }) {
  const newRunPath = appendAccessToken(buildNewRunPath(), buildControlPlaneAccessToken(internalApiToken));
  const normalizedBaseUrl = normalizeBaseUrl(dashboardBaseUrl);

  return normalizedBaseUrl ? `${normalizedBaseUrl}${newRunPath}` : newRunPath;
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

function buildAppMentionReply({ cleanedText, handoffTarget, runId, degradedReason }) {
  const bugSummary = cleanedText || "No bug details were included.";
  const runLine = runId
    ? `ReplayX started live orchestration run \`${runId}\`.`
    : degradedReason
      ? `Live run not started: ${degradedReason}`
      : "Live run not started: ReplayX orchestration API is not configured for this Slack service.";

  return [
    `ReplayX logged this bug report: ${bugSummary}`,
    runLine,
    `Dashboard handoff: ${handoffTarget}`,
  ].join("\n");
}

function buildActionBlocks({
  runId,
  workspaceId,
  dashboardBaseUrl,
  approvalPending,
  canRetry = false,
  actionPaths,
  workspaceTargetOverride,
}) {
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
  } else if (canRetry) {
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
  internalApiToken,
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
      let incidentId;
      let approvalPending = false;
      let canRetry = false;
      let actionPaths;
      let degradedReason;
      const threadTs = event.thread_ts || event.ts;
      let handoffTarget = buildHandoffTarget({
        dashboardBaseUrl,
        internalApiToken,
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
          incidentId = runResult.run?.incidentId;
          actionPaths = runResult.actionPaths;
          approvalPending = Boolean(runResult.run?.approvals?.some((approval) => approval.status === "pending"));
          canRetry = Boolean(
            runResult.run &&
              ["resolved_to_pr", "blocked", "failed", "cancelled"].includes(runResult.run.status) &&
              !runResult.run.archivedAt
          );
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
          degradedReason = "ReplayX orchestration failed before a live run could be created.";
        }
      }

      const replyText = buildAppMentionReply({
        cleanedText,
        handoffTarget,
        runId,
        degradedReason,
      });
      const blocks = buildActionBlocks({
        runId,
        workspaceId,
        dashboardBaseUrl,
        approvalPending,
        canRetry,
        actionPaths,
        workspaceTargetOverride: handoffTarget,
      });

      logger.info("slack.app_mention.reply.attempt", {
        channel: event.channel,
        threadTs,
        cleanedTextLength: cleanedText.length,
        runId,
        handoffTarget,
        degradedReason,
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
        incidentId,
        runId,
        handoffTarget,
        degradedReason,
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
  buildAppMentionReply,
  buildLiveHandoffTarget,
  buildWorkspaceTarget,
  buildHandoffTarget,
  buildControlPlaneAccessToken,
  buildNewRunPath,
  createSlackService,
};
