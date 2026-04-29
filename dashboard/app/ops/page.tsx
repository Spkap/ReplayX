import Link from "next/link";

import {
  buildAuthorizedPath,
  buildControlPlaneAccessToken,
  controlPlaneAuthRequired,
  isControlPlaneAccessTokenValid
} from "../../lib/control-plane-auth";
import { unauthorizedControlPlaneError } from "../../lib/control-plane-errors";
import { ControlPlaneErrorPanel } from "../../components/control-plane-error-panel";
import { listReplayXRuns } from "../../lib/live-runs";
import { AppFrame, EmptyState, MetricCell, PageHeader, SectionHeader, StatusPill } from "../../components/replayx-ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function OpsPage({
  searchParams
}: {
  searchParams?: Promise<{ access?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const accessToken = resolvedSearchParams.access ?? null;

  if (
    controlPlaneAuthRequired() &&
    !isControlPlaneAccessTokenValid(accessToken, { scope: "control-plane" })
  ) {
    return (
      <AppFrame active="ops" statusDetail="Signed link required">
        <ControlPlaneErrorPanel
          kicker="Unauthorized"
          title="This ReplayX control-plane page requires a signed operator link"
          problem={unauthorizedControlPlaneError("This ReplayX control-plane page")}
        />
      </AppFrame>
    );
  }

  const controlPlaneAccessToken = accessToken ?? buildControlPlaneAccessToken({ scope: "control-plane" });
  const homePath = buildAuthorizedPath("/", controlPlaneAccessToken);
  const newRunPath = buildAuthorizedPath("/new", controlPlaneAccessToken);
  const opsPath = buildAuthorizedPath("/ops", controlPlaneAccessToken);
  const analyticsPath = buildAuthorizedPath("/analytics", controlPlaneAccessToken);
  const navItems = [
    { href: homePath, label: "Proof", shortLabel: "PF" },
    { href: newRunPath, label: "New run", shortLabel: "NR" },
    { href: opsPath, label: "Ops", shortLabel: "OP", active: true },
    { href: analyticsPath, label: "Analytics", shortLabel: "AN" }
  ];

  const allRuns = (await listReplayXRuns({ includeArchived: true })).filter((run) => run.origin === "live-run");
  const runs = allRuns.filter((run) => run.archivedAt === null);
  const archivedCount = allRuns.length - runs.length;
  const activeRuns = runs.filter((run) =>
    ["queued", "triaging", "reproducing", "diagnosing", "patching", "validating", "awaiting_approval", "opening_pr"].includes(
      run.status
    )
  );
  const blockedRuns = runs.filter((run) => run.status === "blocked" || run.status === "failed");
  const approvals = runs.flatMap((run) =>
    run.approvals.filter((approval) => approval.status === "pending").map((approval) => ({ run, approval }))
  );
  const degradedIntegrations = runs.flatMap((run) =>
    run.integrations
      .filter((integration) => integration.status !== "healthy")
      .map((integration) => ({ runId: run.runId, integration }))
  );

  return (
    <AppFrame active="ops" homePath={homePath} navItems={navItems} statusDetail="Fleet board">
      <PageHeader
        actions={
          <Link className="button button-primary" href={newRunPath}>
            Start incident
          </Link>
        }
        eyebrow="Ops command center"
        lead={`Active board excludes ${archivedCount} archived run${archivedCount === 1 ? "" : "s"} while historical analytics still preserve them.`}
        meta={<StatusPill tone={blockedRuns.length > 0 ? "danger" : "success"}>{blockedRuns.length > 0 ? "Attention" : "Clear"}</StatusPill>}
        title="Watch the incident fleet without opening every run."
      />

      <section className="ops-stack fade-in">
        <div className="ops-overview">
          <MetricCell label="Active runs" value={activeRuns.length} detail="Triaging through PR packaging." tone="accent" />
          <MetricCell label="Blocked" value={blockedRuns.length} detail="Needs human help or retry." tone={blockedRuns.length > 0 ? "danger" : "success"} />
          <MetricCell label="Approvals" value={approvals.length} detail="Operator decisions waiting." tone={approvals.length > 0 ? "warning" : "neutral"} />
          <MetricCell label="Integrations" value={degradedIntegrations.length} detail="Degraded Slack, executor, or memory signals." tone={degradedIntegrations.length > 0 ? "warning" : "success"} />
        </div>

        <section className="workspace-grid">
          <article className="workspace-surface">
            <SectionHeader
              eyebrow="Active incidents"
              title="Runs in flight"
              body="Primary action on this page is opening the run that needs attention."
            />
            <div className="ops-stack">
              {activeRuns.length > 0 ? (
                activeRuns.map((run) => (
                  <Link
                    className="ops-row ops-row-link"
                    href={buildAuthorizedPath(`/live/${run.runId}`, controlPlaneAccessToken)}
                    key={run.runId}
                  >
                    <div className="ops-row-head">
                      <div>
                        <span className="eyebrow">{run.workspaceId}</span>
                        <h3>{run.issue.text}</h3>
                      </div>
                      <StatusBadge status={run.status.replaceAll("_", " ")} />
                    </div>
                    <p>{run.repoTarget} / {run.environmentTarget}</p>
                    <p className="ops-meta">Current phase: {run.currentPhaseId ?? "queued"}</p>
                  </Link>
                ))
              ) : (
                <EmptyState
                  title="No active incidents"
                  body="New Slack or API runs appear here as soon as ReplayX creates the workspace."
                />
              )}
            </div>
          </article>

          <aside className="workspace-aside">
            <article className="workspace-rail">
              <span className="eyebrow">Approvals</span>
              <h3>{approvals.length > 0 ? "Pending decisions" : "Queue clear"}</h3>
              <div className="ops-stack">
                {approvals.length > 0 ? (
                  approvals.map(({ run, approval }) => (
                    <article className="ops-row" key={approval.id}>
                      <div className="ops-row-head">
                        <div>
                          <span className="eyebrow">{approval.kind}</span>
                          <h3>{run.runId}</h3>
                        </div>
                        <StatusPill tone="warning">{approval.status}</StatusPill>
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
              <span className="eyebrow">Integration health</span>
              <h3>{degradedIntegrations.length > 0 ? "Needs attention" : "Healthy"}</h3>
              <div className="ops-stack">
                {degradedIntegrations.length > 0 ? (
                  degradedIntegrations.map(({ runId, integration }) => (
                    <article className="ops-row" key={`${runId}-${integration.integration}`}>
                      <div className="ops-row-head">
                        <div>
                          <span className="eyebrow">{integration.integration}</span>
                          <h3>{runId}</h3>
                        </div>
                        <StatusPill tone="danger">{integration.status}</StatusPill>
                      </div>
                      <p>{integration.summary}</p>
                    </article>
                  ))
                ) : (
                  <div className="rail-note">All tracked integrations are healthy.</div>
                )}
              </div>
            </article>
          </aside>
        </section>

        <section className="workspace-surface">
          <SectionHeader eyebrow="Blocked / failed" title="Needs attention" />
          <div className="ops-stack">
            {blockedRuns.length > 0 ? (
              blockedRuns.map((run) => (
                <article className="ops-row" key={run.runId}>
                  <div className="ops-row-head">
                    <div>
                      <span className="eyebrow">{run.workspaceId}</span>
                      <h3>{run.issue.text}</h3>
                    </div>
                    <StatusPill tone="danger">{run.status.replaceAll("_", " ")}</StatusPill>
                  </div>
                  <p>{run.currentBlocker ?? run.error ?? "No blocker recorded."}</p>
                  <div className="rail-actions" style={{ marginTop: "0.75rem" }}>
                    <Link
                      className="ghost-link"
                      href={buildAuthorizedPath(`/live/${run.runId}`, controlPlaneAccessToken)}
                    >
                      Open incident
                    </Link>
                    <Link
                      className="ghost-link"
                      href={buildAuthorizedPath(`/runs/${run.runId}/actions/archive`, controlPlaneAccessToken)}
                    >
                      Archive
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
    </AppFrame>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status.includes("blocked") || status.includes("failed")
      ? "danger"
      : status.includes("waiting") || status.includes("approval")
        ? "warning"
        : "success";

  return <StatusPill tone={tone}>{status}</StatusPill>;
}
