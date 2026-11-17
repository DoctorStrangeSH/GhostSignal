import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('corkboard artwork is shipped and the noir board stylesheet loads after other overrides', () => {
    assert.ok(statSync(new URL('../assets/art/board/noir-corkboard.webp', import.meta.url)).size > 25000);
    const markup = read('index.html');
    assert.match(markup, /noir-locations\.css[\s\S]*noir-board\.css/);
    const css = read('assets/css/noir-board.css');
    assert.match(css, /\.\.\/art\/board\/noir-corkboard\.webp/);
    assert.match(css, /\.board-canvas \.connection-line\.active/);
    assert.match(css, /\.board-canvas \.board-slot:focus-visible/);
    assert.match(css, /max-width: 680px/);
});

test('noir board keeps live evidence slots, true connection state and keyboard access', () => {
    const ui = read('assets/js/ui/boardUI.js');
    assert.match(ui, /this\._renderSlots\(\)/);
    assert.match(ui, /this\._renderEvidencePool\(\)/);
    assert.match(ui, /data-slot-id="\$\{slot\.id\}" role="button" tabindex="0"/);
    assert.match(ui, /isActive = slotFrom\.evidenceId && slotTo\.evidenceId/);
    assert.match(ui, /Красная нить показывает соседство карточек, а не доказанную связь/);
});
