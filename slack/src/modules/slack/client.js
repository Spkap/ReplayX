class SlackApiError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "SlackApiError";
    this.details = details;
  }
}

class SlackClient {
  constructor({ botToken, fetchImpl = fetch }) {
    this.botToken = botToken;
    this.fetchImpl = fetchImpl;
  }

  async postMessage({ channel, text, threadTs, blocks }) {
    if (!this.botToken) {
      throw new SlackApiError("Missing SLACK_BOT_TOKEN");
    }

    const payload = { channel, text };

    if (threadTs) {
      payload.thread_ts = threadTs;
    }

    if (blocks) {
      payload.blocks = blocks;
    }

    const response = await this.fetchImpl("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    let result;

    try {
      result = await response.json();
    } catch (error) {
      throw new SlackApiError("Slack chat.postMessage returned a non-JSON response", {
        status: response.status,
        parseError: error instanceof Error ? error.message : "Unknown JSON parse error",
      });
    }

    if (!response.ok || !result.ok) {
      throw new SlackApiError("Slack chat.postMessage failed", {
        status: response.status,
        slackError: result.error,
      });
    }

    return result;
  }
}

module.exports = {
  SlackApiError,
  SlackClient,
};
