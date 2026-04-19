import Link from "next/link";
import { GOLDEN_INCIDENT_ID, listReplayIncidents, loadReplayIncidentBundle } from "../lib/replay-data";

export default async function HomePage() {
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
      title: "Live Incident Workspace",
      body: "A run opens with repo, service, environment, state, and evidence already in view."
    },
    {
      title: "Ops Command Center",
      body: "Track approvals, blocked runs, integration health, and fleet activity without leaving the product."
    },
    {
      title: "Reliability Analytics",
      body: "Watch MTTR, validation quality, operator intervention, and memory performance move over time."
    }
  ];

  return (
    <main className="shell shell-home">
      <header className="site-header">
        <Link className="brand" href="/">
          <span className="brand-mark">RX</span>
          <div className="brand-copy">
            <strong>ReplayX</strong>
            <span>Codex-first incident replay</span>
          </div>
        </Link>
        <div className="site-status">
          <span className="site-status-label">Control plane</span>
          <span className="site-status-value">Live run + ops ready</span>
        </div>
      </header>

      <section className="hero fade-in">
        <div className="hero-copy">
          <span className="hero-kicker">Slack-native incident workspace</span>
          <h1>Resolve production issues without losing the plot.</h1>
          <p>
            ReplayX turns a Slack report into a live investigation, a validated patch path,
            and a PR-ready outcome with evidence attached the whole way through.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/ops">
              Open Control Plane
            </Link>
            <Link className="button button-secondary" href={`/live/run_mo63kvd1_bxj27x`}>
              View Live Incident
            </Link>
            <Link className="button button-secondary" href="/analytics">
              Inspect Analytics
            </Link>
          </div>
          <div className="hero-ledger">
            <div className="ledger-item">
              <span>Surface</span>
              <strong>Slack → Workspace → PR</strong>
            </div>
            <div className="ledger-item">
              <span>Engine</span>
              <strong>Codex-first control plane</strong>
            </div>
            <div className="ledger-item">
              <span>Trust model</span>
              <strong>Evidence before memory</strong>
            </div>
          </div>
        </div>
        <div className="hero-rail">
          <div className="hero-surface">
            <span className="section-kicker">Featured incident</span>
            <h2>{goldenBundle.incident.title}</h2>
            <p>{goldenBundle.incident.summary.symptom}</p>
            <div className="worker-meta" style={{ marginTop: '2rem' }}>
              <div>
                <dt>Service</dt>
                <dd>{goldenBundle.incident.service}</dd>
              </div>
              <div>
                <dt>Severity</dt>
                <dd className="pill-danger" style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px' }}>
                  {goldenBundle.incident.severity.toUpperCase()}
                </dd>
              </div>
              <div>
                <dt>Workers</dt>
                <dd>{goldenBundle.diagnosis?.worker_count ?? 0} active</dd>
              </div>
              <div>
                <dt>Outcome</dt>
                <dd>PR-ready validation</dd>
              </div>
            </div>
          </div>
          <div className="panel">
            <span className="section-kicker">What changes for the team</span>
            <p>
              The product is no longer just a replay. It now carries live run state, approvals, PR handoff,
              and reusable memory through one operational surface.
            </p>
            <div className="rail-actions" style={{ marginTop: "1rem" }}>
              <Link className="ghost-link" href={`/incidents/${GOLDEN_INCIDENT_ID}`}>
                Open replay
              </Link>
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
            ReplayX should keep the state obvious, the evidence close, and the next action unmistakable.
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
