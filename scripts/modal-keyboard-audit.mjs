import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 320, height: 720 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.bootstrap?.Modal && document.querySelector('#universal-modal'));
    await page.waitForFunction(() => window.app?.eventController?.bound && window.app.eventController.events?.emit);
    const modal = page.locator('#universal-modal');
    await page.evaluate(async () => {
      const root = document.querySelector('#universal-modal');
      const opener = document.createElement('button');
      opener.id = 'modal-audit-opener';
      opener.textContent = 'Открыть диалог';
      document.body.prepend(opener);
      const shown = new Promise(resolve => root.addEventListener('shown.bs.modal', resolve, { once: true }));
      const body = Array.from({ length: 72 }, (_, i) =>
        '<p>Сообщение расследования ' + (i + 1) + ': свидетель подтверждает последовательность событий и уточняет детали показаний. ' +
        'Детектив фиксирует источник информации, сопоставляет время, место и независимые свидетельства, не теряя контекст предыдущих ответов.</p>'
      ).join('');
      opener.addEventListener('click', () => window.app.eventController.events.emit('modal:show', {
        title: 'ПРОВЕРКА ДЛИННОГО ДИАЛОГА',
        body,
        footer: '<button class="btn btn-warning" id="modal-audit-action">Продолжить</button>'
      }));
      opener.focus();
      opener.click();
      await shown;
    });
    await modal.waitFor({ state: 'visible' });
    const metrics = await page.evaluate(() => {
      const root = document.querySelector('#universal-modal');
      const dialog = root.querySelector('.modal-dialog');
      const body = root.querySelector('.modal-body');
      const header = root.querySelector('.modal-header');
      const close = root.querySelector('.modal-header .btn-close');
      const footer = root.querySelector('.modal-footer');
      const rect = element => {
        const r = element.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
      };
      return {
        viewport: window.innerWidth,
        dialog: rect(dialog), header: rect(header), body: rect(body), footer: rect(footer), close: rect(close),
        bodyScrollable: body.scrollHeight > body.clientHeight,
        bodyOverflowY: getComputedStyle(body).overflowY,
        closeVisible: !!(close.offsetWidth && close.offsetHeight),
        closeLabel: close.getAttribute('aria-label') || close.title || '',
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
      };
    });
    if (metrics.horizontalOverflow) throw new Error('document horizontal overflow: ' + JSON.stringify(metrics));
    if (!metrics.closeVisible) throw new Error('modal close control is not visible');
    if (!metrics.closeLabel) throw new Error('modal close button needs an accessible label');
    if (metrics.header.top < -1 || metrics.header.bottom > viewport.height + 1) {
      throw new Error('modal header is outside viewport: ' + JSON.stringify(metrics));
    }
    if (!metrics.bodyScrollable) throw new Error('long modal body is not scrollable: ' + JSON.stringify(metrics));
    if (metrics.close.right > viewport.width + 1 || metrics.close.left < -1 ||
      metrics.close.top < -1 || metrics.close.bottom > viewport.height + 1) {
      throw new Error('close control clipped: ' + JSON.stringify(metrics));
    }
    const closeButton = page.locator('#universal-modal .btn-close');
    const actionButton = page.locator('#modal-audit-action');
    await closeButton.focus();
    await page.keyboard.press('Shift+Tab');
    if (!(await actionButton.evaluate(element => element === document.activeElement))) {
      throw new Error('Shift+Tab did not wrap focus to the last modal action');
    }
    await page.keyboard.press('Tab');
    if (!(await closeButton.evaluate(element => element === document.activeElement))) {
      throw new Error('Tab did not wrap focus to the first modal control');
    }
    await modal.focus();
    await page.keyboard.press('Tab');
    if (!(await closeButton.evaluate(element => element === document.activeElement))) {
      throw new Error('Tab from the modal root did not enter the first focusable control');
    }
    await modal.focus();
    await page.keyboard.press('Shift+Tab');
    if (!(await actionButton.evaluate(element => element === document.activeElement))) {
      throw new Error('Shift+Tab from the modal root did not wrap to the last focusable control');
    }
    await page.keyboard.press('Escape');
    await modal.waitFor({ state: 'hidden' });
    const focusRestored = await page.locator('#modal-audit-opener').evaluate(element => element === document.activeElement);
    if (!focusRestored) throw new Error('focus was not restored to the modal opener');
    results.push({ viewport, ...metrics, escapeCloses: true, focusTrap: true, focusRestored });
    await page.close();
  }
  console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
} finally {
  await browser.close();
}
