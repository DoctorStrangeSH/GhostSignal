# Аудит веток Git — 22.11.2026

Проверено 164 ветки (страницы GitHub API 1–2) и история 160 закрытых PR.

| Группа | Количество | Решение |
| --- | ---: | --- |
| Ветки с точным совпадением SHA головы и head SHA слитого PR | 154 | Безопасные кандидаты на удаление после merge |
| Ветки с уникальными коммитами, не подтверждёнными слитым PR | 7 | Сохранить; требуют ручной интеграционной оценки |
| Служебные ветки | 3 | Сохранить: `main`, два cleanup-потока |

## Ветки с уникальными изменениями — НЕ УДАЛЯТЬ

- `feat/community-reputation-ledger` — 4 коммита впереди main; изменяет репутацию, тесты и roadmap.
- `feat/joe-answers-thomas-interview-request` — 6 коммитов впереди; диалоги bartender/waiter, dialogue engine и relationship service.
- `fix/failed-case-reputation-context` — 2 коммита впереди; EventController и его тесты.
- `test/call-ui-explicit-dialogue-regression` — 8 коммитов впереди; visual smoke и roadmap.
- `test/case-one-full-confession-flow-refresh` — 5 коммитов впереди; inventory UI, visual smoke и тесты.
- `test/dialogue-reload-browser-acceptance` — 12 коммитов впереди; case controller, app, тесты и smoke.
- `test/visual-smoke-drain-incoming-calls` — 2 коммита впереди; visual smoke.

Все семь веток расходятся с main и содержат уникальные изменения. Удаление или принудительное перемещение уничтожит потенциально полезную работу.

## Служебные ветки

- `main` — основная ветка.
- `chore/repository-polish-after-dialogue-merge` — активная ветка PR #161.
- `chore/repository-polish-deepseek-cleanup` — старый источник PR #160; содержит историю документационных изменений и расходится с main. Не удалять до закрытия PR #161 и проверки переноса всех правок.

## Ограничение текущего инструментария

Доступная GitHub-интеграция позволяет читать ветки и сравнивать коммиты, но не предоставляет операцию удаления ветки. Поэтому 154 ветки не удалялись автоматически. Их можно удалить через GitHub после проверки списка, сохраняя семь веток с уникальными коммитами и три служебные ветки.

# Последний аудит (22.11.2026)

- Проверенное дерево `main`: 252 отслеживаемых файла и 33 каталога Git.
- Проверены все пять скриптов в `scripts/` на `DeepSeek`, `Deep Seek` и `Deep-Seek`: совпадений нет. Никакие полезные комментарии не удалялись.
- README переработан: визуальная идентичность, назначение игры, быстрый запуск, команды качества, архитектура и ссылки на документацию.
- Сторонние runtime-зависимости не добавлялись; `npm install` для запуска не нужен.
- В этом проходе игровые данные и ассеты не удалялись.
- PR #159 merged в `main` (merge commit `62cc7b2802b7fb4a209aa7e79a40d7c361e1fe76`); Quality checks и Visual Smoke PASS на точном head `c74dc9ff7a140bd7498acb5fd284f8607b4cc908`.
- Первоначальный PR #160 закрыт без merge из-за устаревшей базы. Актуальный PR #161: `chore/repository-polish-after-dialogue-merge`.
- PR #161 merged в `main` (merge commit `3ca946838a96ba04adb95aa4980ac1b9857c8cdc`); Quality checks и Desktop/Mobile Visual Smoke PASS на точном head `16793d570dd72478bf7ee7558a5c39801d3f5e21`.
- Аудит веток: 154 подтверждённые ветки-кандидаты, 7 веток с уникальными коммитами сохранены, 3 служебные ветки сохранены. Физическое удаление 154 кандидатов не выполнено.
- NOT DONE: полный поиск авторских пометок за пределами `scripts/`, интеграционная оценка 7 уникальных веток и полная браузерная приёмка двух дел.

Исторические записи аудитов сохранены ниже. Более ранние цифры и статусы относятся к указанным в тех записях коммитам и датам, а не к текущему состоянию.

---

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

- [x] Visual smoke passed on runtime commit `51709079cdc09d668cc322861e232b5038e3b3c8`; subsequent commits changed only regression tests and documentation.


## Case 001 dialogue prerequisite validation (2026-11-20)

- [x] Fixed Frank's unavailable follow-up: replaced the orphaned `mary_suspicion` insight condition with `red_scarf_detail`, which the preceding dialogue node actually grants.
- [x] Added regression coverage for every `hasInsight` and `hasItem` prerequisite in the housekeeper and porter dialogue trees.
- [x] Quality checks: 520/520 tests passed; syntax validation and game-data validation passed.
- [ ] Browser playthrough still required to confirm the follow-up question appears immediately after the red-scarf clue is received.


## Case 001 dialogue graph coverage (2026-11-20)

- [x] Added graph reachability coverage for all seven NPC dialogues available in case 001: housekeeper, porter, coroner, Elias, wife, shared bartender, and sergeant.
- [x] Every node must be reachable from the dialogue start or an explicit entry point; normal answers and special evidence/contradiction reaction entry paths are included.
- [x] Start nodes, explicit entry points, and all answer targets must resolve to existing nodes.
- [x] Quality checks: 522/522 tests passed; JavaScript syntax and game-data validation passed.
- [ ] Full browser playthrough is still required to verify gated paths under actual evidence, relationship, and save-state conditions.


## Case 002 dialogue graph validation (2026-11-20)

- [x] Added graph regression coverage for all 14 dialogue assets used by case 002, including its case-specific bartender dialogue and shared sergeant dialogue.
- [x] Validates start nodes, explicit entry points, all answer targets, and special evidence/contradiction reaction paths.
- [x] Every declared dialogue node must be reachable from a start, explicit entry point, or special reaction entry.
- [x] Quality checks: 524/524 tests passed; JavaScript syntax and game-data validation passed.
- [ ] Browser playthrough remains required for gated branches under actual evidence, relationship, and save-state conditions.


## Active dialogue save/resume (2026-11-20)

- [x] Added a bounded dialogue snapshot: dialogue/NPC IDs, current node, stable source node, display text, mood, and last 100 transcript entries.
- [x] Restore validates the dialogue and NPC identity, rebuilds answer actions from authored case data, and does not replay node effects, NPC memory writes, or game-time costs.
- [x] SaveController persists the active dialogue together with the active case ID; completed calls and new case starts clear it.
- [x] CallInterface resumes the connected conversation UI without ringing or charging time.
- [x] NPC call/chat paths resolve case-specific dialogue overrides; reload rejects snapshots that do not match the active case's dialogue assignment.
- [x] Transcript records player answers, evidence presentation, and contradiction prompts.
- [x] Quality checks: 531/531 tests passed; 110 JavaScript files passed syntax validation; game-data validation passed.
- [ ] Manual browser verification remains required for ordinary dialogue, evidence reaction, and case-specific bartender dialogue after reload.


## Interrupted dialogue restore fix (2026-11-21)

- [x] Fixed `CallInterface.restoreActiveDialogue` to remove the reference to an undeclared `dialogueId` variable.
- [x] Restores the saved `snapshot.dialogueId` rather than the shared `npc.dialogueId`, preserving case-specific dialogue overrides.
- [x] Added a regression test for the case-two bartender whose investigation dialogue differs from the shared NPC profile.
- [x] Quality checks: 532/532 tests passed; JavaScript syntax and game-data validation passed.
- [ ] Latest visual smoke is still running; browser-level manual resume verification remains an acceptance task.


## Продолжение после PR #161 — 22.11.2026

- [x] PR #161 merged; README и три документа проходят Quality checks и Desktop/Mobile Visual Smoke.
- [x] Перепроверены ссылки на изображения и docs в README, а также команды запуска по package.json.
- [ ] PR #163: браузерный маршрут полного признания Кейна и идеальной концовки дела №2 — ожидает CI.
- [ ] Полный поиск DeepSeek-атрибуции по всем исходникам за пределами scripts/.
- [ ] Ручная оценка семи веток с уникальными коммитами; не удалять до решения.
- [ ] Удаление 154 веток-кандидатов через GitHub UI после отдельной финальной проверки.


## Актуализация после PR #163 — 22.11.2026

- [x] PR #161 merged: repository polish; Quality + Desktop/Mobile Visual Smoke PASS.
- [x] PR #163 merged в `main` (merge commit `c0b91b470c14436aa808467b42fbf92ed514cb3a`). Quality checks и Visual Smoke PASS на точном head `6235619390ff7736c259804363a2bb92edc287cc`.
- [x] Browser smoke теперь проходит три исхода обоих дел; идеальная концовка дела №2 проверяется через полную цепочку признания Кейна и reload в середине допроса.
- [ ] Browser acceptance обещания Томасу и социальных последствий после признания.
- [ ] Полный source audit на авторские пометки за пределами `scripts/`.
- [ ] Интеграционная оценка 7 веток с уникальными коммитами; не удалять до решения.
- [ ] Удаление 154 веток-кандидатов через GitHub UI после отдельной финальной проверки.
- [ ] Ручная приёмка двух дел и UX/арт-аудит.
