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
        await page.screenshot({ path: `${output}/${name}-menu.png`, fullPage: true });

        await page.locator('#btn-open-cases').click();
        await page.locator('#screen-cases.active .case-card').first().waitFor();
        await page.screenshot({ path: `${output}/${name}-cases.png`, fullPage: true });

        // Menu and case selection should fit narrow screens without document overflow.
        const documentOverflow = await page.evaluate(() =>
            document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        if (documentOverflow > 2) throw new Error(`${name}: horizontal page overflow of ${documentOverflow}px`);

        if (name === 'desktop') {
            await page.locator('.case-btn[data-case-id="case-001"]').click();
            await page.locator('#screen-case-active.active').waitFor();
            await page.locator('#scene-container .scene-art').first().waitFor();
            await page.screenshot({ path: `${output}/desktop-investigation.png`, fullPage: true });

            // A first-visit introduction is part of gameplay and covers the sidebar.
            const introduction = page.locator('#universal-modal.show');
            if (await introduction.isVisible()) {
                await page.screenshot({ path: `${output}/desktop-introduction.png`, fullPage: true });
                await introduction.locator('.btn-close').click();
                await page.locator('.modal-backdrop').waitFor({ state: 'hidden' });
            }
            // Toasts are temporary; do not force a click through the player's UI.
            await page.locator('#notifications-container .notification').first()
                .waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
            await page.locator('.sidebar-tab[data-tab="tab-npcs"]').click();
            await page.locator('#tab-npcs.active .npc-card').first().waitFor();
            await page.screenshot({ path: `${output}/desktop-contacts.png`, fullPage: true });
        }
        if (errors.length) throw new Error(`${name}: uncaught browser error(s): ${errors.join(' | ')}`);
        await context.close();
    }
} finally {
    await browser.close();
}
console.log('Visual smoke screenshots captured successfully.');
