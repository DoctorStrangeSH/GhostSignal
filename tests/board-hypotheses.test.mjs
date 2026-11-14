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

test('investigation access requirements are advisory and never become proof that an NPC could not enter', () => {
    const runtime = boardRuntime();
    const board = runtime.create();
    const locations = [
        { id: 'private_house', name: 'Частный дом', requiresItem: 'search_warrant', hours: { open: 8, close: 20 } },
        { id: 'public_square', name: 'Площадь', hours: { open: 0, close: 24 } }
    ];
    const context = { statements: [{ id: 'witness', status: 'active' }], locations };
    const add = (locationId, location) => board.addAlibiClaim({
        subject: 'Анна', location, locationId, startMinute: 600, endMinute: 610,
        precision: 'exact', kind: 'statement', sourceId: 'witness'
    }, context);
    assert.ok(add('private_house', 'Частный дом'));
    assert.ok(add('public_square', 'Площадь'));
    const [finding] = board.reviewAlibiAccessRestrictions(locations);
    assert.equal(finding.status, 'investigator_access_gate');
    assert.equal(finding.requirement, 'search_warrant');
    assert.match(finding.reason, /не доказывает/);
    assert.equal(board.reviewAlibiAccessRestrictions([locations[1]]).length, 0,
        'undiscovered locations must not reveal access requirements');
    assert.equal(board.reviewAlibiAccessRestrictions([]).length, 0);
    const restored = runtime.restore(JSON.parse(JSON.stringify(board.toJSON())));
    assert.equal(restored.reviewAlibiAccessRestrictions(locations).length, 1);
});

test('authored travel routes respect direction, visited stops and uncertain timing', () => {
    const runtime = boardRuntime();
    const board = runtime.create();
    const locations = [{ id: 'bar', name: 'Бар' }, { id: 'alley', name: 'Переулок' },
        { id: 'booth', name: 'Будка' }, { id: 'depot', name: 'Депо' }];
    const edges = [
        { from: 'bar', to: 'alley', minutes: 6, bidirectional: true },
        { from: 'alley', to: 'booth', minutes: 13, bidirectional: true },
        { from: 'booth', to: 'depot', minutes: 8 }
    ];
    const ctx = { statements: [{ id: 'w', status: 'active' }], locations };
    const claim = (locationId, from, to, subject = 'Кейн') => board.addAlibiClaim({
        subject, location: locationId, locationId, startMinute: from, endMinute: to,
        precision: 'approximate', kind: 'statement', sourceId: 'w'
    }, ctx);
    assert.ok(claim('bar', 1320, 1325));
    assert.ok(claim('booth', 1335, 1340));
    const [finding] = board.reviewAlibiRoutes(edges, locations);
    assert.equal(finding.status, 'route_time_tight');
    assert.equal(finding.estimatedMinutes, 19);
    assert.equal(finding.availableMinutes, 10);
    assert.deepEqual(Array.from(finding.routeLocationIds), ['bar', 'alley', 'booth']);
    assert.match(finding.reason, /не доказательство невозможности/);
    assert.equal(board.reviewAlibiRoutes(edges, [locations[0], locations[2]]).length, 0,
        'undiscovered intermediate stops cannot appear in the route');
    assert.equal(board.reviewAlibiRoutes([], locations).length, 0, 'unmapped routes are unknown, not impossible');
    assert.ok(claim('depot', 1350, 1355));
    assert.equal(board.reviewAlibiRoutes(edges, locations).length, 2);
    const restored = runtime.restore(JSON.parse(JSON.stringify(board.toJSON())));
    assert.equal(restored.reviewAlibiRoutes(edges, locations).length, 2);
    const directed = runtime.create();
    const directedCtx = { statements: [{ id: 'w', status: 'active' }], locations };
    assert.ok(directed.addAlibiClaim({ subject: 'Джо', location: 'Будка', locationId: 'booth',
        startMinute: 1000, endMinute: 1005, precision: 'exact', kind: 'statement', sourceId: 'w' }, directedCtx));
    assert.ok(directed.addAlibiClaim({ subject: 'Джо', location: 'Бар', locationId: 'bar',
        startMinute: 1010, endMinute: 1015, precision: 'exact', kind: 'statement', sourceId: 'w' }, directedCtx));
    assert.equal(directed.reviewAlibiRoutes([{ from: 'bar', to: 'booth', minutes: 30 }], locations).length, 0,
        'directed edge must not imply travel in the opposite direction');
});

test('route follow-up requires a real pair of alibi claims and survives only its own case', () => {
    const runtime = boardRuntime();
    const board = runtime.create();
    board.setCase('case-002');
    const context = { statements: [{ id: 'w', status: 'active' }] };
    const add = (location, startMinute) => board.addAlibiClaim({
        subject: 'Кейн', location, startMinute, endMinute: startMinute + 5,
        precision: 'exact', kind: 'statement', sourceId: 'w'
    }, context);
    const first = add('Бар', 1200), second = add('Будка', 1210);
    assert.equal(board.prepareRouteQuestion({ status: 'route_time_tight', ids: ['fake', second] }, 'business_rival'), false);
    const finding = { status: 'route_time_tight', ids: [first, second] };
    assert.equal(board.prepareRouteQuestion(finding, 'business_rival'), true);
    assert.equal(board.prepareRouteQuestion(finding, 'business_rival'), false);
    assert.equal(board.hasPreparedRouteQuestion('business_rival'), true);
    const restored = runtime.restore(JSON.parse(JSON.stringify(board.toJSON())));
    assert.equal(restored.hasPreparedRouteQuestion('business_rival'), true);
    const discussed = runtime.restore(JSON.parse(JSON.stringify(board.toJSON())));
    assert.equal(discussed.markRouteQuestionDiscussed('business_rival'), true);
    assert.equal(discussed.markRouteQuestionDiscussed('business_rival'), false);
    assert.equal(discussed.hasPreparedRouteQuestion('business_rival'), false);
    assert.equal(discussed.hasDiscussedRouteQuestion('business_rival'), true);
    const discussedRestored = runtime.restore(JSON.parse(JSON.stringify(discussed.toJSON())));
    assert.equal(discussedRestored.hasDiscussedRouteQuestion('business_rival'), true);
    assert.match(discussedRestored.getInvestigationChecklist().nextAction, /уже задан/);
    const cancelled = runtime.restore(JSON.parse(JSON.stringify(board.toJSON())));
    assert.equal(cancelled.cancelRouteQuestion('business_rival'), true);
    assert.equal(cancelled.cancelRouteQuestion('business_rival'), false);
    assert.equal(cancelled.hasPreparedRouteQuestion('business_rival'), false);
    assert.equal(cancelled.alibiClaims.length, 2, 'cancelling a question must not delete underlying statements');
    assert.equal(restored.removeAlibiClaim(first), true);
    assert.equal(restored.hasPreparedRouteQuestion('business_rival'), false);
    restored.setCase('case-001');
    assert.equal(restored.routeQuestions.length, 0);
    const legacy = board.toJSON();
    delete legacy.routeQuestions;
    assert.equal(runtime.restore(legacy).hasPreparedRouteQuestion('business_rival'), false);
});

test('alibi UI only offers visited locations from the current case, including its sublocations', () => {
    const locationById = {
        bar_joe: { id: 'bar_joe', name: 'Бар' },
        hotel_grand: { id: 'hotel_grand', name: 'Отель' },
        hotel_room_304: { id: 'hotel_room_304', name: 'Номер', parentLocation: 'hotel_grand' },
        telephone_exchange: { id: 'telephone_exchange', name: 'Станция' }
    };
    const context = vm.createContext({ getLocationById: id => locationById[id],
        document: { getElementById: () => null }, events: { on() {} } });
    vm.runInContext(readFileSync(resolve('assets/js/ui/boardUI.js'), 'utf8'), context);
    const ui = vm.runInContext('Object.create(BoardUI.prototype)', context);
    ui.locationManager = { visitedLocations: new Set(Object.keys(locationById)),
        activeCaseData: { id: 'case-001', locations: ['hotel_grand'], startLocation: 'hotel_grand' } };
    assert.deepEqual(Array.from(ui._knownAlibiLocations(), loc => loc.id), ['hotel_grand', 'hotel_room_304']);
    ui.locationManager.activeCaseData = { id: 'case-002', locations: ['bar_joe', 'telephone_exchange'], startLocation: 'bar_joe' };
    assert.deepEqual(Array.from(ui._knownAlibiLocations(), loc => loc.id), ['bar_joe', 'telephone_exchange']);
    ui.locationManager.activeCaseData = null;
    assert.equal(ui._knownAlibiLocations().length, 0);
});

test('alibi UI shows a persistent next step for an active route question and hides it after cancellation', () => {
    const runtime = boardRuntime();
    const board = runtime.create();
    board.setCase('case-002');
    const locations = [{ id: 'bar', name: 'Бар' }, { id: 'booth', name: 'Будка' }];
    const ctx = { statements: [{ id: 'w', status: 'active' }], locations };
    const add = (id, startMinute) => board.addAlibiClaim({ subject: 'Кейн', location: id,
        locationId: id, startMinute, endMinute: startMinute + 5,
        precision: 'exact', kind: 'statement', sourceId: 'w' }, ctx);
    const first = add('bar', 1300), second = add('booth', 1310);
    const findings = board.reviewAlibiRoutes([{ from: 'bar', to: 'booth', minutes: 20 }], locations);
    assert.equal(findings.length, 1);
    const context = vm.createContext({ CONFIG: { time: { costs: { travel: 20 } } },
        getObjectById: () => null, getLocationById: id => locations.find(l => l.id === id),
        document: { getElementById: () => null }, events: { on() {} } });
    vm.runInContext(readFileSync(resolve('assets/js/ui/boardUI.js'), 'utf8'), context);
    const ui = vm.runInContext('Object.create(BoardUI.prototype)', context);
    ui.board = board;
    ui.inventory = { evidence: [] };
    ui.memoryService = { getStatements: () => [{ id: 'w', status: 'active', sourceName: 'Свидетель' }] };
    ui.locationManager = { visitedLocations: new Set(['bar', 'booth']),
        activeCaseData: { id: 'case-002', locations: ['bar', 'booth'], alibiRoutes: [{ from: 'bar', to: 'booth', minutes: 20 }] } };
    assert.match(ui._renderAlibiReconstruction(), /ПОДГОТОВИТЬ ВОПРОС КЕЙНУ/);
    assert.ok(board.prepareRouteQuestion(findings[0], 'business_rival'));
    const restored = runtime.restore(JSON.parse(JSON.stringify(board.toJSON())));
    ui.board = restored;
    const ready = ui._renderAlibiReconstruction();
    assert.match(ready, /ВОПРОС КЕЙНУ ПОДГОТОВЛЕН/);
    assert.match(ready, /начните разговор заново/);
    assert.doesNotMatch(ready, /ПОДГОТОВИТЬ ВОПРОС КЕЙНУ/);
    assert.equal(restored.cancelRouteQuestion('business_rival'), true);
    assert.match(ui._renderAlibiReconstruction(), /ПОДГОТОВИТЬ ВОПРОС КЕЙНУ/);
    assert.ok(restored.prepareRouteQuestion(findings[0], 'business_rival'));
    assert.equal(restored.markRouteQuestionDiscussed('business_rival'), true);
    const afterInterview = ui._renderAlibiReconstruction();
    assert.match(afterInterview, /ВОПРОС КЕЙНУ ЗАДАН/);
    assert.doesNotMatch(afterInterview, /ПОДГОТОВИТЬ ВОПРОС КЕЙНУ/);
    assert.ok(first && second);
});

test('board investigation tool folders keep their expanded state after rerender and support keyboard-native details', () => {
    const context = vm.createContext({ document: { getElementById: () => null }, events: { on() {} } });
    vm.runInContext(readFileSync(resolve('assets/js/ui/boardUI.js'), 'utf8'), context);
    const ui = vm.runInContext('Object.create(BoardUI.prototype)', context);
    ui._expandedTools = new Set(['hypotheses']);
    assert.match(ui._renderTool('hypotheses', 'Гипотезы', 'content'), /<details[^>]+open>/);
    assert.doesNotMatch(ui._renderTool('alibi', 'Алиби', 'content'), /<details[^>]+open>/);
    assert.match(ui._renderTool('alibi', 'Алиби', 'content'), /<summary>Алиби<\/summary>/);
    const handlers = {};
    const tool = { open: true, dataset: { tool: 'alibi' },
        addEventListener(event, fn) { handlers[event] = fn; } };
    ui.container = { querySelectorAll(selector) { return selector === '.board-tool' ? [tool] : []; },
        querySelector() { return null; } };
    ui._bindEvents();
    handlers.toggle();
    assert.match(ui._renderTool('alibi', 'Алиби', 'content'), /<details[^>]+open>/);
    tool.open = false;
    handlers.toggle();
    assert.doesNotMatch(ui._renderTool('alibi', 'Алиби', 'content'), /<details[^>]+open>/);
    ui.render = () => {};
    ui.setBoard({ hasPreparedRouteQuestion: () => true });
    assert.match(ui._renderTool('alibi', 'Алиби', 'content'), /<details[^>]+open>/);
});

test('investigation checklist only reflects observed places, discovered evidence, recorded witnesses and player versions', () => {
    const runtime = boardRuntime();
    const board = runtime.create();
    board.setCase('case-002');
    const empty = board.getInvestigationChecklist();
    assert.equal(empty.completed, 0);
    assert.equal(empty.tasks.length, 4);
    assert.equal(empty.nextAction, null);
    assert.equal(board.getInvestigationChecklist({ visitedLocationIds: ['bar', 'booth'], evidenceIds: ['receipt'],
        statements: [{ npcId: 'joe', status: 'active' }, { npcId: 'joe', status: 'active' }] }).completed, 2,
    'two statements by one person must not count as two witnesses');
    const observed = board.getInvestigationChecklist({ visitedLocationIds: ['bar', 'booth'], evidenceIds: ['receipt'],
        statements: [{ npcId: 'joe', status: 'active' }, { npcId: 'thomas', status: 'superseded' },
            { npcId: 'thomas', status: 'active' }] });
    assert.equal(observed.completed, 3);
    assert.equal(board.addHypothesis('Проверить время выхода'), 'hyp-1');
    assert.equal(board.getInvestigationChecklist().tasks.find(t => t.id === 'hypothesis').done, true);
    assert.ok(board.addAlibiClaim({ subject: 'Кейн', location: 'Бар', startMinute: 1320, endMinute: 1325,
        precision: 'approximate', kind: 'statement', sourceId: 'w' }, { statements: [{ id: 'w' }] }));
    const partial = board.getInvestigationChecklist();
    assert.equal(partial.tasks.find(t => t.id === 'alibi').done, false);
    assert.equal(partial.nextAction, null);
    assert.ok(board.addAlibiClaim({ subject: 'Кейн', location: 'Будка', startMinute: 1330, endMinute: 1335,
        precision: 'approximate', kind: 'statement', sourceId: 'w' }, { statements: [{ id: 'w' }] }));
    assert.equal(board.getInvestigationChecklist().tasks.find(t => t.id === 'alibi').done, true);
    assert.ok(board.prepareRouteQuestion({ status: 'route_time_tight', ids: ['alibi-1', 'alibi-2'] }, 'business_rival'));
    assert.match(board.getInvestigationChecklist().nextAction, /вернитесь к нему/);
    assert.match(runtime.restore(JSON.parse(JSON.stringify(board.toJSON()))).getInvestigationChecklist().nextAction, /вернитесь к нему/);
    assert.equal(board.cancelRouteQuestion('business_rival'), true);
    assert.equal(board.getInvestigationChecklist().nextAction, null);
});

test('board checklist hides case guidance before a case is selected and escapes visible task text', () => {
    const context = vm.createContext({ document: { getElementById: () => null }, events: { on() {} } });
    vm.runInContext(readFileSync(resolve('assets/js/ui/boardUI.js'), 'utf8'), context);
    const ui = vm.runInContext('Object.create(BoardUI.prototype)', context);
    ui.locationManager = { activeCaseData: null };
    assert.match(ui._renderInvestigationChecklist(), /Выберите расследование/);
    ui.locationManager = { activeCaseData: { id: 'case-002' }, visitedLocations: new Set() };
    ui.board = { evidenceOnBoard: [], getInvestigationChecklist: () => ({ completed: 0,
        tasks: [{ text: '<script>bad</script>', done: false }], nextAction: '<img onerror=bad>' }) };
    ui.inventory = { evidence: [] };
    const html = ui._renderInvestigationChecklist();
    assert.match(html, /&lt;script&gt;/);
    assert.match(html, /&lt;img onerror=bad&gt;/);
    assert.doesNotMatch(html, /<script>|<img/);
});

test('board UI prioritizes active leads and collapses completed leads without revealing unsafe HTML', () => {
    const context = vm.createContext({ document: { getElementById: () => null }, events: { on() {} } });
    vm.runInContext(readFileSync(resolve('assets/js/ui/boardUI.js'), 'utf8'), context);
    const ui = vm.runInContext('Object.create(BoardUI.prototype)', context);
    ui.locationManager = { activeCaseData: { id: 'case-002' }, visitedLocations: new Set() };
    ui.inventory = { evidence: [] };
    ui.board = { evidenceOnBoard: [], getInvestigationChecklist: () => ({ completed: 1,
        tasks: [{ text: 'Проверить документ', done: true }],
        nextActions: [
            { status: 'checked', text: 'Старый <script>вопрос</script>' },
            { status: 'pending', text: 'Лора ещё проверяет' },
            { status: 'available', text: 'Поговорить с Джо' }
        ] }) };
    const html = ui._renderInvestigationChecklist();
    assert.match(html, /АКТИВНЫЕ ЗАЦЕПКИ/);
    assert.match(html, /Проверенные зацепки \(1\)/);
    assert.ok(html.indexOf('Лора ещё проверяет') < html.indexOf('Старый'));
    assert.match(html, /&lt;script&gt;вопрос&lt;\/script&gt;/);
    assert.doesNotMatch(html, /<script>/);
    assert.equal((html.match(/checklist-next-action/g) || []).length, 3);
});

test('board UI supports select-and-place without dragging and rejects unavailable evidence', () => {
    const context = vm.createContext({ document: { getElementById: () => null }, events: { on() {} } });
    vm.runInContext(readFileSync(resolve('assets/js/ui/boardUI.js'), 'utf8'), context);
    const ui = vm.runInContext('Object.create(BoardUI.prototype)', context);
    const states = [];
    const item = { dataset: { evidenceId: 'letter' }, classList: { toggle(name, value) { states.push([name, value]); } },
        setAttribute(name, value) { states.push([name, value]); } };
    const help = { textContent: '' };
    ui.container = { querySelectorAll: selector => selector === '.evidence-pool-item' ? [item] : [],
        querySelector: selector => selector === '#board-selection-help' ? help : null };
    ui.inventory = { evidence: ['letter'] };
    let placed = null;
    ui.board = { getAvailableEvidence: ids => ids, placeEvidence(evidence, slot) { placed = [evidence, slot]; return true; } };
    ui._selectEvidence('missing');
    assert.equal(ui._selectedEvidenceId, undefined);
    ui._selectEvidence('letter');
    assert.equal(ui._selectedEvidenceId, 'letter');
    assert.match(help.textContent, /Улика выбрана/);
    assert.equal(ui._placeSelectedEvidence('slot-1'), true);
    assert.deepEqual(placed, ['letter', 'slot-1']);
    assert.equal(ui._selectedEvidenceId, null);
    assert.equal(ui._placeSelectedEvidence('slot-2'), false);
    assert.ok(states.some(([key, value]) => key === 'aria-pressed' && value === 'true'));
});

test('checklist keeps Kane and Thomas leads separate and never reveals the telephone lead before discovery', () => {
    const runtime = boardRuntime();
    const board = runtime.create();
    board.setCase('case-002');
    const statements = [{ npcId: 'waiter', status: 'active' }];
    const noDocument = board.getInvestigationChecklist({ statements });
    assert.equal(noDocument.nextActions.length, 0);
    const notInterviewed = board.getInvestigationChecklist({ evidenceIds: ['telephone_exchange_slip'] });
    assert.equal(notInterviewed.nextActions.length, 0);
    const discovered = board.getInvestigationChecklist({ evidenceIds: ['telephone_exchange_slip'], statements });
    assert.equal(discovered.nextActions.length, 1);
    assert.equal(discovered.nextActions[0].id, 'thomas-telephone');
    assert.equal(discovered.nextActions[0].status, 'available');
    const asked = board.getInvestigationChecklist({ evidenceIds: ['telephone_exchange_slip'], statements,
        thomasTelephoneQuestionAsked: true });
    assert.equal(asked.nextActions[0].status, 'checked');
    assert.match(asked.nextActions[0].text, /не видел звонившего/);
    const ctx = { statements: [{ id: 'w' }] };
    const one = board.addAlibiClaim({ subject: 'Кейн', location: 'Бар', startMinute: 1300, endMinute: 1305,
        precision: 'exact', kind: 'statement', sourceId: 'w' }, ctx);
    const two = board.addAlibiClaim({ subject: 'Кейн', location: 'Будка', startMinute: 1310, endMinute: 1315,
        precision: 'exact', kind: 'statement', sourceId: 'w' }, ctx);
    assert.ok(board.prepareRouteQuestion({ status: 'route_time_tight', ids: [one, two] }, 'business_rival'));
    const together = board.getInvestigationChecklist({ evidenceIds: ['telephone_exchange_slip'], statements });
    assert.deepEqual(Array.from(together.nextActions, lead => lead.id), ['kane-route', 'thomas-telephone']);
    board.setCase('case-001');
    assert.equal(board.getInvestigationChecklist({ evidenceIds: ['telephone_exchange_slip'], statements }).nextActions.length, 0);
});

test('Lora autonomous verification appears only after the detective learns the report', () => {
    const { create } = boardRuntime();
    const board = create();
    board.setCase('case-002');
    assert.equal(board.getInvestigationChecklist({ loraVerificationOutcome: 'no_independent_evidence' }).nextActions.length, 0,
        'an off-screen investigation must not leak knowledge to the player');
    const pending = board.getInvestigationChecklist({ loraReportKnown: true });
    assert.equal(pending.nextActions[0].status, 'pending');
    const ready = board.getInvestigationChecklist({ loraReportKnown: true,
        loraVerificationOutcome: 'no_independent_evidence' });
    assert.equal(ready.nextActions[0].status, 'available');
    const read = board.getInvestigationChecklist({ loraReportKnown: true,
        loraVerificationOutcome: 'no_independent_evidence', loraVerificationDiscussed: true });
    assert.equal(read.nextActions[0].status, 'checked');
    assert.match(read.nextActions[0].text, /не независимое подтверждение/);
    board.setCase('case-001');
    assert.equal(board.getInvestigationChecklist({ loraReportKnown: true,
        loraVerificationOutcome: 'no_independent_evidence' }).nextActions.length, 0);
});
