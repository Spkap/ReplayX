function normalizeBaseUrl(url) {
  return typeof url === "string" ? url.trim().replace(/\/+$/, "") : "";
}

class ReplayXClient {
  constructor({ baseUrl, internalApiToken, fetchImpl = fetch }) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.internalApiToken = internalApiToken;
    this.fetchImpl = fetchImpl;
  }

  isConfigured() {
    return Boolean(this.baseUrl);
  }

  async createRun({ text, channel, threadTs, user }) {
    if (!this.isConfigured()) {
      const error = new Error("ReplayX orchestrator URL is not configured");
      error.code = "replayx_not_configured";
      throw error;
    }

    const headers = {
      "Content-Type": "application/json",
    };

    if (this.internalApiToken) {
      headers.Authorization = `Bearer ${this.internalApiToken}`;
    }

    const response = await this.fetchImpl(`${this.baseUrl}/api/replayx/runs`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: "slack",
        text,
        channel,
        threadTs,
        user,
      }),
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(body.error || `ReplayX API returned ${response.status}`);
      error.statusCode = response.status;
      error.details = body;
      throw error;
    }

    return body;
  }

  async getRun(runId) {
    if (!this.isConfigured()) {
      const error = new Error("ReplayX orchestrator URL is not configured");
      error.code = "replayx_not_configured";
      throw error;
    }

    const headers = {};

    if (this.internalApiToken) {
      headers.Authorization = `Bearer ${this.internalApiToken}`;
    }

    const response = await this.fetchImpl(`${this.baseUrl}/api/runs/${encodeURIComponent(runId)}`, {
      method: "GET",
      headers,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(body.error || `ReplayX API returned ${response.status}`);
      error.statusCode = response.status;
      error.details = body;
      throw error;
    }

    return body;
  }
}

module.exports = {
  ReplayXClient,
  normalizeBaseUrl,
};
