# Ghost Signal — handoff

## 2026-11-14: часы работы посещённых локаций в реконструкции алиби

- В алиби можно необязательно привязать указанное место к *посещённой* локации (поле `locationId`). Свободный текст и существующие сохранения остаются рабочими.
- `InvestigationBoard.reviewAlibiLocationHours(knownLocations)` сравнивает интервал с обычным режимом работы, включая ночной график через полночь и полностью круглосуточные места. В результате только вопрос о доступе после закрытия, **не** вывод о лжи или невозможности присутствовать.
- UI передаёт только посещённые локации, не раскрывая скрытые места. Неизвестные `locationId` отвергаются при добавлении, если их нет в явном контексте.
- Добавлен регрессионный тест на ночной бар, границу закрытия, длинный интервал, круглосуточный объект, недоступную локацию и загрузку старых сохранений.
- Перед публикацией: локальные `npm run check`, `npm run validate:data`, `npm test`, `npm run build`. Ручная браузерная проверка остаётся задачей; PR #1 не сливать без разрешения.

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


## Семейная защита: Ева и Анна

Добавлены получательские условия `npc_action_received:<rule-id>` и метод `NPCRelationshipService.hasReceivedInteraction`. В `case-002` новое правило `eva-protects-anna-after-pressure`: после `eva-calls-anna`, при повышенном давлении на Анну и задержке по времени Ева звонит снова, повышая готовность Анны сотрудничать. Диалоги Анны и Евы содержат отдельные ветки после фактического контакта; скрытая информация не вытекает между персонажами. Исправлен излишне категоричный внутренний вывод Евы о пузырьке. Есть тесты диалогов и последовательности с сохранением, обновлён валидатор. Следующему исполнителю проверить свежий CI и не сливать PR #1 без разрешения владельца.


## Сюжетный блокер: слишком лёгкое признание Кейна

Обнаружен и устранён обход доказательств в `assets/data/cases/case-002/dialogues/rival.js`: ранее запрос `why` немедленно приводил к подробному признанию; теперь для него требуются `hasInsight:waiter_saw_poisoning` и `hasInsight:kane_stole_vial` одновременно. Игрок без этих показаний может завершить разговор и вернуться. Второй обход через `caught_in_lie → final_decision` также закрыт. Регрессионные тесты добавлены в `tests/dialogue-memory.test.mjs`. Следующему ИИ нужно проверить последний CI, затем продолжить Кейна только с правдоподобными действиями (не наделять задержанного способностью свободно связываться с прессой из допросной). PR #1 не сливать без разрешения.


## Реакция Кейна на обвинение

В `NPCRelationshipService` добавлены парные условия `fromDialogueId` и `fromDialogueNodeId`; факт проверяется по собственным `dialogueHistory` NPC, а не чужим данным. `case-002`: bond `kane-sergeant-procedure`, rule `kane-files-objection` после `dialogue-rival-full/accusation` (одноразовое служебное возражение). Кейн может обсудить событие в `kane_formal_objection` только после его исполнения. Улики не скрываются; изменяются доверие и сотрудничество. Валидатор и тесты с сохранением обновлены. Проверить свежий CI, PR #1 не сливать без разрешения.


## Динамические показания Кейна (2026-11-13)

В `assets/data/cases/case-002/dialogues/rival.js` создана промежуточная ветка `partial_return`, открывающаяся после `waiter_saw_poisoning`. Кейн признаёт возвращение в зал, но НЕ отравление; `claim` с `revisesClaimId: kane-left-before-poisoning` заменяет его старое алиби, не удаляя историю и не создавая полного признания. В `tests/dialogue-memory.test.mjs` проверены состояние `superseded`, `revisionOf`, версия 2, восстановление сохранения, отсутствие `full_confession_kane`. В валидаторе есть проверка связности `revisesClaimId`. На предыдущем HEAD `fc1d5318` CI был успешен; проверить свежий HEAD после документации. PR #1 без разрешения не сливать.


## Динамические вступления NPC (Kane stateful opening)

Добавлен `tree.entryRules: [{ condition, nodeId }]` в `DialogueEngine.startDialogue` с fallback на `tree.start`. Авторство `case-002/dialogues/rival.js`: сначала `hasInsight:full_confession_kane → post_confession_opening`, затем `has_claim:kane-admits-return-to-bar → revised_opening`, иначе `confrontation`. Валидатор теперь учитывает альтернативные стартовые узлы при проверке достижимости и проверяет корректность `entryRules`. Тесты охватывают первое интервью, ревизию с восстановлением сохранения, полный финальный этап и совместимость старых диалогов. Проверить актуальные GitHub Actions; PR #1 не сливать без указания пользователя.


## Следующий этап: контекстные вступления + исправление доказательственной цепочки

`DialogueEngine` теперь поддерживает `not:<condition>` и `case_has_claim:<npcId>:<claimId>` (записанное в деле активное свидетельство). В `case-002/dialogues/rival.js` полное признание через Томаса требует отсутствия его версии v2; при v2 можно использовать независимые материалы Лоры (`hard_evidence_kane`) и улику Джо (`kane_stole_vial`). У Томаса, Анны и Лоры появились `tree.entryRules` с актуальными вступлениями. Тесты проверяют блокировку слабого пути и альтернативу. CI сначала обнаружил регрессию: при новом вступлении Томаса пропадала возможность пересмотреть показания после запугивания. Исправлено в `b8775647`; [CI успешно](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43482394677). Новая версия `waiter-kane-at-poisoning-reconsidered` также ведёт к собственному вступлению. Сохранить main, не сливать PR #1 без разрешения владельца.

Поправка после предыдущего этапа: `93b46fc2` блокирует прежний путь полного признания Кейна также после пересмотра Томасом показаний под давлением (`waiter-kane-at-poisoning-reconsidered`); `21d4dfc3` добавляет соответствующий регрессионный тест и сохраняет альтернативу через независимые материалы Лоры. Ожидается проверка CI для актуальной вершины ветки.

## Последнее продолжение: обоснование пересмотра Томасом свидетельства
`assets/data/cases/case-002/dialogues/waiter.js`: при активной версии `v2` можно спросить о фотографии и восстановлении хронологии либо необоснованно обвинить Томаса в умышленной лжи. Обвинение снижает сотрудничество, фиксируется в памяти, распространяется как отдельный рассказ и ведёт к настороженному завершению беседы. При версии `reconsidered` Томас объясняет влияние угроз детектива; извинение повышает сотрудничество, но не восстанавливает отозванные факты. Тесты добавлены в `tests/dialogue-memory.test.mjs` (`08f2025b`). После коммита проверить свежий CI. PR #1 оставить открытым, main не трогать.

## Следующее продолжение — ответственное извинение (2026-11-14)
Реализовано `NPCMemoryService.getAccusationStatus()` и условие `accusation_status:<id>:pending|false|retracted|substantiated` в `DialogueEngine`, валидатор игровых данных расширен. После бездоказательного обвинения Томаса во лжи появляется отдельное контекстное вступление. Детектив может официально признать обвинение ложным: событие записывается, социально распространяется, однако сотрудничество и доверие не восстанавливаются мгновенно. При повторном визите Томас помнит извинение; повторно его начислить нельзя. Добавлен тест в `tests/dialogue-memory.test.mjs` с проверкой serializable state, реакции, слуха и отсутствия фарма. Дождаться CI на актуальном HEAD и отметить его в PR #1. main не изменять.

## 2026-11-14: доступ к фактам после извинения
Исправлена развилка `apology_acknowledged_opening`: она больше не блокирует все повторные разговоры с Томасом. После извинения детектив может вернуться к текущему свидетельству `v2` либо `reconsidered`; обвинение остаётся разрешённым и повторно не создаётся. Регрессионный тест `Thomas can return to factual testimony after an apology...` добавлен. Отдельно важно для следующей итерации: обещание `thomas-family-protection` сейчас выполняется при `full_confession_kane`, хотя признание само по себе не доказывает безопасность семьи. Требуется отдельное подтверждённое событие защиты, проверка жизненного цикла обещаний и миграция сохранений. Не объявлять защиту реализованной. PR #1 не сливать без разрешения.

Дополнение: `816f107e` скрывает повторное необоснованное обвинение `thomas-lied-about-poisoning` после его записи (`not:has_accusation`), в том числе когда после извинения игрок возвращается в ветку уточнённых показаний. Регрессионная проверка в `26439ddf`.

## 2026-11-14: подтверждаемая защита семьи Томаса
Исправлен критерий обещания `thomas-family-protection`: `full_confession_kane` больше его не выполняет. В `bartender_case2.js` после признания Кейна и **реально завершённого** автономного действия Джо по поддержке Томаса появляется возможность организовать временное укрытие семьи (`joe_arranged_safe_lodging`). Джо честно сообщает, что договорился о месте, но прибытие не подтверждено. Во встрече с Томасом появляется отдельное подтверждение фактического прибытия матери и связи с ней (`thomas_family_protected`); только это новое озарение выполняет обещание. Выдать подтверждение повторно нельзя. Тесты проходят цепочку и проверяют отсутствие преждевременного выполнения. Для старых сохранений **только pending** обещания с прежним критерием мигрируют при создании `NPCMemoryService` ещё до событий; уже завершённые исторические обещания намеренно не переписываются, чтобы не нарушить ранее начисленные эффекты — нужен отдельный дизайн ретроспективной коррекции. Пожалуйста, проверьте CI нового HEAD; не сливать PR #1 без разрешения.

CI выявил ошибку нового теста: `hiddenWhenUnavailable` убирает из `getAvailableAnswers()` недоступный вариант Джо, поэтому проверять нужно `undefined`, а не `isAvailable === false`. Исправление в `f8a53de4`, требуется проверить новый CI. Игровые сценарии до этого прошли синтаксис и валидацию.

## 2026-11-14: утечка первого укрытия и повторная защита
`bartender_case2.js`: после `joe_arranged_safe_lodging` и до `thomas_family_protected` детектив может неосторожно раскрыть Кейну сведения об укрытии. `joe_address_compromised` создаёт `thomas_family_address_exposed`, снижает доверие/готовность Джо и распространяет **только факт утечки**, не сам адрес, как социальное событие. Исходное укрытие перестаёт проходить проверку у Томаса. Джо создаёт другую договорённость `joe_emergency_relocation` → `joe_relocated_family_after_leak`, но обещание остаётся ожидающим. Томас подтверждает второй переезд в `family_safety_reconfirmed`; только тогда создаётся `thomas_family_protected` и выполняется обещание. Блокировка/восстановление покрыты тестом в `tests/dialogue-memory.test.mjs`. Важно: после **уже подтверждённой** безопасности текущая история не моделирует новую угрозу или повторное раскрытие; это отдельная будущая механика с проверяемым статусом безопасности. PR #1 не сливать без разрешения.

## 2026-11-14: подозрительный посетитель после защиты семьи
`bartender_case2.js`: только после `thomas_family_protected` Джо может сообщить о незнакомце, который спрашивал время выхода Томаса на смену, **не спрашивая адрес матери**. Это даёт `unknown_visitor_asked_about_thomas`, не угрозу и не раскрытие адреса. `journalist.js`: Лора проверяет запись, но не находит независимого подтверждения личности или связи с Кейном (`unknown_visitor_unverified`). Ветка доступна и из `greeting`, и из `lora_second_check_opening`; повторная выдача блокируется. Сохранённая безопасность семьи не отменяется от одного подозрения. Тесты покрывают оба вступления и отсутствие ложного события утечки. Следующая задача — найти действительно независимую проверку личности посетителя, которая может привести к разным результатам, но пока не объявлять существование агента Кейна. PR #1 остаётся открытым, main не менялась.

## 2026-11-14: динамические вступления Джо после утечки
В `bartender_case2.js` добавлены три приоритетных `tree.entryRules`: если утечка и защита уже подтверждена — `joe_after_protection_verified_opening` (составное условие двух insights), если второе укрытие организовано — `joe_after_relocation_opening`, если только утечка — `joe_after_leak_opening`. Они не блокируют возвращение к `greeting` и другим вопросам. Обычная подтверждённая защита **без утечки** не активирует эти вступления. Финалы `joe_address_compromised` и `joe_emergency_relocation` направлены в `end_bartender_guarded`: Джо больше не благодарит безусловно после риска для семьи. Валидатор поддерживает `all:hasInsight:A&hasInsight:B` в entry rules. Тесты проверяют весь переход и отсутствие ложной утечки. PR #1 открыт; `main` не менялась.

## 2026-11-14: второй источник для неизвестного посетителя
После `unknown_visitor_unverified` Джо проверяет журнал посетителей и находит запись «И. Руденко / проверка условий труда / заявка 27-Б» (`joe_found_inspection_entry`). Это запись самого бара, а не удостоверение личности. Только затем Лора сверяет 27-Б с опубликованным графиком городской инспекции: визит Ильи Руденко в тот же бар и день совпадает (`visitor_likely_inspector`). Персонажи **не утверждают прямое опознание** и не объявляют человека доказанным агентом Кейна или однозначно невиновным. Проверка доступна из обоих вступлений Лоры, одноразовая и не меняет статус защищённой семьи. Тесты добавлены; проверить CI актуального HEAD. PR #1 открыт, main не менять.

## 2026-11-14: последствия преждевременного вывода о посетителе

В деле 002 добавлен осознанный выбор после документальной сверки заявки 27-Б. Лора подтверждает только то, что инспектор Илья Руденко был назначен на визит в бар; это не устанавливает, что именно он стоял у стойки.

- Осторожный ответ фиксирует в долговременной памяти Лоры, что детектив сохранил вероятную версию вероятной (player_respected_visitor_uncertainty), и немного укрепляет отношения.
- Если детектив объявляет личность установленной, Лора возражает и публикует социальное сообщение detective-overstated-visitor-identity. Это запись о поведении детектива, а не новая улика о посетителе.
- После доставки сообщения Джо может обсудить поспешный вывод. Он напоминает, что лично видел посетителя, но не подтверждал его документы. Игрок может принять поправку или продолжить настаивать; обе реакции сохраняются в долговременной памяти Джо.
- Одноразовое озарение joe_challenged_overstated_visitor_identity не позволяет фармить повторные последствия. Социальное сообщение доступно только после фактической доставки.
- Добавлены регрессионные тесты осторожного и поспешного путей, включая задержанную доставку слуха и повторное посещение Джо.

Текущий кодовый HEAD: 8cbe7019e89dae7d442d3cb92dd4a4a94585e89a. Для него запущены Push CI и PR CI; проверить окончательный статус перед следующим изменением. Предыдущий HEAD 90a48a6fdd790944257f4419a2ad668889fa326b прошёл синтаксис, валидацию и unit tests. PR #1 открыт, main не изменять и PR не объединять без решения владельца.

Следующий логичный этап: дать игроку способ получить настоящее независимое опознание (например, через официальный первичный документ или личную проверку инспектора), сохраняя различие между назначенным визитом, фактическим присутствием и доказанной личностью. Не объявлять посетителя агентом Кейна или инспектором без прямого основания.

## 2026-11-14: официальная проверка отмены и очное опознание посетителя

В деле 002 продолжена цепочка заявки 27-Б. Теперь отдельно проверяются назначение визита, фактическое посещение и личность человека у стойки.

- Добавлена локация `labour_inspection_office` и NPC `labour_inspector` (Илья Руденко), доступный только для очного разговора.
- В официальном журнале инспекции есть первичная запись: визит Руденко был назначен, затем отменён в 15:40 из-за несчастного случая на фабрике; замена не назначалась. Осмотр журнала выдаёт `inspection_cancellation_record` и копию `inspection_cancellation_copy`.
- Только после нахождения записи Джо и официальной отметки об отмене инспектор подтверждает, что сам в бар не приходил и никого не направлял (`rudenko_denies_visit`).
- Удостоверение с фото и номером ИТ-0417 подтверждает личность самого Руденко сейчас, но отдельно оговаривается, что оно не доказывает его присутствие в баре в прошлом. Удостоверение выдаётся как `inspector_service_card`.
- Руденко соглашается приехать к Джо. При очном сравнении Джо уверенно исключает его как человека у стойки (`joe_rules_out_rudenko`), но не опознаёт неизвестного посетителя и не связывает его с Кейном.
- Игрок может аккуратно зафиксировать границы вывода либо без доказательств приписать посетителя Кейну; обе реакции попадают в долговременную память Джо.
- В `index.html`, реестр NPC/локаций дела и тестовый harness добавлены новые данные. Добавлены два регрессионных теста: полная цепочка и запрет получать отрицание инспектора только из первоначальной записи бара.

Проверка актуального HEAD `25e4d926220cf91d0eab3f9b735257a2d8892226`: синтаксис и game-data validation успешно; **170/170 unit tests, 0 failures**. [Push CI](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43562631902) · [PR CI](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43562636651).

PR #1 остаётся открытым, `main` не изменена. Не объединять без решения владельца.

Следующий этап: расследовать, кто использовал имя инспектора. Не добавлять автоматическую связь с Кейном. Нужны отдельные независимые линии: описание внешности от Джо, проверка возможного доступа к номеру заявки/служебным данным, сопоставление времени и маршрута, а также проверка версии о случайном посетителе. Важно, чтобы отсутствие доказательств оставалось отдельным результатом, а не автоматически превращалось в доказательство заговора.

## 2026-11-14: описание неизвестного посетителя и независимый маршрутный след

Продолжено расследование после очного исключения Руденко. Новая ветка не раскрывает личность посетителя и не связывает его автоматически с Кейном.

- После опознания Джо может дать описание: мужчина моложе и ниже Руденко, в тёмном пальто, с повязкой/следом на правой руке; свидетель прямо предупреждает, что не запомнил лицо достаточно хорошо для фотоопознания (`unknown_visitor_description`).
- По этому описанию открывается разговор с Павлом Соколовым, кондуктором ночного трамвая №4, в новой локации `tram_depot`.
- Кондуктор сверяет путевой лист: трамвай задерживался у остановки возле бара около 22:15; пассажир в тёмном пальто с повреждённой правой рукой вышел у старой текстильной улицы. Кондуктор не видел его в баре и не знает имени.
- Выдаётся улика `tram_route_entry` и insight `tram_passenger_route_corroboration`. Это независимая временная/маршрутная зацепка, не опознание и не доказательство того, что пассажир и посетитель — один человек.
- Игрок может сохранить границы вывода или преждевременно объявить совпадение установленным; выбор фиксируется в долговременной памяти кондуктора.
- Добавлены два теста: открытие маршрутной проверки только после описания Джо и сохранение неопределённости после получения путевого листа. NPC/локация/диалог зарегистрированы в деле и загружаются через `index.html`.

Проверка HEAD `0a89777270c0f0b95a80b36bcbc4b3364daee420`: **172/172 unit tests, 0 failures**; синтаксис и game-data validation успешны. [Push CI](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43563069766) · [PR CI](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43563074299).

PR #1 остаётся открытым, `main` не менялась, merge не выполнять без разрешения владельца.

Следующий этап: проверить маршрут у старой текстильной улицы и доступ к заявке 27-Б. Ищите независимые следы (сменные ведомости, записи дежурного/проходной, транспортные журналы), но не превращайте общие совпадения в установление личности. Дайте возможность подтвердить, опровергнуть или оставить версию неопределённой; зафиксируйте последствия поспешных обвинений.

## 2026-11-14: проверка старой текстильной фабрики

Продолжено расследование маршрутной зацепки трамвая №4. Новая проверка сужает одну конкретную версию, но не устанавливает личность неизвестного.

- Добавлена локация `old_textile_mill` и NPC Степан Орлов, ночной сторож фабрики (`mill_watchman`).
- В локации есть объявление о закрытии фабрики на ремонт (`mill_gate_notice`); оно подтверждает закрытие, но прямо предупреждает, что не доказывает невозможность незаконного проникновения.
- После получения `tram_passenger_route_corroboration` можно показать сторожу описание пассажира и сверить журнал смены.
- Журнал сообщает: боковые ворота опечатаны в 21:50 после замены замка, утром пломба цела; зарегистрированных посетителей нет. Выписка `mill_shift_extract` даёт insight `mill_gate_seal_intact`.
- Сторож подчёркивает пределы: запись исключает проход через конкретные боковые ворота при целой пломбе, но не устанавливает местонахождение человека на всей улице, не опознаёт его и не доказывает отсутствие связи с фабрикой.
- Осторожная фиксация и чрезмерный вывод имеют разные ответы и долговременные теги памяти (`player_respected_record_scope`, `player_overstated_factory_record`).
- Добавлены два регрессионных теста: условная доступность сверки журнала и запрет превращать локальную запись ворот в вывод обо всём районе. NPC, локация, предметы и диалог зарегистрированы; скрипт загружается из `index.html`.

Проверка HEAD `25d1a04a1ac282ed30ba1e31daca45a567e8fa53`: **174/174 unit tests, 0 failures**; синтаксис и game-data validation успешны. [Push CI](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43564011383) · [PR CI](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43564014507).

PR #1 остаётся открытым, `main` не менялась, merge не выполнять без разрешения владельца.

Следующий этап: расширить поиск по старой текстильной улице за пределы фабричных ворот. Проверить муниципальный ночной журнал/дежурную будку или соседнее заведение, где могли видеть направление движения; дать независимую версию, способную подтвердить или опровергнуть маршрут трамвая. Не раскрывать личность только по совпадению одежды или повязки.

## 2026-11-14: ночная закусочная и независимое воспоминание о посетителе

Продолжено расследование неизвестного посетителя. Добавлена отдельная линия свидетельства, которая может совпадать с описанием Джо, но не подтверждает личность пассажира трамвая.

- Добавлена локация `night_diner` — круглосуточная закусочная «У последнего трамвая» и NPC Элеонора Брукс (`diner_owner`). Она доступна для очного разговора; её график ограничен допустимыми часами 0–23.
- Диалог открывается только после получения `unknown_visitor_description`. Элеонора вспоминает мужчину с правой рукой под столом и кофе у окна, но не видела его лица достаточно хорошо, чтобы опознать.
- Она оценивает время примерно в десять вечера по часам, которые отстают. При уточнении выясняется, что она не видела, как посетитель уходил, и не знает направления.
- Выдаётся `diner_cash_slip`: чек на кофе с отметкой 22:03. Время кассового аппарата не сверено, чек не именной и не устанавливает личность покупателя.
- Добавлены insights `diner_possible_matching_customer` и `diner_time_unverified`. Игрок может сохранить совпадение как гипотезу или преждевременно объявить, что это пассажир трамвая; выбор отражается в долговременной памяти Элеоноры.
- Добавлены два регрессионных теста: доступность разговора только после описания Джо, выдача чека, неопределённость времени/направления и реакция NPC на поспешное отождествление.
- Первоначально CI обнаружил некорректный час 24 в графике NPC. Исправлено на валидный диапазон 0–23; актуальные проверки прошли.

Проверка HEAD `6e212a3f2e18a7bd3211d2c590b14246f60a2286`: **176/176 unit tests, 0 failures**; JavaScript syntax и game-data reference validation успешны. [Push CI](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43565063325) · [PR CI](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43565066507).

PR #1 остаётся открытым; `main` не менялась, merge не выполнять без разрешения владельца.

Следующий этап: отдельная проверка телефонной будки/городской телефонной линии. Не предполагать, что публичная будка сохраняет журнал звонков: искать реалистичный источник данных (телефонная станция, дежурный оператор, служебная заявка о неисправности), либо честно оставить содержимое звонка недоступным. Связать время только после калибровки часов и независимого источника; не выводить личность звонящего из одного факта использования телефона.

## 2026-11-14: телефонная будка и архив городской станции

Добавлена новая линия расследования, основанная на реальном ограничении архивных данных: уличная будка не хранит журнал звонков, а станция не записывает содержание обычных местных разговоров.

- Добавлена локация `textile_phone_booth` с объектом `public_telephone_booth`. Осмотр таблички даёт `textile_street_phone_line` — идентификатор обслуживающей линии, но не журнал звонков.
- Добавлена локация `telephone_exchange` и NPC Марта Вейл (`telephone_operator`) с диалогом `dialogue-telephone-operator`.
- Запрос в архив открывается только при наличии двух независимых зацепок: `diner_possible_matching_customer` и `textile_street_phone_line`.
- Марта находит служебную карточку междугороднего запроса с линии текстильного района: 22:18 по сверенным служебным часам, направление — Восточный узел. Поле номера абонента утрачено; отметки об успешном соединении нет.
- Улика `telephone_exchange_slip` и insights `telephone_exchange_request_record`, `telephone_time_calibrated` не устанавливают личность звонившего, номер вызываемого абонента, конкретную будку или факт состоявшегося разговора.
- Осторожная фиксация границ документа и поспешное приписывание запроса посетителю закусочной вызывают разные реакции Марты и сохраняются в её долговременной памяти.
- Добавлены два теста: условная доступность проверки архива, выдача карточки и калиброванного времени, запрет приписывать запрос конкретному свидетелю. В тесте исправлена проверка формулировки «с номером абонента»; повторный CI зелёный.

Проверка HEAD `9f95689e6b7dd655e993abc8bcc2d46f9d064f44`: **178/178 unit tests, 0 failures**; syntax и game-data reference validation успешны. [Push CI](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43565714927) · [PR CI](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43565719900).

PR #1 остаётся открытым, `main` не менялась, merge не выполнять без разрешения владельца.

Следующий этап: проверить, можно ли независимым способом установить, что именно телефонная линия текстильной улицы использовалась в конкретный момент. Ищите только реалистичные источники (техническая заявка о линии, журнал дежурного, свидетель у будки); не восстанавливайте номер адресата из отсутствующей карточки. Сопоставьте 22:18 с часами закусочной только как приблизительную хронологию, пока нет калибровки кассового времени. Затем расширяйте доску расследования/версии, если текущая система заметок и улик действительно поддерживает её без фальшивой механики.

## 2026-11-14: техническая проверка телефонной будки Т-17

Продолжена телефонная линия расследования. Добавлена независимая техническая запись, которая сужает одну конкретную версию, но не объясняет источник междугороднего запроса.

- Добавлена локация `telephone_maintenance_depot` — ремонтная мастерская телефонной сети, NPC Генри Кларк (`line_technician`) и диалог `dialogue-line-technician`.
- После получения `telephone_time_calibrated` детектив может запросить наряд по будке Т-17 на текстильной улице.
- Наряд `booth_t17_maintenance_ticket`: нестабильный контакт зафиксирован в 21:55; контрольный вызов с Т-17 не прошёл в 22:05; контакт восстановлен, повторная проверка проведена в 22:41.
- Запись относится только к аппарату Т-17. Она не доказывает полное отключение всех линий района и не указывает, с какого аппарата поступил междугородний запрос станции в 22:18. Другой аппарат района остаётся возможным источником.
- Добавлены insights `booth_t17_fault_window` и `booth_t17_not_confirmed_source`. Осторожное ограничение вывода и чрезмерное обобщение приводят к разным реакциям и сохраняются в долговременной памяти техника.
- Добавлены два регрессионных теста: условный доступ к наряду после калиброванной отметки станции и запрет распространять неисправность одной будки на весь район.

Проверка HEAD `fafc1c71ee2ca489c98f945bdaa0fc1bfa7ab907`: **180/180 unit tests, 0 failures**; JavaScript syntax и game-data reference validation успешны. [Push CI](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43566446702) · [PR CI](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43566451606).

PR #1 остаётся открытым; `main` не менялась, merge не выполнять без разрешения владельца.

Следующий этап: использовать запись Т-17 как проверку конкретной версии, но не назначать её источником запроса. Найти независимый способ проверить, был ли другой общественный аппарат в районе доступен около 22:18 (например, журнал ремонта соседнего аппарата или свидетель, который видел использование другой будки). Затем аккуратно связать техническую хронологию с доской заметок/уликами, только если интерфейс уже умеет показывать связанные и противоречащие доказательства.


## 2026-11-14: пользовательские версии на доске расследования

Добавлена первая полноценная механика **рабочих гипотез**, без автоматического вынесения вердикта:

- Игрок в боковой вкладке «ДОСКА» создаёт собственную версию событий, редактирует её и может отклонить, не удаляя историю.
- К версии можно прикрепить уже собранную улику, запись из журнала показаний (в том числе архивную, с явной пометкой) либо собственное непроверенное допущение.
- У каждой связи игрок задаёт оценку: «поддерживает», «противоречит» или «требует проверки». Игра не выводит из этого истинность версии.
- Добавление, редактирование, прикрепление, удаление связей и отказ от версии образуют историю изменений; рабочие версии восстанавливаются при загрузке.
- Всё хранится в существующем boardData; старые сохранения без hypotheses поддерживаются. Кнопка сброса размещённых улик сохраняет гипотезы (сбрасывает именно слоты улик).
- Проверки в `tests/board-hypotheses.test.mjs` включают изменение версии, отклонение, повторные связи и миграцию старого сохранения.

Важное ограничение: оценка «за/против» субъективна, её вручную выставляет детектив. Не вводить автоматическое раскрытие скрытых истин, засчитывание расследования или изменения отношений NPC по одному только тексту гипотезы. Возможный следующий этап — улучшить поиск среди большого числа версий и проверку противоречий по документально подтверждённым источникам; авторская интерпретация остаётся свободной.

PR #1 оставить открытым, `main` не менять и не сливать без разрешения владельца.


### Дополнение: изоляция гипотез по делам и пересмотренные показания

- `InvestigationBoard.caseId` привязывает доску к активному расследованию: при открытии другого дела очищаются слоты и рабочие версии без восстановления старых улик в инвентарь нового дела.
- При обычной загрузке прежнего дела информация не очищается; старые сохранения без `caseId` принимают идентификатор активного сохранённого дела.
- Связи с заменёнными показаниями остаются в истории гипотез, но помечаются как пересмотренные; такие показания больше нельзя выбирать для новых связей. Это не делает новую версию автоматически истинной.
- Регрессионные тесты покрывают переключение дел, продолжение и миграцию сохранений. Следующий инженерный шаг: ручная браузерная проверка кнопок и мобильной боковой панели; затем расширить источники версий записями из заметок, сохранив происхождение доказательств.


## 2026-11-14: аудит происхождения показаний в рабочих гипотезах

`InvestigationBoard.reviewHypothesisSources(id, statements)` строит **подсказки о качестве источников**, а не о правильности версии. В UI добавлен блок «Проверка источников» рядом с каждой гипотезой:

- `directObservation === true` показывается как *заявлено личное наблюдение*. Отсутствие такого флага означает «способ получения сведений не установлен», а НЕ автоматически слух.
- Две ссылки на показания одного NPC помечаются как не независимые источники.
- Совпадающие `corroboratesRumorIds` / `refutesRumorIds` помечаются как ссылки на общий слух, который нельзя считать двумя независимыми подтверждениями.
- Если ссылка указывает на заменённую или недоступную запись, показывается предупреждение. Сама связь сохраняется для истории.
- Никаких новых скрытых фактов, доказательств в инвентаре, автоматических обвинений или вердиктов не выдаётся.
- Дополнен тест `tests/board-hypotheses.test.mjs` на независимость, общий слух, пересмотренную запись и отсутствие автоматического вывода.

Важно для дальнейшего повествования: `directObservation` — метаданные заявления, а не гарантия правдивости. Два разных NPC также не гарантируют независимость, если оба пересказывают один первоисточник. Следующий шаг: вручную проверить страницу на узком экране и затем добавить в отдельном сюжетном кейсе осмысленные варианты проверки первоисточника, не переписывая чужие слова задним числом.


## 2026-11-14: хронология и реконструкция алиби

- На доске расследования добавлен раздел «Хронология улик»: он показывает временные факты только из уже обнаруженных документов; сравнение отметок сообщает разницу во времени и предупреждает о разных scope. Запись о запросе станции не устанавливает личность звонившего или конкретный аппарат.
- Добавлена ручная реконструкция алиби: игрок записывает персонажа, место, временной интервал, точность (точное/приблизительное) и ссылку на реально обнаруженное показание или улику. Ссылки проверяются по доступным источникам; повторы и некорректные интервалы отклоняются.
- Пересекающиеся интервалы для одного персонажа и разных мест помечаются как требующие проверки. Это не вердикт о лжи.
- Следующий слой использует существующее правило CONFIG.time.costs.travel (сейчас 20 минут на любой переход между разными локациями): если между двумя непересекающимися версиями меньше времени, чем стоит обычный переход, UI показывает предупреждение. Это только минимальная проверка временного бюджета; географический маршрут и реальная длительность между конкретными точками пока не моделируются.
- Реконструкции сохраняются в boardData, миграция старых сохранений поддерживается; данные очищаются при переключении на другое дело.
- UI добавлен в assets/js/ui/boardUI.js; логика в assets/js/systems/board.js; регрессии — tests/board-hypotheses.test.mjs.
- В CI на промежуточном коммите была одна ошибка теста из-за сравнения пустых массивов из разных VM realms через deepStrictEqual. Исправлено на проверку длины; повторный прогон успешен.
- Последний проверенный HEAD: 0aaa059ea37b1df87c42a791bf777f40f8676976. GitHub Actions Quality checks: [успешно](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43570115932): JavaScript syntax, game-data validation, **190/190 unit tests**, 0 failures.
- PR #1 открыт; main не менялась и не должна сливаться без явного разрешения владельца.

Следующий шаг: добавить к алиби проверку доступности конкретной локации в указанное время (часы работы и подтверждённые ограничения доступа), не считая закрытую дверь абсолютным доказательством отсутствия человека. После этого проектировать явный граф переходов/маршрутов для конкретных локаций; не использовать расстояния между mapPosition как реальные маршруты и не выводить путь из прямой линии на карте. Затем проверить доску в браузере вручную, включая сохранение/загрузку, мобильную ширину и реальные сценарии дела №2.


## 2026-11-14: advisory access restrictions in alibi review

- `InvestigationBoard.reviewAlibiAccessRestrictions(knownLocations)` reads only locations supplied by the UI from the detective's visited-location set.
- If a visited location declares `requiresItem`, the alibi review adds `investigator_access_gate`: the detective needs a special authorization to inspect it. The message explicitly states that this is a player/investigation access rule, not proof that an NPC could not be there or enter another way.
- The finding is advisory only. It does not invalidate alibi claims, generate evidence, accuse anyone, or disclose requirements for undiscovered locations.
- `BoardUI` includes these findings beside opening-hours and travel-time warnings.
- Regression coverage: known vs undiscovered locations, special access requirement, explicit non-proof wording, and save/load persistence in `tests/board-hypotheses.test.mjs`.
- Code commits: `0a1eecc` (logic), `095aa6d` (UI), `c626dd6` (test). Latest code HEAD `c626dd670d97b24d04ac0904641555a781a958eb` passed GitHub Actions Quality checks: syntax, game-data validation, **192/192 unit tests**, 0 failures ([run 43570870734](https://github.com/DoctorStrangeSH/GhostSignal/actions/runs/43570870734)).
- PR #1 remains open; do not merge or modify `main` without the owner's explicit instruction.

Next: implement an explicit, case-authored route graph (edges with travel minutes and access notes), not distances inferred from map coordinates. Route checks must be scoped to known/visited places and should explain assumptions; keep opening hours, investigator authorization, physical access, and actual NPC presence as separate concepts. Then add a case-002 route graph grounded in its narrative and test route reachability, travel-time budget, unavailable/undiscovered paths, and legacy-save behavior.
