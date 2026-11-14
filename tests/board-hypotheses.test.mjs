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

test('document chronology uses discovered evidence only and does not infer an alibi or caller identity', () => {
    const context = vm.createContext({ events: { emit() {} }, getObjectById: id => ({
        isEvidence: id !== 'decoration', timelineFacts: id === 'exchange' ? [
            { id: 'request', minute: 1338, label: 'Request received', scope: 'district', caveat: 'Caller unknown' }
        ] : id === 'ticket' ? [
            { id: 'failed', minute: 1325, label: 'Test failed', scope: 'booth' },
            { id: 'bad', minute: 1500, label: 'Invalid time', scope: 'booth' }
        ] : []
    }) });
    vm.runInContext(readFileSync(resolve('assets/js/systems/board.js'), 'utf8'), context);
    const board = vm.runInContext('new InvestigationBoard()', context);
    assert.equal(board.getEvidenceChronology(['exchange']).length, 1);
    assert.equal(board.compareChronologyFacts('failed', 'request', ['exchange']), null);
    const records = board.getEvidenceChronology(['exchange', 'ticket', 'ticket', 'decoration']);
    assert.deepEqual(Array.from(records, item => item.id), ['failed', 'request']);
    const comparison = board.compareChronologyFacts('failed', 'request', ['exchange', 'ticket']);
    assert.equal(comparison.minutesApart, 13);
    assert.equal(comparison.sameScope, false);
    assert.equal('culprit' in comparison, false);
    assert.equal('contradiction' in comparison, false);
});

test('alibi reconstructions flag overlapping locations without deciding whether the witness lied', () => {
    const runtime = boardRuntime();
    const board = runtime.create();
    board.setCase('case-002');
    const source = { statements: [{ id: 'joe', status: 'active' }], evidenceIds: ['telephone_log'] };
    const a = { subject: 'Кейн', location: 'Бар', startMinute: 1320, endMinute: 1350,
        precision: 'approximate', kind: 'statement', sourceId: 'joe' };
    assert.equal(board.addAlibiClaim({ ...a, sourceId: 'missing' }, source), null);
    assert.equal(board.addAlibiClaim({ ...a, startMinute: 1400, endMinute: 1300 }, source), null);
    assert.equal(board.addAlibiClaim({ ...a, startMinute: -1 }, source), null);
    const first = board.addAlibiClaim(a, source);
    assert.equal(first, 'alibi-1');
    assert.equal(board.addAlibiClaim(a, source), null);
    const second = board.addAlibiClaim({ ...a, location: 'Переулок', startMinute: 1340, endMinute: 1360,
        precision: 'exact', kind: 'evidence', sourceId: 'telephone_log' }, source);
    assert.equal(second, 'alibi-2');
    const [warning] = board.reviewAlibiClaims();
    assert.equal(warning.status, 'needs_verification');
    assert.match(warning.reason, /приблизительные/);
    assert.equal('lie' in warning, false);
    const restored = runtime.restore(JSON.parse(JSON.stringify(board.toJSON())));
    assert.equal(restored.alibiClaims.length, 2);
    assert.equal(restored.nextAlibiId, 3);
    assert.equal(restored.removeAlibiClaim(first), true);
    assert.equal(restored.reviewAlibiClaims().length, 0);
    assert.equal(restored.setCase('case-001'), true);
    assert.equal(restored.alibiClaims.length, 0);
    assert.equal(restored.nextAlibiId, 1);
});

test('alibi review checks the existing minimum travel cost without inventing geographic routes', () => {
    const runtime = boardRuntime();
    const board = runtime.create();
    const context = { statements: [{ id: 'witness', status: 'active' }], evidenceIds: ['ticket'] };
    const first = board.addAlibiClaim({ subject: 'Кейн', location: 'Бар', startMinute: 1320, endMinute: 1325,
        precision: 'exact', kind: 'statement', sourceId: 'witness' }, context);
    const second = board.addAlibiClaim({ subject: 'Кейн', location: 'Телефонная станция', startMinute: 1335, endMinute: 1340,
        precision: 'exact', kind: 'evidence', sourceId: 'ticket' }, context);
    assert.ok(first && second);
    assert.equal(board.reviewAlibiClaims().length, 0);
    const [finding] = board.reviewAlibiClaims(20);
    assert.equal(finding.status, 'travel_time_tight');
    assert.equal(finding.gapMinutes, 10);
    assert.equal(finding.minimumTravelMinutes, 20);
    assert.match(finding.reason, /обычный переход в игре занимает 20 мин/);
    assert.equal('route' in finding, false);
    assert.equal('distance' in finding, false);
    const enoughTime = board.reviewAlibiClaims(5);
    assert.equal(enoughTime.length, 0);
});

test('linked, visited locations warn about opening hours without treating closure as proof', () => {
    const runtime = boardRuntime();
    const board = runtime.create();
    const visited = [{ id: 'bar', name: 'Бар Джо', hours: { open: 16, close: 2 } },
        { id: 'station', name: 'Станция', hours: { open: 7, close: 23 } },
        { id: 'street', name: 'Улица', hours: { open: 0, close: 24 } }];
    const context = { statements: [{ id: 'witness', status: 'active' }], locations: visited };
    const add = (id, startMinute, endMinute) => board.addAlibiClaim({ subject: 'Джо',
        location: 'Версия свидетеля', locationId: id, startMinute, endMinute,
        precision: 'exact', kind: 'statement', sourceId: 'witness' }, context);
    assert.equal(add('secret', 1200, 1210), null, 'unknown places cannot be linked');
    assert.ok(add('bar', 60, 90), 'overnight bar is open before 02:00');
    assert.ok(add('bar', 120, 135), 'bar closes at 02:00');
    assert.ok(add('bar', 60, 1080), 'the interior closed period must be detected');
    assert.ok(add('station', 1380, 1390), 'station closes at 23:00');
    assert.ok(add('street', 0, 1439), '24-hour places never warn');
    const findings = board.reviewAlibiLocationHours(visited);
    assert.equal(findings.length, 3);
    assert.ok(findings.every(f => f.status === 'outside_public_hours'));
    assert.ok(findings.every(f => /не доказательство отсутствия/.test(f.reason)));
    assert.equal(board.reviewAlibiLocationHours([]).length, 0, 'unknown location schedule must not leak');
    const restored = runtime.restore(JSON.parse(JSON.stringify(board.toJSON())));
    assert.equal(restored.alibiClaims[0].locationId, 'bar');
    assert.equal(restored.reviewAlibiLocationHours(visited).length, 3);
    const legacy = board.toJSON();
    delete legacy.alibiClaims[0].locationId;
    assert.equal(runtime.restore(legacy).alibiClaims[0].locationId, null);
});
