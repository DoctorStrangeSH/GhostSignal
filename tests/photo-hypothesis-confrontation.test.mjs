import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const Engine = runInNewContext(`${read('assets/js/npc/dialogueEngine.js')}\nDialogueEngine`);
const dialogue = runInNewContext(`${read('assets/data/cases/case-002/dialogues/waiter.js')}\nDIALOGUE_WAITER`, { registerData() {} });

function makeEngine({ status = 'open', statementStatus = 'active', sourceId = 'bar_photo', observed = true } = {}) {
    const engine = new Engine({ hasInsight: id => observed && id === 'bar_photo_observed_waiter' }, {});
    engine.memoryService = { getStatements: () => [{ id: 'statement-1', npcId: 'waiter', status: statementStatus }] };
    engine.investigationBoard = { hypotheses: [{
        status, title: '[Фото: Официант] Нужно проверить время',
        links: [{ kind: 'evidence', sourceId }, { kind: 'statement', sourceId: 'statement-1' }]
    }] };
    return engine;
}

test('only an active, sourced photo hypothesis can be presented to Thomas', () => {
    assert.equal(makeEngine()._checkCondition('has_waiter_photo_comparison'), true);
    assert.equal(makeEngine({ status: 'abandoned' })._checkCondition('has_waiter_photo_comparison'), false);
    assert.equal(makeEngine({ statementStatus: 'superseded' })._checkCondition('has_waiter_photo_comparison'), false);
    assert.equal(makeEngine({ sourceId: 'poison_vial' })._checkCondition('has_waiter_photo_comparison'), false);
    assert.equal(makeEngine({ observed: false })._checkCondition('has_waiter_photo_comparison'), false);
});

test('Thomas responds without automatically confirming guilt or rewriting his testimony', () => {
    for (const id of ['testimony_given_opening', 'revised_testimony_opening']) {
        const answer = dialogue.tree.nodes[id].answers.find(item => item.nextNode === 'photo_hypothesis_confrontation');
        assert.ok(answer);
        assert.equal(answer.condition, 'all:has_waiter_photo_comparison&not:hasInsight:waiter_photo_comparison_discussed');
    }
    const node = dialogue.tree.nodes.photo_hypothesis_confrontation;
    assert.equal(node.givesInsight, 'waiter_photo_comparison_discussed');
    assert.equal(node.claim, undefined);
    assert.equal(node.accusation, undefined);
    assert.match(node.text, /другим свидетельствам/);
});

test('presenting a sourced hypothesis offers cautious, persistent and accusatory paths with consequences', () => {
    const answers = dialogue.tree.nodes.photo_hypothesis_confrontation.answers;
    const calm = answers.find(answer => answer.tone === 'reassuring');
    const insistence = answers.find(answer => answer.nextNode === 'photo_hypothesis_insistence');
    const accusation = answers.find(answer => answer.nextNode === 'photo_hypothesis_unfounded_accusation');
    assert.equal(calm.cooperationDelta, 3);
    assert.ok(insistence.pressureDelta > 0);
    assert.ok(insistence.cooperationDelta < 0);
    assert.ok(accusation.pressureDelta > insistence.pressureDelta);
    assert.ok(accusation.cooperationDelta < insistence.cooperationDelta);
    assert.equal(accusation.accusation.id, 'thomas-photo-testimony-lie');
    assert.equal(accusation.report.networkPropagation, true);
    assert.equal(accusation.condition, 'not:has_accusation:thomas-photo-testimony-lie');
    assert.equal(dialogue.tree.nodes.photo_hypothesis_insistence.claim, undefined);
    assert.equal(dialogue.tree.nodes.photo_hypothesis_unfounded_accusation.claim, undefined);
    assert.match(dialogue.tree.nodes.photo_hypothesis_unfounded_accusation.innerThought, /не как установление лжи/);
});
