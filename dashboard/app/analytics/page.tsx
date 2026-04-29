import Link from "next/link";

import {
  buildAuthorizedPath,
  buildControlPlaneAccessToken,
  controlPlaneAuthRequired,
  isControlPlaneAccessTokenValid
} from "../../lib/control-plane-auth";
import { unauthorizedControlPlaneError } from "../../lib/control-plane-errors";
import { ControlPlaneErrorPanel } from "../../components/control-plane-error-panel";
import { getReplayXAnalytics } from "../../lib/live-runs";
import { AppFrame, EmptyState, MetricCell, PageHeader, SectionHeader, StatusPill } from "../../components/replayx-ui";

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AnalyticsPage({
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
      <AppFrame active="analytics" statusDetail="Signed link required">
        <ControlPlaneErrorPanel
          kicker="Unauthorized"
          title="This ReplayX analytics page requires a signed operator link"
          problem={unauthorizedControlPlaneError("This ReplayX analytics page")}
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
    { href: opsPath, label: "Ops", shortLabel: "OP" },
    { href: analyticsPath, label: "Analytics", shortLabel: "AN", active: true }
  ];
  const analytics = await getReplayXAnalytics();

  return (
    <AppFrame active="analytics" homePath={homePath} navItems={navItems} statusDetail="Trust metrics">
      <PageHeader
        actions={
          <Link className="button button-secondary" href={opsPath}>
            Open ops
          </Link>
        }
        eyebrow="Reliability analytics"
        lead={`Historical metrics include ${analytics.archivedRuns} archived record${analytics.archivedRuns === 1 ? "" : "s"}. Live board currently shows ${analytics.visibleRuns}.`}
        meta={<StatusPill tone={analytics.validationSuccessRate >= 0.8 ? "success" : "warning"}>Trust signal</StatusPill>}
        title="Measure whether ReplayX is earning operator trust."
      />

      <section className="analytics-stack fade-in">
        <div className="analytics-overview">
          <MetricCell label="MTTR" value={analytics.mttrMinutes === null ? "N/A" : `${analytics.mttrMinutes.toFixed(1)} min`} detail="Median create-to-PR time." tone="accent" />
          <MetricCell label="Validation" value={formatPercent(analytics.validationSuccessRate)} detail="Runs with validated PR-ready output." tone="success" />
          <MetricCell label="Intervention" value={formatPercent(analytics.operatorInterventionRate)} detail="Human gates that moved the workflow." tone={analytics.operatorInterventionRate > 0.35 ? "warning" : "neutral"} />
          <MetricCell label="Skill reuse" value={formatPercent(analytics.skillReuseRate)} detail="Resolved runs promoted into memory." tone="accent" />
          <MetricCell label="Evidence backed" value={formatPercent(analytics.evidenceBackedRunRate)} detail="Runs with proof and decisions." tone="success" />
        </div>

        <section className="analytics-grid-2">
          <article className="workspace-surface">
            <SectionHeader
              eyebrow="Core rates"
              title="Signals that matter most"
              body="The page is deliberately sparse: rates first, interpretation second, raw weak spots last."
            />
            <div className="analytics-stack">
              <article className="analytics-row">
                <div className="analytics-row-head">
                  <div>
                    <span className="eyebrow">Repro success</span>
                    <h3>{formatPercent(analytics.reproSuccessRate)}</h3>
                  </div>
                  <StatusPill tone="accent">Baseline</StatusPill>
                </div>
                <p>Whether ReplayX can isolate the failure surface without losing the healthy control.</p>
              </article>
              <article className="analytics-row">
                <div className="analytics-row-head">
                  <div>
                    <span className="eyebrow">PR-ready rate</span>
                    <h3>{formatPercent(analytics.prAcceptanceRate)}</h3>
                  </div>
                  <StatusPill tone="success">Outcome</StatusPill>
                </div>
                <p>The strongest current proxy for whether the product resolved something real.</p>
              </article>
              <article className="analytics-row">
                <div className="analytics-row-head">
                  <div>
                    <span className="eyebrow">Proof records</span>
                    <h3>{analytics.evidenceRecords} evidence / {analytics.decisionRecords} decisions</h3>
                  </div>
                </div>
                <p>How much auditable material ReplayX preserved across incident runs.</p>
              </article>
            </div>
          </article>

          <aside className="workspace-rail">
            <span className="eyebrow">Interpretation</span>
            <h3>What good looks like</h3>
            <div className="rail-note">
              High validation with low intervention means ReplayX is acting like an operator, not an explainer.
            </div>
            <div className="rail-note">
              Rising intervention means the system is leaking complexity back onto humans.
            </div>
          </aside>
        </section>

        <section className="workspace-surface">
          <SectionHeader eyebrow="Phase timing" title="Where the run spends time" />
          <div className="analytics-grid">
            {Object.entries(analytics.phaseTimingMinutes).map(([phaseId, minutes]) => (
              <article className="analytics-row" key={phaseId}>
                <span className="eyebrow">{phaseId}</span>
                <h3>{minutes.toFixed(2)} min</h3>
              </article>
            ))}
          </div>
        </section>

        <section className="analytics-grid-2">
          <article className="workspace-surface">
            <SectionHeader eyebrow="Recurring fingerprints" title="What keeps coming back" />
            <div className="analytics-stack">
              {analytics.topRecurringIncidentFingerprints.length > 0 ? (
                analytics.topRecurringIncidentFingerprints.map((item) => (
                  <article className="analytics-row" key={item.incidentId}>
                    <div className="analytics-row-head">
                      <div>
                        <span className="eyebrow">{item.incidentId}</span>
                        <h3>{item.count} runs</h3>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState title="No recurring incidents" body="ReplayX has not recorded repeat incident fingerprints yet." />
              )}
            </div>
          </article>

          <article className="workspace-surface">
            <SectionHeader eyebrow="Failing integrations" title="Operational weak spots" />
            <div className="analytics-stack">
              {analytics.topFailingIntegrations.length > 0 ? (
                analytics.topFailingIntegrations.map((item) => (
                  <article className="analytics-row" key={item.integration}>
                    <div className="analytics-row-head">
                      <div>
                        <span className="eyebrow">{item.integration}</span>
                        <h3>{item.count} failures</h3>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState title="No degraded integrations" body="Slack, executor, and memory services have no recorded degradation." />
              )}
            </div>
          </article>
        </section>
      </section>
    </AppFrame>
  );
}
