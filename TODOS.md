# ReplayX Roadmap

This file tracks product and engineering work that is intentionally deferred. It should stay small and current. Completed implementation history belongs in git, not in this file.

## Next

### Bounded Patch Worker

- What: add a Codex-backed worker that edits a sandbox branch, records the diff, reruns validation, and only then marks a PR path as ready.
- Why: fresh realtime incidents currently stop at an evidence packet. ReplayX should not claim resolution until a real code change has been applied and verified.
- Depends on: the existing realtime investigation packet in `dashboard/lib/live-runs.ts`.
- Validation: root tests, dashboard build, and at least one fresh realtime run that produces a diff artifact.

### Stronger Operator Identity

- What: replace broad signed-link operator access with a real identity/session boundary.
- Why: signed links are useful for local and early operator flows, but a multi-user product needs revocation, user attribution, and clearer audit history.
- Depends on: deciding the production auth provider and user model.
- Validation: access-control tests for `/ops`, `/analytics`, live workspaces, and run actions.

### Realtime Regression Proof

- What: let fresh incidents preserve the exact failing command, fixed command, and healthy control after a patch worker runs.
- Why: the product promise is proof, not just patch generation.
- Depends on: bounded patch worker and a stable artifact contract for diffs and command output.
- Validation: regression artifacts appear in the live workspace and remain readable after archive.
