"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { ReplayXLiveRun } from "../../../lib/live-runs";
import type { ControlPlaneErrorPayload } from "../../../lib/control-plane-errors";

type LiveRunResponse = {
  ok: boolean;
  run: ReplayXLiveRun;
};

type ClientErrorState = ControlPlaneErrorPayload & {
  technicalDetail?: string | null;
};

type LiveRunStreamResponse =
  | {
      ok: true;
      run: ReplayXLiveRun;
    }
  | {
      ok: false;
      error: string;
      cause?: string;
      fix?: string;
      docsPath?: string;
    };

type ActionId = "approve" | "retry" | "cancel" | "archive";
type TabId = "overview" | "timeline" | "evidence" | "diagnosis" | "patch" | "validation" | "resolution" | "memory";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "evidence", label: "Evidence" },
  { id: "diagnosis", label: "Diagnosis" },
  { id: "patch", label: "Patch" },
  { id: "validation", label: "Validation" },
  { id: "resolution", label: "PR / Resolution" },
  { id: "memory", label: "Memory" }
];

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const isTerminalStatus = (status: string): boolean =>
  status === "resolved_to_pr" || status === "blocked" || status === "failed" || status === "cancelled";

const buildAccessPath = (pathname: string, accessToken: string | null | undefined): string =>
  accessToken
    ? `${pathname}${pathname.includes("?") ? "&" : "?"}access=${encodeURIComponent(accessToken)}`
    : pathname;

const statusTone = (status: string): "danger" | "neutral" | "success" | "warning" => {
  if (status === "resolved_to_pr") {
    return "success";
  }
  if (status === "blocked" || status === "failed" || status === "cancelled") {
    return "danger";
  }
  if (status === "queued") {
    return "neutral";
  }
  return "warning";
};

const nextActionSummary = (run: ReplayXLiveRun): string => {
  if (run.archivedAt) {
    return "This run is archived. ReplayX removed it from the active fleet while preserving the full incident record and historical analytics.";
  }

  if (run.currentBlocker) {
    return run.currentBlocker;
  }

  if (run.approvals.some((approval) => approval.status === "pending")) {
    return "An operator must approve the next action before ReplayX can continue.";
  }

  if (run.status === "resolved_to_pr") {
    return run.pullRequest.url
      ? "ReplayX validated the patch, opened the pull request, and promoted the incident memory."
      : "ReplayX validated the patch, prepared a PR-ready bundle, and promoted the incident memory.";
  }

  if (run.status === "cancelled") {
    return "The run was cancelled before ReplayX could finish the resolution workflow.";
  }

  if (run.status === "failed") {
    return "ReplayX hit an execution failure before it could finish the resolution workflow.";
  }

  if (run.status === "blocked") {
    return "ReplayX needs operator help to unblock the next step in the resolution workflow.";
  }

  return "ReplayX is progressing through the bounded execution loop.";
};

const normalizeClientError = (
  error: unknown,
  fallback: string
): ClientErrorState => {
  if (typeof error === "object" && error !== null && "error" in error) {
    const payload = error as Partial<ControlPlaneErrorPayload> & { technicalDetail?: string | null };
    return {
      error: payload.error ?? fallback,
      cause: payload.cause ?? "ReplayX returned an incomplete error payload.",
      fix: payload.fix ?? "Retry the action. If it repeats, open the troubleshooting guide.",
      docsPath: payload.docsPath ?? "/help/troubleshooting",
      technicalDetail: payload.technicalDetail ?? null
    };
  }

  if (error instanceof Error) {
    return {
      error: fallback,
      cause: "The request failed before ReplayX returned structured details.",
      fix: "Retry the action. If it repeats, open the troubleshooting guide.",
      docsPath: "/help/troubleshooting",
      technicalDetail: error.message
    };
  }

  return {
    error: fallback,
    cause: "ReplayX returned an unknown client-side failure.",
    fix: "Retry the action. If it repeats, open the troubleshooting guide.",
    docsPath: "/help/troubleshooting",
    technicalDetail: null
  };
};

function StatusBadge({ status }: { status: string }) {
  return <span className={`pill pill-${statusTone(status)}`}>{status.replaceAll("_", " ")}</span>;
}

async function postAction(
  runId: string,
  action: ActionId,
  accessToken?: string | null
): Promise<{ run: ReplayXLiveRun; accessToken: string | null; workspacePath: string | null }> {
  const response = await fetch(buildAccessPath(`/api/runs/${encodeURIComponent(runId)}/actions/${action}`, accessToken), {
    method: "POST"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ControlPlaneErrorPayload | null;
    throw payload ?? { error: `Action ${action} failed with status ${response.status}` };
  }

  const payload = (await response.json()) as {
    ok: boolean;
    run: ReplayXLiveRun;
    accessToken?: string | null;
    workspacePath?: string | null;
  };
  return {
    run: payload.run,
    accessToken: payload.accessToken ?? null,
    workspacePath: payload.workspacePath ?? null
  };
}

function WorkspacePanel({
  title,
  kicker,
  children,
  aside
}: {
  title: string;
  kicker: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <article className="workspace-panel">
      <div className="timeline-item-head">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </article>
  );
}

export function LiveRunClient({
  runId,
  workspaceId,
  initialRun,
  accessToken,
  controlPlaneAccessToken
}: {
  runId: string;
  workspaceId?: string;
  initialRun?: ReplayXLiveRun | null;
  accessToken?: string | null;
  controlPlaneAccessToken?: string | null;
}) {
  const [run, setRun] = useState<ReplayXLiveRun | null>(initialRun ?? null);
  const [activeRunId, setActiveRunId] = useState(runId);
  const [activeAccessToken, setActiveAccessToken] = useState<string | null>(accessToken ?? null);
  const [error, setError] = useState<ClientErrorState | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [actionError, setActionError] = useState<ClientErrorState | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let eventSource: EventSource | null = null;
    let webSocket: WebSocket | null = null;

    const load = async () => {
      try {
        const search = activeAccessToken ? `?access=${encodeURIComponent(activeAccessToken)}` : "";
        const response = await fetch(`/api/runs/${encodeURIComponent(activeRunId)}${search}`, {
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error(`Run API returned ${response.status}`);
        }

        const data = (await response.json()) as LiveRunResponse;

        if (cancelled) {
          return;
        }

        setRun(data.run);
        setError(null);

        if (!isTerminalStatus(data.run.status)) {
          timer = setTimeout(load, 2000);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(normalizeClientError(loadError, "Unable to load the ReplayX run."));
          timer = setTimeout(load, 3000);
        }
      }
    };

    const startPolling = () => {
      if (!cancelled) {
        void load();
      }
    };

    const startSseFallback = () => {
      const search = activeAccessToken ? `?access=${encodeURIComponent(activeAccessToken)}` : "";
      eventSource = new EventSource(`/api/replayx/runs/${encodeURIComponent(activeRunId)}/events${search}`);

      eventSource.onmessage = (event) => {
        if (cancelled) {
          return;
        }

        try {
          const payload = JSON.parse(event.data) as LiveRunStreamResponse;

          if (!payload.ok) {
            setError(normalizeClientError(payload, "ReplayX could not stream the live run."));
            return;
          }

          setRun(payload.run);
          setError(null);

          if (isTerminalStatus(payload.run.status)) {
            eventSource?.close();
          }
        } catch {
          setError(
            normalizeClientError(
              { error: "Received invalid run stream payload." },
              "ReplayX returned an unreadable live update."
            )
          );
        }
      };

      eventSource.onerror = () => {
        if (!cancelled) {
          eventSource?.close();
          startPolling();
        }
      };
    };

    const connectStream = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const search = activeAccessToken ? `?access=${encodeURIComponent(activeAccessToken)}` : "";
      const socketUrl = `${protocol}//${window.location.host}/api/replayx/runs/${encodeURIComponent(activeRunId)}/ws${search}`;
      webSocket = new WebSocket(socketUrl);

      webSocket.onmessage = (event) => {
        if (cancelled) {
          return;
        }

        try {
          const payload = JSON.parse(String(event.data)) as LiveRunStreamResponse;

          if (!payload.ok) {
            setError(normalizeClientError(payload, "ReplayX could not stream the live run."));
            return;
          }

          setRun(payload.run);
          setError(null);

          if (isTerminalStatus(payload.run.status)) {
            webSocket?.close();
          }
        } catch {
          setError(
            normalizeClientError(
              { error: "Received invalid websocket payload." },
              "ReplayX returned an unreadable live update."
            )
          );
        }
      };

      webSocket.onerror = () => {
        if (!cancelled) {
          webSocket?.close();
          startSseFallback();
        }
      };

      webSocket.onclose = () => {
        if (!cancelled && !(run && isTerminalStatus(run.status))) {
          startPolling();
        }
      };
    };

    connectStream();

    return () => {
      cancelled = true;
      webSocket?.close();
      eventSource?.close();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [activeAccessToken, activeRunId, run?.status]);

  const handleAction = async (action: ActionId) => {
    try {
      const result = await postAction(activeRunId, action, activeAccessToken);
      setRun(result.run);
      setActiveRunId(result.run.runId);
      setActiveAccessToken(result.accessToken);
      setActionError(null);
    } catch (nextError) {
      setActionError(normalizeClientError(nextError, "Unable to complete the action."));
    }
  };

  if (error && !run) {
    return (
      <main className="shell replay-shell">
        <article className="workspace-panel">
          <span className="section-kicker">Waiting for run</span>
          <h2>Run status is not available yet</h2>
          <p>{error.error}</p>
          <p className="ghost-text">{error.cause}</p>
          <div className="rail-actions" style={{ marginTop: "1rem" }}>
            <Link className="ghost-link" href={error.docsPath}>
              Open troubleshooting guide
            </Link>
          </div>
        </article>
      </main>
    );
  }

  if (!run) {
    return (
      <main className="shell replay-shell">
        <article className="workspace-panel">
          <span className="section-kicker">Loading</span>
          <h2>Connecting to ReplayX run</h2>
          <p className="ghost-text">Run id: {runId}</p>
        </article>
      </main>
    );
  }

  const activeWorkspaceId = workspaceId ?? run.workspaceId;
  const homePath = buildAccessPath("/", controlPlaneAccessToken);
  const opsPath = controlPlaneAccessToken ? buildAccessPath("/ops", controlPlaneAccessToken) : null;
  const analyticsPath = controlPlaneAccessToken
    ? buildAccessPath("/analytics", controlPlaneAccessToken)
    : null;

  return (
    <main className="shell replay-shell">
      <header className="replay-header">
        <div>
          <Link className="ghost-link" href={homePath}>
            ← Back to home
          </Link>
          <span className="eyebrow">Incident Workspace</span>
          <h1>ReplayX owns this incident</h1>
          <p className="lead">
            A live run with the current state, the active blocker, the validation story, and the exact route to resolution.
          </p>
        </div>
        {opsPath && analyticsPath ? (
          <div className="header-actions">
            <Link className="button button-secondary" href={opsPath}>
              Ops
            </Link>
            <Link className="button button-secondary" href={analyticsPath}>
              Analytics
            </Link>
          </div>
        ) : null}
      </header>

      <section className="workspace-shell fade-in">
        <div className="workspace-main">
          <article className="hero-surface workspace-hero">
            <div className="workspace-status-row">
              <div>
                <span className="section-kicker">Live incident</span>
                <h1>{run.issue.text}</h1>
              </div>
              <StatusBadge status={run.status} />
            </div>
            <div className="workspace-meta">
              <div className="ledger-item">
                <span>Workspace</span>
                <strong>{activeWorkspaceId}</strong>
              </div>
              <div className="ledger-item">
                <span>Repo</span>
                <strong>{run.repoTarget}</strong>
              </div>
              <div className="ledger-item">
                <span>Service</span>
                <strong>{run.serviceTarget}</strong>
              </div>
              <div className="ledger-item">
                <span>Environment</span>
                <strong>{run.environmentTarget}</strong>
              </div>
              <div className="ledger-item">
                <span>Owner</span>
                <strong>{run.owner}</strong>
              </div>
              <div className="ledger-item">
                <span>Current blocker</span>
                <strong>{run.currentBlocker ?? "None"}</strong>
              </div>
            </div>
            {actionError ? (
              <div style={{ color: "#ffd9cf", marginTop: "1rem" }}>
                <p>{actionError.error}</p>
                <p>{actionError.fix}</p>
                <Link className="ghost-link" href={actionError.docsPath}>
                  Open troubleshooting guide
                </Link>
              </div>
            ) : null}
          </article>

          <div className="tab-strip">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-button${activeTab === tab.id ? " tab-button-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" ? (
            <section className="workspace-section">
              <div className="metric-strip">
                <div className="metric-chip">
                  <span className="micro-label">Winning diagnosis</span>
                  <strong>{run.cards.winningDiagnosis.worker || "Pending"}</strong>
                </div>
                <div className="metric-chip">
                  <span className="micro-label">Confidence</span>
                  <strong>{formatPercent(run.cards.winningDiagnosis.confidence)}</strong>
                </div>
                <div className="metric-chip">
                  <span className="micro-label">PR status</span>
                  <strong>{run.pullRequest.status.replaceAll("_", " ")}</strong>
                </div>
                <div className="metric-chip">
                  <span className="micro-label">Memory</span>
                  <strong>{run.cards.skill.path !== "pending" ? "Promoted" : "Pending"}</strong>
                </div>
              </div>
              <WorkspacePanel title="What ReplayX thinks is happening" kicker="Diagnosis">
                <p>{run.cards.winningDiagnosis.diagnosis}</p>
                <p className="ops-meta">Why it won: {run.cards.winningDiagnosis.winning_reason}</p>
              </WorkspacePanel>
              <WorkspacePanel title="Current patch direction" kicker="Patch">
                <p>{run.cards.fix.summary}</p>
              </WorkspacePanel>
              <WorkspacePanel title="Why the product trusts this run" kicker="Validation">
                <p>{run.cards.proof.regression_summary}</p>
              </WorkspacePanel>
            </section>
          ) : null}

          {activeTab === "timeline" ? (
            <section className="workspace-section timeline-stack">
              {run.events.map((event) => (
                <article className="timeline-item" key={event.id}>
                  <div className="timeline-item-head">
                    <div>
                      <span className="section-kicker">{event.title}</span>
                      <p>{event.summary}</p>
                    </div>
                    <StatusBadge status={event.status} />
                  </div>
                  <p className="timeline-meta">
                    {event.actor} · {new Date(event.at).toLocaleString()}
                  </p>
                </article>
              ))}
            </section>
          ) : null}

          {activeTab === "evidence" ? (
            <section className="workspace-section">
              <div className="ops-grid-2">
                <WorkspacePanel title="Before" kicker="Observed failure">
                  <p>{run.cards.beforeAfter.before}</p>
                </WorkspacePanel>
                <WorkspacePanel title="After" kicker="Validated outcome">
                  <p>{run.cards.beforeAfter.after}</p>
                </WorkspacePanel>
              </div>
            </section>
          ) : null}

          {activeTab === "diagnosis" ? (
            <section className="workspace-section worker-cluster">
              {run.cards.workerCards.length > 0 ? (
                run.cards.workerCards.map((worker) => (
                  <article className="workspace-panel worker-tile" key={worker.worker}>
                    <div className="timeline-item-head">
                      <div>
                        <span className="section-kicker">{worker.specialty}</span>
                        <h3>{worker.worker}</h3>
                      </div>
                      <StatusBadge status={worker.status} />
                    </div>
                    <p>{worker.diagnosis}</p>
                    <p className="ops-meta">Confidence · {formatPercent(worker.confidence)}</p>
                  </article>
                ))
              ) : (
                <article className="workspace-panel empty-state">
                  <div>
                    <h3>Workers warming up</h3>
                    <p>Diagnosis cards appear as bounded agents gather evidence.</p>
                  </div>
                </article>
              )}
            </section>
          ) : null}

          {activeTab === "patch" ? (
            <section className="workspace-section">
              <WorkspacePanel title={run.cards.fix.strategy || "Patch pending"} kicker="Patch bundle">
                <p>{run.cards.fix.summary}</p>
                <ul className="bullet-list" style={{ marginTop: "1rem" }}>
                  {run.cards.fix.changed_files.length > 0 ? (
                    run.cards.fix.changed_files.map((file) => <li key={file}>{file}</li>)
                  ) : (
                    <li>No changed files recorded yet.</li>
                  )}
                </ul>
              </WorkspacePanel>
            </section>
          ) : null}

          {activeTab === "validation" ? (
            <section className="workspace-section">
              <WorkspacePanel title={run.cards.proof.review_verdict} kicker="Validation summary">
                <p>{run.cards.proof.regression_summary}</p>
                {run.cards.proof.regression_command && (
                  <pre className="signal-block" style={{ marginTop: "1rem" }}>
                    {run.cards.proof.regression_command}
                  </pre>
                )}
              </WorkspacePanel>
            </section>
          ) : null}

          {activeTab === "resolution" ? (
            <section className="workspace-section">
              <WorkspacePanel title={run.pullRequest.title ?? "PR not ready"} kicker="PR / resolution">
                <p>{run.pullRequest.summary ?? "ReplayX has not produced a PR-ready bundle yet."}</p>
                <ul className="bullet-list" style={{ marginTop: "1rem" }}>
                  <li>Branch · {run.pullRequest.branchName ?? "pending"}</li>
                  <li>Remote PR · {run.pullRequest.url ?? "pending"}</li>
                  <li>Preview · {run.pullRequest.previewPath ?? "pending"}</li>
                  <li>Diff · {run.pullRequest.diffPath ?? "pending"}</li>
                  <li>Rollback · {run.pullRequest.rollbackNote ?? "pending"}</li>
                </ul>
              </WorkspacePanel>
            </section>
          ) : null}

          {activeTab === "memory" ? (
            <section className="workspace-section">
              <WorkspacePanel title="Validated skill" kicker="Reusable memory">
                <p>{run.cards.skill.summary}</p>
                <p className="ops-meta">{run.cards.skill.path}</p>
              </WorkspacePanel>
            </section>
          ) : null}
        </div>

        <aside className="workspace-aside">
          <article className="workspace-rail">
            <div>
              <span className="section-kicker">Next action</span>
              <h3 style={{ marginTop: "0.9rem" }}>
                {run.archivedAt
                  ? "Run archived"
                  : run.approvals.some((approval) => approval.status === "pending")
                  ? "Approval needed"
                  : isTerminalStatus(run.status)
                    ? "Run complete"
                    : "ReplayX is still working"}
              </h3>
            </div>
            <div className="workspace-callout">
              <p>{nextActionSummary(run)}</p>
            </div>
            <div className="rail-actions">
              {run.approvals.some((approval) => approval.status === "pending") ? (
                <button className="button button-primary" onClick={() => void handleAction("approve")} type="button">
                  Approve next action
                </button>
              ) : null}
              {!isTerminalStatus(run.status) ? (
                <button className="button button-secondary" onClick={() => void handleAction("cancel")} type="button">
                  Cancel run
                </button>
              ) : null}
              {isTerminalStatus(run.status) && !run.archivedAt ? (
                <button className="button button-secondary" onClick={() => void handleAction("archive")} type="button">
                  Archive run
                </button>
              ) : null}
              {isTerminalStatus(run.status) && !run.archivedAt ? (
                <button className="button button-secondary" onClick={() => void handleAction("retry")} type="button">
                  Retry run
                </button>
              ) : null}
            </div>
          </article>

          <article className="workspace-rail">
            <span className="section-kicker">Fast facts</span>
            <div className="rail-note">
              Run · {run.runId}
            </div>
            <div className="rail-note">
              Status · {run.status.replaceAll("_", " ")}
            </div>
            <div className="rail-note">
              PR · {run.pullRequest.url ?? run.pullRequest.previewPath ?? "pending"}
            </div>
            {run.archivedAt ? (
              <div className="rail-note">
                Archived · {new Date(run.archivedAt).toLocaleString()}
              </div>
            ) : null}
          </article>
        </aside>
      </section>
    </main>
  );
}
