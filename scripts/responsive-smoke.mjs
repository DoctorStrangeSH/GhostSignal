import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.GHOST_SIGNAL_URL || 'http://127.0.0.1:4173';
const output = 'artifacts/responsive-smoke';
await mkdir(output, { recursive: true });

async function settleNarrative(page) {
    const modal = page.locator('#universal-modal');
    const isOpen = () => modal.count().then(count => count > 0
        ? modal.evaluate(element => element.classList.contains('show'))
        : false);
    let quietSince = Date.now();

    for (let attempt = 0; attempt < 60; attempt++) {
        if (await isOpen()) {
            const close = modal.locator('[data-bs-dismiss="modal"], .btn-close').first();
            if (!await close.count()) throw new Error('Narrative modal has no close control');
            await close.click();
            await page.waitForTimeout(250);
            quietSince = Date.now();
            continue;
        }

        await page.waitForTimeout(200);
        if (await isOpen()) {
            quietSince = Date.now();
            continue;
        }
        if (Date.now() - quietSince >= 1600) return;
    }
    throw new Error('Narrative modal queue did not settle for 1.6 seconds');
}

async function settleIncomingCalls(page) {
    const callModal = page.locator('#call-modal');
    const hangup = page.locator('#btn-hangup');
    for (let attempt = 0; attempt < 24; attempt++) {
        const visible = await callModal.count() &&
            await callModal.evaluate(element => !element.classList.contains('hidden'));
        if (visible) {
            await hangup.waitFor({ state: 'visible' });
            await hangup.click();
            await callModal.waitFor({ state: 'hidden' });
            await page.waitForTimeout(200);
            continue;
        }
        await page.waitForTimeout(350);
        const stillVisible = await callModal.count() &&
            await callModal.evaluate(element => !element.classList.contains('hidden'));
        if (!stillVisible) return;
    }
    throw new Error('Incoming call queue did not settle');
}

async function assertNoPageOverflow(page, label, width) {
    const metrics = await page.evaluate(() => {
        const viewport = document.documentElement.clientWidth;
        const offenders = [...document.querySelectorAll('body *')].map(element => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return {
                tag: element.tagName.toLowerCase(),
                id: element.id || null,
                className: typeof element.className === 'string' ? element.className : '',
                right: Math.round(rect.right * 10) / 10,
                left: Math.round(rect.left * 10) / 10,
                width: Math.round(rect.width * 10) / 10,
                position: style.position,
                whiteSpace: style.whiteSpace
            };
        }).filter(item => item.right > viewport + 1 || item.left < -1)
            .sort((a, b) => b.right - a.right).slice(0, 12);
        return {
            viewport,
            document: document.documentElement.scrollWidth,
            body: document.body.scrollWidth,
            offenders
        };
    });
    if (metrics.document > metrics.viewport + 2 || metrics.body > metrics.viewport + 2) {
        throw new Error(`${label} at ${width}px: horizontal overflow ${JSON.stringify(metrics)}`);
    }
}

const viewports = [
    { width: 320, height: 740 }, { width: 360, height: 780 },
    { width: 375, height: 812 }, { width: 390, height: 844 },
    { width: 430, height: 932 }, { width: 768, height: 1024 },
    { width: 1024, height: 768 }, { width: 1440, height: 900 }
];

const browser = await chromium.launch({ headless: true });
try {
    for (const viewport of viewports) {
        const name = String(viewport.width);
        const context = await browser.newContext({
            viewport, deviceScaleFactor: 1,
            isMobile: viewport.width <= 430, hasTouch: viewport.width <= 430
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));

        await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
        await page.locator('#loading-screen').waitFor({ state: 'detached' });
        await page.locator('#screen-main-menu.active').waitFor();
        await page.screenshot({ path: `${output}/${name}-menu.png`, fullPage: true });
        await assertNoPageOverflow(page, 'main menu', viewport.width);

        await page.locator('#btn-achievements').click();
        await page.locator('#screen-achievements.active .achievement-screen-header h2').waitFor();
        await page.locator('#screen-achievements .achievement-entry').first().waitFor();
        await assertNoPageOverflow(page, 'achievements', viewport.width);
        const achievements = await page.locator('#screen-achievements .achievement-screen').boundingBox();
        if (!achievements || achievements.width > viewport.width + 2) {
            throw new Error(`achievements exceed viewport at ${viewport.width}px`);
        }
        await page.screenshot({ path: `${output}/${name}-achievements.png`, fullPage: true });
        await page.locator('[data-achievement-back]').click();
        await page.locator('#screen-main-menu.active').waitFor();

        await page.locator('#btn-open-cases').click();
        await page.locator('#screen-cases.active .case-card').first().waitFor();
        await settleNarrative(page);
        await assertNoPageOverflow(page, 'case selection', viewport.width);
        await page.screenshot({ path: `${output}/${name}-cases.png`, fullPage: true });

        await page.locator('.case-btn[data-case-id="case-001"]').click();
        await page.locator('#screen-case-active.active').waitFor();
        await page.locator('#scene-container .scene-art').first().waitFor();
        await settleNarrative(page);
        await settleIncomingCalls(page);
        await assertNoPageOverflow(page, 'investigation', viewport.width);

        for (const tabId of ['tab-npcs', 'tab-board', 'tab-inventory']) {
            const tab = page.locator(`.sidebar-tab[data-tab="${tabId}"]`);
            await tab.click();
            await page.locator(`#${tabId}.active`).waitFor();
            const bounds = await tab.boundingBox();
            if (!bounds || bounds.x < -2 || bounds.x + bounds.width > viewport.width + 2) {
                throw new Error(`${tabId} outside viewport at ${viewport.width}px: ${JSON.stringify(bounds)}`);
            }
            await assertNoPageOverflow(page, tabId, viewport.width);
            if (tabId === 'tab-board') {
                await page.locator('#tab-board.active .board-canvas').waitFor();
                const board = await page.locator('.board-viewport').evaluate(element => ({
                    clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
                    overflowX: getComputedStyle(element).overflowX
                }));
                if (viewport.width <= 576 &&
                    (board.scrollWidth <= board.clientWidth || !['auto', 'scroll'].includes(board.overflowX))) {
                    throw new Error(`board horizontal scrolling missing at ${viewport.width}px: ${JSON.stringify(board)}`);
                }
            }
            await page.screenshot({ path: `${output}/${name}-${tabId}.png`, fullPage: true });
        }

        if (errors.length) throw new Error(`browser errors at ${viewport.width}px: ${errors.join(' | ')}`);
        await context.close();
        console.log(`Responsive audit PASS: ${viewport.width}x${viewport.height}`);
    }
} finally {
    await browser.close();
}
console.log('Responsive viewport audit completed.');
