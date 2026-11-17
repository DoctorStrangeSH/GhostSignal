import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('chronology cards expose timestamp provenance and unknown or approximate time without inventing certainty', () => {
    const ui = read('assets/js/ui/boardUI.js');
    assert.match(ui, /class="noir-timeline" aria-label="Хронология обнаруженных событий"/);
    assert.match(ui, /noir-timeline-card--\$\{timeClass\(f\)\}/);
    assert.match(ui, /fact\.minute === null \? 'Время неизвестно'/);
    assert.match(ui, /ПРИБЛИЗИТЕЛЬНО/);
    assert.match(ui, /this\._escapeHTML\(f\.caveat\)/);
    assert.match(ui, /this\._escapeHTML\(getObjectById\(f\.evidenceId\)\?\.name/);
});

test('noir chronology keeps player proposals visibly tentative and adapts to mobile', () => {
    const ui = read('assets/js/ui/boardUI.js');
    const css = read('assets/css/components/board.css');
    assert.match(ui, /chronology_reviewed/);
    assert.match(ui, /РАСХОЖДЕНИЕ ВРЕМЕНИ/);
    assert.match(ui, /НЕДОСТАТОЧНО ДАННЫХ/);
    assert.match(css, /\.noir-timeline::before/);
    assert.match(css, /\.noir-timeline-card--unknown::before/);
    assert.match(css, /\.noir-timeline-review--conflicts/);
    assert.match(css, /@media \(max-width: 576px\)[\s\S]*\.noir-timeline-card/);
});
