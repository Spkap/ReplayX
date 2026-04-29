"use client";

import { useState } from "react";
import Link from "next/link";

import type { ReplayXLiveRun } from "../../../../../lib/live-runs";
import type { ControlPlaneErrorPayload } from "../../../../../lib/control-plane-errors";
import { AppFrame, MetricCell, PageHeader, StatusPill } from "../../../../../components/replayx-ui";

type ActionId = "approve" | "retry" | "cancel" | "archive";

type ClientErrorState = ControlPlaneErrorPayload & {
  technicalDetail?: string | null;
};

const buildAccessPath = (pathname: string, accessToken: string | null | undefined): string =>
  accessToken
    ? `${pathname}${pathname.includes("?") ? "&" : "?"}access=${encodeURIComponent(accessToken)}`
    : pathname;

const actionLabels: Record<ActionId, { title: string; summary: string; confirm: string }> = {
  approve: {
    title: "Approve this run",
    summary: "ReplayX will continue the gated workflow after operator confirmation.",
    confirm: "Approve run"
  },
  retry: {
    title: "Retry this run",
    summary: "ReplayX will create a fresh run from the saved incident context when the current run has reached a terminal state.",
    confirm: "Retry run"
  },
  cancel: {
    title: "Cancel this run",
    summary: "ReplayX will stop the workflow and preserve the current incident state.",
    confirm: "Cancel run"
  },
  archive: {
    title: "Archive this run",
    summary: "ReplayX will remove the run from the live fleet while keeping the incident workspace, audit trail, and historical analytics intact.",
    confirm: "Archive run"
  }
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

const isTerminalStatus = (status: ReplayXLiveRun["status"]): boolean =>
  status === "resolved_to_pr" || status === "blocked" || status === "failed" || status === "cancelled";

const getBlockedActionReason = (action: ActionId, run: ReplayXLiveRun): string | null => {
  if (run.archivedAt && action !== "archive") {
    return "Archived runs are read-only. Open the incident workspace to review the preserved record.";
  }

  if (action === "archive") {
    if (run.archivedAt) {
      return "This run is already archived.";
    }

    if (!isTerminalStatus(run.status)) {
      return "ReplayX can archive only terminal runs.";
    }
  }

  if (action === "retry" && !isTerminalStatus(run.status)) {
    return "ReplayX can retry only terminal runs.";
  }

  if (action === "cancel" && isTerminalStatus(run.status)) {
    return "ReplayX can cancel only active runs.";
  }

  if (action === "approve" && !run.approvals.some((approval) => approval.status === "pending")) {
    return "This run has no pending approval.";
  }

  return null;
};

export function ActionPageClient({
  action,
  run,
  accessToken,
  controlPlaneAccessToken
}: {
  action: ActionId;
  run: ReplayXLiveRun;
  accessToken: string | null;
  controlPlaneAccessToken: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ClientErrorState | null>(null);
  const [nextRun, setNextRun] = useState<ReplayXLiveRun | null>(null);
  const [nextAccessToken, setNextAccessToken] = useState<string | null>(accessToken);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const copy = actionLabels[action];
  const activeRun = nextRun ?? run;
  const blockedActionReason = getBlockedActionReason(action, activeRun);
  const incidentWorkspacePath =
    workspacePath ??
    buildAccessPath(`/workspaces/${activeRun.workspaceId}/incidents/${activeRun.runId}`, nextAccessToken);
  const opsPath = controlPlaneAccessToken ? buildAccessPath("/ops", controlPlaneAccessToken) : null;

  const handleConfirm = async () => {
    if (blockedActionReason) {
      setError(
        normalizeClientError(
          { error: blockedActionReason },
          blockedActionReason
        )
      );
      return;
    }

    setPending(true);
    setError(null);

    try {
      const response = await fetch(buildAccessPath(`/api/runs/${encodeURIComponent(run.runId)}/actions/${action}`, accessToken), {
        method: "POST"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as ControlPlaneErrorPayload | null;
        throw payload ?? { error: `ReplayX action failed with status ${response.status}` };
      }

      const payload = (await response.json()) as {
        ok: boolean;
        run: ReplayXLiveRun;
        accessToken?: string | null;
        workspacePath?: string | null;
      };
      setNextRun(payload.run);
      setNextAccessToken(payload.accessToken ?? null);
      setWorkspacePath(payload.workspacePath ?? null);
    } catch (actionError) {
      setError(normalizeClientError(actionError, "Unable to complete this action."));
    } finally {
      setPending(false);
    }
  };

  return (
    <AppFrame active="action" statusDetail="Control action">
      <PageHeader
        eyebrow="Control plane action"
        lead={nextRun ? "ReplayX finished the requested control-plane action." : copy.summary}
        meta={<StatusPill tone={blockedActionReason ? "warning" : nextRun ? "success" : "accent"}>{action}</StatusPill>}
        title={copy.title}
      />
      <section className="two-up-grid">
        <MetricCell label="Run" value={activeRun.runId} detail={activeRun.issue.text} tone="accent" />
        <MetricCell
          label="Status"
          value={activeRun.status.replaceAll("_", " ")}
          detail={activeRun.currentBlocker ?? "No blocker recorded."}
          tone={activeRun.status === "failed" || activeRun.status === "blocked" ? "danger" : "neutral"}
        />
      </section>
      {error ? (
        <article className="workspace-panel" style={{ marginTop: "1.5rem" }}>
          <span className="eyebrow">Action failed</span>
          <p>{error.error}</p>
          <p className="ghost-text">{error.cause}</p>
          <p className="ghost-text">{error.fix}</p>
          <div className="rail-actions" style={{ marginTop: "0.75rem" }}>
            <Link className="ghost-link" href={error.docsPath}>
              Open troubleshooting guide
            </Link>
          </div>
        </article>
      ) : null}
      {!error && blockedActionReason ? (
        <article className="workspace-panel" style={{ marginTop: "1.5rem" }}>
          <span className="eyebrow">Action unavailable</span>
          <p className="ghost-text">{blockedActionReason}</p>
        </article>
      ) : null}
      <div className="header-actions" style={{ marginTop: "2rem" }}>
        {!nextRun && !blockedActionReason ? (
          <button className="button button-primary" disabled={pending} onClick={handleConfirm} type="button">
            {pending ? "Working..." : copy.confirm}
          </button>
        ) : null}
        <Link className="button button-secondary" href={incidentWorkspacePath}>
          Open incident workspace
        </Link>
        {opsPath ? (
          <Link className="button button-secondary" href={opsPath}>
            Open Ops Command Center
          </Link>
        ) : null}
      </div>
    </AppFrame>
  );
}
