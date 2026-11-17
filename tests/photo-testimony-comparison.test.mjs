import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../assets/data/cases/case-002/dialogues/waiter.js', import.meta.url), 'utf8');
const dialogue = runInNewContext(`${source}\nDIALOGUE_WAITER`, { registerData() {} });
const nodes = dialogue.tree.nodes;

test('specific photo observation unlocks a follow-up in both original and revised testimony', () => {
    for (const id of ['testimony_given_opening', 'revised_testimony_opening']) {
        const answer = nodes[id].answers.find(option => option.nextNode === 'photo_observation_comparison');
        assert.ok(answer, `${id} should offer photo comparison`);
        assert.equal(answer.condition, 'all:hasItem:bar_photo&hasInsight:bar_photo_observed_waiter&not:hasInsight:bar_photo_testimony_scope_checked');
        assert.equal(answer.tone, 'calm');
        assert.equal(answer.hiddenWhenUnavailable, true);
    }
});

test('comparing the photograph records uncertainty, not a confession or a revised claim', () => {
    const comparison = nodes.photo_observation_comparison;
    assert.equal(comparison.givesInsight, 'bar_photo_testimony_scope_checked');
    assert.equal(comparison.claim, undefined);
    assert.equal(comparison.accusation, undefined);
    assert.match(comparison.text, /не подтвердить по фотографии/);
    assert.match(comparison.innerThought, /не доказанную ложь/);
    assert.ok(comparison.answers.every(answer => answer.nextNode === 'end_waiter'));
});
