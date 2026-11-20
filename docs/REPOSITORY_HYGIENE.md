# Repository hygiene

This file records the repository cleanup state for the Ghost Signal 1.0 release.

## Verified baseline (2026-11-20)

- Default branch: `main`.
- Repository tree inspected on `feat/save-schema-migrations`: 230 tracked files.
- Branch inventory: 129 branch refs (10 `design/*`, 75 `feat/*`, 31 `fix/*`, 11 `test/*`, plus `main` and `refactor/*`).
- Pull requests: #128 is open; the reviewed recent PR history contains merged feature, design, fix and test work. Closed-but-unmerged PRs #123 and #61 must not be treated as merged.
- No tracked `node_modules`, generated build directories, coverage output, Playwright output or local environment files were found in the inspected tree.
- No large tracked blobs over 1 MB were found.
- `main` was not modified during this audit. Cleanup and CI work is being staged on `feat/save-schema-migrations`.

## Completed

- [x] Inspect root layout and tracked-file inventory.
- [x] Inspect recent PR history and identify the open save-migration PR.
- [x] Confirm that closed-but-unmerged PRs #123 and #61 are not safe deletion candidates.
- [x] Add ignore rules for local dependencies, secrets, logs, generated test output and OS metadata.
- [x] Replace the brittle fixed-count modal dismissal in the visual smoke test with a state-based queue drain and actionable timeout diagnostics.
- [x] Keep cleanup changes isolated from `main`.

## In progress

- [ ] Obtain a passing Visual smoke run after the modal-queue test update.
- [ ] Review all 129 branch refs against merged PRs and unique commits.
- [ ] Prune branches only after confirming their work is merged or otherwise preserved.
- [ ] Review asset usage and duplicate/obsolete documentation before deleting anything.
- [ ] Complete a clean install/build/test run from the documented setup.

## Branch cleanup rules

1. A branch is not obsolete merely because it is old.
2. Delete a branch only when its PR is merged and its head work is reachable from `main`, or when its unique work has been explicitly preserved elsewhere.
3. Preserve branches for open PRs and closed-but-unmerged work until their disposition is decided.
4. Do not rewrite or force-push `main` as part of routine cleanup.
5. Keep generated artifacts, local credentials and machine-specific files out of Git; keep source assets and authored game data tracked.

## Follow-up

After the Visual smoke run is green, perform branch pruning and the deeper asset/documentation audit as separate, reviewable cleanup steps. Update this checklist with exact counts and links rather than marking unverified work complete.
