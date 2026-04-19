import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatPercent,
  formatTimestamp,
  isReplayDataNotFoundError,
  loadReplayIncidentBundle,
  type ReplayWorkerCard
} from "../../../lib/replay-data";

function StatusBadge({ tone, children }: { tone: "danger" | "neutral" | "success" | "warning"; children: string }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function WorkerCard({ worker }: { worker: ReplayWorkerCard }) {
  const tone =
    worker.status === "completed" ? "success" : worker.status === "weak_signal" ? "warning" : "neutral";

  return (
    <article className={`card worker-card worker-card-${tone}`} style={{ position: 'relative' }}>
      <div className="worker-topline">
        <div>
          <p className="worker-label">{worker.label}</p>
          <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)' }}>{worker.shortTitle}</h3>
        </div>
        <StatusBadge tone={tone}>{worker.status.replace("_", " ")}</StatusBadge>
      </div>
      <p className="worker-diagnosis" style={{ fontSize: '0.9375rem', color: 'var(--text-muted)' }}>{worker.diagnosis}</p>
      <div className="worker-meta" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
        <div>
          <dt>Confidence</dt>
          <dd style={{ color: tone === 'success' ? 'var(--success)' : 'var(--text)' }}>{formatPercent(worker.confidence)}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{worker.mode}</dd>
        </div>
      </div>
      <ul className="bullet-list" style={{ marginTop: '1rem' }}>
        {worker.observations.slice(0, 3).map((observation) => (
          <li key={observation}>{observation}</li>
        ))}
      </ul>
    </article>
  );
}

function TimelineStep({
  title,
  detail,
  status
}: {
  title: string;
  detail: string;
  status: "done" | "now" | "next";
}) {
  return (
    <li className={`timeline-step timeline-${status}`}>
      <span className="timeline-dot" />
      <div style={{ flex: 1 }}>
        <p className="timeline-title" style={{ color: status === 'now' ? 'var(--accent)' : 'var(--text)' }}>{title}</p>
        <p className="timeline-detail">{detail}</p>
      </div>
      {status === 'now' && <span className="pill pill-warning" style={{ alignSelf: 'flex-start', fontSize: '0.65rem' }}>ACTIVE</span>}
    </li>
  );
}

export default async function IncidentReplayPage({
  params
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const { incidentId } = await params;
  let bundle;

  try {
    bundle = await loadReplayIncidentBundle(incidentId);
  } catch (error) {
    if (isReplayDataNotFoundError(error)) {
      notFound();
    }
    throw error;
  }

  const beforeAfter = bundle.beforeAfter;
  const winner = bundle.winningDiagnosis;

  return (
    <main className="shell replay-shell">
      <header className="site-header site-header-compact">
        <Link className="brand" href="/">
          <span className="brand-mark">RX</span>
          <div className="brand-copy">
            <strong>ReplayX</strong>
            <span>Incident Replay</span>
          </div>
        </Link>
        <div className="site-status">
          <span className="site-status-label">Environment</span>
          <span className="site-status-value">{bundle.incident.environment}</span>
        </div>
      </header>

      <div style={{ marginBottom: '2rem' }}>
        <Link className="ghost-link" href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>←</span> Back to Index
        </Link>
      </div>

      <header className="replay-header">
        <div>
          <span className="section-kicker" style={{ color: 'var(--brand)' }}>Golden Replay</span>
          <h1>{bundle.incident.title}</h1>
          <p className="lead" style={{ fontSize: '1.25rem', maxWidth: '800px' }}>{bundle.incident.summary.customerImpact}</p>
        </div>
        <div className="header-actions">
          <StatusBadge tone="danger">{bundle.incident.severity.toUpperCase()}</StatusBadge>
          <StatusBadge tone={bundle.repro?.repro_confirmed ? "success" : "warning"}>
            {bundle.repro?.repro_confirmed ? "PROVEN" : "PARTIAL"}
          </StatusBadge>
          <StatusBadge tone="neutral">{bundle.incident.service}</StatusBadge>
        </div>
      </header>

      <section className="replay-ribbon" style={{ marginBottom: '4rem' }}>
        <article className="card" style={{ background: 'var(--bg-subtle)' }}>
          <span className="section-kicker">Input Signal</span>
          <strong style={{ display: 'block', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            {bundle.repro?.repro_confirmed ? "Confirmed Failure" : "Reported Failure"}
          </strong>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{bundle.incident.summary.symptom}</p>
        </article>
        <article className="card" style={{ border: '1px solid var(--success)', background: 'oklch(75% 0.15 150 / 0.05)' }}>
          <span className="section-kicker" style={{ color: 'var(--success)' }}>Winning Path</span>
          <strong style={{ display: 'block', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            {winner?.shortTitle ?? "Diagnosis pending"}
          </strong>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{bundle.fixCard.summary}</p>
        </article>
        <article className="card" style={{ border: '1px solid var(--accent)', background: 'oklch(70% 0.12 250 / 0.05)' }}>
          <span className="section-kicker" style={{ color: 'var(--accent)' }}>Outcome</span>
          <strong style={{ display: 'block', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            {bundle.skillCard.title}
          </strong>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{bundle.skillCard.summary}</p>
        </article>
      </section>

      <section className="timeline-layout">
        <div className="card spotlight-card">
          <span className="section-kicker">Incident Context</span>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '1.5rem' }}>{bundle.incident.summary.symptom}</h2>
          <p style={{ marginBottom: '2rem' }}>{bundle.repro?.failure_surface ?? "Replay artifact missing failure surface."}</p>
          <div className="worker-meta">
            <div>
              <span>System</span>
              <strong>{bundle.incident.service}</strong>
            </div>
            <div>
              <span>Visibility</span>
              <strong>{bundle.incident.summary.customerVisible ? "Public" : "Internal"}</strong>
            </div>
            <div>
              <span>Timestamp</span>
              <strong>{formatTimestamp(bundle.incident.summary.firstObservedAt)}</strong>
            </div>
            <div>
              <span>Region</span>
              <strong>Global / Edge</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <span className="section-kicker">Failing Signal</span>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: '1rem' }}>Observed Evidence</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{beforeAfter.beforeLabel}</p>
          <pre className="signal-block" style={{ fontSize: '0.75rem' }}>{beforeAfter.beforeEvidence}</pre>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <span className="section-kicker">Diagnosis Arena</span>
          <h2>Specialists Race to Root Cause</h2>
          <p>
            ReplayX fans out bounded experts to analyze the failure surface from different angles.
          </p>
        </div>
        <div className="worker-grid">
          {bundle.workerCards.map((worker) => (
            <WorkerCard key={worker.workerId} worker={worker} />
          ))}
        </div>
      </section>

      <section className="section">
        <div className="two-up-grid">
          <article className="card" style={{ borderLeft: '4px solid var(--success)' }}>
            <span className="section-kicker" style={{ color: 'var(--success)' }}>Winning Diagnosis</span>
            <h2 style={{ fontFamily: 'var(--font-display)', margin: '1rem 0' }}>{winner?.shortTitle ?? "Top diagnosis pending"}</h2>
            <p className="winner-summary" style={{ fontStyle: 'italic', marginBottom: '1.5rem' }}>
              &ldquo;{winner?.diagnosis ?? "No winning diagnosis artifact is available yet."}&rdquo;
            </p>
            <div className="worker-meta" style={{ marginBottom: '1.5rem' }}>
              <div>
                <span>Confidence</span>
                <strong style={{ color: 'var(--success)' }}>{winner ? formatPercent(winner.confidence) : "Pending"}</strong>
              </div>
              <div>
                <span>Files Affected</span>
                <strong>{winner?.candidateFiles.slice(0, 2).join(", ") ?? "Pending"}</strong>
              </div>
            </div>
            <ul className="bullet-list">
              {(winner?.observations ?? bundle.incident.constraints).slice(0, 3).map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </article>

          <article className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
            <span className="section-kicker" style={{ color: 'var(--accent)' }}>Fix Proposal</span>
            <h2 style={{ fontFamily: 'var(--font-display)', margin: '1rem 0' }}>{bundle.fixCard.title}</h2>
            <p style={{ marginBottom: '1.5rem' }}>{bundle.fixCard.summary}</p>
            <ul className="bullet-list">
              {bundle.fixCard.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="three-up-grid">
          <article className="card">
            <span className="section-kicker">Verification</span>
            <h3 style={{ margin: '1rem 0', fontFamily: 'var(--font-display)' }}>{bundle.proofCard.title}</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>{bundle.proofCard.summary}</p>
            <ul className="bullet-list">
              {bundle.proofCard.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>

          <article className="card">
            <span className="section-kicker">Postmortem</span>
            <h3 style={{ margin: '1rem 0', fontFamily: 'var(--font-display)' }}>{bundle.postmortemCard.title}</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>{bundle.postmortemCard.summary}</p>
            <ul className="bullet-list">
              {bundle.postmortemCard.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>

          <article className="card">
            <span className="section-kicker" style={{ color: 'var(--accent)' }}>New Skill</span>
            <h3 style={{ margin: '1rem 0', fontFamily: 'var(--font-display)' }}>{bundle.skillCard.title}</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>{bundle.skillCard.summary}</p>
            <ul className="bullet-list">
              {bundle.skillCard.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <span className="section-kicker">Flight Path</span>
          <h2>The ReplayX Narrative</h2>
          <p>Chronological breakdown of the incident response lifecycle.</p>
        </div>
        <div className="timeline-layout">
          <ol className="timeline-list">
            {bundle.timeline.map((item) => (
              <TimelineStep key={item.title} title={item.title} detail={item.detail} status={item.status} />
            ))}
          </ol>
          <div className="card" style={{ background: 'oklch(75% 0.15 150 / 0.05)', border: '1px solid var(--success)' }}>
            <span className="section-kicker" style={{ color: 'var(--success)' }}>Success Signal</span>
            <h3 style={{ fontFamily: 'var(--font-display)', margin: '1rem 0' }}>{beforeAfter.afterLabel}</h3>
            <pre className="signal-block signal-block-success" style={{ fontSize: '0.75rem' }}>{beforeAfter.afterEvidence}</pre>
          </div>
        </div>
      </section>
    </main>
  );
}
