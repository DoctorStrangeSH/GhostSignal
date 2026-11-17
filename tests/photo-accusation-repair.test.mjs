import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../assets/data/cases/case-002/dialogues/waiter.js', import.meta.url), 'utf8');
const dialogue = runInNewContext(`${source}\nDIALOGUE_WAITER`, { registerData() {} });
const { entryRules, nodes } = dialogue.tree;

test('the photo accusation requires an apology before a separate retraction conversation', () => {
    assert.equal(entryRules[0].condition, 'all:accusation_status:thomas-photo-testimony-lie:pending&hasInsight:thomas_photo_accusation_apology');
    assert.equal(entryRules[1].condition, 'accusation_status:thomas-photo-testimony-lie:pending');
    assert.equal(entryRules[2].condition, 'all:accusation_status:thomas-photo-testimony-lie:retracted&not:has_visited_node:photo_accusation_retracted_opening');
    assert.equal(nodes.photo_accusation_apology.givesInsight, 'thomas_photo_accusation_apology');
    assert.ok(nodes.photo_accusation_pending.answers.some(answer => answer.nextNode === 'photo_accusation_apology'));
    assert.equal(nodes.photo_accusation_apology.answers[0].resolveAccusation, undefined);
});

test('retraction changes the accusation record but does not fabricate innocence or restore trust immediately', () => {
    const resolution = nodes.photo_accusation_followup.answers.find(answer => answer.resolveAccusation);
    assert.equal(resolution.resolveAccusation.id, 'thomas-photo-testimony-lie');
    assert.equal(resolution.resolveAccusation.outcome, 'retracted');
    assert.equal(resolution.report.networkPropagation, true);
    assert.match(nodes.photo_accusation_retraction.text, /не обещаю, что сразу снова стану вам доверять/);
    assert.match(nodes.photo_accusation_followup.text, /не доказывает/);
    assert.equal(nodes.photo_accusation_retraction.claim, undefined);
});
