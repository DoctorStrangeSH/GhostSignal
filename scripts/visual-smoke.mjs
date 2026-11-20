// Browser-based visual smoke check; screenshots are CI artifacts for manual review.
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.GHOST_SIGNAL_URL || 'http://127.0.0.1:4173';
const output = 'artifacts/visual-smoke';
await mkdir(output, { recursive: true });

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

        // Exercise a real investigation path through rendered scene objects.
        // The clue must enter the inventory and grant its authored insight;
        // examining the bed in room 304 must reveal a second, spawned clue.
        await page.evaluate(() => window.app?.sceneRenderer?.renderLocation('hotel_grand'));
        await page.locator('#scene-container .scene-object-card').filter({ hasText: 'Журнал регистрации' }).click();
        await page.locator('#universal-modal.show #modal-body').waitFor();
        await page.waitForFunction(() => window.app?.inventory?.hasItem('guest_book') &&
            window.app?.inventory?.hasInsight('missing_page'));
        await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
        await page.locator('#universal-modal').waitFor({ state: 'hidden' });
        await page.locator('.modal-backdrop').waitFor({ state: 'detached' });

        await page.locator('#scene-container .scene-sublocation-btn').filter({ hasText: 'Номер 304' }).click();
        await page.locator('#scene-container .scene-object-card').filter({ hasText: 'Кровать' }).click();
        await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
        await page.locator('#universal-modal').waitFor({ state: 'hidden' });
        await page.locator('.modal-backdrop').waitFor({ state: 'detached' });
        await page.waitForFunction(() => window.app?.inventory?.hasItem('hidden_note'));

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

        if (errors.length) throw new Error(`${name}: uncaught browser error(s): ${errors.join(' | ')}`);
        await context.close();
    }
} finally {
    await browser.close();
}
console.log('Visual smoke screenshots captured successfully.');
