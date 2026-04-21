import Link from "next/link";
import {
  buildAuthorizedPath,
  buildControlPlaneAccessToken,
  controlPlaneAuthRequired,
  getControlPlaneAccessPayload
} from "../lib/control-plane-auth";
import { listReplayXRuns, selectFeaturedProofRun } from "../lib/live-runs";
import { GOLDEN_INCIDENT_ID, listReplayIncidents, loadReplayIncidentBundle } from "../lib/replay-data";

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
  let goldenBundle;
  try {
    goldenBundle = await loadReplayIncidentBundle(GOLDEN_INCIDENT_ID);
  } catch (e) {
    // Fallback if bundle not found during build
    goldenBundle = { 
      incident: { incidentId: "offline", title: "Incident Replay", summary: { symptom: "Sample symptom" }, service: "N/A", severity: "high" },
      diagnosis: { worker_count: 0 }
    };
  }

  const productPillars = [
    {
      title: "Featured Proof",
      body: "The public entrance shows the product earning trust with concrete replay evidence before any operator-only control surface appears."
    },
    {
      title: "Incident Workspace",
      body: "A live run opens with repo, service, environment, blockers, validation evidence, and PR handoff already in view."
    },
    {
      title: "Ops + Analytics",
      body: "Signed operator surfaces track the active fleet while preserving historical truth for reliability and learning metrics."
    }
  ];

  const liveRuns = !authRequired || controlPlaneAccessToken ? await listReplayXRuns() : [];
  const latestLiveRun = liveRuns.find((run) => run.origin === "live-run") ?? null;
  const featuredProofRun = selectFeaturedProofRun(liveRuns);
  const homePath = buildAuthorizedPath("/", controlPlaneAccessToken);
  const opsPath = buildAuthorizedPath("/ops", controlPlaneAccessToken);
  const analyticsPath = buildAuthorizedPath("/analytics", controlPlaneAccessToken);
  const featuredProofPath = featuredProofRun
    ? buildAuthorizedPath(`/live/${featuredProofRun.runId}`, controlPlaneAccessToken)
    : `/incidents/${GOLDEN_INCIDENT_ID}`;
  const latestLivePath = latestLiveRun
    ? buildAuthorizedPath(`/live/${latestLiveRun.runId}`, controlPlaneAccessToken)
    : null;
  const controlPlaneStatus = authRequired
    ? controlPlaneAccessToken
      ? "Signed operator session"
      : "Public proof entry"
    : "Live run + ops ready";
  const featuredProofTitle = featuredProofRun?.issue.text ?? goldenBundle.incident.title;
  const featuredProofSummary =
    featuredProofRun?.cards.proof.regression_summary ?? goldenBundle.incident.summary.symptom;
  const featuredProofMeta = featuredProofRun
    ? [
        { label: "Run", value: featuredProofRun.runId },
        { label: "Status", value: featuredProofRun.status.replaceAll("_", " ") },
        { label: "Repo", value: featuredProofRun.repoTarget },
        { label: "Outcome", value: featuredProofRun.pullRequest.url ? "Validated PR" : "Validated bundle" }
      ]
    : [
        { label: "Service", value: goldenBundle.incident.service },
        { label: "Severity", value: goldenBundle.incident.severity.toUpperCase() },
        { label: "Workers", value: `${goldenBundle.diagnosis?.worker_count ?? 0} active` },
        { label: "Outcome", value: "PR-ready validation" }
      ];

  return (
    <main className="shell shell-home">
      <header className="site-header">
        <Link className="brand" href={homePath}>
          <span className="brand-mark">RX</span>
          <div className="brand-copy">
            <strong>ReplayX</strong>
            <span>Codex-first incident replay</span>
          </div>
        </Link>
        <div className="site-status">
          <span className="site-status-label">Control plane</span>
          <span className="site-status-value">{controlPlaneStatus}</span>
        </div>
      </header>

      <section className="hero fade-in">
        <div className="hero-copy">
          <span className="hero-kicker">Proof-first incident response</span>
          <h1>Show the evidence first. Open the operator surfaces second.</h1>
          <p>
            ReplayX turns a Slack report into a live investigation, a validated patch path,
            and a PR-ready outcome with evidence attached the whole way through. Home stays safe
            and proof-first; signed links unlock the fleet, approvals, and analytics.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href={featuredProofPath}>
              Open Featured Proof
            </Link>
            <Link className="button button-secondary" href={`#incident-list`}>
              Browse Incident Library
            </Link>
            {latestLivePath && latestLiveRun?.runId !== featuredProofRun?.runId ? (
              <Link className="button button-secondary" href={latestLivePath}>
                Open Latest Live Run
              </Link>
            ) : null}
          </div>
          <div className="hero-ledger">
            <div className="ledger-item">
              <span>Surface</span>
              <strong>Proof → Workspace → PR</strong>
            </div>
            <div className="ledger-item">
              <span>Operator access</span>
              <strong>{controlPlaneStatus}</strong>
            </div>
            <div className="ledger-item">
              <span>Trust model</span>
              <strong>Evidence before memory, history before vanity</strong>
            </div>
          </div>
        </div>
        <div className="hero-rail">
          <div className="hero-surface">
            <span className="section-kicker">Featured Proof</span>
            <h2>{featuredProofTitle}</h2>
            <p>{featuredProofSummary}</p>
            <div className="worker-meta" style={{ marginTop: '2rem' }}>
              {featuredProofMeta.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <span className="section-kicker">Operator surfaces</span>
            <p>
              Ops and Analytics stay behind signed links. The homepage stays public and proof-first so the
              product explains itself before it asks for operator trust.
            </p>
            <div className="rail-actions" style={{ marginTop: "1rem" }}>
              {controlPlaneAccessToken ? (
                <>
                  <Link className="ghost-link" href={opsPath}>
                    Open Ops
                  </Link>
                  <Link className="ghost-link" href={analyticsPath}>
                    Open Analytics
                  </Link>
                </>
              ) : (
                <span className="ghost-text">Open from a signed operator link to access the live fleet and analytics.</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <span className="section-kicker">Product pillars</span>
          <h2>Three surfaces, one product</h2>
          <p>ReplayX should feel like one calm operating system for incident intake, live execution, and engineering memory.</p>
        </div>
        <div className="story-grid">
          {productPillars.map((step) => (
            <article className="panel story-step" key={step.title}>
              <span className="section-kicker" style={{ color: 'var(--muted)' }}>Product surface</span>
              <h3 style={{ marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>{step.title}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <span className="section-kicker">Why it feels different</span>
          <h2>Built for operators, not spectators</h2>
          <p>
            Incident products usually split coordination, evidence, and resolution across too many tabs and too much chrome.
            ReplayX keeps the state obvious, the evidence close, and the next action unmistakable without making
            the homepage depend on privileged operator access.
          </p>
        </div>
        <div className="ops-grid-2">
          <article className="panel">
            <span className="section-kicker">Slack-native intake</span>
            <h3>Bug report becomes a live investigation</h3>
            <p>Slack kicks off the run, but the product keeps the whole incident visible from first report to PR-ready resolution.</p>
          </article>
          <article className="panel">
            <span className="section-kicker">Validated patch loop</span>
            <h3>ReplayX earns the right to say “resolved”</h3>
            <p>The seeded patch candidate is applied in sandbox, validated, and only then promoted into reusable memory.</p>
          </article>
        </div>
      </section>

      <section className="section" id="incident-list">
        <div className="section-header">
          <span className="section-kicker">Incident library</span>
          <h2>Seeded incidents with real product coverage</h2>
          <p>The bundled incidents show the system across auth, concurrency, and null-shape failures.</p>
        </div>
        <div className="incident-grid">
          {incidents.map((incident) => (
            <Link
              className="card incident-card"
              key={incident.incidentId}
              href={`/incidents/${incident.incidentId}`}
            >
              <div className="incident-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className={`pill ${incident.severity === 'high' ? 'pill-danger' : 'pill-warning'}`}>
                  {incident.severity.toUpperCase()}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{incident.environment}</span>
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem' }}>{incident.title}</h3>
                <p style={{ marginTop: '0.5rem' }}>{incident.summary.symptom}</p>
              </div>
              <div className="incident-card-footer">
                <span>{incident.service}</span>
                <span style={{ color: 'var(--brand)', fontWeight: '600' }}>Replay →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
