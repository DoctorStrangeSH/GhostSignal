import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../assets/data/cases/case-002/dialogues/waiter.js', import.meta.url), 'utf8');
const dialogue = runInNewContext(`${source}\nDIALOGUE_WAITER`, { registerData() {} });
const { nodes } = dialogue.tree;
const condition = 'all:hasInsight:bar_photo_testimony_scope_checked&hasInsight:tram_passenger_route_corroboration&not:hasInsight:photo_tram_scope_checked';

test('independent tram comparison is gated behind studying photo scope and the actual conductor record', () => {
    for (const opening of ['revised_testimony_opening', 'testimony_given_opening']) {
        const answers = nodes[opening].answers.filter(answer => answer.nextNode === 'photo_tram_independent_check');
        assert.equal(answers.length, 1);
        assert.equal(answers[0].condition, condition);
        assert.equal(answers[0].hiddenWhenUnavailable, true);
    }
});

test('independent tram record cannot establish the photo timestamp, visitor identity or Thomas position', () => {
    const node = nodes.photo_tram_independent_check;
    assert.equal(node.givesInsight, 'photo_tram_scope_checked');
    assert.match(node.text, /22:15/);
    assert.match(node.text, /не могу связать его пассажира с Кейном/);
    assert.match(node.text, /Ни время самого фотокадра/);
    assert.equal(node.claim, undefined);
    assert.ok(node.answers.every(answer => !answer.accusation && !answer.resolveAccusation));
});
