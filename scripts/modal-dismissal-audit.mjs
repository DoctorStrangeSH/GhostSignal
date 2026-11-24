import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.bootstrap?.Modal &&
    window.app?.eventController?.bound && window.app.eventController.events?.emit);

  const modal = page.locator('#universal-modal');
  await page.evaluate(() => window.app.eventController.events.emit('modal:show', {
    title: 'ОБЯЗАТЕЛЬНОЕ РЕШЕНИЕ',
    body: 'Проверьте, что случайное закрытие не уничтожает обязательный сюжетный выбор.',
    footer: '<button class="btn btn-warning" data-bs-dismiss="modal">Подтвердить выбор</button>',
    dismissible: false
  }));
  await modal.waitFor({ state: 'visible' });

  const closeButton = modal.locator('.modal-header .btn-close');
  if (await closeButton.isVisible()) throw new Error('Protected modal exposes the close button');

  await page.keyboard.press('Escape');
  if (!(await modal.evaluate(element => element.classList.contains('show')))) {
    throw new Error('Escape closed a protected narrative modal');
  }

  await page.evaluate(() => {
    const root = document.querySelector('#universal-modal');
    root.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  if (!(await modal.evaluate(element => element.classList.contains('show')))) {
    throw new Error('Backdrop click closed a protected narrative modal');
  }

  await page.evaluate(() => window.bootstrap.Modal.getInstance(
    document.querySelector('#universal-modal')
  ).hide());
  await modal.waitFor({ state: 'hidden' });

  await page.evaluate(() => window.app.eventController.events.emit('modal:show', {
    title: 'ОБЫЧНОЕ ОКНО',
    body: 'Обычное окно можно закрыть клавишей Escape.',
    footer: '<button class="btn btn-warning" data-bs-dismiss="modal">Закрыть</button>'
  }));
  await modal.waitFor({ state: 'visible' });
  if (!(await closeButton.isVisible())) throw new Error('Ordinary modal lost its close control');

  await page.keyboard.press('Escape');
  await modal.waitFor({ state: 'hidden' });
  console.log(JSON.stringify({ status: 'PASS', protectedEscape: true, protectedBackdrop: true, ordinaryEscape: true }));
  await page.close();
} finally {
  await browser.close();
}
