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
    const context = vm.createContext({
        console,
        events: {
            on() {},
            emit(name, payload) { emitted.push({ name, payload }); }
        },
        document: {
            getElementById(id) {
                return id === 'deduction-feedback' ? feedback :
                    id === 'btn-deduction-submit' ? submit : null;
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
    return { first, second, inventory, emitted, feedback, submit, screen: new screen(inventory), manager };
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
    assert.match(h.feedback.innerHTML, /Материалы Лоры или признание Кейна/);
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
