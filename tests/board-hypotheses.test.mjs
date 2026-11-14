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
