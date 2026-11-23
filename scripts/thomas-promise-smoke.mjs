// End-to-end acceptance for Thomas's family-protection promise.
// The two outcomes branch from the same real browser save in isolated contexts.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.GHOST_SIGNAL_URL || 'http://127.0.0.1:4173';
const output = 'artifacts/thomas-promise-smoke';
await mkdir(output, { recursive: true });

async function waitForModalQueueToSettle(page, { quietMs = 700, timeoutMs = 12000 } = {}) {
    const started = Date.now();
    let quietSince = null;
    while (Date.now() - started < timeoutMs) {
        const modal = page.locator('#universal-modal.show');
        if (await modal.isVisible()) {
            quietSince = null;
            const close = modal.locator('[data-bs-dismiss="modal"], .btn-close').first();
            if (!await close.count()) throw new Error('Narrative modal has no close control');
            await close.click();
            await page.waitForTimeout(350);
            continue;
        }
        const state = await page.evaluate(() => ({
            modals: document.querySelectorAll('.modal.show').length,
            backdrops: document.querySelectorAll('.modal-backdrop').length,
            bodyOpen: document.body.classList.contains('modal-open')
        }));
        if (!state.modals && !state.backdrops && !state.bodyOpen) {
            quietSince ??= Date.now();
            if (Date.now() - quietSince >= quietMs) return;
        } else {
            quietSince = null;
        }
        await page.waitForTimeout(150);
    }
    throw new Error('Narrative modal queue did not settle');
}

async function waitForGame(page) {
    await page.locator('#loading-screen').waitFor({ state: 'detached', timeout: 30000 });
    await page.locator('#screen-main-menu.active, #screen-case-active.active').first().waitFor();
}

async function startThomasCall(page) {
    await page.evaluate(() => window.app.callInterface.startCall('waiter', 'dialogue-waiter'));
    await page.waitForFunction(() =>
        document.querySelector('#call-status')?.textContent?.trim() === 'СОЕДИНЁН' &&
        document.querySelectorAll('#dialogue-answers .answer-btn').length > 0,
    { timeout: 15000 });
}

async function choose(page, text, nextNode) {
    const answer = page.locator('#dialogue-answers .answer-btn').filter({ hasText: text });
    await answer.waitFor({ state: 'visible', timeout: 10000 });
    await answer.click();
    await page.waitForFunction(id => window.app?.dialogueEngine?.currentNode?.id === id,
        nextNode, { timeout: 10000 });
}

async function assertPromise(page, expectedStatus, expectedTrust) {
    await page.waitForFunction(({ status, trust }) => {
        const app = window.app;
        const promise = app?.npcMemoryService?.getPromises('waiter')
            ?.find(item => item.id === 'thomas-family-protection');
        const actualTrust = app?.npcMemoryService?.getMemory('waiter')?.trust;
        return promise?.status === status &&
            (trust === null || actualTrust === trust);
    }, { status: expectedStatus, trust: expectedTrust }, { timeout: 15000 });
}

const browser = await chromium.launch({ headless: true });
try {
    const seedContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const seedPage = await seedContext.newPage();
    const pageErrors = [];
    seedPage.on('pageerror', error => pageErrors.push(error.message));
    await seedPage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await waitForGame(seedPage);
    await seedPage.evaluate(() => {
        if (!window.app?.loadCase?.('case-002')) throw new Error('Could not start case-002');
    });
    await seedPage.locator('#screen-case-active.active').waitFor();
    await seedPage.waitForFunction(() => window.app?.progress?.activeCase === 'case-002');
    await waitForModalQueueToSettle(seedPage);

    // Prepare only the preconditions needed to reach the authored testimony
    // branch. Promise creation and all promise outcomes remain real game flows.
    await seedPage.evaluate(() => {
        // Give the player enough trust to choose the authored protection promise.
        // The testimony claim is added only after that promise is recorded, so
        // the first call follows the real greeting branch.
        window.app.npcMemoryService.adjustTrust('waiter', 10);
    });
    await startThomasCall(seedPage);
    await choose(seedPage, 'Томас, ты видел что-то в тот вечер.', 'he_saw');
    await choose(seedPage, 'Ты видел, что было дальше?', 'what_next');
    await choose(seedPage, 'Почему ты не рассказал это сразу?', 'why_silent');
    await choose(seedPage, 'Я обеспечу охрану твоей семьи', 'protection');
    const pendingTrust = await seedPage.evaluate(() =>
        window.app.npcMemoryService.getMemory('waiter').trust
    );
    await assertPromise(seedPage, 'pending', pendingTrust);
    await seedPage.screenshot({ path: `${output}/promise-made-pending.png`, fullPage: true });
    await seedPage.evaluate(() => {
        const result = window.app.npcMemoryService.recordClaim('waiter', {
            id: 'waiter-kane-at-poisoning-v2',
            topic: 'kane-presence-during-poisoning',
            value: 'saw-poisoning'
        });
        if (!result.added) throw new Error('Could not seed follow-up testimony claim');
    });
    await seedPage.locator('#btn-hangup').click();
    await seedPage.waitForFunction(() => !window.app.callInterface.isCallActive);
    await seedPage.keyboard.press('Control+s');
    const sharedSave = await seedContext.storageState();

    // Positive branch: the actual confirmation node emits the insight through
    // Inventory -> EventController -> NPCMemoryService.
    const keptContext = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        storageState: sharedSave
    });
    try {
        const page = await keptContext.newPage();
        page.on('pageerror', error => pageErrors.push('kept branch: ' + error.message));
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForGame(page);
        await page.locator('#btn-continue:not(.hidden)').click();
        await page.locator('#screen-case-active.active').waitFor();
        await page.waitForFunction(() => window.app?.progress?.activeCase === 'case-002');
        await waitForModalQueueToSettle(page);
        await page.evaluate(() => {
            window.app.inventory.addInsight('full_confession_kane');
            window.app.inventory.addInsight('joe_arranged_safe_lodging');
        });
        await startThomasCall(page);
        await page.waitForFunction(() =>
            window.app.dialogueEngine.currentNode.id === 'revised_testimony_opening'
        );
        await choose(page, 'Джо организовал для твоей матери временное безопасное место', 'family_safety_confirmed');
        await assertPromise(page, 'fulfilled', pendingTrust + 6);
        await page.waitForFunction(() => window.app.inventory.hasInsight('thomas_family_protected'));
        await page.screenshot({ path: `${output}/promise-kept-confirmed.png`, fullPage: true });
        await page.locator('#btn-hangup').click();
        await page.waitForFunction(() => !window.app.callInterface.isCallActive);
        await page.keyboard.press('Control+s');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForGame(page);
        await page.locator('#btn-continue:not(.hidden)').click();
        await page.locator('#screen-case-active.active').waitFor();
        await page.waitForFunction(() =>
            window.app?.npcMemoryService?.getPromises('waiter')
                ?.some(item => item.id === 'thomas-family-protection' && item.status === 'fulfilled') &&
            window.app?.npcMemoryService?.getMemory('waiter')?.trust === pendingTrust + 6
        );
        await page.evaluate(() => window.app.loadCase('case-002'));
        await startThomasCall(page);
        await page.waitForFunction(() =>
            window.app.dialogueEngine.currentNode.id === 'promise_kept_opening'
        );
        await page.screenshot({ path: `${output}/thomas-remembers-kept-promise.png`, fullPage: true });
    } finally {
        await keptContext.close();
    }

    // Negative branch: abandon the same pending run without family confirmation.
    const brokenContext = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        storageState: sharedSave
    });
    try {
        const page = await brokenContext.newPage();
        page.on('pageerror', error => pageErrors.push('broken branch: ' + error.message));
        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await waitForGame(page);
        await page.locator('#btn-continue:not(.hidden)').click();
        await page.locator('#screen-case-active.active').waitFor();
        await page.waitForFunction(() => window.app?.progress?.activeCase === 'case-002');
        await page.locator('#btn-abandon-case').click();
        await page.locator('#universal-modal.show #btn-confirm-abandon-case').click();
        await page.locator('#universal-modal.show .ending-report--failed').waitFor({ timeout: 15000 });
        await assertPromise(page, 'broken', pendingTrust - 8);
        await page.screenshot({ path: `${output}/promise-broken-ending.png`, fullPage: true });
        await page.keyboard.press('Control+s');
        await page.reload({ waitUntil: 'domcontentloaded' });
        await waitForGame(page);
        await page.waitForFunction(() =>
            window.app?.npcMemoryService?.getPromises('waiter')
                ?.some(item => item.id === 'thomas-family-protection' && item.status === 'broken') &&
            window.app?.npcMemoryService?.getMemory('waiter')?.trust === pendingTrust - 8
        );
        await page.evaluate(() => window.app.loadCase('case-002'));
        await startThomasCall(page);
        await page.waitForFunction(() =>
            window.app.dialogueEngine.currentNode.id === 'promise_broken_opening'
        );
        await page.screenshot({ path: `${output}/thomas-remembers-broken-promise.png`, fullPage: true });
    } finally {
        await brokenContext.close();
    }

    if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
    await seedContext.close();
    console.log('Thomas promise browser acceptance passed: pending -> fulfilled and pending -> broken; both outcomes survive reload and affect Thomas\'s next conversation.');
} finally {
    await browser.close();
}
