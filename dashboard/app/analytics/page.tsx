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
      <main className="shell replay-shell">
        <ControlPlaneErrorPanel
          kicker="Unauthorized"
          title="This ReplayX analytics page requires a signed operator link"
          problem={unauthorizedControlPlaneError("This ReplayX analytics page")}
        />
      </main>
    );
  }

  const controlPlaneAccessToken = accessToken ?? buildControlPlaneAccessToken({ scope: "control-plane" });
  const homePath = buildAuthorizedPath("/", controlPlaneAccessToken);
  const analytics = await getReplayXAnalytics();

  return (
    <main className="shell replay-shell">
      <header className="replay-header">
        <div>
          <Link className="ghost-link" href={homePath}>
            ← Back to home
          </Link>
          <span className="eyebrow">Reliability + Learning Analytics</span>
          <h1>Measure whether the product is earning trust</h1>
          <p className="lead">
            Analytics should explain how fast ReplayX works, how often it gets to a validated outcome, and where operator effort still leaks into the system.
          </p>
          <p className="ghost-text">
            Historical metrics include archived runs. Current live board: {analytics.visibleRuns}. Archived records preserved: {analytics.archivedRuns}.
          </p>
        </div>
      </header>

      <section className="analytics-shell fade-in">
        <section className="analytics-overview">
          <article className="card kpi-card">
            <span className="section-kicker">MTTR</span>
            <div className="kpi-value">{analytics.mttrMinutes === null ? "N/A" : `${analytics.mttrMinutes.toFixed(1)} min`}</div>
            <p>Median time from run creation to a PR-ready outcome.</p>
          </article>
          <article className="card kpi-card">
            <span className="section-kicker">Validation success</span>
            <div className="kpi-value">{formatPercent(analytics.validationSuccessRate)}</div>
            <p>Runs that completed with a validated PR-ready bundle.</p>
          </article>
          <article className="card kpi-card">
            <span className="section-kicker">Operator intervention</span>
            <div className="kpi-value">{formatPercent(analytics.operatorInterventionRate)}</div>
            <p>How often a human had to step in to move the workflow forward.</p>
          </article>
          <article className="card kpi-card">
            <span className="section-kicker">Skill reuse proxy</span>
            <div className="kpi-value">{formatPercent(analytics.skillReuseRate)}</div>
            <p>Validated runs that ended with reusable memory promotion.</p>
          </article>
        </section>

        <section className="analytics-grid-2">
          <article className="workspace-surface">
            <div className="section-header">
              <span className="section-kicker">Core rates</span>
              <h2>Signals that matter most</h2>
            </div>
            <div className="analytics-stack">
              <article className="analytics-row">
                <div className="analytics-row-head">
                  <div>
                    <span className="section-kicker">Repro success</span>
                    <h3>{formatPercent(analytics.reproSuccessRate)}</h3>
                  </div>
                </div>
                <p>Whether ReplayX can isolate the failure surface without losing the healthy control.</p>
              </article>
              <article className="analytics-row">
                <div className="analytics-row-head">
                  <div>
                    <span className="section-kicker">PR-ready rate</span>
                    <h3>{formatPercent(analytics.prAcceptanceRate)}</h3>
                  </div>
                </div>
                <p>The strongest proxy we have today for “did the product actually resolve something?”</p>
              </article>
            </div>
          </article>

          <article className="workspace-rail">
            <span className="section-kicker">Interpretation</span>
            <h3>How to read this page</h3>
            <div className="rail-note">
              High validation with low intervention means the product is behaving like a real incident operator, not just an explainer.
            </div>
            <div className="rail-note">
              If intervention climbs, the product is leaking complexity back onto the human team.
            </div>
          </article>
        </section>

        <section className="workspace-surface">
          <div className="section-header">
            <span className="section-kicker">Phase timing</span>
            <h2>Where the run spends time</h2>
          </div>
          <div className="analytics-grid">
            {Object.entries(analytics.phaseTimingMinutes).map(([phaseId, minutes]) => (
              <article className="analytics-row" key={phaseId}>
                <span className="section-kicker">{phaseId}</span>
                <h3>{minutes.toFixed(2)} min</h3>
              </article>
            ))}
          </div>
        </section>

        <section className="analytics-grid-2">
          <article className="workspace-surface">
            <div className="section-header">
              <span className="section-kicker">Recurring incident fingerprints</span>
              <h2>What keeps coming back</h2>
            </div>
            <div className="analytics-stack">
              {analytics.topRecurringIncidentFingerprints.length > 0 ? (
                analytics.topRecurringIncidentFingerprints.map((item) => (
                  <article className="analytics-row" key={item.incidentId}>
                    <div className="analytics-row-head">
                      <div>
                        <span className="section-kicker">{item.incidentId}</span>
                        <h3>{item.count} runs</h3>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rail-note">No incidents recorded yet.</div>
              )}
            </div>
          </article>

          <article className="workspace-surface">
            <div className="section-header">
              <span className="section-kicker">Failing integrations</span>
              <h2>Operational weak spots</h2>
            </div>
            <div className="analytics-stack">
              {analytics.topFailingIntegrations.length > 0 ? (
                analytics.topFailingIntegrations.map((item) => (
                  <article className="analytics-row" key={item.integration}>
                    <div className="analytics-row-head">
                      <div>
                        <span className="section-kicker">{item.integration}</span>
                        <h3>{item.count} failures</h3>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rail-note">No degraded integrations recorded.</div>
              )}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}
