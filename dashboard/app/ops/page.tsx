import Link from "next/link";

import { listReplayXRuns } from "../../lib/live-runs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OpsPage() {
  const runs = (await listReplayXRuns()).filter((run) => run.origin === "live-run");
  const activeRuns = runs.filter((run) =>
    ["queued", "triaging", "reproducing", "diagnosing", "patching", "validating", "awaiting_approval", "opening_pr"].includes(
      run.status
    )
  );
  const blockedRuns = runs.filter((run) => run.status === "blocked" || run.status === "failed");
  const approvals = runs.flatMap((run) => run.approvals.filter((approval) => approval.status === "pending").map((approval) => ({ run, approval })));
  const degradedIntegrations = runs.flatMap((run) =>
    run.integrations
      .filter((integration) => integration.status !== "healthy")
      .map((integration) => ({ runId: run.runId, integration }))
  );

  return (
    <main className="shell replay-shell">
      <header className="replay-header">
        <div>
          <Link className="ghost-link" href="/">
            ← Back to home
          </Link>
          <span className="eyebrow">Ops Command Center</span>
          <h1>See the incident fleet at a glance</h1>
          <p className="lead">
            Watch active work, blocked paths, approvals, and degraded integrations without digging through individual run pages.
          </p>
        </div>
      </header>

      <section className="ops-shell fade-in">
        <section className="ops-overview">
          <article className="card kpi-card">
            <span className="section-kicker">Active runs</span>
            <div className="kpi-value">{activeRuns.length}</div>
            <p>Triaging, diagnosing, patching, validating, or packaging a PR.</p>
          </article>
          <article className="card kpi-card">
            <span className="section-kicker">Blocked runs</span>
            <div className="kpi-value">{blockedRuns.length}</div>
            <p>Runs that need help, approval, or a better route to resolution.</p>
          </article>
          <article className="card kpi-card">
            <span className="section-kicker">Approval queue</span>
            <div className="kpi-value">{approvals.length}</div>
            <p>Human decisions waiting before the automation can continue.</p>
          </article>
          <article className="card kpi-card">
            <span className="section-kicker">Integration health</span>
            <div className="kpi-value">{degradedIntegrations.length}</div>
            <p>Degraded or failing systems across Slack, executor, and memory services.</p>
          </article>
        </section>

        <section className="ops-grid-2">
          <article className="workspace-surface">
            <div className="section-header">
              <span className="section-kicker">Active incidents</span>
              <h2>Runs in flight</h2>
            </div>
            <div className="ops-stack">
              {activeRuns.length > 0 ? (
                activeRuns.map((run) => (
                  <Link className="ops-row" key={run.runId} href={`/live/${run.runId}`}>
                    <div className="ops-row-head">
                      <div>
                        <span className="section-kicker">{run.workspaceId}</span>
                        <h3>{run.issue.text}</h3>
                      </div>
                      <StatusBadge status={run.status.replaceAll("_", " ")} />
                    </div>
                    <p>{run.repoTarget} · {run.environmentTarget}</p>
                    <p className="ops-meta">Current phase · {run.currentPhaseId ?? "queued"}</p>
                  </Link>
                ))
              ) : (
                <article className="workspace-panel empty-state">
                  <div>
                    <h3>No active incidents</h3>
                    <p>ReplayX is currently idle. New incidents appear here as soon as Slack or the workspace API creates a run.</p>
                  </div>
                </article>
              )}
            </div>
          </article>

          <div className="workspace-aside">
            <article className="workspace-rail">
              <span className="section-kicker">Approvals</span>
              <h3>{approvals.length > 0 ? "Pending decisions" : "Queue clear"}</h3>
              <div className="ops-stack">
                {approvals.length > 0 ? (
                  approvals.map(({ run, approval }) => (
                    <article className="ops-row" key={approval.id}>
                      <div className="ops-row-head">
                        <div>
                          <span className="section-kicker">{approval.kind}</span>
                          <h3>{run.runId}</h3>
                        </div>
                        <span className="pill pill-warning">{approval.status}</span>
                      </div>
                      <p>{approval.summary}</p>
                    </article>
                  ))
                ) : (
                  <div className="rail-note">No approvals are waiting right now.</div>
                )}
              </div>
            </article>

            <article className="workspace-rail">
              <span className="section-kicker">Integration health</span>
              <h3>{degradedIntegrations.length > 0 ? "Needs attention" : "Healthy"}</h3>
              <div className="ops-stack">
                {degradedIntegrations.length > 0 ? (
                  degradedIntegrations.map(({ runId, integration }) => (
                    <article className="ops-row" key={`${runId}-${integration.integration}`}>
                      <div className="ops-row-head">
                        <div>
                          <span className="section-kicker">{integration.integration}</span>
                          <h3>{runId}</h3>
                        </div>
                        <span className="pill pill-danger">{integration.status}</span>
                      </div>
                      <p>{integration.summary}</p>
                    </article>
                  ))
                ) : (
                  <div className="rail-note">All tracked integrations are healthy.</div>
                )}
              </div>
            </article>
          </div>
        </section>

        <section className="workspace-surface">
          <div className="section-header">
            <span className="section-kicker">Blocked / failed</span>
            <h2>Needs attention</h2>
          </div>
          <div className="ops-stack">
            {blockedRuns.length > 0 ? (
              blockedRuns.map((run) => (
                <article className="ops-row" key={run.runId}>
                  <div className="ops-row-head">
                    <div>
                      <span className="section-kicker">{run.workspaceId}</span>
                      <h3>{run.issue.text}</h3>
                    </div>
                    <span className="pill pill-danger">{run.status.replaceAll("_", " ")}</span>
                  </div>
                  <p>{run.currentBlocker ?? run.error ?? "No blocker recorded."}</p>
                  <div className="rail-actions" style={{ marginTop: "0.75rem" }}>
                    <Link className="ghost-link" href={`/live/${run.runId}`}>
                      Open incident
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <div className="rail-note">The queue is clear right now.</div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status.includes("blocked") || status.includes("failed")
      ? "pill-danger"
      : status.includes("waiting") || status.includes("approval")
        ? "pill-warning"
        : "pill-success";

  return <span className={`pill ${tone}`}>{status}</span>;
}
