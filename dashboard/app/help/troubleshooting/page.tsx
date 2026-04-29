import Link from "next/link";

import { controlPlaneDocsPaths } from "../../../lib/control-plane-errors";
import { AppFrame, PageHeader, StatusPill } from "../../../components/replayx-ui";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const sections = [
  {
    id: controlPlaneDocsPaths.signedLinks.split("#")[1],
    title: "Signed operator links",
    body:
      "When REPLAYX_INTERNAL_API_TOKEN is enabled, Ops, Analytics, incident workspaces, and action pages require a signed link. The homepage stays public. Operator access should not appear automatically from a plain run-scoped link."
  },
  {
    id: controlPlaneDocsPaths.runNotFound.split("#")[1],
    title: "Run not found",
    body:
      "This usually means the link points at a different .replayx-control-plane store than the dashboard is reading, or the local store was cleared. Open the featured proof, create a fresh run, and verify you are still in the same repo and environment."
  },
  {
    id: controlPlaneDocsPaths.archivedRuns.split("#")[1],
    title: "Archived runs",
    body:
      "Archive removes a terminal run from the live fleet but keeps it readable in the incident workspace and preserved in historical analytics. Archived runs are intentionally read-only."
  },
  {
    id: controlPlaneDocsPaths.invalidRequest.split("#")[1],
    title: "Invalid run request",
    body:
      "Manual run creation needs a non-empty text field because ReplayX preserves the original incident report as the realtime intake packet. Deterministic fixture behavior requires an explicit fixture id."
  },
  {
    id: controlPlaneDocsPaths.localStack.split("#")[1],
    title: "Local stack",
    body:
      "Use pnpm dev:all for the fastest local path. Use pnpm dev:all:slack if you also need Slack intake. If signed links fail locally, make sure dashboard and Slack share the same REPLAYX_INTERNAL_API_TOKEN."
  }
];

export default function TroubleshootingPage() {
  return (
    <AppFrame active="help" statusDetail="Troubleshooting">
      <PageHeader
        actions={
          <Link className="button button-secondary" href="/">
            Back to proof
          </Link>
        }
        eyebrow="Troubleshooting"
        lead="The control plane should fail with useful instructions: signed-link access, missing runs, archive lifecycle, invalid intake, and local stack setup."
        meta={<StatusPill tone="accent">Operator docs</StatusPill>}
        title="Fix the workflow, not the symptoms."
      />

      <section className="story-grid fade-in">
        {sections.map((section) => (
          <article className="workspace-panel" id={section.id} key={section.id}>
            <span className="eyebrow">Troubleshooting</span>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>
    </AppFrame>
  );
}
