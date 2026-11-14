import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function harness(savedCount) {
    const emitted = [];
    const ctx = vm.createContext({
        console,
        events: { emit(name, value) { emitted.push({ name, value }); } },
        document: { getElementById() { return null; } }
    });
    for (const path of [
        'assets/data/cases/case-002/index.js',
        'assets/js/systems/caseManager.js',
        'assets/js/controllers/caseController.js'
    ]) {
        vm.runInContext(readFileSync(resolve(root, path), 'utf8'), ctx, { filename: path });
    }
    const { caseData, managerType, controllerType } = vm.runInContext(
        '({ caseData: CASE_002, managerType: CaseManager, controllerType: CaseController })',
        ctx
    );
    const manager = new managerType(null, null, null);
    manager.currentCase = caseData;
    manager.caseState = 'active';
    manager.evidenceFound = savedCount;
    manager.completedEvents = ['all_evidence_002'];
    const app = {
        caseManager: manager,
        progress: { activeCase: 'case-002' },
        locationManager: { currentLocation: 'bar_joe' },
        sceneRenderer: { renderLocation() {} },
        navigateTo() {},
        _quickSave() {}
    };
    return { app, manager, caseData, emitted, controller: new controllerType(app, id => id === 'case-002' ? caseData : null) };
}

test('resuming case two restores the final button with four previously collected clues', () => {
    const h = harness(4);
    assert.equal(h.manager.isReadyForFinal(), true);
    assert.equal(h.controller.loadCase('case-002'), true);
    assert.deepEqual(h.emitted.filter(event => event.name === 'case:ready_for_final').map(event => event.value), [true]);
    assert.deepEqual(Array.from(h.manager.completedEvents), ['all_evidence_002'], 'resume must not replay narrative');
    assert.equal(h.manager.evidenceFound, 4);
});

test('resuming before threshold explicitly keeps final button hidden', () => {
    const h = harness(3);
    assert.equal(h.manager.isReadyForFinal(), false);
    assert.equal(h.controller.loadCase('case-002'), true);
    assert.deepEqual(h.emitted.filter(event => event.name === 'case:ready_for_final').map(event => event.value), [false]);
});

test('a solved case cannot be treated as ready for another accusation', () => {
    const h = harness(8);
    h.manager.caseState = 'solved';
    assert.equal(h.manager.isReadyForFinal(), false);
});

test('starting a different case hides an old deduction button', () => {
    const h = harness(4);
    h.app.progress.activeCase = null;
    h.manager.loadCase = function (id) {
        this.currentCase = { id, title: 'New case', finalQuestion: { title: 'Answer' } };
        this.caseState = 'active';
        this.evidenceFound = 0;
        return true;
    };
    const controller = new (h.controller.constructor)(h.app, id =>
        id === 'case-new' ? { id, title: 'New case', startLocation: 'police_station' } : null
    );
    assert.equal(controller.loadCase('case-new'), true);
    assert.deepEqual(h.emitted.filter(event => event.name === 'case:ready_for_final').map(event => event.value), [false]);
});
