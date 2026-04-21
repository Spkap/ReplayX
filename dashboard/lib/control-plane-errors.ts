export type ControlPlaneErrorPayload = {
  error: string;
  cause: string;
  fix: string;
  docsPath: string;
};

export const controlPlaneDocsPaths = {
  signedLinks: "/help/troubleshooting#signed-links",
  runNotFound: "/help/troubleshooting#run-not-found",
  archivedRuns: "/help/troubleshooting#archived-runs",
  invalidRequest: "/help/troubleshooting#invalid-run-request",
  localStack: "/help/troubleshooting#local-stack"
} as const;

export const buildControlPlaneErrorResponse = (
  payload: ControlPlaneErrorPayload,
  status: number
): Response => Response.json(payload, { status });

export const unauthorizedControlPlaneError = (
  surfaceLabel: string
): ControlPlaneErrorPayload => ({
  error: `${surfaceLabel} requires a signed operator link.`,
  cause:
    "ReplayX is running with REPLAYX_INTERNAL_API_TOKEN enabled, so operator surfaces accept only signed links minted from an already-authorized entrypoint.",
  fix:
    "Re-open this surface from the homepage, Slack handoff, Ops, Analytics, or an incident workspace that already has operator access. If this is local dev, make sure every service shares the same REPLAYX_INTERNAL_API_TOKEN.",
  docsPath: controlPlaneDocsPaths.signedLinks
});

export const runNotFoundControlPlaneError = (runId?: string): ControlPlaneErrorPayload => ({
  error: runId ? `ReplayX could not find run ${runId}.` : "ReplayX could not find that run.",
  cause:
    "The run id is stale, the control-plane store was reset, or this environment is pointing at a different .replayx-control-plane database than the link expects.",
  fix:
    "Open the Featured Proof or create a fresh live run. In local dev, verify the dashboard is reading the expected .replayx-control-plane store and that you did not switch repos or clear the database.",
  docsPath: controlPlaneDocsPaths.runNotFound
});

export const invalidRunRequestControlPlaneError = (): ControlPlaneErrorPayload => ({
  error: "ReplayX needs a non-empty incident description.",
  cause:
    "Run creation expects a text payload so the seeded incident selector can map the request to a supported incident bundle.",
  fix:
    "Send a JSON body with text, for example: {\"source\":\"manual\",\"text\":\"checkout is overselling stock during concurrent orders\"}.",
  docsPath: controlPlaneDocsPaths.invalidRequest
});

export const archivedRunReadOnlyControlPlaneError = (): ControlPlaneErrorPayload => ({
  error: "Archived runs are read-only incident records.",
  cause:
    "Archive removes a terminal run from the live fleet while preserving the audit trail and historical analytics. ReplayX does not silently reopen archived history.",
  fix:
    "Open the incident workspace to inspect the preserved record, or create a fresh run instead of mutating the archived one.",
  docsPath: controlPlaneDocsPaths.archivedRuns
});
