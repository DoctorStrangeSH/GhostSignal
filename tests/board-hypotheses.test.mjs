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


test('source audit flags one witness, shared rumor and revised records without a truth verdict', () => {
    const runtime = boardRuntime();
    const board = runtime.create();
    const id = board.addHypothesis('Два рассказа подтверждают друг друга');
    board.linkHypothesis(id, 'statement', 'claim-a', 'for');
    board.linkHypothesis(id, 'statement', 'claim-b', 'for');
    board.linkHypothesis(id, 'statement', 'claim-old', 'against');
    board.linkHypothesis(id, 'statement', 'claim-missing', 'pending');
    const review = board.reviewHypothesisSources(id, [
        { id: 'claim-a', npcId: 'thomas', topic: 'phone', directObservation: true, status: 'active', corroboratesRumorIds: ['rumor-x'] },
        { id: 'claim-b', npcId: 'thomas', topic: 'phone', directObservation: false, status: 'active', refutesRumorIds: ['rumor-x'] },
        { id: 'claim-old', npcId: 'joe', topic: 'phone', status: 'superseded' }
    ]);
    assert.equal(review.sources[0].origin, 'firsthand_claim');
    assert.equal(review.sources[1].origin, 'unverified');
    assert.ok(review.warnings.some(w => w.type === 'same_witness'));
    assert.ok(review.warnings.some(w => w.type === 'shared_rumor_reference'));
    assert.ok(review.warnings.some(w => w.type === 'superseded'));
    assert.ok(review.warnings.some(w => w.type === 'missing'));
    assert.equal('correct' in review, false);
    assert.equal(board.reviewHypothesisSources('unknown'), null);
});

test('rumor inquiry requires observed references, discovered leads and persists without a truth verdict', () => {
    const runtime = boardRuntime();
    const board = runtime.create();
    board.setCase('case-one');
    const hypothesis = board.addHypothesis('Оба свидетеля повторяют один слух');
    board.linkHypothesis(hypothesis, 'statement', 'claim-a', 'pending');
    const statements = [{ id: 'claim-a', status: 'active', corroboratesRumorIds: ['rumor-one'] },
        { id: 'old', status: 'superseded' }];
    assert.equal(board.startSourceInquiry(hypothesis, 'unseen', statements), null);
    const id = board.startSourceInquiry(hypothesis, 'rumor-one', statements);
    assert.equal(id, 'inquiry-1');
    assert.equal(board.startSourceInquiry(hypothesis, 'rumor-one', statements), null);
    assert.equal(board.closeSourceInquiry(id, 'Это всего лишь пересказ'), false);
    assert.equal(board.addSourceInquiryLead(id, 'statement', 'old', 'Старая версия', { statements }), false);
    assert.equal(board.addSourceInquiryLead(id, 'evidence', 'unknown', 'Не найдена', { evidenceIds: [] }), false);
    assert.equal(board.addSourceInquiryLead(id, 'statement', 'claim-a', 'Свидетель повторяет слух', { statements }), true);
    assert.equal(board.addSourceInquiryLead(id, 'statement', 'claim-a', 'Повтор', { statements }), false);
    assert.equal(board.addSourceInquiryLead(id, 'evidence', 'log', 'Запись не совпадает со временем', { evidenceIds: ['log'] }), true);
    const restored = runtime.restore(JSON.parse(JSON.stringify(board.toJSON())));
    assert.equal(restored.sourceInquiries[0].leads.length, 2);
    assert.equal(restored.closeSourceInquiry(id, 'Источник всё ещё неизвестен'), true);
    assert.equal(restored.addSourceInquiryLead(id, 'evidence', 'new', 'Поздно', { evidenceIds: ['new'] }), false);
    assert.equal('verdict' in restored.sourceInquiries[0], false);
    assert.equal(restored.setCase('case-two'), true);
    assert.equal(restored.sourceInquiries.length, 0);
    assert.equal(restored.nextInquiryId, 1);
});

test('hearsay can initiate a source inquiry without being labelled firsthand evidence', () => {
    const { create } = boardRuntime();
    const board = create();
    const hypothesis = board.addHypothesis('Слова Джо пришли от Лоры');
    board.linkHypothesis(hypothesis, 'statement', 'joe-lora', 'pending');
    const claims = [{ id: 'joe-lora', npcId: 'bartender', directObservation: false,
        referencesRumorIds: ['detective-overstated-visitor-identity'] }];
    const review = board.reviewHypothesisSources(hypothesis, claims);
    assert.equal(review.sources[0].origin, 'unverified');
    assert.equal(review.sources[0].linkedRumorIds[0], 'detective-overstated-visitor-identity');
    assert.ok(board.startSourceInquiry(hypothesis, 'detective-overstated-visitor-identity', claims));
});
