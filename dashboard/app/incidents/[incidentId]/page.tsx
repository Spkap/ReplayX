import Link from "next/link";
import { notFound } from "next/navigation";
import {
  formatPercent,
  formatTimestamp,
  isReplayDataNotFoundError,
  loadReplayIncidentBundle,
  type ReplayWorkerCard
} from "../../../lib/replay-data";
import {
  AppFrame,
  CommandBlock,
  MetricCell,
  PageHeader,
  SectionHeader,
  StatusPill
} from "../../../components/replayx-ui";

function StatusBadge({ tone, children }: { tone: "danger" | "neutral" | "success" | "warning"; children: string }) {
  return <StatusPill tone={tone}>{children}</StatusPill>;
}

function WorkerCard({ worker }: { worker: ReplayWorkerCard }) {
  const tone =
    worker.status === "completed" ? "success" : worker.status === "weak_signal" ? "warning" : "neutral";

  return (
    <article className="workspace-panel worker-card">
      <div className="worker-topline">
        <div>
          <p className="worker-label">{worker.label}</p>
          <h3 className="panel-title">{worker.shortTitle}</h3>
        </div>
        <StatusBadge tone={tone}>{worker.status.replace("_", " ")}</StatusBadge>
      </div>
      <p className="worker-diagnosis">{worker.diagnosis}</p>
      <div className="worker-meta">
        <div>
          <dt>Confidence</dt>
          <dd>{formatPercent(worker.confidence)}</dd>
        </div>
        <div>
          <dt>Mode</dt>
          <dd>{worker.mode}</dd>
        </div>
      </div>
      <ul className="bullet-list">
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
      <div>
        <p className="timeline-title">{title}</p>
        <p className="timeline-detail">{detail}</p>
      </div>
      {status === "now" ? <StatusPill tone="warning">Active</StatusPill> : null}
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
  const navItems = [
    { href: "/", label: "Proof", shortLabel: "PF" },
    { href: "/new", label: "New run", shortLabel: "NR" },
    { href: "/ops", label: "Ops", shortLabel: "OP" },
    { href: "/analytics", label: "Analytics", shortLabel: "AN" }
  ];

  return (
    <AppFrame active="replay" navItems={navItems} statusDetail="Fixture replay">
      <PageHeader
        actions={
          <div className="header-actions">
            <StatusBadge tone="danger">{bundle.incident.severity.toUpperCase()}</StatusBadge>
            <StatusBadge tone={bundle.repro?.repro_confirmed ? "success" : "warning"}>
              {bundle.repro?.repro_confirmed ? "Proven" : "Partial"}
            </StatusBadge>
            <StatusBadge tone="neutral">{bundle.incident.service}</StatusBadge>
          </div>
        }
        eyebrow="Golden replay"
        lead={bundle.incident.summary.customerImpact}
        title={bundle.incident.title}
      />

      <section className="replay-ribbon fade-in">
        <MetricCell
          label="Input signal"
          value={bundle.repro?.repro_confirmed ? "Confirmed failure" : "Reported failure"}
          detail={bundle.incident.summary.symptom}
          tone="danger"
        />
        <MetricCell
          label="Winning path"
          value={winner?.shortTitle ?? "Diagnosis pending"}
          detail={bundle.fixCard.summary}
          tone="success"
        />
        <MetricCell
          label="Outcome"
          value={bundle.skillCard.title}
          detail={bundle.skillCard.summary}
          tone="accent"
        />
      </section>

      <section className="section timeline-layout">
        <article className="dark-panel">
          <span className="eyebrow">Incident context</span>
          <h2 className="panel-title">{bundle.incident.summary.symptom}</h2>
          <p>{bundle.repro?.failure_surface ?? "Replay artifact missing failure surface."}</p>
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
              <span>Incident id</span>
              <strong>{bundle.incident.incidentId}</strong>
            </div>
          </div>
        </article>

        <article className="workspace-panel">
          <span className="eyebrow">Failing signal</span>
          <h2>Observed evidence</h2>
          <p>{beforeAfter.beforeLabel}</p>
          <CommandBlock>{beforeAfter.beforeEvidence}</CommandBlock>
        </article>
      </section>

      <section className="section">
        <SectionHeader
          eyebrow="Diagnosis arena"
          title="Specialists race to root cause"
          body="Bounded workers inspect the same failure surface from different failure domains, then the challenger rejects weak theories."
        />
        <div className="worker-grid">
          {bundle.workerCards.map((worker) => (
            <WorkerCard key={worker.workerId} worker={worker} />
          ))}
        </div>
      </section>

      <section className="section two-up-grid">
        <article className="workspace-panel">
          <span className="eyebrow">Winning diagnosis</span>
          <h2>{winner?.shortTitle ?? "Top diagnosis pending"}</h2>
          <p>{winner?.diagnosis ?? "No winning diagnosis artifact is available yet."}</p>
          <div className="worker-meta">
            <div>
              <span>Confidence</span>
              <strong>{winner ? formatPercent(winner.confidence) : "Pending"}</strong>
            </div>
            <div>
              <span>Files affected</span>
              <strong>{winner?.candidateFiles.slice(0, 2).join(", ") ?? "Pending"}</strong>
            </div>
          </div>
          <ul className="bullet-list">
            {(winner?.observations ?? bundle.incident.constraints).slice(0, 3).map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </article>

        <article className="workspace-panel">
          <span className="eyebrow">Fix proposal</span>
          <h2>{bundle.fixCard.title}</h2>
          <p>{bundle.fixCard.summary}</p>
          <ul className="bullet-list">
            {bundle.fixCard.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="section three-up-grid">
        <article className="workspace-panel">
          <span className="eyebrow">Verification</span>
          <h3>{bundle.proofCard.title}</h3>
          <p>{bundle.proofCard.summary}</p>
          <ul className="bullet-list">
            {bundle.proofCard.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </article>
        <article className="workspace-panel">
          <span className="eyebrow">Postmortem</span>
          <h3>{bundle.postmortemCard.title}</h3>
          <p>{bundle.postmortemCard.summary}</p>
          <ul className="bullet-list">
            {bundle.postmortemCard.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </article>
        <article className="workspace-panel">
          <span className="eyebrow">New skill</span>
          <h3>{bundle.skillCard.title}</h3>
          <p>{bundle.skillCard.summary}</p>
          <ul className="bullet-list">
            {bundle.skillCard.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="section">
        <SectionHeader eyebrow="Flight path" title="The ReplayX narrative" />
        <div className="timeline-layout">
          <ol className="timeline-list">
            {bundle.timeline.map((item) => (
              <TimelineStep key={item.title} title={item.title} detail={item.detail} status={item.status} />
            ))}
          </ol>
          <article className="workspace-panel">
            <span className="eyebrow">Success signal</span>
            <h3>{beforeAfter.afterLabel}</h3>
            <CommandBlock success>{beforeAfter.afterEvidence}</CommandBlock>
          </article>
        </div>
      </section>

      <section className="section">
        <Link className="button button-secondary" href="/">
          Back to proof surface
        </Link>
      </section>
    </AppFrame>
  );
}
