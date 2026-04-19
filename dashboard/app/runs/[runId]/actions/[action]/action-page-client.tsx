"use client";

import { useState } from "react";
import Link from "next/link";

import type { ReplayXLiveRun } from "../../../../../lib/live-runs";

type ActionId = "approve" | "retry" | "cancel";

const actionLabels: Record<ActionId, { title: string; summary: string; confirm: string }> = {
  approve: {
    title: "Approve this run",
    summary: "ReplayX will continue the gated workflow after operator confirmation.",
    confirm: "Approve run"
  },
  retry: {
    title: "Retry this run",
    summary: "ReplayX will create a fresh run from the saved incident context.",
    confirm: "Retry run"
  },
  cancel: {
    title: "Cancel this run",
    summary: "ReplayX will stop the workflow and preserve the current incident state.",
    confirm: "Cancel run"
  }
};

export function ActionPageClient({
  action,
  run,
  accessToken
}: {
  action: ActionId;
  run: ReplayXLiveRun;
  accessToken: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextRun, setNextRun] = useState<ReplayXLiveRun | null>(null);
  const [nextAccessToken, setNextAccessToken] = useState<string | null>(accessToken);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const copy = actionLabels[action];
  const activeRun = nextRun ?? run;
  const incidentWorkspacePath =
    workspacePath ??
    `/workspaces/${activeRun.workspaceId}/incidents/${activeRun.runId}${
      nextAccessToken ? `?access=${encodeURIComponent(nextAccessToken)}` : ""
    }`;

  const handleConfirm = async () => {
    setPending(true);
    setError(null);

    try {
      const search = accessToken ? `?access=${encodeURIComponent(accessToken)}` : "";
      const response = await fetch(`/api/runs/${encodeURIComponent(run.runId)}/actions/${action}${search}`, {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error(`ReplayX action failed with status ${response.status}`);
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
      setError(actionError instanceof Error ? actionError.message : "Unable to complete this action");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="shell replay-shell">
      <header className="replay-header">
        <div>
          <span className="eyebrow">Control plane action</span>
          <h1>{copy.title}</h1>
          <p className="lead">{nextRun ? "ReplayX finished the requested control-plane action." : copy.summary}</p>
        </div>
      </header>
      <section className="story-grid">
        <article className="card">
          <span className="section-kicker">Run</span>
          <h2>{activeRun.runId}</h2>
          <p>{activeRun.issue.text}</p>
        </article>
        <article className="card">
          <span className="section-kicker">Status</span>
          <h2>{activeRun.status.replaceAll("_", " ")}</h2>
          <p>{activeRun.currentBlocker ?? "No blocker recorded."}</p>
        </article>
      </section>
      {error ? (
        <article className="workspace-panel" style={{ marginTop: "1.5rem" }}>
          <span className="section-kicker">Action failed</span>
          <p className="ghost-text">{error}</p>
        </article>
      ) : null}
      <div className="header-actions" style={{ marginTop: "2rem" }}>
        {!nextRun ? (
          <button className="button button-primary" disabled={pending} onClick={handleConfirm} type="button">
            {pending ? "Working..." : copy.confirm}
          </button>
        ) : null}
        <Link className="button button-secondary" href={incidentWorkspacePath}>
          Open incident workspace
        </Link>
        <Link className="button button-secondary" href="/ops">
          Open Ops Command Center
        </Link>
      </div>
    </main>
  );
}
