import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1440, height: 900 }
];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    await context.addInitScript(() => {
      // Clear only on the first document of this isolated browser context.
      // sessionStorage survives reloads, so the save under test remains intact.
      if (sessionStorage.getItem('__ghost_board_audit_cleaned') === '1') return;
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('detective_archive_')) localStorage.removeItem(key);
      }
      sessionStorage.setItem('__ghost_board_audit_cleaned', '1');
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));

    await page.goto('http://127.0.0.1:4173', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app?.inventory && window.app?.investigationBoard &&
      window.app?.saveController && window.app?.caseController, null, { timeout: 20000 });
    await page.locator('#loading-screen').waitFor({ state: 'detached', timeout: 20000 });

    const started = await page.evaluate(() => window.app.loadCase('case-001'));
    if (!started) throw new Error(viewport.name + ': could not start case-001');

    const placed = await page.evaluate(() => {
      const app = window.app;
      if (!app.inventory.addItem('guest_book')) throw new Error('could not acquire guest_book');
      const slotId = 'slot-1';
      if (!app.investigationBoard.placeEvidence('guest_book', slotId)) {
        throw new Error('could not place guest_book on the investigation board');
      }
      const hypothesisId = app.investigationBoard.addHypothesis('Запись в журнале могла быть изменена после полуночи');
      if (!hypothesisId) throw new Error('could not create a hypothesis');
      if (!app.investigationBoard.linkHypothesis(hypothesisId, 'evidence', 'guest_book', 'for')) {
        throw new Error('could not link the clue to the hypothesis');
      }
      const alternativeId = app.investigationBoard.createAlternativeHypothesis(
        hypothesisId, 'Запись могла быть изменена до исчезновения'
      );
      if (!alternativeId) throw new Error('could not create an alternative hypothesis');
      if (!app.investigationBoard.reviseHypothesis(
        hypothesisId, 'Журнал могли изменить после полуночи перед исчезновением'
      )) throw new Error('could not revise the original hypothesis');
      const alibiId = app.investigationBoard.addAlibiClaim({
        subject: 'Томас',
        location: 'Отель «Гранд»',
        startMinute: 600,
        endMinute: 630,
        kind: 'evidence',
        sourceId: 'guest_book',
        precision: 'approximate',
        uncertaintyMinutes: 10
      }, { evidenceIds: ['guest_book'] });
      if (!alibiId) throw new Error('could not create a sourced alibi claim');
      if (!app._quickSave()) throw new Error('quickSave returned false');
      return { hypothesisId, alternativeId, alibiId, boardData: app.progress.boardData, inventoryData: app.progress.inventoryData };
    });
    if (placed.boardData.slots.find(slot => slot.id === 'slot-1')?.evidenceId !== 'guest_book') {
      throw new Error(viewport.name + ': clue was not included in the saved slot');
    }
    if (placed.inventoryData.evidence.includes('guest_book')) {
      throw new Error(viewport.name + ': placed clue remains in the saved available inventory pool');
    }

    await page.locator('.sidebar-tab[data-tab="tab-board"]').click();
    await page.locator('#board-area .board-slot[data-slot-id="slot-1"] .slot-evidence-name')
      .filter({ hasText: 'Журнал регистрации' }).waitFor({ state: 'visible' });

    const expected = await page.evaluate(() => ({
      hypothesisId: window.app.investigationBoard.hypotheses[0]?.id,
      alternativeId: window.app.investigationBoard.hypotheses[1]?.id,
      alibiId: window.app.investigationBoard.alibiClaims[0]?.id,
      boardData: window.app.investigationBoard.toJSON()
    }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app?.investigationBoard && window.app?.inventory &&
      window.app?.progress?.activeCase === 'case-001', null, { timeout: 20000 });
    await page.locator('#loading-screen').waitFor({ state: 'detached', timeout: 20000 });
    await page.locator('.sidebar-tab[data-tab="tab-board"]').click();

    const restored = await page.evaluate(expected => {
      const app = window.app;
      const slot = app.investigationBoard.slots.find(item => item.id === 'slot-1');
      const hypothesis = app.investigationBoard.hypotheses.find(item => item.id === expected.hypothesisId);
      const alternative = app.investigationBoard.hypotheses.find(item => item.id === expected.alternativeId);
      const pool = app.boardUI?.container?.querySelector('[data-evidence-id="guest_book"]');
      return {
        activeCase: app.progress.activeCase,
        slotEvidence: slot?.evidenceId || null,
        evidenceOnBoard: app.investigationBoard.evidenceOnBoard,
        inventoryOwnsClue: app.inventory.hasItem('guest_book'),
        clueInAvailableInventory: app.inventory.evidence.includes('guest_book'),
        clueInRenderedPool: Boolean(pool),
        hypothesisId: hypothesis?.id || null,
        hypothesisTitle: hypothesis?.title || null,
        hypothesisHistory: hypothesis?.history || [],
        hypothesisLink: hypothesis?.links?.find(link => link.sourceId === 'guest_book') || null,
        alternativeId: alternative?.id || null,
        alternativeGroupId: alternative?.alternativeGroupId || null,
        alternativeHistory: alternative?.history || [],
        alibi: app.investigationBoard.alibiClaims.find(claim => claim.id === expected.alibiId) || null,
        boardSnapshot: app.investigationBoard.toJSON()
      };
    }, expected);

    if (restored.activeCase !== 'case-001') throw new Error(viewport.name + ': active case was not restored');
    if (restored.slotEvidence !== 'guest_book') throw new Error(viewport.name + ': clue was lost from the board after reload');
    if (!restored.evidenceOnBoard.includes('guest_book')) throw new Error(viewport.name + ': evidenceOnBoard was not restored');
    if (!restored.inventoryOwnsClue) throw new Error(viewport.name + ': player no longer owns the placed clue');
    if (restored.clueInAvailableInventory || restored.clueInRenderedPool) {
      throw new Error(viewport.name + ': placed clue is incorrectly available for duplicate placement');
    }
    if (restored.hypothesisId !== expected.hypothesisId ||
        restored.hypothesisLink?.sourceId !== 'guest_book' ||
        restored.hypothesisLink?.stance !== 'for') {
      throw new Error(viewport.name + ': hypothesis or its evidence link was not restored');
    }
    if (restored.hypothesisTitle !== 'Журнал могли изменить после полуночи перед исчезновением' ||
        !restored.hypothesisHistory.some(item => item.action === 'revised')) {
      throw new Error(viewport.name + ': revised hypothesis title/history was not restored');
    }
    if (restored.alternativeId !== expected.alternativeId ||
        restored.alternativeGroupId !== expected.hypothesisId ||
        !restored.alternativeHistory.some(item => item.action === 'alternative_created')) {
      throw new Error(viewport.name + ': alternative hypothesis group/history was not restored');
    }
    if (restored.alibi?.id !== expected.alibiId ||
        restored.alibi?.sourceId !== 'guest_book' ||
        restored.alibi?.precision !== 'approximate' ||
        restored.alibi?.uncertaintyMinutes !== 10) {
      throw new Error(viewport.name + ': sourced alibi claim was not restored');
    }

    const removed = await page.evaluate(() => {
      const app = window.app;
      const result = app.investigationBoard.removeEvidence('slot-1');
      if (result !== 'guest_book') throw new Error('could not remove clue from restored board');
      if (!app.inventory.evidence.includes('guest_book')) {
        throw new Error('removed clue was not returned to the available evidence pool');
      }
      if (!app._quickSave()) throw new Error('could not save after removing clue');
      return true;
    });
    if (!removed) throw new Error(viewport.name + ': remove/recovery step failed');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app?.investigationBoard && window.app?.inventory &&
      window.app?.progress?.activeCase === 'case-001', null, { timeout: 20000 });
    await page.locator('#loading-screen').waitFor({ state: 'detached', timeout: 20000 });
    const removalRestored = await page.evaluate(() => ({
      slotEvidence: window.app.investigationBoard.slots.find(slot => slot.id === 'slot-1')?.evidenceId || null,
      available: window.app.inventory.evidence.includes('guest_book')
    }));
    if (removalRestored.slotEvidence || !removalRestored.available) {
      throw new Error(viewport.name + ': removed clue state did not survive a second reload');
    }

    // Switching investigations must not carry clues, hypotheses or alibis
    // from the previous case into the new case.
    const switched = await page.evaluate(() => {
      const app = window.app;
      if (!app.loadCase('case-002')) throw new Error('could not start case-002');
      return {
        caseId: app.investigationBoard.caseId,
        activeCase: app.progress.activeCase,
        placedEvidence: app.investigationBoard.evidenceOnBoard,
        hypotheses: app.investigationBoard.hypotheses,
        alibis: app.investigationBoard.alibiClaims,
        oldClueOwned: app.inventory.hasItem('guest_book')
      };
    });
    if (switched.caseId !== 'case-002' || switched.activeCase !== 'case-002' ||
        switched.placedEvidence.length || switched.hypotheses.length ||
        switched.alibis.length || switched.oldClueOwned) {
      throw new Error(viewport.name + ': previous investigation state leaked into case-002');
    }
    if (!await page.evaluate(() => window.app._quickSave())) {
      throw new Error(viewport.name + ': could not save case-002 after switching');
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.app?.investigationBoard &&
      window.app?.progress?.activeCase === 'case-002', null, { timeout: 20000 });
    await page.locator('#loading-screen').waitFor({ state: 'detached', timeout: 20000 });
    const caseTwoRestored = await page.evaluate(() => ({
      caseId: window.app.investigationBoard.caseId,
      placedEvidence: window.app.investigationBoard.evidenceOnBoard,
      hypotheses: window.app.investigationBoard.hypotheses
    }));
    if (caseTwoRestored.caseId !== 'case-002' ||
        caseTwoRestored.placedEvidence.length || caseTwoRestored.hypotheses.length) {
      throw new Error(viewport.name + ': case-002 reload restored data from case-001');
    }

    if (pageErrors.length) throw new Error(viewport.name + ': browser errors: ' + pageErrors.join(' | '));
    console.log(JSON.stringify({
      viewport: viewport.name,
      status: 'PASS',
      clueRestoredAfterReload: true,
      hypothesisLinkRestored: true,
      clueReturnedAfterRemovalAndReload: true
    }));
    await context.close();
  }
} finally {
  await browser.close();
}
