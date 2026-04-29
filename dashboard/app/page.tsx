import Link from "next/link";
import {
  buildAuthorizedPath,
  buildControlPlaneAccessToken,
  controlPlaneAuthRequired,
  getControlPlaneAccessPayload
} from "../lib/control-plane-auth";
import { listReplayXRuns, selectFeaturedProofRun } from "../lib/live-runs";
import { listReplayIncidents } from "../lib/replay-data";
import { AppFrame, MetricCell, SectionHeader, StatusPill } from "../components/replayx-ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ access?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedAccessToken = resolvedSearchParams.access ?? null;
  const authRequired = controlPlaneAuthRequired();
  const accessPayload = getControlPlaneAccessPayload(requestedAccessToken);
  const controlPlaneAccessToken =
    !authRequired
      ? buildControlPlaneAccessToken({ scope: "control-plane" })
      : accessPayload?.scope === "control-plane"
        ? requestedAccessToken
        : null;
  const incidents = await listReplayIncidents();
  const liveRuns = !authRequired || controlPlaneAccessToken ? await listReplayXRuns() : [];
  const latestLiveRun = liveRuns.find((run) => run.origin === "live-run") ?? null;
  const featuredProofRun = selectFeaturedProofRun(liveRuns);

  const homePath = buildAuthorizedPath("/", controlPlaneAccessToken);
  const newRunPath = buildAuthorizedPath("/new", controlPlaneAccessToken);
  const opsPath = buildAuthorizedPath("/ops", controlPlaneAccessToken);
  const analyticsPath = buildAuthorizedPath("/analytics", controlPlaneAccessToken);
  const featuredProofPath = featuredProofRun
    ? buildAuthorizedPath(`/live/${featuredProofRun.runId}`, controlPlaneAccessToken)
    : newRunPath;
  const latestLivePath = latestLiveRun
    ? buildAuthorizedPath(`/live/${latestLiveRun.runId}`, controlPlaneAccessToken)
    : null;
  const controlPlaneStatus = authRequired
    ? controlPlaneAccessToken
      ? "Signed operator session"
      : "Public proof entry"
    : "Live runs ready";
  const navItems = [
    { href: homePath, label: "Proof", shortLabel: "PF", active: true },
    { href: newRunPath, label: "New run", shortLabel: "NR" },
    { href: opsPath, label: "Ops", shortLabel: "OP" },
    { href: analyticsPath, label: "Analytics", shortLabel: "AN" }
  ];

  const featuredProofTitle = featuredProofRun?.issue.text ?? "Start a realtime incident";
  const featuredProofSummary =
    featuredProofRun?.cards.proof.regression_summary ??
    "Paste the incident exactly as it arrived. ReplayX builds the evidence packet, runs the proof loop, and stops before it claims a fix it cannot validate.";
  const featuredProofMeta = featuredProofRun
    ? [
        { label: "Run", value: featuredProofRun.runId },
        { label: "Mode", value: featuredProofRun.executionMode },
        { label: "Status", value: featuredProofRun.status.replaceAll("_", " ") },
        { label: "Evidence", value: `${featuredProofRun.evidence.length} records` }
      ]
    : [
        { label: "Mode", value: "Realtime" },
        { label: "Fixture", value: "Explicit only" },
        { label: "First gate", value: "Validation baseline" },
        { label: "Claim rule", value: "Proof first" }
      ];

  return (
    <AppFrame
      active="home"
      controlPlaneLabel="Control plane"
      homePath={homePath}
      navItems={navItems}
      statusDetail={controlPlaneStatus}
    >
      <section className="home-grid fade-in">
        <div className="home-copy">
          <div>
            <span className="eyebrow">Incident proof engine</span>
            <h1>Replay proof before panic.</h1>
          </div>
          <p>
            ReplayX turns a Slack report or manual incident into a bounded Codex investigation:
            repro evidence, challenged diagnosis, patch strategy, regression proof, postmortem,
            and reusable incident memory.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href={newRunPath}>
              Start live incident
            </Link>
            {latestLivePath && latestLiveRun?.runId !== featuredProofRun?.runId ? (
              <Link className="button button-secondary" href={latestLivePath}>
                Open latest run
              </Link>
            ) : null}
            <Link className="button button-secondary" href={featuredProofPath}>
              {featuredProofRun ? "Open featured proof" : "Open run form"}
            </Link>
          </div>
          <div className="metric-grid">
            <MetricCell label="Primary loop" value="Intake -> proof" />
            <MetricCell label="Default mode" value="Realtime" />
            <MetricCell label="Memory" value="Skill writeback" />
            <MetricCell label="Fixtures" value={`${incidents.length} evals`} />
          </div>
        </div>

        <aside className="dark-panel home-proof">
          <div className="proof-title">
            <div>
              <span className="eyebrow">Featured run</span>
              <h2>{featuredProofTitle}</h2>
            </div>
            <StatusPill tone={featuredProofRun ? "success" : "warning"}>
              {featuredProofRun ? featuredProofRun.pullRequest.status.replaceAll("_", " ") : "Ready"}
            </StatusPill>
          </div>
          <p className="proof-summary">{featuredProofSummary}</p>
          <div className="metric-grid">
            {featuredProofMeta.map((item) => (
              <MetricCell key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
          <Link className="button button-primary" href={featuredProofPath}>
            {featuredProofRun ? "Enter workspace" : "Create proof run"}
          </Link>
        </aside>
      </section>

      <section className="section">
        <SectionHeader
          eyebrow="Session model"
          title="One operator session, three gates"
          body="The product does not need a marketing tour. It needs to orient the responder, expose the evidence, and make the next decision unmistakable."
        />
        <div className="three-column">
          <article className="panel">
            <span className="eyebrow">1. Intake</span>
            <h3 className="panel-title">Capture the incident as-is</h3>
            <p>Slack or manual text becomes the immutable incident packet. Plain reports do not silently fall back to seeded fixture answers.</p>
          </article>
          <article className="panel">
            <span className="eyebrow">2. Evidence</span>
            <h3 className="panel-title">Show every reason</h3>
            <p>Commands, repo search, worker theories, rejected paths, and operator decisions stay visible in a single proof ledger.</p>
          </article>
          <article className="panel">
            <span className="eyebrow">3. Resolution</span>
            <h3 className="panel-title">Advance only with proof</h3>
            <p>ReplayX reaches PR-ready output only after patch validation, regression evidence, postmortem, and reusable memory are in place.</p>
          </article>
        </div>
      </section>

      <section className="section" id="incident-list">
        <SectionHeader
          eyebrow="Fixture lab"
          title="Seeded incidents are evals, not the product default"
          body="These bundles remain useful for regression testing and demos. A live Slack/API report starts from realtime evidence unless a fixture id is supplied."
        />
        <div className="incident-grid">
          {incidents.map((incident) => (
            <Link
              className="panel incident-card row-card-link"
              href={`/incidents/${incident.incidentId}`}
              key={incident.incidentId}
            >
              <div className="evidence-head">
                <StatusPill tone={incident.severity === "high" ? "danger" : "warning"}>
                  {incident.severity}
                </StatusPill>
                <span className="ops-meta">{incident.environment}</span>
              </div>
              <div>
                <h3 className="panel-title">{incident.title}</h3>
                <p>{incident.summary.symptom}</p>
              </div>
              <div className="evidence-head">
                <span className="ops-meta">{incident.service}</span>
                <strong>Replay</strong>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </AppFrame>
  );
}
