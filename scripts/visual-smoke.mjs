// Browser-based visual smoke check; screenshots are CI artifacts for manual review.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.GHOST_SIGNAL_URL || 'http://127.0.0.1:4173';
const output = 'artifacts/visual-smoke';
await mkdir(output, { recursive: true });

// Modal events can enqueue a follow-up narrative while Bootstrap is finishing
// the previous hide transition. Wait for a genuinely quiet modal state instead
// of assuming a fixed number of dialogs or a fixed transition delay.
async function waitForModalQueueToSettle(page, { quietMs = 900, timeoutMs = 15000 } = {}) {
    const startedAt = Date.now();
    let quietSince = null;

    while (Date.now() - startedAt < timeoutMs) {
        const modal = page.locator('#universal-modal.show');
        if (await modal.isVisible()) {
            quietSince = null;
            const close = modal.locator('[data-bs-dismiss="modal"], .btn-close').first();
            if (!await close.count()) {
                throw new Error('Visible modal has no dismiss control');
            }
            await close.click();
            // The hidden.bs.modal handler may synchronously open the next queued
            // narrative modal. Waiting for a hidden state can miss that brief
            // transition and time out; let Bootstrap finish, then inspect again.
            await page.waitForTimeout(400);
            continue;
        }

        const state = await page.evaluate(() => ({
            visibleModals: document.querySelectorAll('.modal.show').length,
            backdrops: document.querySelectorAll('.modal-backdrop').length,
            bodyModalOpen: document.body.classList.contains('modal-open')
        }));

        if (state.visibleModals === 0 && state.backdrops === 0 && !state.bodyModalOpen) {
            quietSince ??= Date.now();
            if (Date.now() - quietSince >= quietMs) return;
        } else {
            quietSince = null;
        }

        await page.waitForTimeout(150);
    }

    const state = await page.evaluate(() => ({
        visibleModals: [...document.querySelectorAll('.modal.show')].map(el => el.id || el.className),
        backdrops: document.querySelectorAll('.modal-backdrop').length,
        bodyModalOpen: document.body.classList.contains('modal-open'),
        bodyClass: document.body.className
    }));
    throw new Error(`Modal queue did not settle within ${timeoutMs}ms: ${JSON.stringify(state)}`);
}

async function waitForCallModalToSettle(page, { quietMs = 900, timeoutMs = 15000 } = {}) {
    const startedAt = Date.now();
    let quietSince = null;
    const callModal = page.locator('#call-modal');
    const hangup = page.locator('#btn-hangup');

    while (Date.now() - startedAt < timeoutMs) {
        const visible = await callModal.count() &&
            await callModal.evaluate(element => !element.classList.contains('hidden'));

        if (visible) {
            quietSince = null;
            await hangup.waitFor({ state: 'visible' });
            await hangup.click();
            await callModal.waitFor({ state: 'hidden' });
            await page.waitForTimeout(150);
            continue;
        }

        quietSince ??= Date.now();
        if (Date.now() - quietSince >= quietMs) return;
        await page.waitForTimeout(150);
    }

    throw new Error(`Incoming call modal did not settle within ${timeoutMs}ms`);
}

let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
    try {
        ready = (await fetch(baseUrl)).ok;
        if (ready) break;
    } catch { /* the CI server may still be starting */ }
    await new Promise(resolve => setTimeout(resolve, 200));
}
if (!ready) throw new Error(`Visual smoke server unavailable at ${baseUrl}`);

const browser = await chromium.launch({ headless: true });
try {
    for (const [name, viewport] of [
        ['desktop', { width: 1440, height: 900 }],
        ['mobile', { width: 390, height: 844 }]
    ]) {
        const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.locator('#screen-main-menu.active').waitFor();
        // The menu is present behind the boot animation before it is usable.
        await page.locator('#loading-screen').waitFor({ state: 'detached' });
        await page.screenshot({ path: `${output}/${name}-menu.png`, fullPage: true });

        await page.locator('#btn-achievements').click();
        await page.locator('#screen-achievements.active .achievement-screen-header h2').waitFor();
        await page.locator('#screen-achievements .achievement-entry').first().waitFor();
        await page.screenshot({ path: `${output}/${name}-achievements.png`, fullPage: true });
        const achievementOverflow = await page.locator('#screen-achievements .achievement-screen').evaluate(element =>
            element.scrollWidth - element.clientWidth
        );
        if (achievementOverflow > 2) {
            throw new Error(`${name}: achievement collection has horizontal overflow of ${achievementOverflow}px`);
        }
        await page.locator('[data-achievement-back]').click();
        await page.locator('#screen-main-menu.active').waitFor();

        await page.locator('#btn-open-cases').click();
        await page.locator('#screen-cases.active .case-card').first().waitFor();
        await page.screenshot({ path: `${output}/${name}-cases.png`, fullPage: true });

        // Menu and case selection should fit narrow screens without document overflow.
        const documentOverflow = await page.evaluate(() =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        if (documentOverflow > 2) throw new Error(`${name}: horizontal page overflow of ${documentOverflow}px`);

        await page.locator('.case-btn[data-case-id="case-001"]').click();
        await page.locator('#screen-case-active.active').waitFor();
        await page.locator('#scene-container .scene-art').first().waitFor();
        await page.screenshot({ path: `${output}/${name}-investigation.png`, fullPage: true });

        // Introductory narrative overlays are part of gameplay, on both screen sizes.
        const introduction = page.locator('#universal-modal.show');
        let dismissed = 0;
        // Follow-up narrative windows can be queued after the previous one closes.
        // Consider the intro complete only after a short modal-free interval.
        for (let index = 0; index < 20; index++) {
            await page.waitForTimeout(1000);
            if (!await introduction.isVisible()) {
                await page.waitForTimeout(750);
                if (!await introduction.isVisible()) break;
            }
            if (dismissed === 0) await page.screenshot({ path: `${output}/${name}-introduction.png`, fullPage: true });
            await introduction.locator('.btn-close').click();
            await introduction.waitFor({ state: 'hidden' });
            dismissed++;
        }
        if (await introduction.isVisible()) throw new Error(`${name}: introductory modals did not settle`);
        await page.waitForFunction(() => document.querySelectorAll('.modal-backdrop').length === 0);
        await page.locator('#notifications-container .notification').first()
            .waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

        // Verify the explicit unresolved closure from an isolated fresh save.
        // This must always show the authored failure outcome, even when the
        // original investigation continues in the main browser context.
        await page.keyboard.press('Control+s');
        const failureContext = await browser.newContext({
            viewport,
            deviceScaleFactor: 1,
            storageState: await context.storageState()
        });
        try {
            const failurePage = await failureContext.newPage();
            failurePage.on('pageerror', error => errors.push('failure route: ' + error.message));
            failurePage.on('console', message => {
                if (message.type() === 'error') console.error('[failure route console]', message.text());
            });
            await failurePage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
            await failurePage.locator('#loading-screen').waitFor({ state: 'detached' });
            await failurePage.locator('#screen-main-menu.active').waitFor();
            await failurePage.locator('#btn-continue:not(.hidden)').click();
            await failurePage.locator('#screen-case-active.active').waitFor();
            await failurePage.locator('#btn-abandon-case').click();
            await failurePage.locator('#universal-modal.show #btn-confirm-abandon-case').click();
            try {
                await failurePage.locator('#universal-modal.show .ending-report--failed').waitFor({ timeout: 8000 });
            } catch (error) {
                const diagnostics = await failurePage.evaluate(() => ({
                    activeCase: window.app?.progress?.activeCase,
                    activeRunId: window.app?.progress?.activeRunId,
                    completedRunIds: window.app?.progress?.completedRunIds,
                    failedCases: window.app?.progress?.failedCases,
                    caseState: window.app?.caseManager?.caseState,
                    modalTitle: document.querySelector('#modal-title')?.textContent,
                    modalBody: document.querySelector('#modal-body')?.innerHTML,
                    modalVisible: document.querySelector('#universal-modal')?.classList.contains('show'),
                    pendingModal: Boolean(window.app?.eventController?.pendingModalData)
                }));
                console.error('[failure route diagnostics]', JSON.stringify(diagnostics));
                await failurePage.screenshot({ path: `${output}/${name}-case-one-failure-debug.png`, fullPage: true });
                throw error;
            }
            await failurePage.waitForFunction(() =>
                window.app?.progress?.activeCase === null &&
                window.app?.progress?.failedCases?.includes('case-001') &&
                document.querySelector('#universal-modal.show #modal-title')?.textContent?.includes('ДЕЛО НЕ РАСКРЫТО')
            );
            await failurePage.screenshot({
                path: `${output}/${name}-case-one-failed-ending.png`,
                fullPage: true
            });
        } finally {
            await failureContext.close();
        }

        // Exercise a real investigation path through rendered scene objects.
        // The clue must enter the inventory and grant its authored insight;
        // examining the bed in room 304 must reveal a second, spawned clue.
        await page.evaluate(() => window.app?.sceneRenderer?.renderLocation('hotel_grand'));
        await page.locator('#scene-container .scene-object-card').filter({ hasText: 'Журнал регистрации' }).click();
        await page.locator('#universal-modal.show #modal-body').waitFor();
        await page.waitForFunction(() => window.app?.inventory?.hasItem('guest_book') &&
            window.app?.inventory?.hasInsight('missing_page'));
        await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
        await waitForModalQueueToSettle(page);

        await page.locator('#scene-container .scene-sublocation-btn').filter({ hasText: 'Номер 304' }).click();
        await page.waitForFunction(() => window.app?.sceneRenderer?.currentScene?.id === 'hotel_room_304');
        // Location introductions and autonomous NPC events can enqueue more
        // than one narrative window. Drain the queue through the real UI.
        await page.waitForTimeout(850);
        await waitForModalQueueToSettle(page);
        await page.locator('#scene-container .scene-object-card').filter({ hasText: 'Кровать' }).click();
        await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
        await waitForModalQueueToSettle(page);
        await page.waitForFunction(() => window.app?.inventory?.hasItem('hidden_note'));

        // The wardrobe contains the brass key required by the wall safe.
        await waitForCallModalToSettle(page);
        await page.locator('#scene-container .scene-object-card').filter({ hasText: 'Шкаф' }).click({ force: true });
        await page.waitForFunction(() => window.app?.inventory?.hasItem('small_key'));
        await waitForCallModalToSettle(page);
        await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
        await waitForModalQueueToSettle(page);

        // The crooked mirror must reveal a previously hidden wall safe. Its
        // code is grounded in the room number and rewards the victim's diary.
        await page.locator('#scene-container .scene-object-card').filter({ hasText: 'Зеркало' }).click({ force: true });
        await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
        await waitForModalQueueToSettle(page);
        const revealedSafe = page.locator('#scene-container .scene-object-card').filter({ hasText: 'Сейф в стене' });
        await revealedSafe.waitFor({ state: 'visible' });
        await waitForCallModalToSettle(page);
        await revealedSafe.click({ force: true });
        await page.locator('#universal-modal.show .lock-game').waitFor();
        for (let click = 0; click < 3; click++) {
            await page.locator('.lock-arrow.up[data-index="0"]').click();
        }
        for (let click = 0; click < 4; click++) {
            await page.locator('.lock-arrow.up[data-index="2"]').click();
        }
        await page.locator('#btn-lock-check').click();
        await page.waitForFunction(() => window.app?.inventory?.hasItem('victim_diary'), { timeout: 10000 });
        await page.locator('#universal-modal .modal-header .btn-close').click();
        await waitForModalQueueToSettle(page);
        await waitForModalQueueToSettle(page);
        await page.waitForFunction(() => window.app?.locationManager?.getLocationItems('hotel_room_304')?.includes('wall_safe'));

        // Three distinct evidence items trigger the sergeant's real incoming
        // call. Complete the authored dialogue instead of bypassing the warrant gate.
        await page.locator('#call-modal').waitFor({ state: 'visible', timeout: 20000 });
        await page.waitForFunction(() =>
            document.querySelector('#call-status')?.textContent?.trim() === 'СОЕДИНЁН' &&
            document.querySelectorAll('#dialogue-answers .answer-btn').length > 0
        );
        await page.locator('#dialogue-answers .answer-btn').filter({
            hasText: 'Мне нужен судебный ордер по делу.'
        }).click();
        await page.locator('#dialogue-answers .answer-btn').filter({
            hasText: 'У меня есть три разные улики, подтверждающие необходимость обыска и запроса документов.'
        }).waitFor({ state: 'visible' });
        await page.locator('#dialogue-answers .answer-btn').filter({
            hasText: 'У меня есть три разные улики, подтверждающие необходимость обыска и запроса документов.'
        }).click();
        await page.waitForFunction(() => window.app?.inventory?.hasItem('search_warrant'));
        await page.locator('#dialogue-answers .answer-btn').filter({
            hasText: 'Спасибо, сержант. Я не подведу.'
        }).click();
        await page.locator('#call-modal').waitFor({ state: 'hidden', timeout: 10000 });

        // The chain mechanism is an additional fourth clue. The diary already
        // satisfied the three-evidence warrant gate, so this click is unblocked.
        await page.locator('#scene-container .scene-object-card').filter({ hasText: 'Дверная цепочка' }).click();
        await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
        await waitForModalQueueToSettle(page);
        await page.waitForFunction(() => window.app?.inventory?.hasItem('wire_fragment') &&
            window.app?.inventory?.hasInsight('chain_trick'));

        // The warrant must unlock the private apartment, but opening hours still
        // apply. Use the in-game wait controls, then travel through the city map.
        await page.locator('#btn-wait').click();
        await page.locator('#universal-modal.show .wait-btn[data-minutes="0"]').click();
        await waitForModalQueueToSettle(page);
        await page.locator('#btn-wait').click();
        await page.locator('#universal-modal.show .wait-btn[data-minutes="120"]').click();
        await waitForModalQueueToSettle(page);
        await waitForCallModalToSettle(page);
        await page.locator('#btn-map').click();
        await page.locator('#screen-map.active').waitFor();
        const apartmentMarker = page.locator('.map-marker').filter({ hasText: 'Квартира жертвы' });
        await apartmentMarker.waitFor({ state: 'visible' });
        await apartmentMarker.click();
        await page.locator('#screen-case-active.active').waitFor();
        await page.waitForFunction(() => window.app?.sceneRenderer?.currentScene?.id === 'victim_apartment');
        const victoriaDesk = page.locator('#scene-container .scene-object-card').filter({
            hasText: 'Письменный стол Виктории'
        });
        await victoriaDesk.waitFor({ state: 'visible' });
        // The card intentionally lifts on hover. Force only bypasses Playwright's
        // bounding-box stability heuristic; the real DOM click handler still runs.
        await victoriaDesk.click({ force: true });
        await page.locator('#universal-modal.show #modal-body').waitFor();
        await page.waitForFunction(() => window.app?.inventory?.hasItem('detective_photos') &&
            window.app?.inventory?.hasInsight('wife_hired_detective'));
        await page.screenshot({ path: `${output}/${name}-case-one-warrant-apartment.png`, fullPage: true });
        await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
        await waitForModalQueueToSettle(page);

        // Audit every remaining apartment prop through the real interaction UI.
        // The locked home safe must clearly explain what is missing rather than
        // pretending that an unsupported key/code path exists.
        for (const [label, expectedText] of [
            ['Книжный шкаф', 'Некоторые книги лежат на полу'],
            ['Сейф', 'Нужен ключ или код'],
            ['Фоторамка', 'На фото они улыбаются']
        ]) {
            const objectCard = page.locator('#scene-container .scene-object-card').filter({ hasText: label });
            await objectCard.waitFor({ state: 'visible' });
            await objectCard.click({ force: true });
            await page.locator('#universal-modal.show #modal-body').getByText(expectedText, { exact: false }).waitFor();
            await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
            await waitForModalQueueToSettle(page);
        }
        await page.waitForFunction(() => window.app?.inventory?.hasItem('detective_photos') &&
            window.app?.inventory?.hasInsight('wife_hired_detective'));


        // Autonomous calls can still arrive during later UI checks. Drain them
        // through the actual in-game hang-up control, never by hiding the overlay.
        await waitForCallModalToSettle(page);

        for (const [tabId, filename, contentSelector] of [
            ['tab-npcs', 'contacts', '#tab-npcs.active .npc-card'],
            ['tab-board', 'board', '#tab-board.active .board-canvas'],
            ['tab-inventory', 'evidence', '#tab-inventory.active']
        ]) {
            const tab = page.locator(`.sidebar-tab[data-tab="${tabId}"]`);
            await tab.click();
            await page.locator(contentSelector).first().waitFor();
            if (name === 'mobile' && tabId === 'tab-board') {
                const boardScroll = await page.locator('.board-viewport').evaluate(element => ({
                    scrollWidth: element.scrollWidth,
                    clientWidth: element.clientWidth
                }));
                if (boardScroll.scrollWidth <= boardScroll.clientWidth) {
                    throw new Error('mobile: board must scroll horizontally instead of shrinking its evidence slots');
                }
            }
            if (name === 'mobile') {
                const bounds = await tab.boundingBox();
                if (!bounds || bounds.x < -2 || bounds.x + bounds.width > viewport.width + 2) {
                    throw new Error(`mobile: ${tabId} navigation is outside the viewport`);
                }
            }
            await page.screenshot({ path: `${output}/${name}-${filename}.png`, fullPage: true });
        }
        const investigationOverflow = await page.evaluate(() =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        if (investigationOverflow > 2) {
            throw new Error(`${name}: investigation has horizontal page overflow of ${investigationOverflow}px`);
        }

        // Exercise the real browser lifecycle as well as the first render:
        // persistence across a full reload, resume, and isolated case restart.
        await page.keyboard.press('Control+s');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('#loading-screen').waitFor({ state: 'detached' });
        await page.locator('#screen-main-menu.active').waitFor();
        await page.locator('#btn-continue:not(.hidden)').waitFor();
        await page.locator('#btn-continue').click();
        await page.locator('#screen-case-active.active').waitFor();
        await page.locator('#scene-container .scene-art').first().waitFor();
        const restoredInvestigation = await page.waitForFunction(() => {
            const app = window.app;
            return app?.progress?.activeCase === 'case-001' &&
                app?.inventory?.hasItem('guest_book') &&
                app?.inventory?.hasItem('hidden_note') &&
                app?.inventory?.hasItem('wire_fragment') &&
                app?.inventory?.hasItem('victim_diary') &&
                app?.locationManager?.getLocationItems('hotel_room_304')?.includes('wall_safe') &&
                app?.inventory?.hasItem('search_warrant') &&
                app?.inventory?.hasItem('detective_photos') &&
                app?.inventory?.hasInsight('missing_page') &&
                app?.inventory?.hasInsight('chain_trick') &&
                app?.inventory?.hasInsight('wife_hired_detective') &&
                app?.locationManager?.unlockedLocations?.has('victim_apartment');
        }, { timeout: 30000 }).catch(async error => {
            const state = await page.evaluate(() => {
                const app = window.app;
                return {
                    activeCase: app?.progress?.activeCase,
                    items: ['guest_book', 'hidden_note', 'wire_fragment', 'victim_diary', 'search_warrant', 'detective_photos']
                        .filter(id => app?.inventory?.hasItem(id)),
                    insights: ['missing_page', 'chain_trick', 'wife_hired_detective']
                        .filter(id => app?.inventory?.hasInsight(id)),
                    wallSafeRevealed: app?.locationManager?.getLocationItems('hotel_room_304')?.includes('wall_safe'),
                    apartmentUnlocked: app?.locationManager?.unlockedLocations?.has('victim_apartment'),
                    savedProgress: app?.progress?.toJSON?.(),
                    savedLocation: app?.locationManager?.toJSON?.()
                };
            });
            throw new Error(`Investigation did not restore after reload: ${JSON.stringify(state)}; ${error.message}`);
        });

        // Complete the first investigation's critical confession route through
        // real scene, inventory, call and deduction interfaces. The route requires
        // a physical relationship clue, the sedative observation, the door-chain
        // reconstruction and the victim's diary; merely knowing Mary's identity
        // must not be enough to close the case.
        await waitForCallModalToSettle(page);
        await page.evaluate(() => window.app?.sceneRenderer?.renderLocation('hotel_room_304'));
        await page.locator('#scene-container .scene-object-card').filter({ hasText: 'Пятно на ковре' }).click({ force: true });
        await page.waitForFunction(() => window.app?.inventory?.hasInsight('sedative_clue'));
        await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
        await waitForModalQueueToSettle(page);

        await page.evaluate(() => window.app?.sceneRenderer?.renderLocation('alley'));
        await page.locator('#scene-container .scene-object-card').filter({ hasText: 'Мусорный бак' }).click({ force: true });
        await page.waitForFunction(() => window.app?.inventory?.hasItem('torn_photo'));
        await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
        await waitForModalQueueToSettle(page);

        // Study the diary before any confession: it independently corroborates
        // the danger to the victim and is required for a supported accusation.
        await page.evaluate(() => window.app?.inventoryUI?.render?.());
        await page.locator('.sidebar-tab[data-tab="tab-inventory"]').click();
        await page.locator('.inventory-card[data-item-id="victim_diary"]').click();
        await page.locator('#universal-modal.show').waitFor();
        await page.waitForFunction(() => window.app?.inventory?.hasInsight('victim_knew_danger'));
        await page.locator('#universal-modal .modal-header .btn-close').click();
        await waitForModalQueueToSettle(page);

        // Clone the pre-confession save into an isolated browser context. This
        // lets the same real deduction UI prove that enough evidence without
        // Mary's confession leads to the partial, not perfect, ending.
        await page.keyboard.press('Control+s');
        await page.waitForFunction(() => window.app?.caseManager?.evidenceFound >= 6 &&
            window.app?.inventory?.hasInsight('victim_knew_danger'));
        const partialContext = await browser.newContext({
            viewport,
            deviceScaleFactor: 1,
            storageState: await context.storageState()
        });
        try {
            const partialPage = await partialContext.newPage();
            partialPage.on('pageerror', error => errors.push('partial route: ' + error.message));
            await partialPage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
            await partialPage.locator('#loading-screen').waitFor({ state: 'detached' });
            await partialPage.locator('#screen-main-menu.active').waitFor();
            await partialPage.locator('#btn-continue:not(.hidden)').click();
            await partialPage.locator('#screen-case-active.active').waitFor();
            await partialPage.waitForFunction(() => window.app?.progress?.activeCase === 'case-001' &&
                window.app?.caseManager?.evidenceFound >= 6 &&
                window.app?.inventory?.hasItem('hidden_note') &&
                window.app?.inventory?.hasItem('wire_fragment') &&
                window.app?.inventory?.hasInsight('victim_knew_danger') &&
                !window.app?.inventory?.hasInsight('mary_full_confession') &&
                !window.app?.inventory?.hasInsight('blackwood_location_revealed'));
            await partialPage.evaluate(() =>
                window.app?.deductionScreen?.show(window.app?.caseManager?.currentCase)
            );
            await partialPage.locator('#ded-suspect').selectOption('housekeeper');
            await partialPage.locator('#ded-motive').selectOption('love');
            await partialPage.locator('#ded-weapon').selectOption('sedative');
            await partialPage.locator('#btn-deduction-submit').click();
            await partialPage.locator('#deduction-feedback').getByText('ВСЁ ВЕРНО', { exact: false }).waitFor();
            await partialPage.waitForFunction(() =>
                window.app?.caseManager?.caseState === 'solved' &&
                document.querySelector('#universal-modal.show #modal-title')?.textContent?.includes('ЧАСТИЧНОЕ РАСКРЫТИЕ'),
            { timeout: 15000 });
            await partialPage.locator('#universal-modal.show .ending-report--partial').waitFor();
            await partialPage.screenshot({
                path: `${output}/${name}-case-one-partial-ending.png`,
                fullPage: true
            });
        } finally {
            await partialContext.close();
        }

        await page.evaluate(() => {
            if (!window.app?.callInterface) throw new Error('Call interface is unavailable');
            window.app.callInterface.currentDialogueId = 'dialogue-housekeeper';
            window.app.callInterface.startCall('housekeeper');
        });
        const maryAnswers = page.locator('#dialogue-answers .answer-btn');
        await page.waitForFunction(() =>
            document.querySelector('#call-status')?.textContent?.trim() === 'СОЕДИНЁН' &&
            document.querySelectorAll('#dialogue-answers .answer-btn').length > 0,
        { timeout: 15000 });
        for (const answer of [
            'Успокойтесь, Мэри. Я просто хочу задать несколько вопросов о мистере Блэквуде.',
            'Расскажите о ваших отношениях с мистером Блэквудом.',
            'Вы были ближе, чем просто горничная и постоялец. Я знаю о вас.',
            'Это не важно. Важно то, что вы скрываете правду.',
            'Но он передумал, верно?',
            'И что вы сделали, когда он сказал это?',
            'Вы угрожали ему. А потом он исчез.',
            'Он спал? Или вы дали ему снотворное?',
            'Мэри, что вы сделали с ним?',
            'Дверь была заперта цепочкой изнутри. Как вы закрыли её снаружи?',
            'Теперь расскажите, где Блэквуд.',
            'Мэри, вы совершили ошибку. Но он жив. Это главное.',
            'Я вызову полицию. Вам нужна помощь, Мэри.'
        ]) {
            await maryAnswers.filter({ hasText: answer }).waitFor({ state: 'visible' });
            await maryAnswers.filter({ hasText: answer }).click();
        }
        await page.waitForFunction(() =>
            window.app?.inventory?.hasInsight('mary_full_confession') &&
            window.app?.inventory?.hasInsight('blackwood_location_revealed') &&
            window.app?.inventory?.hasInsight('chain_trick_confirmed'),
        { timeout: 15000 });
        await page.locator('#call-modal').waitFor({ state: 'hidden', timeout: 10000 });
        await page.screenshot({ path: `${output}/${name}-case-one-full-confession.png`, fullPage: true });

        // The complete confession and the independently revealed rescue location
        // must produce the ideal ending, while the actual deduction still checks
        // the physical scene evidence and corroborating diary.
        await page.evaluate(() => window.app?.inventoryUI?.render?.());
        await page.locator('.sidebar-tab[data-tab="tab-inventory"]').click();
        await page.locator('.inventory-card[data-item-id="victim_diary"]').click();
        await page.locator('#universal-modal.show').waitFor();
        await page.waitForFunction(() => window.app?.inventory?.hasInsight('victim_knew_danger'));
        await page.locator('#universal-modal .modal-header .btn-close').click();
        await waitForModalQueueToSettle(page);
        await page.evaluate(() => window.app?.deductionScreen?.show(window.app?.caseManager?.currentCase));
        await page.locator('#ded-suspect').selectOption('housekeeper');
        await page.locator('#ded-motive').selectOption('love');
        await page.locator('#ded-weapon').selectOption('sedative');
        await page.locator('#btn-deduction-submit').click();
        await page.locator('#deduction-feedback').getByText('ВСЁ ВЕРНО', { exact: false }).waitFor();
        await page.waitForFunction(() => window.app?.caseManager?.caseState === 'solved', { timeout: 15000 });
        await page.screenshot({ path: `${output}/${name}-case-one-perfect-ending.png`, fullPage: true });
        await waitForModalQueueToSettle(page);

        await page.keyboard.press('Escape');
        await page.locator('#screen-main-menu.active').waitFor();
        await page.locator('#btn-options').click();
        await page.locator('#btn-reset-case').waitFor();
        page.once('dialog', dialog => dialog.accept());
        await page.locator('#btn-reset-case').click();
        await page.locator('#screen-main-menu.active').waitFor();
        await page.locator('#loading-screen').waitFor({ state: 'detached' });
        await page.locator('#btn-continue').waitFor({ state: 'attached' });
        if (!await page.locator('#btn-continue').evaluate(button => button.classList.contains('hidden'))) {
            throw new Error(`${name}: Continue remains available after case restart`);
        }

        // A fresh investigation must remain playable after the first case was
        // restarted; the previous case must not leak into the new save.
        // The reset reloads the entire app. Wait for the new controller and
        // case list to finish binding before opening a different investigation.
        await page.waitForFunction(() => Boolean(
            window.app?.caseListUI && window.app?.navigationController &&
            window.app?.progress?.activeCase === null
        ));
        await page.locator('#btn-open-cases').click();
        await page.locator('#screen-cases.active .case-btn[data-case-id="case-002"]').click();
        await page.locator('#screen-case-active.active').waitFor();
        await page.locator('#scene-container .scene-art').first().waitFor();
        await page.keyboard.press('Control+s');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('#loading-screen').waitFor({ state: 'detached' });
        await page.locator('#screen-main-menu.active').waitFor();
        await page.locator('#btn-continue:not(.hidden)').click();
        await page.locator('#screen-case-active.active').waitFor();
        await page.locator('#scene-container .scene-art').first().waitFor();
        const resumedCase = await page.evaluate(() => window.app?.progress?.activeCase ?? null);
        if (resumedCase !== 'case-002') {
            throw new Error(`${name}: expected case-002 after resume, got ${resumedCase}`);
        }

        // Case two must expose its own crime-scene objects after a real reload.
        // Inspecting the glass should reveal the hidden vial and preserve the
        // authored poison insight; the scarf is a separate, collectible clue.
        await page.evaluate(() => window.app?.sceneRenderer?.renderLocation('bar_joe'));
        await page.locator('#scene-container .scene-object-card').filter({ hasText: 'Опрокинутый стакан' }).waitFor();
        await page.screenshot({ path: output + '/' + name + '-case-two-crime-scene.png', fullPage: true });

        await page.locator('#scene-container .scene-object-card').filter({ hasText: 'Опрокинутый стакан' }).click();
        await page.locator('#universal-modal.show #modal-body').waitFor();
        await page.waitForFunction(() => window.app?.inventory?.hasItem('overturned_glass') &&
            window.app?.inventory?.hasItem('poison_vial') &&
            window.app?.inventory?.hasInsight('cyanide_poison'));
        await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
        await waitForModalQueueToSettle(page);

        await page.locator('#scene-container .scene-object-card').filter({ hasText: 'Красный шарф' }).click();
        await page.locator('#universal-modal.show #modal-body').waitFor();
        await page.waitForFunction(() => window.app?.inventory?.hasItem('red_scarf') &&
            window.app?.inventory?.hasInsight('scarf_owner'));
        await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
        await waitForModalQueueToSettle(page);

        await page.keyboard.press('Control+s');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.locator('#loading-screen').waitFor({ state: 'detached' });
        await page.locator('#screen-main-menu.active').waitFor();
        await page.locator('#btn-continue:not(.hidden)').click();
        await page.locator('#screen-case-active.active').waitFor();
        await page.waitForFunction(() => window.app?.progress?.activeCase === 'case-002' &&
            window.app?.inventory?.hasItem('overturned_glass') &&
            window.app?.inventory?.hasItem('poison_vial') &&
            window.app?.inventory?.hasItem('red_scarf') &&
            window.app?.inventory?.hasInsight('cyanide_poison') &&
            window.app?.inventory?.hasInsight('scarf_owner'));
        await page.evaluate(() => window.app?.sceneRenderer?.renderLocation('bar_joe'));
        await page.screenshot({ path: output + '/' + name + '-case-two-resumed-evidence.png', fullPage: true });

        // Complete a proof-based case-two route through the rendered browser UI.
        // Start from the resumed save, collect the two required physical exhibits,
        // verify that the deduction gate rejects a theory without independent
        // corroboration, then obtain Lora's documentary evidence and solve.
        await page.evaluate(() => window.app?.sceneRenderer?.renderLocation('pharmacy'));
        await page.locator('#scene-container .scene-object-card').filter({ hasText: 'Журнал продаж' }).click();
        await page.locator('#universal-modal.show #modal-body').waitFor();
        await page.waitForFunction(() => window.app?.inventory?.hasItem('prescription_copy') &&
            window.app?.inventory?.hasInsight('kane_bought_cyanide'));
        await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
        await waitForModalQueueToSettle(page);

        await page.evaluate(() => window.app?.sceneRenderer?.renderLocation('newspaper_office'));
        await page.locator('#scene-container .scene-object-card').filter({ hasText: 'Фотографии прессы' }).click();
        await page.locator('#universal-modal.show #modal-body').waitFor();
        await page.waitForFunction(() => window.app?.inventory?.hasItem('bar_photo') &&
            window.app?.inventory?.hasInsight('photo_evidence'));
        await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
        await waitForModalQueueToSettle(page);

        // Correct suspect/motive/weapon are not enough: the UI must explain
        // that independent corroboration is still missing without leaking answers.
        await page.evaluate(() => window.app?.deductionScreen?.show(window.app?.caseManager?.currentCase));
        await page.locator('#ded-suspect').selectOption('business_rival');
        await page.locator('#ded-motive').selectOption('revenge');
        await page.locator('#ded-weapon').selectOption('poison');
        await page.locator('#btn-deduction-submit').click();
        await page.locator('#deduction-feedback').getByText('ДОКАЗАТЕЛЬСТВ НЕДОСТАТОЧНО', { exact: false }).waitFor();
        await page.locator('#deduction-feedback').getByText('Документы журналистки или официальное признание', { exact: false }).waitFor();
        await page.screenshot({ path: `${output}/${name}-case-two-proof-gate.png`, fullPage: true });
        await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
        await waitForModalQueueToSettle(page);

        // Lora's dialogue is run through the call UI: greeting -> investigation
        // -> show_evidence. The resulting insight is independent corroboration,
        // not a side effect of merely visiting her office.
        await page.evaluate(() => {
            if (!window.app?.callInterface) throw new Error('Call interface is unavailable');
            window.app.callInterface.currentDialogueId = 'dialogue-journalist';
            window.app.callInterface.startCall('journalist');
        });
        await page.waitForFunction(() =>
            document.querySelector('#call-status')?.textContent?.trim() === 'СОЕДИНЁН' &&
            document.querySelectorAll('#dialogue-answers .answer-btn').length > 0,
        { timeout: 15000 });
        await page.locator('#dialogue-answers .answer-btn').filter({
            hasText: 'Вы следили за Кейном. Что вы раскопали?'
        }).click();
        await page.locator('#dialogue-answers .answer-btn').filter({
            hasText: 'У вас есть доказательства? Покажите.'
        }).waitFor({ state: 'visible' });
        await page.locator('#dialogue-answers .answer-btn').filter({
            hasText: 'У вас есть доказательства? Покажите.'
        }).click();
        await page.waitForFunction(() => window.app?.inventory?.hasInsight('hard_evidence_kane'));
        await page.screenshot({ path: `${output}/${name}-case-two-independent-corroboration.png`, fullPage: true });
        await page.locator('#btn-hangup').click();
        await page.locator('#call-modal').waitFor({ state: 'hidden' });

        // The same deduction now passes only after the independent source is
        // acquired. The normal success path emits case:solved exactly once.
        await page.evaluate(() => window.app?.deductionScreen?.show(window.app?.caseManager?.currentCase));
        await page.locator('#ded-suspect').selectOption('business_rival');
        await page.locator('#ded-motive').selectOption('revenge');
        await page.locator('#ded-weapon').selectOption('poison');
        await page.locator('#btn-deduction-submit').click();
        await page.locator('#deduction-feedback').getByText('ВСЁ ВЕРНО', { exact: false }).waitFor();
        await page.waitForFunction(() =>
            window.app?.progress?.completedCases?.includes('case-002') ||
            window.app?.progress?.solvedCases?.includes('case-002') ||
            window.app?.caseManager?.caseState === 'solved',
        { timeout: 12000 });
        await page.screenshot({ path: `${output}/${name}-case-two-solved.png`, fullPage: true });

        if (errors.length) throw new Error(`${name}: uncaught browser error(s): ${errors.join(' | ')}`);
        await context.close();
    }
} finally {
    await browser.close();
}
console.log('Visual smoke screenshots captured successfully.');
