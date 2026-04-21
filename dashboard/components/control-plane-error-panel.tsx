import Link from "next/link";

import type { ControlPlaneErrorPayload } from "../lib/control-plane-errors";

export function ControlPlaneErrorPanel({
  kicker,
  title,
  problem,
  error,
  docsPath
}: {
  kicker: string;
  title: string;
  problem: ControlPlaneErrorPayload;
  error?: string | null;
  docsPath?: string;
}) {
  return (
    <article className="workspace-panel">
      <span className="section-kicker">{kicker}</span>
      <h2>{title}</h2>
      <p>{problem.error}</p>
      <div className="ops-stack" style={{ marginTop: "1rem" }}>
        <div className="rail-note">
          <strong>Cause</strong>
          <p>{problem.cause}</p>
        </div>
        <div className="rail-note">
          <strong>Fix</strong>
          <p>{problem.fix}</p>
        </div>
        {error ? (
          <div className="rail-note">
            <strong>Technical detail</strong>
            <p>{error}</p>
          </div>
        ) : null}
      </div>
      <div className="rail-actions" style={{ marginTop: "1rem" }}>
        <Link className="ghost-link" href={docsPath ?? problem.docsPath}>
          Open troubleshooting guide
        </Link>
      </div>
    </article>
  );
}
