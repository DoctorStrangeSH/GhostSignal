import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadCaseTwoNarrative() {
    const registry = {};
    const context = vm.createContext({
        console: { log() {} },
        registerData(type, data) { registry[type] = data; }
    });
    vm.runInContext(readFileSync(resolve(root, 'assets/data/cases/case-002/index.js'), 'utf8'), context);
    vm.runInContext('globalThis.caseTwo = CASE_002', context);
    vm.runInContext(readFileSync(resolve(root, 'assets/data/cases/case-002/evidence.js'), 'utf8'), context);
    return { caseTwo: context.caseTwo, chains: registry.evidence };
}

test('case two treats a collected vial as an observation, not an instant forensic report', () => {
    const { caseTwo } = loadCaseTwoNarrative();
    const discovery = caseTwo.events.find(event => event.id === 'discover_poison');
    assert.equal(discovery.trigger, 'item_acquired:poison_vial');
    assert.match(discovery.text, /проверк/i);
    assert.doesNotMatch(discovery.text, /отпечатки пальцев принадлежат|кто-то заменил содержимое/i);

    const fourClues = caseTwo.events.find(event => event.id === 'all_evidence_002');
    assert.equal(fourClues.trigger, 'evidence_count:4');
    assert.match(fourClues.text, /не доказывает вину/i);
});

test('case two does not present revised witness accounts as unquestionable courtroom proof', () => {
    const { caseTwo, chains } = loadCaseTwoNarrative();
    const summary = caseTwo.finalQuestion.feedbackCorrect.evidenceSummary.join(' ');
    assert.match(summary, /уточнения/i);
    assert.doesNotMatch(summary, /официанта — видел момент отравления|бармена — Кейн украл пузырёк/i);

    const witnessChain = chains.chain_002_witnesses;
    assert.deepEqual(Array.from(witnessChain.requiredInsights), [
        'waiter_saw_poisoning', 'bartender_testimony', 'kane_threatened_witness'
    ]);
    assert.match(witnessChain.description, /пересмотренные показания/i);
    assert.match(witnessChain.narrative, /не была очевидицей/i);
});
