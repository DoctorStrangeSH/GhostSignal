import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDialogueReactionTargets } from '../scripts/dialogue-reaction-validation.mjs';

test('special reactions must point to a real dialogue node', () => {
    const dialogue = {
        id: 'interrogation',
        tree: { nodes: { start: {}, continue: {} } },
        contradictionReactions: {
            alibi: { text: 'Уточните ваши показания.', answers: [
                { text: 'Продолжим', nextNode: 'continue' },
                { text: 'Повторите', nextNode: 'missing' }
            ] }
        },
        evidenceReactions: {
            photo: { text: 'Это не доказательство.', answers: [{ text: 'Ещё вопрос', nextNode: 'absent' }] }
        }
    };
    assert.deepEqual(validateDialogueReactionTargets(dialogue), [
        'Dialogue interrogation evidenceReactions/photo points to missing node: absent',
        'Dialogue interrogation contradictionReactions/alibi points to missing node: missing'
    ]);
    dialogue.evidenceReactions.photo.answers[0].nextNode = 'continue';
    dialogue.contradictionReactions.alibi.answers[1].nextNode = 'start';
    assert.deepEqual(validateDialogueReactionTargets(dialogue), []);
});

test('special reactions require meaningful text and a valid answer collection', () => {
    const dialogue = {
        id: 'interrogation', tree: { nodes: {} },
        evidenceReactions: { blank: { text: '  ', answers: {} } },
        contradictionReactions: { noText: { answers: [] } }
    };
    assert.deepEqual(validateDialogueReactionTargets(dialogue), [
        'Dialogue interrogation evidenceReactions/blank has missing reaction text.',
        'Dialogue interrogation evidenceReactions/blank has invalid answers.',
        'Dialogue interrogation contradictionReactions/noText has missing reaction text.'
    ]);
});
