const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createApp } = require("../src/app/create-app");
const { createSlackSignature } = require("../src/modules/slack/signature");

const signingSecret = "test-signing-secret";
const fixedTimestamp = 1_700_000_000;
const fixedNow = () => fixedTimestamp * 1000;

function signPayload(payload) {
  const rawBody = JSON.stringify(payload);
  const signature = createSlackSignature(
    signingSecret,
    String(fixedTimestamp),
    rawBody,
  );

  return {
    rawBody,
    signature,
  };
}

function createLoggerSpy() {
  const entries = [];

  return {
    logger: {
      info(event, details) {
        entries.push({ level: "info", event, details });
      },
      warn(event, details) {
        entries.push({ level: "warn", event, details });
      },
      error(event, details) {
        entries.push({ level: "error", event, details });
      },
    },
    entries,
  };
}

test("GET /health returns ok", async () => {
  const app = createApp({
    signingSecret,
    now: fixedNow,
    slackService: {
      handleAppMention: async () => ({}),
      postMessage: async () => ({}),
    },
  });

  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true });
});

test("POST /slack/events returns plaintext challenge for url_verification", async () => {
  const payload = {
    type: "url_verification",
    challenge: "challenge-token",
  };
  const { rawBody, signature } = signPayload(payload);

  const app = createApp({
    signingSecret,
    now: fixedNow,
    slackService: {
      handleAppMention: async () => ({}),
      postMessage: async () => ({}),
    },
  });

  const response = await request(app)
    .post("/slack/events")
    .set("Content-Type", "application/json")
    .set("X-Slack-Request-Timestamp", String(fixedTimestamp))
    .set("X-Slack-Signature", signature)
    .send(rawBody);

  assert.equal(response.status, 200);
  assert.equal(response.text, "challenge-token");
  assert.equal(response.headers["content-type"], "text/plain; charset=utf-8");
});

test("POST /slack/events rejects invalid signatures", async () => {
  const { logger, entries } = createLoggerSpy();
  const app = createApp({
    signingSecret,
    now: fixedNow,
    logger,
    slackService: {
      handleAppMention: async () => ({}),
      postMessage: async () => ({}),
    },
  });

  const response = await request(app)
    .post("/slack/events")
    .set("Content-Type", "application/json")
    .set("X-Slack-Request-Timestamp", String(fixedTimestamp))
    .set("X-Slack-Signature", "v0=invalid")
    .send(JSON.stringify({ type: "url_verification", challenge: "nope" }));

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: "Invalid Slack signature" });
  assert.deepEqual(entries, [
    {
      level: "warn",
      event: "slack.signature.invalid",
      details: {
        path: "/events",
        timestamp: String(fixedTimestamp),
      },
    },
  ]);
});

test("POST /slack/events replies to app mentions in the bugs channel", async () => {
  const calls = [];
  const { logger, entries } = createLoggerSpy();
  const app = createApp({
    signingSecret,
    bugsChannelId: "CBUGS123",
    dashboardBaseUrl: "https://replayx.app",
    now: fixedNow,
    logger,
    slackClient: {
      postMessage: async (payload) => {
        calls.push(payload);
        return { posted: true, ts: "171234.200" };
      },
    },
  });

  const payload = {
    type: "event_callback",
    event: {
      type: "app_mention",
      channel: "CBUGS123",
      text: "<@UREPLAYX> app is broken",
      ts: "171234.123",
    },
  };
  const { rawBody, signature } = signPayload(payload);

  const response = await request(app)
    .post("/slack/events")
    .set("Content-Type", "application/json")
    .set("X-Slack-Request-Timestamp", String(fixedTimestamp))
    .set("X-Slack-Signature", signature)
    .send(rawBody);

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    channel: "CBUGS123",
    text: [
      "ReplayX logged this bug report: app is broken",
      "Live run not started: ReplayX orchestration API is not configured for this Slack service.",
      "Dashboard handoff: https://replayx.app/new",
    ].join("\n"),
    threadTs: "171234.123",
  });
  assert.deepEqual(response.body, {
    ok: true,
    result: {
      posted: true,
      ts: "171234.200",
      handoffTarget: "https://replayx.app/new",
    },
  });
  assert.deepEqual(entries, [
    {
      level: "info",
      event: "slack.events.received",
      details: {
        requestType: "event_callback",
        eventType: "app_mention",
        eventId: undefined,
        channel: "CBUGS123",
        user: undefined,
        ts: "171234.123",
        threadTs: undefined,
      },
    },
    {
      level: "info",
      event: "slack.app_mention.reply.attempt",
      details: {
        channel: "CBUGS123",
        threadTs: "171234.123",
        cleanedTextLength: 13,
        runId: undefined,
        handoffTarget: "https://replayx.app/new",
        degradedReason: undefined,
      },
    },
    {
      level: "info",
      event: "slack.app_mention.reply.success",
      details: {
        channel: "CBUGS123",
        threadTs: "171234.123",
        ts: "171234.200",
      },
    },
    {
      level: "info",
      event: "slack.events.completed",
      details: {
        eventType: "app_mention",
        outcome: "handled",
        reason: undefined,
      },
    },
  ]);
});

test("POST /slack/events ignores duplicate Slack event ids after a successful app mention", async () => {
  const calls = [];
  const app = createApp({
    signingSecret,
    bugsChannelId: "CBUGS123",
    now: fixedNow,
    slackClient: {
      postMessage: async (payload) => {
        calls.push(payload);
        return { posted: true };
      },
    },
  });

  const payload = {
    type: "event_callback",
    team_id: "T123",
    event_id: "Ev123",
    event: {
      type: "app_mention",
      channel: "CBUGS123",
      text: "<@UREPLAYX> app is broken",
      ts: "171234.123",
    },
  };
  const { rawBody, signature } = signPayload(payload);

  const first = await request(app)
    .post("/slack/events")
    .set("Content-Type", "application/json")
    .set("X-Slack-Request-Timestamp", String(fixedTimestamp))
    .set("X-Slack-Signature", signature)
    .send(rawBody);

  const retry = await request(app)
    .post("/slack/events")
    .set("Content-Type", "application/json")
    .set("X-Slack-Request-Timestamp", String(fixedTimestamp))
    .set("X-Slack-Signature", signature)
    .set("X-Slack-Retry-Num", "1")
    .send(rawBody);

  assert.equal(first.status, 200);
  assert.equal(retry.status, 200);
  assert.deepEqual(retry.body, { ok: true, ignored: true, reason: "duplicate_event" });
  assert.equal(calls.length, 1);
});

test("POST /slack/events signs the new-run fallback when operator auth is enabled", async () => {
  const calls = [];
  const app = createApp({
    signingSecret,
    internalApiToken: "internal-secret",
    bugsChannelId: "CBUGS123",
    dashboardBaseUrl: "https://replayx.app",
    now: fixedNow,
    slackClient: {
      postMessage: async (payload) => {
        calls.push(payload);
        return { posted: true };
      },
    },
  });

  const payload = {
    type: "event_callback",
    event: {
      type: "app_mention",
      channel: "CBUGS123",
      text: "<@UREPLAYX> app is broken",
      ts: "171234.123",
    },
  };
  const { rawBody, signature } = signPayload(payload);

  const response = await request(app)
    .post("/slack/events")
    .set("Content-Type", "application/json")
    .set("X-Slack-Request-Timestamp", String(fixedTimestamp))
    .set("X-Slack-Signature", signature)
    .send(rawBody);

  assert.equal(response.status, 200);
  assert.match(calls[0].text, /Dashboard handoff: https:\/\/replayx\.app\/new\?access=/);
  assert.doesNotMatch(calls[0].text, /\/replay\//);
  assert.match(response.body.result.handoffTarget, /^https:\/\/replayx\.app\/new\?access=/);
});

test("POST /slack/events creates a ReplayX live run when orchestrator client is configured", async () => {
  const calls = [];
  const runCalls = [];
  const app = createApp({
    signingSecret,
    bugsChannelId: "CBUGS123",
    dashboardBaseUrl: "https://dashboard.example",
    now: fixedNow,
    slackClient: {
      postMessage: async (payload) => {
        calls.push(payload);
        return { posted: true, ts: "171234.201" };
      },
    },
    replayXClient: {
      isConfigured: () => true,
      createRun: async (payload) => {
        runCalls.push(payload);
        return {
          runId: "run_live123",
          livePath: "/live/run_live123",
        };
      },
    },
  });

  const payload = {
    type: "event_callback",
    event: {
      type: "app_mention",
      channel: "CBUGS123",
      text: "<@UREPLAYX> checkout is overselling inventory",
      ts: "171234.123",
      user: "U123",
    },
  };
  const { rawBody, signature } = signPayload(payload);

  const response = await request(app)
    .post("/slack/events")
    .set("Content-Type", "application/json")
    .set("X-Slack-Request-Timestamp", String(fixedTimestamp))
    .set("X-Slack-Signature", signature)
    .send(rawBody);

  assert.equal(response.status, 200);
  assert.deepEqual(runCalls[0], {
    text: "checkout is overselling inventory",
    channel: "CBUGS123",
    threadTs: "171234.123",
    user: "U123",
  });
  assert.deepEqual(calls[0], {
    channel: "CBUGS123",
    text: [
      "ReplayX logged this bug report: checkout is overselling inventory",
      "ReplayX started live orchestration run `run_live123`.",
      "Dashboard handoff: https://dashboard.example/live/run_live123",
    ].join("\n"),
    threadTs: "171234.123",
    blocks: [
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open Incident Workspace" },
            url: "https://dashboard.example/live/run_live123",
            style: "primary",
          },
        ],
      },
    ],
  });
  assert.deepEqual(response.body.result, {
    posted: true,
    ts: "171234.201",
    runId: "run_live123",
    handoffTarget: "https://dashboard.example/live/run_live123",
  });
});

test("POST /slack/events does not fall back to golden replay when live run creation fails", async () => {
  const calls = [];
  const app = createApp({
    signingSecret,
    bugsChannelId: "CBUGS123",
    dashboardBaseUrl: "https://dashboard.example",
    now: fixedNow,
    slackClient: {
      postMessage: async (payload) => {
        calls.push(payload);
        return { posted: true, ts: "171234.202" };
      },
    },
    replayXClient: {
      isConfigured: () => true,
      createRun: async () => {
        throw new Error("orchestrator unavailable");
      },
    },
  });

  const payload = {
    type: "event_callback",
    event: {
      type: "app_mention",
      channel: "CBUGS123",
      text: "<@UREPLAYX> checkout is overselling inventory",
      ts: "171234.123",
      user: "U123",
    },
  };
  const { rawBody, signature } = signPayload(payload);

  const response = await request(app)
    .post("/slack/events")
    .set("Content-Type", "application/json")
    .set("X-Slack-Request-Timestamp", String(fixedTimestamp))
    .set("X-Slack-Signature", signature)
    .send(rawBody);

  assert.equal(response.status, 200);
  assert.deepEqual(calls[0], {
    channel: "CBUGS123",
    text: [
      "ReplayX logged this bug report: checkout is overselling inventory",
      "Live run not started: ReplayX orchestration failed before a live run could be created.",
      "Dashboard handoff: https://dashboard.example/new",
    ].join("\n"),
    threadTs: "171234.123",
  });
  assert.deepEqual(response.body.result, {
    posted: true,
    ts: "171234.202",
    handoffTarget: "https://dashboard.example/new",
    degradedReason: "ReplayX orchestration failed before a live run could be created.",
  });
});

test("POST /slack/events replies in-thread when the mention came from a thread", async () => {
  const calls = [];
  const app = createApp({
    signingSecret,
    bugsChannelId: "CBUGS123",
    now: fixedNow,
    slackClient: {
      postMessage: async (payload) => {
        calls.push(payload);
        return { posted: true };
      },
    },
  });

  const payload = {
    type: "event_callback",
    event: {
      type: "app_mention",
      channel: "CBUGS123",
      text: "<@UREPLAYX> still broken in thread",
      ts: "171234.124",
      thread_ts: "171234.100",
    },
  };
  const { rawBody, signature } = signPayload(payload);

  const response = await request(app)
    .post("/slack/events")
    .set("Content-Type", "application/json")
    .set("X-Slack-Request-Timestamp", String(fixedTimestamp))
    .set("X-Slack-Signature", signature)
    .send(rawBody);

  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    channel: "CBUGS123",
    text: [
      "ReplayX logged this bug report: still broken in thread",
      "Live run not started: ReplayX orchestration API is not configured for this Slack service.",
      "Dashboard handoff: /new",
    ].join("\n"),
    threadTs: "171234.100",
  });
  assert.deepEqual(response.body, {
    ok: true,
    result: {
      posted: true,
      handoffTarget: "/new",
    },
  });
});

test("POST /api/slack/post-message posts to the default bugs channel", async () => {
  const calls = [];
  const app = createApp({
    signingSecret,
    internalApiToken: "internal-secret",
    bugsChannelId: "CBUGS123",
    now: fixedNow,
    slackService: {
      handleAppMention: async () => ({}),
      postMessage: async (payload) => {
        calls.push(payload);
        return { ok: true, channel: payload.channel, ts: "1.23" };
      },
    },
  });

  const response = await request(app)
    .post("/api/slack/post-message")
    .set("Authorization", "Bearer internal-secret")
    .send({ text: "Investigating this now" });

  assert.equal(response.status, 200);
  assert.deepEqual(calls[0], {
    channel: "CBUGS123",
    text: "Investigating this now",
    threadTs: undefined,
  });
  assert.equal(response.body.ok, true);
});

test("POST /api/slack/post-message rejects requests without the internal API token", async () => {
  const app = createApp({
    signingSecret,
    internalApiToken: "internal-secret",
    now: fixedNow,
    slackService: {
      handleAppMention: async () => ({}),
      postMessage: async () => ({}),
    },
  });

  const response = await request(app)
    .post("/api/slack/post-message")
    .send({ text: "Investigating this now" });

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: "Unauthorized" });
});

test("POST /api/slack/post-message is disabled until an internal API token is configured", async () => {
  const app = createApp({
    signingSecret,
    now: fixedNow,
    slackService: {
      handleAppMention: async () => ({}),
      postMessage: async () => ({}),
    },
  });

  const response = await request(app)
    .post("/api/slack/post-message")
    .send({ text: "Investigating this now" });

  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { error: "Internal Slack API is disabled" });
});

test("POST /api/slack/post-message validates the text field", async () => {
  const app = createApp({
    signingSecret,
    internalApiToken: "internal-secret",
    now: fixedNow,
    slackService: {
      handleAppMention: async () => ({}),
      postMessage: async () => ({}),
    },
  });

  const response = await request(app)
    .post("/api/slack/post-message")
    .set("Authorization", "Bearer internal-secret")
    .send({ channel: "CBUGS123" });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: "text is required" });
});

test("POST /slack/events logs failures from mention processing", async () => {
  const { logger, entries } = createLoggerSpy();
  const app = createApp({
    signingSecret,
    now: fixedNow,
    logger,
    slackService: {
      handleAppMention: async () => {
        throw new Error("boom");
      },
      postMessage: async () => ({}),
    },
  });

  const payload = {
    type: "event_callback",
    event: {
      type: "app_mention",
      channel: "CBUGS123",
      text: "<@UREPLAYX> app is broken",
      ts: "171234.123",
    },
  };
  const { rawBody, signature } = signPayload(payload);

  const response = await request(app)
    .post("/slack/events")
    .set("Content-Type", "application/json")
    .set("X-Slack-Request-Timestamp", String(fixedTimestamp))
    .set("X-Slack-Signature", signature)
    .send(rawBody);

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: "boom" });
  assert.deepEqual(entries, [
    {
      level: "info",
      event: "slack.events.received",
      details: {
        requestType: "event_callback",
        eventType: "app_mention",
        eventId: undefined,
        channel: "CBUGS123",
        user: undefined,
        ts: "171234.123",
        threadTs: undefined,
      },
    },
    {
      level: "error",
      event: "slack.events.failed",
      details: {
        eventType: "app_mention",
        message: "boom",
        details: undefined,
      },
    },
  ]);
});
