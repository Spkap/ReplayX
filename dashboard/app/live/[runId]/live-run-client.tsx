"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { ReplayXLiveRun } from "../../../lib/live-runs";
import type { ControlPlaneErrorPayload } from "../../../lib/control-plane-errors";
import {
  AppFrame,
  CommandBlock,
  EmptyState,
  MetricCell,
  StatusPill
} from "../../../components/replayx-ui";

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

const isTabId = (value: string | null | undefined): value is TabId =>
  value === "overview" ||
  value === "timeline" ||
  value === "evidence" ||
  value === "diagnosis" ||
  value === "patch" ||
  value === "validation" ||
  value === "resolution" ||
  value === "memory";

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const formatDurationMs = (value: number | null): string =>
  value === null ? "n/a" : value < 1000 ? `${value}ms` : `${(value / 1000).toFixed(1)}s`;

const isTerminalStatus = (status: string): boolean =>
  status === "resolved_to_pr" || status === "blocked" || status === "failed" || status === "cancelled";

const buildAccessPath = (pathname: string, accessToken: string | null | undefined): string =>
  accessToken
    ? `${pathname}${pathname.includes("?") ? "&" : "?"}access=${encodeURIComponent(accessToken)}`
    : pathname;

const statusTone = (status: string): "danger" | "neutral" | "success" | "warning" => {
  if (status === "resolved_to_pr" || status === "passed" || status === "validated" || status === "accepted") {
    return "success";
  }
  if (status === "completed" || status === "approved") {
    return "success";
  }
  if (status === "blocked" || status === "failed" || status === "cancelled") {
    return "danger";
  }
  if (status === "queued" || status === "info") {
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
  return <StatusPill tone={statusTone(status)}>{status.replaceAll("_", " ")}</StatusPill>;
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
      <div className="evidence-head">
        <div>
          <span className="eyebrow">{kicker}</span>
          <h2>{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </article>
  );
}

function EvidenceLedger({
  run,
  limit,
  artifactHref
}: {
  run: ReplayXLiveRun;
  limit?: number;
  artifactHref: (artifactId: "preview" | "diff" | "postmortem" | "skill") => string;
}) {
  const evidenceItems = [...run.evidence].reverse().slice(0, limit);

  if (evidenceItems.length === 0) {
    return (
      <EmptyState
        title="No evidence logged yet"
        body="ReplayX will attach commands, artifacts, and operator gates as the run progresses."
      />
    );
  }

  return (
    <div className="evidence-ledger">
      {evidenceItems.map((item) => (
        <article className="evidence-row" key={item.id}>
          <div className="evidence-status">
            <StatusBadge status={item.status} />
            <span>{item.kind}</span>
          </div>
          <div className="evidence-main">
            <div className="evidence-head">
              <strong>{item.label}</strong>
              <span>{item.phaseId ?? "run"}</span>
            </div>
            <p>{item.summary}</p>
            {item.command ? <pre className="inline-command">{item.command}</pre> : null}
          </div>
          <div className="evidence-proof">
            {item.command ? (
              <>
                <span>exit {item.exitCode ?? "n/a"}</span>
                <span>{formatDurationMs(item.durationMs)}</span>
              </>
            ) : null}
            {item.artifactId ? (
              <Link className="ghost-link evidence-link" href={artifactHref(item.artifactId)}>
                Open {item.artifactId}
              </Link>
            ) : item.artifactPath ? (
              <span>{item.artifactPath}</span>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function DecisionLedger({ run, limit }: { run: ReplayXLiveRun; limit?: number }) {
  const decisions = [...run.decisions].reverse().slice(0, limit);

  if (decisions.length === 0) {
    return <EmptyState title="No decision ledger yet" body="Accepted, rejected, and blocked decisions will appear here." />;
  }

  return (
    <div className="decision-ledger">
      {decisions.map((decision) => (
        <article className="decision-row" key={decision.id}>
          <div className="evidence-head">
            <div>
              <span className="eyebrow">{decision.phaseId ?? "Run decision"}</span>
              <h3>{decision.decision}</h3>
            </div>
            <StatusBadge status={decision.status} />
          </div>
          <p>{decision.rationale}</p>
          <p className="ops-meta">
            {decision.evidenceItemIds.length} evidence item{decision.evidenceItemIds.length === 1 ? "" : "s"} attached ·{" "}
            {new Date(decision.at).toLocaleString()}
          </p>
        </article>
      ))}
    </div>
  );
}

function PhaseRail({ run, limit }: { run: ReplayXLiveRun; limit?: number }) {
  const phases = typeof limit === "number" ? run.phases.slice(0, limit) : run.phases;

  return (
    <div className="phase-rail">
      {phases.map((phase) => (
        <div
          className={`phase-step phase-${phase.status}${phase.id === run.currentPhaseId ? " phase-current" : ""}`}
          key={phase.id}
        >
          <div>
            <strong>{phase.label}</strong>
            <p>{phase.summary}</p>
          </div>
          <StatusBadge status={phase.status} />
        </div>
      ))}
    </div>
  );
}

export function LiveRunClient({
  runId,
  workspaceId,
  initialRun,
  initialTab = "overview",
  accessToken,
  controlPlaneAccessToken
}: {
  runId: string;
  workspaceId?: string;
  initialRun?: ReplayXLiveRun | null;
  initialTab?: TabId;
  accessToken?: string | null;
  controlPlaneAccessToken?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [run, setRun] = useState<ReplayXLiveRun | null>(initialRun ?? null);
  const [activeRunId, setActiveRunId] = useState(runId);
  const [activeAccessToken, setActiveAccessToken] = useState<string | null>(accessToken ?? null);
  const [error, setError] = useState<ClientErrorState | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [actionError, setActionError] = useState<ClientErrorState | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionId | null>(null);

  const selectTab = (tabId: TabId) => {
    setActiveTab(tabId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabId);
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, {
      scroll: false
    });
  };

  const artifactHref = (artifactId: "preview" | "diff" | "postmortem" | "skill"): string =>
    buildAccessPath(`/runs/${encodeURIComponent(activeRunId)}/artifacts/${artifactId}`, activeAccessToken);

  const tabPanelProps = (tabId: TabId) => ({
    id: `live-panel-${tabId}`,
    role: "tabpanel" as const,
    "aria-labelledby": `live-tab-${tabId}`
  });

  const focusTab = (tabId: TabId) => {
    window.requestAnimationFrame(() => {
      document.getElementById(`live-tab-${tabId}`)?.focus();
    });
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tabId: TabId) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === tabId);
    const lastIndex = tabs.length - 1;
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
    } else if (event.key === "ArrowLeft") {
      nextIndex = currentIndex === 0 ? lastIndex : currentIndex - 1;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = lastIndex;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex].id;
    selectTab(nextTab);
    focusTab(nextTab);
  };

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
    if (pendingAction) {
      return;
    }

    const confirmationByAction: Partial<Record<ActionId, string>> = {
      archive: "Archive this completed run? It will leave the active fleet but remain readable in historical analytics.",
      cancel: "Cancel this live run now? ReplayX will stop progressing the incident workflow.",
      retry: "Retry this run from the current incident context?"
    };
    const confirmation = confirmationByAction[action];

    if (confirmation && !window.confirm(confirmation)) {
      return;
    }

    try {
      setPendingAction(action);
      const result = await postAction(activeRunId, action, activeAccessToken);
      setRun(result.run);
      setActiveRunId(result.run.runId);
      setActiveAccessToken(result.accessToken);
      setActionError(null);
    } catch (nextError) {
      setActionError(normalizeClientError(nextError, "Unable to complete the action."));
    } finally {
      setPendingAction(null);
    }
  };

  const loadingHomePath = buildAccessPath("/", controlPlaneAccessToken);
  const loadingNavItems = [
    { href: loadingHomePath, label: "Proof", shortLabel: "PF" },
    { href: buildAccessPath("/new", controlPlaneAccessToken), label: "New run", shortLabel: "NR" },
    { href: buildAccessPath("/ops", controlPlaneAccessToken), label: "Ops", shortLabel: "OP" },
    { href: buildAccessPath("/analytics", controlPlaneAccessToken), label: "Analytics", shortLabel: "AN" }
  ];

  if (error && !run) {
    return (
      <AppFrame active="live" homePath={loadingHomePath} navItems={loadingNavItems} statusDetail="Waiting for run">
        <article className="workspace-panel">
          <span className="eyebrow">Waiting for run</span>
          <h2>Run status is not available yet</h2>
          <p>{error.error}</p>
          <p className="ghost-text">{error.cause}</p>
          <div className="rail-actions" style={{ marginTop: "1rem" }}>
            <Link className="ghost-link" href={error.docsPath}>
              Open troubleshooting guide
            </Link>
          </div>
        </article>
      </AppFrame>
    );
  }

  if (!run) {
    return (
      <AppFrame active="live" homePath={loadingHomePath} navItems={loadingNavItems} statusDetail="Connecting">
        <EmptyState title="Connecting to ReplayX run" body={`Run id: ${runId}`} />
      </AppFrame>
    );
  }

  const activeWorkspaceId = workspaceId ?? run.workspaceId;
  const homePath = buildAccessPath("/", controlPlaneAccessToken);
  const opsPath = controlPlaneAccessToken ? buildAccessPath("/ops", controlPlaneAccessToken) : null;
  const analyticsPath = controlPlaneAccessToken
    ? buildAccessPath("/analytics", controlPlaneAccessToken)
    : null;
  const navItems = [
    { href: homePath, label: "Proof", shortLabel: "PF" },
    { href: buildAccessPath("/new", controlPlaneAccessToken), label: "New run", shortLabel: "NR" },
    { href: opsPath ?? homePath, label: "Ops", shortLabel: "OP" },
    { href: analyticsPath ?? homePath, label: "Analytics", shortLabel: "AN" }
  ];

  return (
    <AppFrame active="live" homePath={homePath} navItems={navItems} statusDetail={run.status.replaceAll("_", " ")}>
      <header className="compact-header">
        <div>
          <span className="eyebrow">Incident workspace</span>
          <p className="lead">Current state, proof ledger, active blocker, and route to resolution.</p>
        </div>
        <div className="header-actions">
          <StatusBadge status={run.status} />
          {opsPath && analyticsPath ? (
            <>
              <Link className="button button-secondary" href={opsPath}>
                Ops
              </Link>
              <Link className="button button-secondary" href={analyticsPath}>
                Analytics
              </Link>
            </>
          ) : null}
        </div>
      </header>

      <section className="workspace-grid fade-in">
        <div className="workspace-main">
          <article className="dark-panel incident-hero">
            <div className="proof-title">
              <div>
                <span className="eyebrow">Live incident</span>
                <h1>{run.issue.text}</h1>
              </div>
              <StatusBadge status={run.status} />
            </div>
            <div className="metric-grid">
              <MetricCell label="Mode" value={run.executionMode} />
              <MetricCell label="Capability" value={run.capability.status.replaceAll("_", " ")} />
              <MetricCell label="Workspace" value={activeWorkspaceId} />
              <MetricCell label="Repo" value={run.repoTarget} />
              <MetricCell label="Service" value={run.serviceTarget} />
              <MetricCell label="Environment" value={run.environmentTarget} />
              <MetricCell label="Owner" value={run.owner} />
              <MetricCell label="Blocker" value={run.currentBlocker ?? "None"} />
            </div>
            {actionError ? (
              <div className="rail-note">
                <p>{actionError.error}</p>
                <p>{actionError.fix}</p>
                <Link className="ghost-link" href={actionError.docsPath}>
                  Open troubleshooting guide
                </Link>
              </div>
            ) : null}
          </article>

          <div className="tab-strip" role="tablist" aria-label="Live run sections">
            {tabs.map((tab) => (
              <button
                aria-controls={`live-panel-${tab.id}`}
                aria-selected={activeTab === tab.id}
                id={`live-tab-${tab.id}`}
                key={tab.id}
                className={`tab-button${activeTab === tab.id ? " tab-button-active" : ""}`}
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                onClick={() => selectTab(tab.id)}
                role="tab"
                tabIndex={activeTab === tab.id ? 0 : -1}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" ? (
            <section className="workspace-section" {...tabPanelProps("overview")}>
              <div className="metric-strip">
                <MetricCell label="Mode" value={run.executionMode} />
                <MetricCell label="Capability" value={run.capability.status.replaceAll("_", " ")} />
                <MetricCell label="Winning diagnosis" value={run.cards.winningDiagnosis.worker || "Pending"} />
                <MetricCell label="Confidence" value={formatPercent(run.cards.winningDiagnosis.confidence)} />
                <MetricCell label="PR status" value={run.pullRequest.status.replaceAll("_", " ")} />
                <MetricCell label="Evidence" value={`${run.evidence.length} items`} />
                <MetricCell label="Decisions" value={`${run.decisions.length} logged`} />
                <MetricCell label="Memory" value={run.cards.skill.path !== "pending" ? "Promoted" : "Pending"} />
              </div>
              <WorkspacePanel title="Proof ledger" kicker="Evidence-backed replay">
                <EvidenceLedger run={run} limit={4} artifactHref={artifactHref} />
              </WorkspacePanel>
              <WorkspacePanel title="Decision ledger" kicker="Why ReplayX moved forward">
                <DecisionLedger run={run} limit={3} />
              </WorkspacePanel>
              <WorkspacePanel title="What ReplayX thinks is happening" kicker="Diagnosis">
                <p>{run.cards.winningDiagnosis.diagnosis}</p>
                <p className="ops-meta">Why it won: {run.cards.winningDiagnosis.winning_reason}</p>
              </WorkspacePanel>
              <WorkspacePanel title="What ReplayX ruled out" kicker="Rejected theories">
                {run.cards.workerCards.filter((worker) => worker.worker !== run.cards.winningDiagnosis.worker).length > 0 ? (
                  <ul className="bullet-list">
                    {run.cards.workerCards
                      .filter((worker) => worker.worker !== run.cards.winningDiagnosis.worker)
                      .map((worker) => (
                        <li key={worker.worker}>
                          {worker.worker}: {worker.diagnosis}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p>ReplayX has not logged defeated theories yet.</p>
                )}
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
            <section className="workspace-section timeline-stack" {...tabPanelProps("timeline")}>
              {run.events.map((event) => (
                <article className="timeline-item" key={event.id}>
                  <div className="evidence-head">
                    <div>
                      <span className="eyebrow">{event.title}</span>
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
            <section className="workspace-section" {...tabPanelProps("evidence")}>
              <WorkspacePanel title="Evidence ledger" kicker="Commands, artifacts, gates">
                <EvidenceLedger run={run} artifactHref={artifactHref} />
              </WorkspacePanel>
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
            <section className="workspace-section worker-cluster" {...tabPanelProps("diagnosis")}>
              {run.cards.workerCards.length > 0 ? (
                run.cards.workerCards.map((worker) => (
                  <article className="workspace-panel worker-tile" key={worker.worker}>
                    <div className="evidence-head">
                      <div>
                        <span className="eyebrow">{worker.specialty}</span>
                        <h3>{worker.worker}</h3>
                      </div>
                      <StatusBadge status={worker.status} />
                    </div>
                    <p>{worker.diagnosis}</p>
                    <p className="ops-meta">Confidence · {formatPercent(worker.confidence)}</p>
                  </article>
                ))
              ) : (
                <EmptyState
                  title="Workers warming up"
                  body="Diagnosis cards appear as bounded agents gather evidence."
                />
              )}
            </section>
          ) : null}

          {activeTab === "patch" ? (
            <section className="workspace-section" {...tabPanelProps("patch")}>
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
            <section className="workspace-section" {...tabPanelProps("validation")}>
              <WorkspacePanel title={run.cards.proof.review_verdict} kicker="Validation summary">
                <p>{run.cards.proof.regression_summary}</p>
                {run.cards.proof.regression_command && (
                  <CommandBlock>{run.cards.proof.regression_command}</CommandBlock>
                )}
              </WorkspacePanel>
            </section>
          ) : null}

          {activeTab === "resolution" ? (
            <section className="workspace-section" {...tabPanelProps("resolution")}>
              <WorkspacePanel title={run.pullRequest.title ?? "PR not ready"} kicker="PR / resolution">
                <p>{run.pullRequest.summary ?? "ReplayX has not produced a PR-ready bundle yet."}</p>
                <ul className="bullet-list" style={{ marginTop: "1rem" }}>
                  <li>Branch · {run.pullRequest.branchName ?? "pending"}</li>
                  <li>Rollback · {run.pullRequest.rollbackNote ?? "pending"}</li>
                </ul>
                <div className="rail-actions" style={{ marginTop: "1rem" }}>
                  {run.pullRequest.url ? (
                    <Link className="ghost-link" href={run.pullRequest.url} target="_blank" rel="noreferrer">
                      Open pull request
                    </Link>
                  ) : null}
                  {run.pullRequest.previewPath ? (
                    <Link className="ghost-link" href={artifactHref("preview")}>
                      Open PR preview
                    </Link>
                  ) : null}
                  {run.pullRequest.diffPath ? (
                    <Link className="ghost-link" href={artifactHref("diff")}>
                      Open diff
                    </Link>
                  ) : null}
                  {run.cards.postmortem.path !== "pending" ? (
                    <Link className="ghost-link" href={artifactHref("postmortem")}>
                      Open postmortem
                    </Link>
                  ) : null}
                  {run.cards.skill.path !== "pending" ? (
                    <Link className="ghost-link" href={artifactHref("skill")}>
                      Open skill
                    </Link>
                  ) : null}
                </div>
              </WorkspacePanel>
            </section>
          ) : null}

          {activeTab === "memory" ? (
            <section className="workspace-section" {...tabPanelProps("memory")}>
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
              <span className="eyebrow">Next action</span>
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
            <div className="decision-callout">
              <p>{nextActionSummary(run)}</p>
            </div>
            <div className="rail-actions">
              {run.approvals.some((approval) => approval.status === "pending") ? (
                <button className="button button-primary" disabled={pendingAction !== null} onClick={() => void handleAction("approve")} type="button">
                  {pendingAction === "approve" ? "Approving..." : "Approve next action"}
                </button>
              ) : null}
              {!isTerminalStatus(run.status) ? (
                <button className="button button-secondary" disabled={pendingAction !== null} onClick={() => void handleAction("cancel")} type="button">
                  {pendingAction === "cancel" ? "Cancelling..." : "Cancel run"}
                </button>
              ) : null}
              {isTerminalStatus(run.status) && !run.archivedAt ? (
                <button className="button button-secondary" disabled={pendingAction !== null} onClick={() => void handleAction("archive")} type="button">
                  {pendingAction === "archive" ? "Archiving..." : "Archive run"}
                </button>
              ) : null}
              {isTerminalStatus(run.status) && !run.archivedAt ? (
                <button className="button button-secondary" disabled={pendingAction !== null} onClick={() => void handleAction("retry")} type="button">
                  {pendingAction === "retry" ? "Retrying..." : "Retry run"}
                </button>
              ) : null}
            </div>
          </article>

          <article className="workspace-rail">
            <span className="eyebrow">Run phases</span>
            <PhaseRail run={run} />
          </article>

          <article className="workspace-rail">
            <span className="eyebrow">Fast facts</span>
            <div className="rail-note">
              Run · {run.runId}
            </div>
            <div className="rail-note">
              Status · {run.status.replaceAll("_", " ")}
            </div>
            <div className="rail-note">
              Evidence · {run.evidence.length} records, {run.decisions.length} decisions
            </div>
            <div className="rail-note">
              PR ·{" "}
              {run.pullRequest.url ? (
                <Link className="ghost-link" href={run.pullRequest.url} target="_blank" rel="noreferrer">
                  Open pull request
                </Link>
              ) : run.pullRequest.previewPath ? (
                <Link className="ghost-link" href={artifactHref("preview")}>
                  Open PR preview
                </Link>
              ) : (
                "pending"
              )}
            </div>
            {run.archivedAt ? (
              <div className="rail-note">
                Archived · {new Date(run.archivedAt).toLocaleString()}
              </div>
            ) : null}
          </article>
        </aside>
      </section>
    </AppFrame>
  );
}
