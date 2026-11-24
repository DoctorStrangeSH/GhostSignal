import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const viewport of [{ width: 320, height: 720 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.bootstrap?.Modal && window.app?.eventController?.bound &&
      window.app.eventController.events?.emit);

    const expected = Array.from({ length: 10 }, (_, index) => ({
      title: 'QUEUE AUDIT ' + String(index + 1).padStart(2, '0'),
      body: 'Проверка последовательности сюжетных сообщений: ' + (index + 1),
      footer: '<button class="btn btn-warning" data-bs-dismiss="modal">Закрыть сообщение</button>'
    }));

    await page.evaluate(async (messages) => {
      const root = document.querySelector('#universal-modal');
      const opener = document.createElement('button');
      opener.id = 'modal-queue-audit-opener';
      opener.textContent = 'Начать проверку очереди';
      document.body.prepend(opener);
      opener.focus();

      const firstShown = new Promise(resolve =>
        root.addEventListener('shown.bs.modal', resolve, { once: true })
      );
      for (const message of messages) {
        window.app.eventController.events.emit('modal:show', message);
      }
      await firstShown;
      window.__modalQueueAuditExpected = messages.map(message => message.title);
      window.__modalQueueAuditInitialPending = window.app.eventController.pendingModalData.length;
    }, expected);

    const initialPending = await page.evaluate(() => window.__modalQueueAuditInitialPending);
    if (initialPending !== 9) {
      throw new Error('Expected 9 queued messages behind the first modal, got ' + initialPending);
    }

    const observed = [];
    for (let index = 0; index < expected.length; index++) {
      const expectedTitle = expected[index].title;
      const actualTitle = await page.locator('#modal-title').textContent();
      if (actualTitle !== expectedTitle) {
        throw new Error('FIFO violation at position ' + (index + 1) +
          ': expected ' + expectedTitle + ', got ' + actualTitle);
      }
      observed.push(actualTitle);

      const hidden = page.locator('#universal-modal');
      const hiddenPromise = hidden.evaluate(element => new Promise(resolve =>
        element.addEventListener('hidden.bs.modal', resolve, { once: true })
      ));
      await page.locator('#modal-footer [data-bs-dismiss="modal"]').click();
      await hiddenPromise;

      if (index < expected.length - 1) {
        const nextTitle = expected[index + 1].title;
        await page.waitForFunction(title => {
          const root = document.querySelector('#universal-modal');
          return root?.classList.contains('show') &&
            document.querySelector('#modal-title')?.textContent === title;
        }, nextTitle);
      }
    }

    const focusRestored = await page.locator('#modal-queue-audit-opener')
      .evaluate(element => element === document.activeElement);
    if (!focusRestored) {
      throw new Error('Focus was not restored after the final queued message');
    }

    const remaining = await page.evaluate(() => window.app.eventController.pendingModalData.length);
    if (remaining !== 0) throw new Error('Queue was not empty after all messages were shown: ' + remaining);

    results.push({ viewport, messages: observed.length, fifo: true, noLoss: true, queueDrained: true, focusRestored });
    await page.close();
  }

  console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
} finally {
  await browser.close();
}
