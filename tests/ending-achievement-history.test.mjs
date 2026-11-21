import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function createSystem(history = []) {
    const emitted = [];
    const progress = {
        solvedCases: ['case-001'],
        trackerData: { stats: { casesHistory: history } }
    };
    const context = vm.createContext({
        console,
        events: { emit(name, data) { emitted.push({ name, data }); } },
        storage: { set() {} }
    });
    vm.runInContext(readFileSync(resolve(root, 'assets/js/systems/achievements.js'), 'utf8'), context);
    const AchievementSystem = vm.runInContext('AchievementSystem', context);
    return { system: new AchievementSystem(progress, context.events), progress, emitted };
}

test('a solved run unlocks the first-ending achievement and stores its run identity', () => {
    const history = [{ runId: 'case-001:partial-1', caseId: 'case-001', result: 'solved', endingId: 'case-001-partial' }];
    const { system, progress } = createSystem(history);
    const unlocked = system.checkAll({
        caseData: { id: 'case-001' },
        runRecord: { runId: 'case-001:partial-1', result: 'solved', endingId: 'case-001-partial' }
    });
    assert.ok(unlocked.some(record => record.id === 'first_ending'));
    assert.equal(system.records.first_ending.runId, 'case-001:partial-1');
    assert.ok(progress.achievementData.unlocked.includes('first_ending'));
});

test('two distinct solved ending IDs across replay history unlock the multiple-endings achievement', () => {
    const history = [
        { runId: 'case-001:partial-1', caseId: 'case-001', result: 'solved', endingId: 'case-001-partial' },
        { runId: 'case-001:perfect-2', caseId: 'case-001', result: 'solved', endingId: 'case-001-perfect' }
    ];
    const { system } = createSystem(history);
    const unlocked = system.checkAll({
        caseData: { id: 'case-001' },
        runRecord: history[1]
    });
    assert.ok(unlocked.some(record => record.id === 'two_endings'));
    assert.equal(new Set(history.map(record => record.endingId)).size, 2);
});

test('failed runs and duplicate endings do not count toward the multiple-endings achievement', () => {
    const history = [
        { runId: 'case-001:failed-1', caseId: 'case-001', result: 'failed', endingId: 'case-001-failed' },
        { runId: 'case-001:partial-1', caseId: 'case-001', result: 'solved', endingId: 'case-001-partial' },
        { runId: 'case-001:partial-2', caseId: 'case-001', result: 'solved', endingId: 'case-001-partial' }
    ];
    const { system } = createSystem(history);
    const unlocked = system.checkAll({ caseData: { id: 'case-001' }, runRecord: history[2] });
    assert.equal(unlocked.some(record => record.id === 'two_endings'), false);
});

test('achievement unlocks and records survive save/load', () => {
    const history = [
        { runId: 'case-001:partial-1', caseId: 'case-001', result: 'solved', endingId: 'case-001-partial' },
        { runId: 'case-001:perfect-2', caseId: 'case-001', result: 'solved', endingId: 'case-001-perfect' }
    ];
    const first = createSystem(history).system;
    first.checkAll({ caseData: { id: 'case-001' }, runRecord: history[1] });
    const saved = JSON.parse(JSON.stringify(first.toJSON()));
    const restored = createSystem(history).system;
    restored.load(saved);
    assert.ok(restored.unlocked.includes('two_endings'));
    assert.equal(restored.records.two_endings.runId, first.records.two_endings.runId);
    assert.equal(restored.checkAll({ caseData: { id: 'case-001' }, runRecord: history[1] })
        .some(record => record.id === 'two_endings'), false);
});
