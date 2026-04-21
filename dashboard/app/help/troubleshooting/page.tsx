import Link from "next/link";

import { controlPlaneDocsPaths } from "../../../lib/control-plane-errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sections = [
  {
    id: controlPlaneDocsPaths.signedLinks.split("#")[1],
    title: "Signed operator links",
    body:
      "When REPLAYX_INTERNAL_API_TOKEN is enabled, Ops, Analytics, incident workspaces, and action pages require a signed link. The homepage stays public. Operator access is not supposed to appear automatically from a plain run-scoped link."
  },
  {
    id: controlPlaneDocsPaths.runNotFound.split("#")[1],
    title: "Run not found",
    body:
      "This usually means the link points at a different .replayx-control-plane store than the dashboard is reading, or the local store was cleared. Open the Featured Proof, create a fresh run, and verify you are still in the same repo and environment."
  },
  {
    id: controlPlaneDocsPaths.archivedRuns.split("#")[1],
    title: "Archived runs",
    body:
      "Archive removes a terminal run from the live fleet but keeps it readable in the incident workspace and preserved in historical analytics. Archived runs are intentionally read-only. Start a fresh run instead of mutating history."
  },
  {
    id: controlPlaneDocsPaths.invalidRequest.split("#")[1],
    title: "Invalid run request",
    body:
      "Manual run creation needs a non-empty text field because ReplayX maps requests onto seeded incident bundles. Use the same incident wording from the docs if you want deterministic demo behavior."
  },
  {
    id: controlPlaneDocsPaths.localStack.split("#")[1],
    title: "Local stack",
    body:
      "Use pnpm dev:all for the fastest local path. Use pnpm dev:all:slack if you also need Slack intake. If signed links fail locally, make sure dashboard and slack share the same REPLAYX_INTERNAL_API_TOKEN."
  }
];

export default function TroubleshootingPage() {
  return (
    <main className="shell replay-shell">
      <header className="replay-header">
        <div>
          <Link className="ghost-link" href="/">
            ← Back to home
          </Link>
          <span className="eyebrow">Troubleshooting</span>
          <h1>Operator and local-dev fixes that actually help</h1>
          <p className="lead">
            This page covers the control-plane errors ReplayX can realistically surface today:
            signed-link access, missing runs, archived lifecycle, invalid run creation, and local stack setup.
          </p>
        </div>
      </header>

      <section className="story-grid fade-in">
        {sections.map((section) => (
          <article className="workspace-panel" id={section.id} key={section.id}>
            <span className="section-kicker">Troubleshooting</span>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
