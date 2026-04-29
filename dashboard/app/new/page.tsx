import Link from "next/link";

import {
  buildAuthorizedPath,
  buildControlPlaneAccessToken,
  controlPlaneAuthRequired,
  isControlPlaneAccessTokenValid
} from "../../lib/control-plane-auth";
import { unauthorizedControlPlaneError } from "../../lib/control-plane-errors";
import { ControlPlaneErrorPanel } from "../../components/control-plane-error-panel";
import { AppFrame, PageHeader, StatusPill } from "../../components/replayx-ui";
import { NewRunForm } from "./new-run-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function NewRunPage({
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
      <AppFrame active="new" statusDetail="Signed link required">
        <ControlPlaneErrorPanel
          kicker="Unauthorized"
          title="This ReplayX run creation page requires a signed operator link"
          problem={unauthorizedControlPlaneError("ReplayX run creation")}
        />
      </AppFrame>
    );
  }

  const controlPlaneAccessToken = accessToken ?? buildControlPlaneAccessToken({ scope: "control-plane" });
  const homePath = buildAuthorizedPath("/", controlPlaneAccessToken);
  const opsPath = buildAuthorizedPath("/ops", controlPlaneAccessToken);
  const analyticsPath = buildAuthorizedPath("/analytics", controlPlaneAccessToken);
  const navItems = [
    { href: homePath, label: "Proof", shortLabel: "PF" },
    { href: buildAuthorizedPath("/new", controlPlaneAccessToken), label: "New run", shortLabel: "NR", active: true },
    { href: opsPath, label: "Ops", shortLabel: "OP" },
    { href: analyticsPath, label: "Analytics", shortLabel: "AN" }
  ];

  return (
    <AppFrame active="new" homePath={homePath} navItems={navItems} statusDetail="Realtime intake">
      <PageHeader
        actions={
          <Link className="button button-secondary" href={opsPath}>
            Open ops
          </Link>
        }
        eyebrow="New live incident"
        lead="Start with the report exactly as it arrived. ReplayX will validate the baseline, gather repo evidence, and stop before any unproven fix claim."
        meta={<StatusPill tone="accent">Realtime by default</StatusPill>}
        title="Create the run from the raw incident."
      />

      <section className="two-column fade-in">
        <NewRunForm accessToken={controlPlaneAccessToken} />
        <aside className="rail-panel sticky-aside">
          <span className="eyebrow">Execution contract</span>
          <h3>What happens next</h3>
          <div className="ops-stack">
            <div className="phase-step phase-running">
              <div>
                <strong>Validation baseline</strong>
                <p>ReplayX records the report, repo target, environment, and initial capability boundary.</p>
              </div>
              <StatusPill tone="accent">First</StatusPill>
            </div>
            <div className="phase-step">
              <div>
                <strong>Evidence packet</strong>
                <p>Commands, artifact paths, decisions, and rejected routes are attached to the workspace.</p>
              </div>
              <StatusPill tone="neutral">Next</StatusPill>
            </div>
            <div className="phase-step">
              <div>
                <strong>Proof gate</strong>
                <p>Resolution stays pending until a patch and regression path can be validated.</p>
              </div>
              <StatusPill tone="neutral">Then</StatusPill>
            </div>
          </div>
        </aside>
      </section>
    </AppFrame>
  );
}
