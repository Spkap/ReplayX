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

  const proofSteps = [
    {
      label: "Slack or API",
      body: "The incident arrives exactly as written, without being polished into a fake prompt."
    },
    {
      label: "Evidence packet",
      body: "ReplayX captures commands, repo facts, worker theories, rejected paths, and gates."
    },
    {
      label: "Validated patch",
      body: "The run advances only when the patch story has a regression proof and rollback path."
    },
    {
      label: "Memory",
      body: "Resolved incidents write back into reusable incident skill artifacts."
    }
  ];

  return (
    <AppFrame
      active="home"
      controlPlaneLabel="Control plane"
      homePath={homePath}
      navItems={navItems}
      statusDetail={controlPlaneStatus}
    >
      <div className="proof-home fade-in">
        <section className="home-grid">
          <div className="home-copy">
            <div>
              <span className="eyebrow">Incident proof engine</span>
              <h1>Turn incident reports into proof.</h1>
            </div>
            <p>
              ReplayX is the operator surface for coding-agent incident repair. Start with a Slack report
              or raw incident text, then follow the proof ledger until diagnosis, patch validation, PR output,
              postmortem, and reusable memory are all visible.
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
            <div className="proof-flow" aria-label="ReplayX proof flow">
              {proofSteps.map((step, index) => (
                <div className="proof-flow-row" key={step.label}>
                  <span className="proof-flow-index">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{step.label}</strong>
                    <p>{step.body}</p>
                  </div>
                  <span className="ops-meta">{index === proofSteps.length - 1 ? "writeback" : "gate"}</span>
                </div>
              ))}
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

        <section className="workspace-surface">
          <SectionHeader
            eyebrow="Session model"
            title="The one job is deciding what proof allows next."
            body="This is not a war-room dashboard. The screen has to keep the responder oriented around state, evidence, and the next permitted action."
          />
          <div className="metric-strip">
            <MetricCell label="Primary loop" value="Intake -> proof" />
            <MetricCell label="Default mode" value="Realtime" />
            <MetricCell label="Memory" value="Skill writeback" />
            <MetricCell label="Fixtures" value={`${incidents.length} evals`} />
          </div>
        </section>

        <section className="workspace-surface" id="incident-list">
          <SectionHeader
            eyebrow="Fixture lab"
            title="Seeded incidents are evals, not the default product path."
            body="They stay visible for regression testing and demos. A fresh Slack or API report starts from realtime evidence unless a fixture id is supplied."
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
      </div>
    </AppFrame>
  );
}
