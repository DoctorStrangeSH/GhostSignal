import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function createHarness(items = [], insights = []) {
    const emitted = [];
    const feedback = { classList: { remove() {} }, innerHTML: '' };
    const submit = { disabled: false };
    const publicButton = { disabled: false, onClick: null, addEventListener(name, handler) { if (name === 'click') this.onClick = handler; }, click() { this.onClick?.({ currentTarget: this }); } };
    const context = vm.createContext({
        console,
        events: {
            on() {},
            emit(name, payload) { emitted.push({ name, payload }); }
        },
        document: {
            getElementById(id) {
                return id === 'deduction-feedback' ? feedback :
                    id === 'btn-deduction-submit' ? submit :
                    id === 'btn-deduction-public' ? publicButton : null;
            }
        },
        setTimeout(callback) { callback(); }
    });
    for (const path of [
        'assets/data/cases/case-001/index.js',
        'assets/data/cases/case-002/index.js',
        'assets/js/systems/caseManager.js',
        'assets/js/ui/deductionScreen.js'
    ]) {
        vm.runInContext(readFileSync(resolve(root, path), 'utf8'), context, { filename: path });
    }
    const inventory = {
        hasItem(id) { return items.includes(id); },
        hasInsight(id) { return insights.includes(id); }
    };
    const { first, second, screen, manager } = vm.runInContext(
        '({ first: CASE_001, second: CASE_002, screen: DeductionScreen, manager: CaseManager })',
        context
    );
    return { first, second, inventory, emitted, feedback, submit, publicButton, screen: new screen(inventory), manager };
}

test('correct suspect, motive and weapon without corroboration do not close case two', () => {
    const h = createHarness(['poison_vial', 'red_scarf', 'threat_note', 'bar_photo']);
    const verdict = h.screen._checkDeduction(h.second, 'business_rival', 'revenge', 'poison');
    assert.equal(verdict.allCorrect, true);
    assert.equal(verdict.proof.sufficient, false);
    assert.deepEqual(Array.from(verdict.proof.missingItems), ['prescription_copy']);
    assert.equal(verdict.proof.missingCorroboration, true);

    let hidden = false;
    h.screen._showDeductionResult(verdict, { hide() { hidden = true; } }, h.second);
    assert.match(h.feedback.innerHTML, /ДОКАЗАТЕЛЬСТВ НЕДОСТАТОЧНО/);
    assert.match(h.feedback.innerHTML, /Копия аптечной записи/);
    assert.match(h.feedback.innerHTML, /Документы журналистки или официальное признание/);
    assert.equal(hidden, false);
    assert.equal(h.submit.disabled, false);
    assert.equal(h.emitted.some(event => event.name === 'case:solved'), false);
});

test('independent corroboration can come from alternative routes; the correct case two verdict solves', () => {
    for (const insight of ['hard_evidence_kane', 'full_confession_kane']) {
        const h = createHarness(['prescription_copy', 'bar_photo'], [insight]);
        const verdict = h.screen._checkDeduction(h.second, 'business_rival', 'revenge', 'poison');
        assert.equal(verdict.proof.sufficient, true);
        h.screen._showDeductionResult(verdict, { hide() {} }, h.second);
        assert.equal(h.emitted.filter(event => event.name === 'case:solved').length, 1);
    }
});

test('a pharmacy note and uncertain witness inference are not independent corroboration', () => {
    for (const insight of ['kane_bought_cyanide', 'rival_took_vial_confirmed', 'full_poison_path']) {
        const h = createHarness(['prescription_copy', 'bar_photo'], [insight]);
        const verdict = h.screen._checkDeduction(h.second, 'business_rival', 'revenge', 'poison');
        assert.equal(verdict.allCorrect, true);
        assert.equal(verdict.proof.sufficient, false);
        assert.equal(verdict.proof.missingCorroboration, true);
        h.screen._showDeductionResult(verdict, { hide() {} }, h.second);
        assert.equal(h.emitted.some(event => event.name === 'case:solved'), false);
    }
});

test('legacy typed answer cannot bypass proof gate in case two', () => {
    const h = createHarness(['prescription_copy', 'bar_photo']);
    const manager = new h.manager(null, null, h.inventory);
    manager.currentCase = h.second;
    manager.caseState = 'active';
    const weak = manager.checkFinalAnswer('виктор кейн');
    assert.equal(weak.isCorrect, false);
    assert.equal(weak.theoryCorrect, undefined);
    assert.equal(weak.insufficientEvidence, true);
    assert.equal(manager.caseState, 'active');
    assert.equal(h.emitted.some(event => event.name === 'case:solved'), false);
});


test('insufficient evidence reveals no correct suspect, motive or weapon to brute-force attempts', () => {
    const h = createHarness(['bar_photo']);
    const correct = h.screen._checkDeduction(h.second, 'business_rival', 'revenge', 'poison');
    h.screen._showDeductionResult(correct, { hide() {} }, h.second);
    const correctFeedback = h.feedback.innerHTML;
    const wrong = h.screen._checkDeduction(h.second, 'ex_wife', 'jealousy', 'alcohol');
    h.screen._showDeductionResult(wrong, { hide() {} }, h.second);
    assert.equal(h.feedback.innerHTML, correctFeedback, 'same proof guidance regardless of the guessed culprit');
    assert.doesNotMatch(h.feedback.innerHTML, /Вы правильно связали|Подозреваемый: ✅/);
    assert.equal(h.emitted.some(event => event.name === 'case:solved'), false);
});

test('incorrect deduction with full evidence does not reveal individual answer fields', () => {
    const h = createHarness(['prescription_copy', 'bar_photo'], ['hard_evidence_kane']);
    const wrong = h.screen._checkDeduction(h.second, 'business_rival', 'jealousy', 'poison');
    assert.equal(wrong.allCorrect, false);
    h.screen._showDeductionResult(wrong, { hide() {} }, h.second);
    assert.match(h.feedback.innerHTML, /ОБВИНЕНИЕ НЕ ПОДТВЕРЖДЕНО/);
    assert.doesNotMatch(h.feedback.innerHTML, /Мотив:|Орудие:|Подозреваемый:/);
    assert.equal(h.emitted.some(event => event.name === 'case:solved'), false);
});

test('legacy typed answers do not disclose correctness before proof is sufficient', () => {
    const h = createHarness(['bar_photo']);
    const manager = new h.manager(null, null, h.inventory);
    manager.currentCase = h.second;
    const correct = manager.checkFinalAnswer('виктор кейн');
    const wrong = manager.checkFinalAnswer('анна');
    assert.equal(correct.insufficientEvidence, true);
    assert.equal(wrong.insufficientEvidence, true);
    assert.equal(correct.theoryCorrect, undefined);
    assert.equal(wrong.theoryCorrect, undefined);
    assert.equal(correct.text, wrong.text);
});

test('case one remains compatible without evidence requirements', () => {
    const h = createHarness();
    const verdict = h.screen._checkDeduction(h.first, 'housekeeper', 'love', 'sedative');
    assert.equal(verdict.allCorrect, true);
    assert.equal(verdict.proof.sufficient, true);
    const manager = new h.manager(null, null, h.inventory);
    manager.currentCase = h.first;
    manager.caseState = 'active';
    assert.equal(manager.checkFinalAnswer('мэри').isCorrect, true);
    assert.equal(manager.caseState, 'solved');
});

test('private checks never accuse Anna, but an explicit public declaration does', () => {
    const h = createHarness(['prescription_copy', 'bar_photo'], ['hard_evidence_kane']);
    const verdict = h.screen._checkDeduction(h.second, 'ex_wife', 'jealousy', 'poison');
    h.screen._showDeductionResult(verdict, { hide() {} }, h.second);

    assert.match(h.feedback.innerHTML, /ОБЪЯВИТЬ ОБВИНЕНИЕ ПУБЛИЧНО/);
    assert.equal(h.emitted.some(event => event.name === 'deduction:public_accusation'), false);
    h.publicButton.click();
    assert.deepEqual(h.emitted.filter(event => event.name === 'deduction:public_accusation').map(event =>
        [event.payload.caseId, event.payload.suspectId]), [['case-002', 'ex_wife']]);
    assert.equal(h.publicButton.disabled, true);
});

test('without independent evidence, even a wrong guess offers no public accusation', () => {
    const h = createHarness(['bar_photo']);
    const verdict = h.screen._checkDeduction(h.second, 'ex_wife', 'jealousy', 'poison');
    h.screen._showDeductionResult(verdict, { hide() {} }, h.second);
    assert.doesNotMatch(h.feedback.innerHTML, /ОБЪЯВИТЬ ОБВИНЕНИЕ ПУБЛИЧНО/);
    assert.equal(h.publicButton.onClick, null);
    assert.equal(h.emitted.some(event => event.name === 'deduction:public_accusation'), false);
});
