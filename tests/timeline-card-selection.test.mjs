import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('timeline cards are native keyboard-usable toggle buttons with announced selection state', () => {
    const ui = read('assets/js/ui/boardUI.js');
    assert.match(ui, /class="noir-timeline-select" type="button"/);
    assert.match(ui, /data-timeline-id="\$\{this\._escapeHTML\(f\.id\)\}"/);
    assert.match(ui, /aria-pressed="\$\{this\._chronologySelection\.includes\(f\.id\)\}"/);
    assert.match(ui, /chronology-selection-status"[^>]*role="status" aria-live="polite"/);
    assert.match(ui, /this\._chronologySelection = \[\]/);
});

test('two selected timeline events synchronize available chronology comparison and hypothesis forms', () => {
    const ui = read('assets/js/ui/boardUI.js');
    const css = read('assets/css/components/board.css');
    assert.match(ui, /\['chronology-order-first', 'chronology-order-second'\]/);
    assert.match(ui, /\['chronology-first', 'chronology-second'\]/);
    assert.match(ui, /\.some\(option => option\.value === selected\[0\]\)/);
    assert.match(ui, /this\._chronologySelection\.length < 2/);
    assert.match(css, /\.noir-timeline-card\.is-selected/);
    assert.match(css, /\.noir-timeline-select:focus-visible/);
});
