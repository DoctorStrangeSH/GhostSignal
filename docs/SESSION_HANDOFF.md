# Ghost Signal — handoff

Updated: 2026-11-13

## Repository state

- Repository: https://github.com/DoctorStrangeSH/GhostSignal
- Working branch: `refactor/foundation-quality-pass`
- Pull request: https://github.com/DoctorStrangeSH/GhostSignal/pull/1
- PR #1 is open and must not be merged without the owner's approval.
- `main` has not been modified by this work.

## Current verified baseline

Latest confirmed CI on the current cooperation/testimony pass:
- JavaScript syntax check: 100 files passed.
- Game-data validation: 2 cases, 14 locations, 13 NPCs, 61 objects, 14 dialogues.
- Unit and controller tests: 124 passed, 0 failed.
- Push CI: https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43454601640
- PR CI: https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43454611294 (last observed in progress when this note was written).

Run locally:
```bash
npm run check
npm run validate:data
npm test
npm run build
```

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
## Версионирование свидетельских показаний (2026-11-13)

- `NPCMemoryService` обновлён до версии 7. Первое показание получает версию 1; уточнение создаёт новую запись и не перезаписывает исходную.
- Новая запись должна ссылаться на активный claim того же NPC и той же темы через `revisesClaimId`. Неверный источник, повторная ревизия устаревшей версии или смена темы отклоняются.
- Предыдущая версия получает статус `superseded`, ссылку на заменившую запись и время изменения. Новая версия хранит `revisionOf`, `revisionReason` и номер версии.
- Устаревшие версии остаются в архиве и истории, но исключаются из поиска противоречий и недоступны для нового предъявления. Если ревизия затрагивает уже подготовленное предъявление, оно сбрасывается.
- В деле №2 Томас может уточнить показания после изучения фотографии: он подтверждает, что видел Кейна возле столика, но больше не утверждает, что лично видел попадание порошка в стакан.
- Журнал показаний визуально различает актуальные и предыдущие версии; старые записи нельзя выбрать для нового сопоставления.
- Добавлены тесты цепочки версий, миграции v6 → v7, сохранения истории, отклонения некорректной ревизии и реального диалогового сценария.
## Социальные последствия в концовках (2026-11-13)

- `NPCMemoryService.getCaseSocialSummary()` формирует read-only сводку доверия, обещаний, слухов, актуальных и заменённых показаний для каждого NPC дела.
- `AlternateEndings.determineEnding()` принимает социальный контекст отдельно от улик. Юридический результат дела не подменяется отношениями: социальные последствия добавляются как персональный эпилог.
- В концовки дела №2 добавлены авторские последствия обещания Томасу: семья защищена при выполненном обещании; при частичном исходе или провале обещание нарушено; низкое доверие отдельно отражается в эпилоге.
- EventController передаёт социальную память в расчёт концовки после разрешения обещаний. Повторное начисление не меняет исход дела.
- Добавлены тесты сводки и эпилогов для выполненного/нарушенного обещания.
## Последствия ложных обвинений (2026-11-13)

- `NPCMemoryService` обновлён до версии 8; у каждого NPC есть журнал обвинений со статусами `pending`, `false`, `retracted`, `substantiated`, основанием, временем и причиной разрешения.
- Обвинение записывается только из выбранного игроком ответа. Позднее оно может быть подтверждено, отозвано или признано ложным; запись не удаляется после извинения.
- Ложное обвинение снижает доверие обвинённого NPC на 10 и повышает давление на 8; признание ошибки не обнуляет последствия.
- В диалоге Томаса добавлен отдельный прямой путь обвинения в соучастии. Если детектив позже признаёт ошибку, Томас рассказывает Джо и о ложном обвинении, и об извинении.
- Карточки NPC показывают обвинения и их исход; сводка для концовок учитывает ложные и не снятые обвинения.
- В концовки дела №2 добавлены последствия для отношений с Томасом. Юридический исход дела не меняется, но социальный эпилог учитывает действия детектива.
- Добавлены тесты журнала обвинений, штрафов доверия/давления, распространения сведений, сохранения и социальных эпилогов.

## Социальная сеть NPC с отложенной передачей (2026-11-13)

- Добавлен `NPCSocialNetwork`: направленные связи задаются данными дела; ребро хранит тип отношений, базовое доверие, канал, задержку, порог доверия, допустимые типы сведений и право пересылки.
- Каналы `in_person`, `phone` и `message` имеют разные условия доставки. Личная встреча требует общей локации и доступности обоих NPC; звонок — доступности обоих и поддержки звонков; сообщение ждёт доступности получателя.
- Многошаговая передача ограничена `maxHops`. Слух сохраняет первоначальный источник, непосредственного передатчика, исходный диалог и ответ, канал и полный маршрут.
- Взаимная защита задаётся на конкретном ребре. Если слух касается защищаемого NPC, персонаж может не передавать его; отказ остаётся в журнале `withheld`.
- Очередь и журнал доставок сохраняются в `npcSocialData`; сохранения без этого поля продолжают загружаться.
- Для дела №2 описаны связи коллег Томаса и Джо, сестёр Анны и Евы, а также ограниченная связь бармена с журналисткой. Сведения о Томасе Джо не передаёт прессе, защищая коллегу.
- Диалоги Томаса используют временную социальную сеть вместо мгновенной передачи по списку `recipients`; старый механизм оставлен для совместимости.
- Карточки NPC показывают связи и текущее доверие. Добавлены тесты временных задержек, доступности, маршрутов, защиты и сохранения.

## Проверка социальной сети NPC (2026-11-13)

- Ветка `refactor/foundation-quality-pass` включает `NPCSocialNetwork` и временную передачу слухов.
- Последний подтверждённый GitHub Actions: **98 JavaScript-файлов**, **87/87 тестов**, 0 ошибок.
- Дополнительные проверки: NPC-to-NPC звонки не зависят от доступности звонка для игрока; взаимные отношения не дублируются в карточках; при доставке сохраняется первоначальный источник и цепочка передачи.
- После сброса дела NPCManager повторно получает ссылки на память и социальную сеть при старте следующего дела.
- PR #1 остаётся открытым; `main` не менялся. Ручной браузерный прогон не выполнялся.

## Хроника социальных контактов (2026-11-13)

- `NPCSocialNetwork` обновлён до версии 2. Старые сохранения без журнала автоматически получают пустой `eventLog`.
- События сети сохраняются в истории дела: исходное сообщение, запланированная передача, фактическая доставка, задержка, истечение срока и сокрытие сведений.
- Запись содержит игровой день/время, отправителя, получателя, канал, тип отношений, маршрут, краткое содержание и причину блокировки/задержки.
- Сокрытие не раскрывает текст секрета: журнал сообщает, кого защищали и почему передача остановлена.
- Журнал ограничен последними 300 событиями на дело; ID событий последовательные и сохраняются.
- NPCManager предоставляет журнал интерфейсу; NPCListUI показывает отдельную «Хронику контактов» над карточками персонажей.
- Добавлены тесты порядка событий, атрибуции, фильтра по NPC, сокрытия без утечки содержания, единичной записи задержки и миграции/сохранения журнала.
- CI для этого этапа ещё требуется проверить; ручной браузерный прогон не выполнялся.

## Хроника социальных контактов — CI подтверждён (2026-11-13)

- `NPCSocialNetwork` v2 сохраняет отдельный журнал событий на дело; старые сохранения безопасно мигрируют.
- Записи фиксируют: сообщение источника, запланированную передачу, доставку, задержку (один раз на попытку доставки), истечение срока, дубликат и сокрытие сведений.
- Для каждого события сохраняются игровой день/время, отправитель, получатель, канал, отношения, маршрут и причина. Содержание секретного сообщения не попадает в запись о сокрытии.
- NPCManager отдаёт журнал UI; вкладка контактов показывает «Хронику контактов» над карточками NPC. Обновление приходит по `npc:social_network_changed`.
- Тесты проверяют атрибуцию, порядок, фильтрацию по NPC, защиту содержания, задержки, сохранение и миграцию.
- **Подтверждённый CI на head `29e5735b849792c8fbf3b4b9c8c10caa59c72088`: 98 JS-файлов, 91/91 тест, 0 ошибок.**
- Успешные проверки: [push](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43436328710), [pull request](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43436338343).
- PR #1 открыт; `main` не изменён. Браузерный ручной прогон ещё не выполнялся.

## Мотивы, лояльность и предательство NPC (2026-11-13)

- Новый файл `assets/js/npc/npcMotivationService.js` содержит `NPCMotivationService`. Он загружает `caseData.npcMotivations`, нормализует мотивы/лояльность и рассчитывает эффективную лояльность с учётом давления.
- Формула: `effective = baseStrength - pressure * (1 - weightedPressureResistance)`. Вес и устойчивость каждого мотива ограничены безопасными диапазонами; результат ограничен 0–100.
- `evaluateDisclosure` возвращает решение: `loyalty_protection` либо `loyalty_broken`. Если лояльность сломана, `NPCSocialNetwork` фиксирует `betrayal` и продолжает передачу. Отправка напрямую самому защищаемому NPC не блокируется.
- В деле №2 описаны индивидуальные мотивы и связи восьми персонажей. Джо защищает Томаса, но после угроз/сильного давления может выдать сведения журналистке; Ева сильнее сопротивляется давлению ради Анны.
- `DialogueEngine` получил условия `motive:<id>`, `loyalty_at_least:<npcId>:<score>`, `loyalty_below:<npcId>:<score>` для авторских веток. Сервис подключён в `App`, `EventController` и загружается перед `NPCSocialNetwork`.
- Скрытые профили не выводятся в карточки NPC. Текущее давление хранится в уже существующей памяти NPC, поэтому новый формат сохранения не добавлялся.
- Тесты покрывают взвешенную устойчивость, защиту при низком давлении, предательство при высоком давлении, фактическую доставку после предательства и условия диалоговых веток.
- **Подтверждённый CI:** 99 JS-файлов, 95/95 тестов, 0 ошибок. [Push CI](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43438761151).
- PR #1 остаётся открытым; `main` не изменён. Ручной браузерный прогон не выполнялся.

## Знание детектива и раскрытие социальных событий (2026-11-13)

- `NPCSocialNetwork` v3 хранит два уровня: полную внутреннюю `eventLog` мира и `knownEventIds` — только те записи, которые были раскрыты детективу. `discoveryLog` сохраняет метод, источник и игровое время раскрытия.
- Старые `npcSocialData` мигрируют автоматически: старые события остаются в истории, но не считаются известными игроку без подтверждения.
- `revealEventsForReport(reportId, discovery)` требует допустимый метод `dialogue`, `observation`, `document` или `evidence`, непустой `sourceId` и может фильтровать по типу события и участникам.
- `DialogueEngine.selectAnswer` обрабатывает `answer.revealSocialEvents` только при выборе ответа; sourceId генерируется из ID диалога, узла и индекса ответа.
- `NPCManager.getSocialEventLog` возвращает только известные события. UI показывает «Известные контакты», а не внутреннюю хронику.
- В диалоге Джо подтверждается доставка сведений от Томаса. Если Джо предал Томаса под давлением, Лора может рассказать об этом только после фактического получения слуха; её ответ раскрывает игроку события передачи/предательства.
- Удалены из карточек NPC скрытые социальные связи и слухи, которые персонажи ещё не сообщили детективу.
- При усечении внутренней истории до 300 записей старые ID и ссылки на раскрытия также удаляются.
- **Подтверждённый CI:** 99 JS-файлов, 97/97 тестов, 0 ошибок. [Push CI](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43439896990).
- Ручной браузерный прогон не выполнялся; PR #1 открыт, `main` не менялся.

## Живые отношения NPC — текущая реализация (2026-11-13)

- Новый `assets/js/npc/npcRelationshipService.js` (`NPCRelationshipService`) загружает `caseData.npcRelationships`, нормализует связи и правила, инициализирует направленное доверие в `NPCMemoryService` и сохраняет расписания в `npcRelationshipData`.
- Схема `bonds`: `id`, `fromNpcId`, `toNpcId`, `relationship`, `label`, `trust`, `reciprocal`.
- Схема `autonomousInteractions`: `id`, `relationshipId`, участники, `interaction` (`support|conflict|reconcile|avoidance`), `channel` (`in_person|phone|message`), задержка/интервал, условия по доверию и давлению, trust deltas, краткое описание.
- Встречи проверяют расписания NPC; `in_person` требует совпадения локаций, `phone` требует доступности обоих, `message` асинхронен. Недоступные контакты откладываются с ограниченными повторами; правила не создают бесконечный поток.
- `EventController` запускает симуляцию на `time:changed`, сохраняет изменения отношений/событий; `SaveController` и `App._defaultProgress` включают `npcRelationshipData`.
- `NPCSocialNetwork` сообщает сервису о передаче слухов, защите и предательстве. Доставка даёт небольшой плюс доверию; защита усиливает связь с защищаемым NPC; нарушение лояльности снижает доверие к предателю.
- `DialogueEngine` раскрывает отношения из `node.revealRelationships` и `answer.revealRelationships` при реальном посещении узла/выборе ответа. Условие `relationship_known:<id>` доступно для последующих веток.
- `NPCManager` передаёт интерфейсу только подтверждённые отношения; удаляет из dossier memory приватные `relationshipTrusts` и NPC-only rumors. `NPCListUI` отображает найденные связи и изменения отношений.
- Реальные данные обновлены для case-001 и case-002; добавлен authoring-шаблон `npcRelationships` в `case-000-template.js`.
- Проверки включают поддержку, конфликт, примирение, отложенную встречу, сохранение открытых связей, интеграцию передачи слухов/предательства и приватность досье.
- **Подтверждённый CI:** 100 JavaScript-файлов, 105/105 тестов, 0 ошибок. [Push](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43443065373) · [PR](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43443075122).
- Визуальный/ручной браузерный прогон пока не выполнялся; PR #1 открыт, `main` не менялась.

**Следующий ИИ:** сначала проверь CI последнего коммита (после этого handoff могут быть ещё изменения), затем добавляй data-driven отношения и способы раскрытия для следующих дел. Не показывай скрытые bonds/rumors напрямую в UI. Не запускай параллельно два update_file на один путь.


## Долгосрочная память NPC — текущая реализация (2026-11-13)

- NPCMemoryService v9 теперь хранит два слоя: cases[caseId][npcId] (локальная память расследования) и people[npcId] (долговременное впечатление о детективе между делами).
- Глобальный профиль: trust, familiarity, interactions, lastSeenCaseId, lastSeenAt, memories (лимит 60, приоритет по importance), nextMemoryId.
- Важные ответы в данных диалога могут задавать memorySummary (до 220 символов), memoryTags (строки до 48 символов), memoryImportance (1–5). Пример и правила: docs/NPC_LONG_TERM_MEMORY.md.
- Начало разговора повышает familiarity; угрозы/агрессия/поддержка создают долговременное впечатление и мягко меняют persistent trust. Ложные обвинения дают долговременный штраф; выполненные/нарушенные обещания фиксируются как сильные события.
- При первом появлении NPC в другом деле локальный trust создаётся из persistent trust. Старые v8 saves без people инициализируются доверием активного дела.
- DialogueEngine поддерживает условия long_term_memory:<tag>, long_term_trust_at_least:N, long_term_trust_below:N, long_term_disposition:<state>, familiarity_at_least:N.
- Joe example: в case-001 player choices tag player_threatened / player_reassured; в case-002 Джо открывает соответствующую реплику и может стать guarded после накопленного недоверия. Условия работают только по NPC текущего диалога.
- Валидатор проверяет, что используемые long_term_memory tags имеют хотя бы один авторский источник в данных диалогов. Скрытые воспоминания напрямую в UI не выводить.
- Последний полностью подтверждённый кодовый CI на 67accb8: 100 JS, 112/112 тестов, валидатор: 2 cases / 14 locations / 13 NPCs / 61 objects / 14 dialogues. [Push](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43445978221) · [PR](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43445986918).
- Последние изменения документации после этого коммита должны получить свой CI. PR #1 открыт, main не менялась; ручной браузерный прогон ещё не выполнен.

**Следующий ИИ:** сначала проверь CI последнего HEAD SHA. Затем расширяй cross-case memory на других повторяющихся NPC. Не показывай сырые воспоминания игроку без сюжетного раскрытия. Держи локальные факты дела отдельно от глобального отношения NPC к детективу и от отношений NPC друг к другу.


## Межделовые отношения NPC (NPCRelationshipService v2)

- Добавлено worldTrusts: глобальная направленная карта доверия между NPC, сохраняется в npcRelationshipData.
- setCase гидратирует case-local NPCMemoryService.relationshipTrusts из глобального слоя; если глобальной записи ещё нет, берёт текущее case-local значение или authored bond.trust и создаёт world запись.
- Все автономные действия и recordInteraction обновляют оба слоя. Сброс case-local состояния не очищает глобальные отношения.
- Раскрытие связи детективу, discoveryLog и расписания остаются case-scoped. Не показывать worldTrusts напрямую в UI.
- Сохранения NPCRelationshipService v1 без worldTrusts автоматически получают глобальные записи из активного дела при setCase.


## Повторяющаяся связь Joe / Sergeant Mills

- В case-001 и case-002 используется одинаковый bond ID bartender-sergeant. Case-001 задаёт стартовое доверие 55 и одно телефонное взаимодействие Джо с Миллсом; case-002 повторно описывает ту же пару с тем же ID.
- NPCRelationshipService v2 должен переносить текущее доверие через worldTrusts. Case-local discovery и расписания при этом остаются отдельными.
- Последний подтверждённый CI на HEAD ae8e137: 100 JS, 113/113 тестов, validator: 2 cases / 14 locations / 13 NPCs / 61 objects / 14 dialogues. [Push](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43446773933) · [PR](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43446780426).
- Ручной браузерный переход case-001 → case-002 всё ещё не выполнялся.


## Личные цели и автономные действия NPC — 2026-11-13

- NPCRelationshipService v3: глобальные worldTrusts и worldGoals. worldGoals[npcId][goalId] содержит title, description, priority, target, progress, status, createdInCaseId, updatedAt, history (лимит 40).
- В npcRelationships.goals авторятся цели; автономные взаимодействия указывают goalId, goalNpcId и goalProgress. goalNpcId позволяет событию одного NPC продвигать цель другого (например, журналистка поддерживает бармена).
- Прогресс засчитывается только после реального выполнения автономного действия (после расписания/доступности/условий). maxOccurrences предотвращает повторное начисление после одноразового действия.
- Условия автономных действий: requiresGoalId, requiresGoalNpcId, requiresGoalStatus, requiresGoalProgressAtLeast, requiresGoalProgressBelow. Важно: goalId — награда/цель действия; requiresGoalId — отдельное предусловие, не смешивать.
- API: getGoalProgress(npcId, goalId), isGoalCompleted(npcId, goalId), getPersonalGoals(npcId). Сырые цели/история не выводятся в досье автоматически.
- DialogueEngine conditions: npc_goal_completed:<id>, npc_goal_progress_at_least:<id>:N. Джо в case-002 имеет ветку community_support, доступную только если межделовая цель maintain_bar_community завершена.
- Авторские цели: case-001 — protect_mary, maintain_bar_community, keep_in_touch_with_mills; case-002 — maintain_bar_community, protect_staff, protect_sister, publish_exclusive, keep_in_touch_with_mills.
- Автономный сюжет: Лора отправляет Джо настойчивое сообщение за эксклюзив через 8 игровых часов (один раз); это конфликт и влияет на доверие, одновременно продвигая publish_exclusive. Ева звонит Анне; Джо поддерживает Томаса; Фрэнк поддерживает Мэри.
- Валидатор проверяет владельцев, target/priority, ссылки из autonomousInteractions, prerequisites и диалоговые ссылки.
- Последний подтверждённый CI на HEAD a404677: 100 JS, 116/116 тестов, validator: 2 cases / 14 locations / 13 NPCs / 61 objects / 14 dialogues. [Push](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43449199159) · [PR](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43449211944).
- Следующая обязательная ручная проверка: ускорить игровое время, проверить тайминги/одноразовость Лоры, переход case-001 → case-002, сохранение и восстановление goal progress. CI не заменяет игровой прогон.

**Следующий ИИ:** сначала проверь актуальный HEAD и Actions. Не меняй main и не сливай PR без разрешения. Расширяй личные цели на другие повторяющиеся NPC, но сюжетные последствия связывай с доказательствами и доступностью. Не раскрывай скрытые события автоматически. Следи, чтобы время не обрабатывало один и тот же одноразовый rule повторно после save/load.


- Дополнительно journalist.js: когда личная цель journalist/publish_exclusive завершена автономным сообщением Джо, Лора в следующем разговоре открывает deadline_followup. Она прямо говорит, что уже написала Джо и дала понять, что дедлайн не будет ждать. Условие — npc_goal_completed:publish_exclusive; до события ветка скрыта.
- CI на code HEAD 3e813be: 100 JS, 118/118 tests, 0 fail; validator 2 cases / 14 locations / 13 NPCs / 61 objects / 14 dialogues. [Push](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43449843052) · [PR](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43449855592).


- Важная нарративная защита: Joe/Elias catch-up (case-001) и Lora checks Joe (case-002) имеют maxOccurrences: 1. Иначе повторные взаимодействия могли бы завершить maintain_bar_community без обоих сюжетных этапов, после чего Джо упоминал бы поддержку Лоры, которой ещё не было.
- Последний подтверждённый CI на HEAD 88f366a: 100 JS, 118/118 tests, validator 2 cases / 14 locations / 13 NPCs / 61 objects / 14 dialogues. [Push](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43450190072) · [PR](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43450197252).

## Cooperation readiness и динамические показания — 2026-11-13

- Последний кодовый HEAD: a46911bbe03ad9295ffbb9248b3e6a76277e12fa.
- NPCMemoryService v10: cooperation 0–100 и cooperationHistory per case. getCooperationState(npcId, profile) возвращает score/state/label; getPsychologicalState добавляет только state/label.
- Итоговый score учитывает текущую готовность, текущее доверие/давление и долговременное доверие. cooperationResistance и cooperationThresholds — индивидуальные настройки NPC.
- Ответы могут задавать cooperationDelta; promises поддерживают fulfilledCooperationDelta и brokenCooperationDelta; legacy promises мигрируют к +10/-18. Исходы обвинений также меняют готовность.
- NPCRelationshipService normalizes fromCooperationDelta / toCooperationDelta и применяет их после успешного автономного взаимодействия. Поддержка и примирение Джо с Томасом — одноразовые события; поддержка Евы/Лоры также может повышать готовность близких/друзей.
- DialogueEngine conditions: cooperation_at_least:N, cooperation_below:N, cooperation_state:<state>, has_claim:<id>, has_claim_topic:<topic>. hiddenWhenUnavailable:true скрывает конкретный ответ, пока условие ложно.
- NPCManager удаляет raw cooperation score/history из публичного memory payload; NPCListUI показывает только текстовый статус сотрудничества.
- Томас: после официальных показаний детектив может снова запугать его. При следующем разговоре, если готовность упала до reluctant, появляется скрытая до выполнения условий опция пересмотреть показания. Узел создаёт claim с revisesActiveClaimTopic:true; recordClaim разрешает такую ревизию только при ровно одном активном claim на тему. Предыдущая версия сохраняется как superseded; новая становится active. Никаких evidence/insight не выдаётся.
- Валидатор проверяет cooperation profile/ranges, relationship deltas, answer deltas, promise deltas и ссылки на claims из составных условий.
- CI на HEAD a46911b: 100 JS, 124/124 tests, 0 fail; validator: 2 cases / 14 locations / 13 NPCs / 61 objects / 14 dialogues. [Push](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43453446694) · [PR](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43453456859).

### Следующий шаг
1. Провести ручной прогон: Томас даёт официальное показание → детектив угрожает → повторный разговор → новая версия показания; проверить claim history и отсутствие автоматического evidence/insight.
2. Повторить сценарий при поддержке Джо и проверить, что поддержка реально меняет порог доступности ветки.
3. Проверить save/load до обещания, после обещания, после угрозы и после пересмотра показаний.
4. Добавить похожую механику другим NPC только при наличии сюжетной причины; не превращать любое изменение отношений в автоматическую смену фактов.

PR #1 остаётся открытым; main не менялась и не сливалась.

## Руморные условия диалогов — 2026-11-13

- DialogueEngine теперь поддерживает `rumor_status:<id>:unverified|corroborated|disputed` и `rumor_confidence_at_least:<id>:<0-100>`.
- Условия читают только слухи, сохранённые у текущего собеседника; наличие слуха у одного NPC не делает его известным остальным.
- Независимая проверка не ослаблена: corroborate/challenge по-прежнему требуют claim другого NPC с directObservation и явной ссылкой на rumor ID.
- Валидатор проверяет синтаксис новых условий и диапазон уверенности.
- Добавлен тест полного цикла: получение слуха → скрытая/доступная ветка → независимое оспаривание → переключение диалоговой реакции и порога уверенности.
- Это связывает социальную сеть с авторингом диалогов, но не создаёт автоматически улики/озарения и не объявляет спорный слух ложным.

### Следующий шаг
1. Применить новые условия в диалогах Лоры, Джо и Евы с разными реакциями на один слух.
2. Проверить, что пересылка по цепочке снижает уверенность и не переносит проверку одного NPC другому.
3. После этого расширить проверку слухов на долговременные последствия между делами только для подтверждённых сюжетных событий.


## Продолжение: слухи запускают автономные поступки NPC

В ветке `refactor/foundation-quality-pass` добавлены условия `fromRumorId`, `fromRumorStatus`, `fromRumorConfidenceAtLeast` для `NPCRelationshipService`. Действие проверяет личную память инициатора; отсутствие доставки блокирует событие. В деле 002 появились действия `joe-reassures-thomas-after-threat` и `lora-questions-joe-about-threat`; Лора получает сообщение только если социальная сеть действительно передала ей слух (Джо может удержать сведения ради защиты Томаса). Валидатор и регрессионные тесты дополнены. Проверить Actions на последнем SHA перед слиянием; PR #1 остаётся открытым, не сливать автоматически.


## Продолжение — диалоги о поступках за кадром

Добавлены `NPCRelationshipService.hasCompletedInteraction(npcId, ruleId)` и диалоговое условие `npc_action_completed:<rule-id>`. В `case-002` Джо и Лора могут рассказать игроку о самостоятельных действиях лишь после их фактического выполнения; при одном лишь получении слуха реплика недоступна. Обновлены диалоги, валидатор и регрессионные тесты для каждого персонажа и сохранения/загрузки. Проверить свежий GitHub Actions для последнего HEAD; не сливать PR #1 без разрешения пользователя.


## Аудит проверки слухов и исправление CI

Проверка GitHub Actions на SHA `49ac5578` выявила 4 сбоя в тестах диалогов из-за неполных тестовых адаптеров `relationshipService`; исправлена безопасная optional-call проверка новых/существующих capability. Дополнительно в `NPCMemoryService` закрыт дефект: после пересказа слуха его исходный рассказчик не может подтверждать или опровергать его как независимый свидетель; замещённые версии показаний не принимаются. Дополнен тест Томас → Джо → Лора с независимым наблюдателем. Требуется проверить свежие CI после последнего SHA.


## Автономная проверка свидетельств — следующий этап

В `NPCRelationshipService` добавлен `investigatesRumorId`: после реального отложенного контакта со свидетелем вызывается `corroborateRumor`/`challengeRumor` только при наличии одного пригодного независимого непосредственного показания. В иных случаях результат `no_independent_evidence`; ничего не признаётся истинным автоматически. Результат сохраняется в `state.rules[ruleId].investigationOutcome`, извлекается через `getInvestigationOutcome` и доступен в диалогах по условию `npc_investigation_outcome`. Добавлен ответ Лоры про отсутствие независимого подтверждения. Регрессионные тесты проверяют задержку, независимую верификацию, недостаточное свидетельство и повторную загрузку. Проверить CI последнего коммита. PR #1 не сливать без решения пользователя.


## Продолжение: многоэтапное расследование Лоры

В автономные правила добавлены `requiresActionId`, `requiresInvestigationOutcome`, `requiresActionAgeMinutes`; они проверяют предыдущее действие того же NPC, его исход и время с момента выполнения. Лора после неподтверждённого слуха от Джо может позвонить Еве. Новое отношение `lora-eva-inquiry` и правило `lora-interviews-eva-about-threat` в `case-002`; новый диалог `lora_eva_followup_unverified`. Запрос к Еве не приравнивается к подтверждению без её непосредственного утверждения. Добавлены валидация и регрессии на последовательность действий и сохранение скрытой информации. Проверить последнюю GitHub Actions перед сообщением пользователю. PR #1 не сливать без разрешения.
