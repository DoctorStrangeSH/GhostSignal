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
- [x] Complete source-level asset reference audit for the current art inventory; all 26 art files have confirmed uses after checking the dynamic evidence-photo viewer.
- [x] Remove unpinned runtime/dev server dependencies and replace them with a Node.js built-in static server.
- [x] Complete Quality checks on the case-dialogue architecture changes: 515/515 tests passed; data validation and syntax checks passed.
- [x] Extract recurring NPC profiles and their default dialogues into `assets/data/shared/`; update script load order and integration coverage.
- [x] Visual smoke passed on the latest runtime-code HEAD; only documentation updates followed.
- [x] Add a regression guard: cloud upload is aborted when the preceding local save fails; the new test is running in CI.

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

- The application package has no third-party npm dependencies after replacing `serve`/`live-server` with a Node.js built-in static server. A project `package-lock.json` is therefore unnecessary at this stage.
- The Visual smoke workflow installs its pinned Playwright test runner ephemerally with lockfile generation disabled; it is CI tooling, not an application dependency.

## Art-reference audit (2026-11-20)

- Direct references were confirmed for all five location SVGs through `assets/css/art-direction.css`.
- Direct references were confirmed for the board texture, menu background, brand emblem and seven location/city backgrounds through the corresponding noir CSS files.
- All nine portrait WebP files are referenced by the two case NPC data packs and rendered by `assets/js/ui/npcListUI.js`.
- `assets/art/evidence/bar-contact-print.webp` is confirmed in active runtime use by `assets/js/ui/inventoryUI.js` (`_renderBarPhotoStudy`, line 193), shown when the player inspects `bar_photo`. It is not an orphan and must be retained.
- All 26 art resources in `assets/art/` now have confirmed direct or dynamic references; no art file is currently approved for deletion.
- No art resources were deleted or recompressed in this audit. The objective is to identify genuinely unused files without degrading the visual direction.


## Save/sync integrity follow-up (2026-11-20)

- [x] Found and fixed a failure path in `SyncManager.saveEverywhere()`: previously it could proceed to cloud upload even if `storage.saveProgress()` returned false.
- [x] Cloud upload now stops immediately when local persistence fails or the persisted snapshot cannot be read back.
- [x] Added a regression test proving that local write failure returns false and performs zero cloud writes.
- [x] Confirm Quality checks on commit `dde279b4198d6bd7049f4b847011c266d060af50`: 514/514 tests passed on commit `8e3a979b43c38fa159fce2c2a380f785e341c9d2`.
- [ ] Confirm Visual smoke on the same commit.
- [x] Remove the need for a project lockfile by eliminating third-party app dependencies; document Node.js 20+ as the only local runtime requirement.


## Dependency-free local server (2026-11-20)

- [x] Replaced `npx serve` and `npx live-server` package scripts with `scripts/dev-server.mjs`, using only Node.js built-ins.
- [x] Updated README startup instructions: no `npm install` is required; `npm start` serves on 4173 and `npm run dev` serves on 3000.
- [x] Server supports GET/HEAD, MIME types, directory index files, 404/405 responses, path traversal protection and symlink containment checks.
- [x] Hidden files/directories (including `.git` and `.env`) are denied to avoid exposing repository metadata or local secrets.
- [x] Added automated tests for normal serving, MIME, HEAD, missing files, unsupported methods, traversal, hidden paths and symlink escapes.
- [x] Verify the server implementation and tests: 512/512 tests passed on commit `c2a66969b90f3003a7670bb1a31bc3ab6670c2d4`.
- [ ] Complete Visual smoke on the newest server implementation.


## Case-pack ownership pass (2026-11-20)

- [x] Moved case-002's bartender dialogue selection out of the case-001 NPC profile and into `CASE_002.npcDialogueOverrides`.
- [x] NPCManager resolves case-owned overrides from the active case data and restores that data when loading a saved NPC manager.
- [x] Validator checks that each override targets an active NPC and a dialogue authored for that NPC; dialogue-link validation runs after case packs are inspected.
- [x] Regression coverage added for switching between case-001 and case-002 without mutating the shared bartender profile.
- [x] Updated the new-case template and added `docs/CASE_PACK_AUTHORING.md`.
- [ ] Extract recurring bartender/sergeant profiles and shared dialogue from the legacy case-001 folder into a shared-data pack before case-003 is created.


## Shared NPC and dialogue extraction (2026-11-20)

- [x] Moved Joe and Sergeant Mills profiles to `assets/data/shared/npcs.js`.
- [x] Moved their base dialogue trees to `assets/data/shared/dialogues/`.
- [x] Removed the old case-001 dialogue script tags and files; case-specific Joe dialogue for case-002 remains in case-002.
- [x] Case runtime tests load the shared data before case packs.
- [x] Quality checks and Visual smoke passed after the shared dialogue move.


## Location progression ownership (2026-11-20)

- [x] Separate permanent reward unlocks from case-scoped evidence and warrant gates.
- [x] Persist both ownership sets and restore visited locations from the location snapshot.
- [x] Preserve all ambiguous unlocks in legacy saves rather than deleting progress during migration.
- [x] Add regression coverage for new-case isolation, permanent ending rewards, and legacy-save compatibility.
- [x] Quality checks: 516/516 tests passed; JavaScript syntax and game-data validation passed.


- [x] Case-scoped location unlock ownership changes passed Quality checks (516/516) and Visual smoke on runtime commit `1f667492b24028fbcfeabbe5d0c768324edb79f7`; later commits only updated documentation.


## Case 001 evidence reachability (2026-11-20)

- [x] Added a scene-object reachability regression test that follows accessible locations, examine-spawned evidence, revealed objects, and keyed containers.
- [x] Confirmed both required accusation exhibits (`hidden_note`, `wire_fragment`) are discoverable.
- [x] Confirmed both independent corroboration paths (`victim_knew_danger` from the diary and `blackwood_affair` from the torn photograph) have reachable sources.
- [x] Confirmed the housekeeper dialogue graph contains the `blackwood_location_revealed` node required for the perfect ending.
- [x] Quality checks: 519/519 tests passed; JavaScript syntax and game-data validation passed.
- [ ] Browser playthrough still required for the actual key → wall safe → diary interaction sequence and all final routes.
