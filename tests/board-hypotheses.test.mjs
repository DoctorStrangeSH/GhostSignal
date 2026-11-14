import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

function boardRuntime() {
    const emissions = [];
    const context = vm.createContext({
        events: { emit: (...args) => emissions.push(args) },
        getObjectById: id => ({ id, isEvidence: true })
    });
    vm.runInContext(readFileSync(resolve('assets/js/systems/board.js'), 'utf8'), context);
    return { create: () => vm.runInContext('new InvestigationBoard()', context),
        restore: data => { context.snapshot = data; return vm.runInContext('InvestigationBoard.fromJSON(snapshot)', context); },
        emissions };
}

test('player can propose, challenge, revise and abandon a hypothesis without automatic truth verdict', () => {
    const runtime = boardRuntime();
    const board = runtime.create();
    const id = board.addHypothesis('  Кейн подменил журнал  ');
    assert.equal(board.hypotheses[0].title, 'Кейн подменил журнал');
    assert.equal(board.linkHypothesis(id, 'evidence', 'telephone_log', 'for'), true);
    assert.equal(board.linkHypothesis(id, 'statement', 'thomas-v2', 'against'), true);
    assert.equal(board.linkHypothesis(id, 'assumption', 'Может существовать копия', 'pending'), true);
    assert.equal(board.linkHypothesis(id, 'evidence', 'telephone_log', 'against'), false);
    assert.equal(board.reviseHypothesis(id, 'Журнал был изменён позже'), true);
    assert.equal(board.unlinkHypothesis(id, 0), true);
    assert.equal(board.abandonHypothesis(id), true);
    assert.equal(board.linkHypothesis(id, 'evidence', 'new', 'for'), false);
    assert.equal(board.hypotheses[0].history.length, 7);
    assert.equal('verdict' in board.hypotheses[0], false);
    assert.ok(runtime.emissions.some(([event]) => event === 'board:updated'));
});

test('legacy board saves load, and hypothesis history survives save/load', () => {
    const runtime = boardRuntime();
    const legacy = runtime.restore({ slots: [], evidenceOnBoard: [] });
    assert.equal(legacy.hypotheses.length, 0);
    const id = legacy.addHypothesis('Версия 1');
    legacy.linkHypothesis(id, 'evidence', 'scratched_receiver', 'against');
    const save = JSON.parse(JSON.stringify(legacy.toJSON()));
    const loaded = runtime.restore(save);
    assert.equal(loaded.hypotheses[0].links[0].stance, 'against');
    assert.equal(loaded.hypotheses[0].history.length, 2);
    assert.notEqual(loaded.addHypothesis('Версия 2'), id);
    loaded.hypotheses[0].title = 'Изменено';
    assert.equal(save.hypotheses[0].title, 'Версия 1');
});


test('boards keep hypotheses for a resumed case but clear them when a new case starts', () => {
    const runtime = boardRuntime();
    const board = runtime.create();
    board.setCase('case-001');
    board.addHypothesis('Версия по первому делу');
    board.placeEvidence('telephone_log', 'slot-1');
    const loaded = runtime.restore(JSON.parse(JSON.stringify(board.toJSON())));
    assert.equal(loaded.caseId, 'case-001');
    assert.equal(loaded.setCase('case-001'), false);
    assert.equal(loaded.hypotheses.length, 1);
    assert.equal(loaded.setCase('case-002'), true);
    assert.equal(loaded.hypotheses.length, 0);
    assert.equal(loaded.slots[0].evidenceId, null);
    assert.equal(loaded.evidenceOnBoard.length, 0);
    assert.equal(loaded.addHypothesis('Версия второго дела'), 'hyp-1');
});

test('legacy save adopts current case without losing existing evidence or hypotheses', () => {
    const runtime = boardRuntime();
    const board = runtime.restore({ slots: [{ id: 'slot-1', evidenceId: 'note' }], evidenceOnBoard: ['note'] });
    board.addHypothesis('Неопределённая версия');
    assert.equal(board.setCase('case-001', true), false);
    assert.equal(board.hypotheses.length, 1);
    assert.equal(board.toJSON().caseId, 'case-001');
});
