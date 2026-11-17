import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../assets/js/ui/boardUI.js', import.meta.url), 'utf8');
const BoardUI = runInNewContext(`${source}\nBoardUI`, { getObjectById: id => ({ name: id }) });

test('comparison form offers three tentative outcomes and excludes superseded statements', () => {
    const ui = Object.create(BoardUI.prototype);
    ui._escapeHTML = text => String(text);
    const html = ui._renderEvidenceComparison(['bar_photo'], [
        { id: 'active', sourceName: 'Томас', summary: 'Видел Кейна', status: 'active' },
        { id: 'old', sourceName: 'Томас', summary: 'Старая версия', status: 'superseded' }
    ]);
    assert.match(html, /comparison-evidence/);
    assert.match(html, /value="pending">Недостаточно информации/);
    assert.match(html, /value="for">Согласуются/);
    assert.match(html, /value="against">Есть расхождение/);
    assert.match(html, /value="active"/);
    assert.doesNotMatch(html, /value="old"/);
});

test('comparison stores two sourced links and rejects unavailable or superseded inputs', () => {
    const ui = Object.create(BoardUI.prototype);
    const calls = [];
    ui.inventory = { evidence: ['bar_photo'] };
    ui.memoryService = { getStatements: () => [{ id: 'current', status: 'active' }, { id: 'old', status: 'superseded' }] };
    ui.board = {
        evidenceOnBoard: [],
        addHypothesis: note => { calls.push(['create', note]); return 'hyp-1'; },
        linkHypothesis: (...args) => { calls.push(args); return true; }
    };
    ui._expandedTools = new Set();
    assert.equal(ui._saveEvidenceComparison('missing', 'current', 'against', 'Нужно проверить'), false);
    assert.equal(ui._saveEvidenceComparison('bar_photo', 'old', 'against', 'Нужно проверить'), false);
    assert.equal(ui._saveEvidenceComparison('bar_photo', 'current', 'for', ' '), false);
    assert.deepEqual(calls, []);
    assert.equal(ui._saveEvidenceComparison('bar_photo', 'current', 'against', 'Время не совпадает'), true);
    assert.equal(JSON.stringify(calls), JSON.stringify([
        ['create', 'Время не совпадает'],
        ['hyp-1', 'evidence', 'bar_photo', 'pending'],
        ['hyp-1', 'statement', 'current', 'against']
    ]));
});
