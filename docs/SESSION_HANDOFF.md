# Ghost Signal — handoff

Updated: 2026-11-13

## Repository state

- Repository: https://github.com/DoctorStrangeSH/GhostSignal
- Working branch: `refactor/foundation-quality-pass`
- Pull request: https://github.com/DoctorStrangeSH/GhostSignal/pull/1
- PR #1 is open and must not be merged without the owner's approval.
- `main` has not been modified by this work.

## Current verified baseline

Latest confirmed CI after the controller extraction:
- JavaScript syntax check: 95 files passed.
- Game-data validation: 2 cases, 14 locations, 13 NPCs, 59 objects, 14 dialogues.
- Unit and controller tests: 30 passed, 0 failed.

Run locally:
```bash
npm run check
npm run validate:data
npm test
npm run build
```

## Important changes in this branch

### Gameplay and narrative
- Case 001 starts at 20:00 to match the evening/nocturnal story and porter schedule.
- Case 002 starts at 00:30; the prologue, witness accounts and scene timing now describe an after-midnight poisoning.
- Blackwood survives the poisoning. Case 002 is an attempted-murder case, not a completed murder.
- Anna did not leave the bar after arguing; she moved from Blackwood's table to the counter.
- Kane picks up Anna's vial through a napkin, changes its contents in the restroom, doses Blackwood and leaves the vial under the table to frame Anna.
- The bar photograph has a plausible source and is explicitly corroborative, not conclusive on its own.
- Anna has a dedicated, warrant-gated apartment with an inspectable desk that yields the threat note.
- The sergeant's warrant dialogue is generic enough to work for the apartment and bank records in either case.

### NPCs and scenes
- NPCManager supports `case:<id>` special dialogue conditions and persists active case context.
- Case 002 now routes the bartender to `dialogue-bartender-case2`.
- NPCs without work shifts now appear at their home locations when awake.
- LocationManager merges default location objects with all active-case scene objects, deduplicating them and respecting night-only items.
- The poison vial is now obtainable by examining the overturned glass.

### Evidence and endings
- Registered evidence chains in each case's `evidence.js` are now canonical; duplicate inline arrays were removed from case indexes.
- EvidenceChainSystem loads registered chains and restores completed-chain state after continuing a save.
- Broken case 001 chain prerequisites were replaced with actually obtainable evidence/insights.
- AlternateEndings reads the registered endings, checks confession insights and evidence thresholds, and returns the correct case-specific outcome.
- Ending registry IDs are namespaced by case to prevent case 002 from overwriting case 001 endings.
- Solving a case now displays its authored ending and applies bonus reputation and unlock rewards.
- Perfect-ending conditions now use the exact insight IDs emitted by the confession dialogues.

## Latest continuation pass (2026-11-13)

- `CaseManager.fromJSON` now falls back to `progress.activeCase` when the saved case snapshot is missing, and treats that field as authoritative if snapshots disagree.
- Case-specific progress counters/events are discarded when the serialized case belongs to a different case; warrant unlocks are re-evaluated on restore.
- `NPCManager.fromJSON` reconstructs contacts from the active case when the NPC snapshot is missing, empty, or stale.
- `EvidenceChainSystem.fromJSON` and `loadChainsForCase` prevent completed chains from leaking between different cases.
- Starting a new case clears the previous current location before travel, so no travel time is charged from the previous investigation.
- `GameTime.setTime` notifies the clock and other subscribers when a case sets its start time.
- Added `tests/game-flow.test.mjs`, which loads the actual data scripts referenced by `index.html` and exercises both cases with the real case, NPC, location, inventory, evidence-chain and ending systems.
- Evidence chains are reconciled after event listeners are bound on restore and immediately after a new case starts, so already-collected prerequisites cannot remain silently unprocessed.
- CI on the latest tested commit passed: 92 JS files, data validation (2 cases / 14 locations / 13 NPCs / 59 objects / 14 dialogues), and 21 tests (21 passed, 0 failed).

## Architecture extraction pass (2026-11-13)

- Added `assets/js/controllers/navigationController.js`. Screen navigation, tab switching, main-menu shortcuts, global shortcuts and navigation buttons now live outside App.
- App retains compatibility wrappers (`navigateTo`, `_switchTab`, `_bindNavigation`, `_bindKeyboard`, `_bindGlobalShortcuts`) so existing game code and event callbacks keep their current entry points.
- Added `assets/js/controllers/saveController.js`. Snapshot serialization and local persistence are centralized there; cloud synchronization remains with SyncManager.
- App retains `_quickSave` and `_saveProgress` wrappers. All direct `storage.saveProgress(this.progress)` calls were moved behind SaveController.
- Both controllers are loaded before `assets/js/core/app.js` in `index.html`.
- Added `assets/js/controllers/eventController.js`: all 31 App-level event subscriptions and the two periodic autosave/cloud-sync timers moved out of App. EventController tracks unsubscribe callbacks, prevents duplicate binding and exposes `dispose()` to release subscriptions and timers.
- Added 4 navigation controller tests, 3 save controller tests and 2 event controller lifecycle/dispatch tests in separate test files.
- Latest confirmed CI: 96 JavaScript files checked; game-data validation passed (2 cases, 14 locations, 13 NPCs, 59 objects, 14 dialogues); 35 tests passed, 0 failed.

## CaseController extraction (2026-11-13)

- Added `assets/js/controllers/caseController.js` and loaded it before `app.js`.
- `CaseController` now owns the App-facing case selection/start/resume flow. `CaseManager` remains the owner of case rules, event progress and per-case state.
- `App.loadCase(caseId)` remains as a compatibility wrapper; EventController and NavigationController keep calling the same public entry point.
- Unknown case IDs, missing progress/CaseManager and rejected CaseManager loads now return `false` without navigating to the investigation screen or persisting a bogus active case.
- Resuming the already active case does not call `CaseManager.loadCase`, so it does not reset evidence, time, visited locations or completed events.
- Case headers are updated safely when the corresponding DOM nodes exist; location rendering uses the saved current location, then the case start location.
- Added `tests/case-controller.test.mjs`: five tests cover fresh start, resume, unknown ID, rejected load and pre-initialization.
- Latest CI for this change: 96 JavaScript files checked; 2 cases / 14 locations / 13 NPCs / 61 objects / 14 dialogues validated; 37 tests passed, 0 failed.

## Narrative continuity pass (2026-11-13)

- Case 002 chapter 5 previously stated that Kane had already confessed, while chapter 6 contained the actual interrogation/confession. Chapter 5 now clearly frames the solution as the detective's evidence-based reconstruction, calls out the contradiction between Kane's alibi and Eva/waiter testimony, and leaves the confession for chapter 6.
- Case 001's locked-room premise lacked a physical explanation for the inside door chain: Mary said she left, but the porter later found the chain engaged and had to cut it.
- Added the visible `door_chain` scene object to room 304. Examining it reveals a bent wire fragment and the `chain_trick` insight; the fragment can be collected and examined as evidence.
- Added a conditional follow-up in Mary's confession: if the player found the clue, she explains how she slid the chain into its bracket from outside with the hooked wire, and why a fragment remained in the latch.
- The chain object is included in the room intro highlights and triggers a contextual notification. The extra evidence item is accounted for by moving Case 001's evidence threshold and partial-ending condition from 5 to 6, preserving the previous evidence requirement.
- Added narrative continuity regression coverage for the Case 002 confession sequence and the Case 001 chain clue, witness explanation and ending threshold.
- Latest CI after the narrative changes: 96 JavaScript files; data validator passed (2 cases, 14 locations, 13 NPCs, 61 objects, 14 dialogues); 37 tests passed, 0 failed.

## NPC memory, evidence presentation and contradictions (2026-11-13)

- Added `assets/js/npc/npcMemoryService.js`: per-case/per-NPC records with conversation count, bounded dialogue history (last 100 entries), selected answers, trust (0–100), presented evidence and explicit narrative claims.
- Memory is backward compatible with saves that do not contain `npcMemoryData`; it is included in SaveController quick snapshots and persisted on `npc:memory_changed`.
- DialogueEngine records dialogue starts, visited nodes, selected answers and claims. Calm answers increase trust by 1; aggressive answers reduce it by 3; trust is clamped to 0–100.
- Added explicit claim metadata to Case 002 waiter, bartender and Kane dialogue. Claims are compared only when they share the same topic and have different normalized values; corroborating claims do not trigger false positives.
- Kane now states that he left before the poisoning. If the player has the waiter's direct testimony, a new conditional answer confronts him; his evasive response unlocks `kane_alibi_broken`. Potential conflicts are not announced automatically: the player must compare statements in the investigation journal and prepare a confrontation.
- Added evidence presentation to the call/dialogue UI. The player can present any collected evidence (including evidence already pinned to the investigation board); each NPC remembers which items were shown and duplicate presentations are blocked. Dialogue data can define NPC-specific reactions and grant insights.
- NPC contact cards now show trust, conversation count and presented-evidence count after the first interaction.
- Polished two Case 002 dialogue lines to remove accidental English words from Russian narration.
- Added 11 focused tests across NPC memory, dialogue integration and event persistence; SaveController coverage also includes `npcMemoryData`.
- Latest verified CI: 97 JavaScript files; 2 cases, 14 locations, 13 NPCs, 61 objects and 14 dialogues validated; 48 tests passed, 0 failed.

## Known limitations / next tasks

1. **Manual playthrough is still required.** CI validates syntax, data links and unit tests, but does not run a browser end-to-end test. Play both cases from a fresh save and verify every route, time gate, clue chain and ending.
2. Create real noir raster illustrations for locations, portraits, documents and evidence. The current scene art panel is CSS atmosphere only, not final authored artwork.
3. Continue CaseController beyond selection/start/resume: move reset and ending orchestration only after mapping their event side effects and adding regression tests. Then extract initialization/bootstrap responsibilities; App remains the composition root. Then gradually migrate globals to ES modules.
4. Add versioned migrations for the new NPC memory snapshot before future save-schema changes, then improve the cloud/local merge strategy. Current conflict handling preserves both versions and asks the user to choose; it does not merge individual fields.
5. Audit all `innerHTML` usage for untrusted player/cloud data.
6. Verify Firebase Firestore and Storage security rules in Firebase Console.

## Working rules

- Continue on `refactor/foundation-quality-pass` unless the PR state requires a new branch.
- Do not push directly to `main`.
- Do not merge PR #1 without explicit owner approval.
- Preserve existing assets and content unless a tested replacement is ready.
- Update this file and `docs/REFACTORING_ROADMAP.md` after meaningful changes.

## Свидетельский журнал и ручное предъявление противоречий (2026-11-13)

- `NPCMemoryService` version 2 хранит provenance каждого явного claim: источник, место, временную метку/описание времени, обстоятельства, узел и timestamp записи. Старые claims без новых полей продолжают читаться с fallback на npcId.
- Добавлены `getStatements()`, `getStatementById()` и `compareStatements()`. Сопоставление различает пропущенный выбор, повтор одной записи, неизвестную запись, разные темы, совпадающие показания и реальное противоречие.
- Подготовка предъявления (`prepareConfrontation`) разрешена только для двух известных claims одной темы с разными значениями и одного из NPC — источников этих claims. Подготовленное действие сохраняется в per-case journal.
- В `BoardUI` добавлен журнал показаний: источник, краткое утверждение, место и обстоятельства; игрок вручную выбирает две записи, сравнивает их и выбирает, кому предъявить конфликт.
- В `CallInterface` появляется кнопка предъявления только во время разговора с выбранным NPC. `DialogueEngine.presentPreparedContradiction()` использует заданную реакцию диалога, фиксирует предъявление, выдаёт insight при наличии и блокирует повторное предъявление той же пары тому же NPC.
- Для Кейна добавлена реакция: он признаёт, что вернулся в зал, но отрицает подход к столику. Это даёт `kane_alibi_broken` и открывает дальнейшие варианты допроса.
- Убрано автоматическое предупреждение «обнаружено противоречие»: система больше не раскрывает игроку готовый вывод до его самостоятельного сопоставления. Событие остаётся доступным для внутренних слушателей.
- Данные утверждений Томаса, Джо и Кейна дополнены источником, локацией и обстоятельствами.
- Добавлены тесты provenance, всех исходов сравнения, подготовки/сохранения/однократного предъявления и сквозного ответа Кейна.
- Проверенный CI: 97 JavaScript-файлов; валидатор — 2 дела, 14 локаций, 13 NPC, 61 объект, 14 диалогов; **52/52 теста успешно**.
- Ручной браузерный прогон UI пока не выполнен. Следующая проверка — собрать показания Томаса и Кейна, сопоставить их на доске, подготовить допрос Кейна, предъявить конфликт и перезагрузить игру для проверки сохранения.

## Психология NPC и намеренная ложь (2026-11-13)

- `NPCMemoryService` обновлён до версии 3. Существующие записи при чтении мигрируют лениво: старым NPC добавляются `pressure: 0` и пустой `liesExposed`; неизвестные контакты не создаются побочным чтением.
- Каждое выбранное действие диалога теперь меняет доверие и давление. Базовые эффекты tone: calm (+1 trust, -1 pressure), reassuring (+3, -3), direct (0, +2), aggressive (-3, +8), threatening (-5, +12). Данные ответа могут переопределять `trustDelta`/`pressureDelta`.
- В NPC data второго дела добавлены индивидуальные пороги открытости/давления и локализованные названия психологического состояния. NPCManager отдаёт вычисленное состояние; карточки контактов обновляются при изменении памяти.
- DialogueEngine поддерживает условия `trust_at_least:N`, `trust_below:N`, `pressure_at_least:N`, `pressure_below:N`, `lie_exposed:claimId`, `disposition:name`, а также композиции `all:condition&condition` и `any:condition&condition`.
- Томас больше не оформляет официальное показание автоматически после рассказа. Он выдаёт claim `waiter-kane-at-poisoning` и insight только если доверие достигло порога и давление достаточно низкое; при низком доверии/высоком давлении он откладывает показания, но может вернуться к разговору после подготовки защиты.
- Ложь хранится только если автор данных пометил claim как `deception: { deliberate: true }`. Само противоречие не считается доказательством умышленной лжи.
- При предъявлении такого claim источнику NPCMemoryService записывает `lie_exposed`, повышает давление и показывает раскрытую ложь в карточке контакта. Для Кейна это работает с его ложным алиби; реакция и последующие варианты диалога зависят от раскрытой лжи/уровня давления.
- Добавлены тесты миграции v2→v3, pressure/trust, явной лжи, условий диалога и альтернативного исхода разговора с Томасом.
- Важно: автоматического NLP-распознавания лжи нет. Умышленность задаётся только сценарными данными, чтобы система не обвиняла NPC из-за ошибки памяти или неточного свидетельства.

## Долговременные обещания NPC (2026-11-13)

- `NPCMemoryService` обновлён до версии 4. У каждой записи NPC теперь есть массив `promises`; старые версии автоматически получают пустой массив при нормализации.
- Выбранный ответ диалога может содержать data-driven поле `promise`. Обещание фиксируется только после фактического выбора игроком, а не при просмотре узла/варианта.
- Поддерживаются условия исполнения: `case_solved`, `insight_gained`, `item_acquired`. Обещания сохраняются вместе с per-case памятью и переживают перезапуск.
- EventController связывает обещания с игровыми событиями: получение insight/предмета исполняет соответствующее обещание; при закрытии дела оставшиеся обещания завершаются. Успешное закрытие исполняет обещание типа `case_solved`; провал дела нарушает все оставшиеся обещания.
- Исполненное обещание повышает доверие (настраивается в данных, по умолчанию +3) и немного снижает давление. Нарушенное снижает доверие (по умолчанию -6) и повышает давление. Итог и причина сохраняются в истории NPC.
- NPCManager передаёт список обещаний в карточки контактов. UI показывает последние два обещания со статусами «Ожидает», «Выполнено», «Нарушено».
- В деле №2 Томасу можно пообещать безопасность семьи и прекращение угроз Кейна. Обещание фиксируется только если игрок выбирает ветку поддержки; оно исполняется только при получении `full_confession_kane` (идеальная концовка, где Кейн арестован и признан виновным). Если дело закрыто частично или провалено без этого insight, обещание нарушается — нельзя считать безопасность семьи гарантированной просто из-за закрытия дела.
- Автотесты покрывают запись, дубликаты, сохранение/загрузку, исполнение по insight и предмету, завершение по исходу дела, нарушение обещаний и интеграцию с EventController.
- Ограничение текущего среза: нет календарных дедлайнов и отдельного UI-журнала обещаний; обещания закрываются при событиях, явно заданных в сценарии, или при завершении дела.

## Социальная память NPC: передача сведений о детективе (2026-11-13)

- `NPCMemoryService` обновлён до версии 5. У каждого NPC в рамках дела теперь есть отдельный массив `rumors`; сохранения v4 лениво мигрируют с пустым списком, без изменения старых claims и promises.
- Добавлен `shareExperience(fromNpcId, toNpcId, report, sourceEvent)`. Он не позволяет создать слух без реально записанного в истории источника ответа диалога, запрещает пересылку самому себе и повторную передачу одной записи тому же адресату.
- На первом вертикальном срезе поддержан тип `detective_behavior`. Полученная запись хранит автора сообщения, исходный диалог/узел/ответ, тон, время и статус `unverified`.
- Слухи хранятся отдельно от свидетельских claims. Они не участвуют в автоматическом сравнении показаний и не могут сами по себе создавать противоречие или считаться доказательством.
- DialogueEngine обрабатывает data-driven `report.recipients` у выбранного ответа. Добавлено условие `heard_rumor:rumorId` для ветвления диалогов.
- В деле №2 агрессивная реплика детектива Томасу может быть им передана Джо. При следующем разговоре с барменом появляется отдельная реакция; до передачи слуха реплика недоступна.
- NPCManager отдаёт слухи карточкам контактов; UI показывает последние сведения с указанием источника и пометкой «непроверено».
- Добавлены тесты: источник должен действительно иметь выбранный ответ в истории; слух изолирован от других NPC; дубликат не создаётся; запись переживает сохранение/загрузку; миграция v4; слух не попадает в claims/contradictions; реакция Джо закрыта до получения информации.
- Ручной браузерный прогон и визуальная проверка карточек NPC пока не выполнены.

### Ограничения и следующие шаги

1. Пока распространение задаётся явно через сценарное поле `report.recipients`; автоматической сети связей/случайных разговоров NPC нет.
2. Следующий безопасный шаг — добавить доверие к источнику и возможность подтверждать/опровергать слух независимым свидетелем.
3. Затем ввести историю версий показаний: NPC может уточнить claim после новой улики, но исходная запись и причина изменения останутся в деле.
4. Не смешивать слух, свидетельство и доказательство: это три разных уровня достоверности.
## Достоверность слухов и независимые свидетели (2026-11-13)

- `NPCMemoryService` обновлён до версии 6; старые записи v5 получают безопасные значения по умолчанию для доверия к источнику, уверенности и журналов подтверждений/оспариваний.
- Добавлено отдельное доверие между NPC (`setRelationshipTrust` / `getRelationshipTrust`), не смешанное с доверием NPC к детективу.
- При передаче слуха сохраняются доверие получателя к отправителю и начальная оценка уверенности. Для отчёта Томаса Джо задано доверие 80/100; слух остаётся непроверенным, но не считается одинаково достоверным для всех персонажей.
- Слух можно подтвердить или оспорить только claim другого NPC, явно помеченным `directObservation` и связанным с конкретным слухом. Пересказ чужих слов не считается независимым подтверждением.
- Подтверждение/оспаривание сохраняет свидетеля, claim и время; итоговые статусы: `unverified`, `corroborated`, `disputed`. История и уверенность переживают сохранение/загрузку.
- `DialogueEngine` принимает прежний формат `recipients: ["npc"]` и расширенный `recipients: [{ npcId, recipientTrust }]`.
- Карточки NPC показывают фактический статус слуха вместо постоянной надписи «непроверено».
- В текущем сценарии Томас → Джо нет искусственно добавленного второго очевидца: без отдельного прямого показания слух честно остаётся непроверенным. Механика независимой проверки готова для дальнейших сюжетных сцен.
- Добавлены тесты доверия к источнику, проверки независимости, подтверждения, оспаривания, сохранения и миграции v5 → v6.

