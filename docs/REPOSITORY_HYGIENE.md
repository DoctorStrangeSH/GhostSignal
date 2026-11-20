# Repository hygiene

This file records the repository cleanup state for the Ghost Signal 1.0 release.

## Verified baseline (2026-11-20)

- Default branch: `main`.
- Repository tree inspected on `feat/save-schema-migrations`: 232 tracked files.
- Branch inventory: 129 branch refs (10 `design/*`, 75 `feat/*`, 31 `fix/*`, 11 `test/*`, plus `main` and `refactor/*`).
- Pull requests: 128 total. 125 are merged, #128 is open, and #123 plus #61 are closed without merge. The 125 merged PR head branches are cleanup candidates; preserve the two closed-but-unmerged branches and the open PR branch.
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

- [x] Obtain passing Quality checks and Visual smoke runs on the updated branch HEAD.
- [ ] Review all 129 branch refs against merged PRs and unique commits.
- [ ] Prune branches only after confirming their work is merged or otherwise preserved.
- [ ] Complete source-level asset reference audit and review duplicate/obsolete documentation before deleting anything.
- [ ] Complete a clean install/build/test run from the documented setup.

## Branch cleanup rules

1. A branch is not obsolete merely because it is old.
2. Delete a branch only when its PR is merged and its head work is reachable from `main`, or when its unique work has been explicitly preserved elsewhere.
3. Preserve branches for open PRs and closed-but-unmerged work until their disposition is decided.
4. Do not rewrite or force-push `main` as part of routine cleanup.
5. Keep generated artifacts, local credentials and machine-specific files out of Git; keep source assets and authored game data tracked.

## Follow-up

With both CI workflows green, continue branch pruning and the deeper asset/documentation audit as separate, reviewable cleanup steps. Update this checklist with exact counts and links rather than marking unverified work complete.

## Asset and content inventory (2026-11-20)

- The inspected tree contains 172 files under `assets/`: 26 authored art files and the remaining application styles, scripts and data.
- Art inventory: 20 WebP, 5 SVG and 1 PNG (26 files). The separate favicon at `assets/icons/ghost-signal.svg` brings the total SVG count under `assets/` to six.
- Ten art files exceed 250 KB; the largest is the city map at approximately 727 KB. These are not automatically cleanup targets: visual quality and actual rendering use must be checked before recompression or replacement.
- Repeated basenames in separate case folders (for example `case-001/evidence.js` and `case-002/evidence.js`) are intentional case-pack boundaries, not duplicate files.
- `assets/data/narrative/notes.js` and `assets/js/systems/notes.js` have the same basename but different responsibilities (authored note content vs. runtime note system); do not merge based on filename alone.
- No asset was deleted during this pass. A source-level reference audit is still required before declaring any art file unused.

## Latest CI confirmation

- Commit `b94d0498792ce2305ee7fc94ebfed43a926eb516`: Quality checks — PASS; Visual smoke — PASS.
- Documentation-only follow-up commit `3a82e7fdec9872c4b3d30922e7a0aa9159a2a2d6`: Quality checks — PASS; Visual smoke was still running at the time of this audit update.
- The modal-queue smoke test now waits for the queue and Bootstrap backdrop/body state to settle instead of relying on a fixed number of dismissals.


## Reproducible dependency installation

- `package-lock.json` is currently absent. The quality workflow does not install npm dependencies, while the visual workflow installs a pinned Playwright version with lockfile generation disabled.
- Before release, decide whether to add and commit a lockfile for the runtime/development dependency set, then use `npm ci` in workflows that install project dependencies. Do not generate or claim a lockfile until it has been produced and validated with the project's Node/npm version.

## Art-reference audit (2026-11-20)

- Direct references were confirmed for all five location SVGs through `assets/css/art-direction.css`.
- Direct references were confirmed for the board texture, menu background, brand emblem and seven location/city backgrounds through the corresponding noir CSS files.
- All nine portrait WebP files are referenced by the two case NPC data packs and rendered by `assets/js/ui/npcListUI.js`.
- `assets/art/evidence/bar-contact-print.webp` is the only art file not yet found in the direct-reference paths checked (CSS, HTML and case NPC/evidence/object data). Treat it as a possible orphan, not as safe to delete: inspect dynamic/runtime usage and visual intent before removal.
- No art resources were deleted or recompressed in this audit. The objective is to identify genuinely unused files without degrading the visual direction.
