import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('Anna and Kane have separate shipped painterly portraits in the second case', () => {
    const data = read('assets/data/cases/case-002/npcs.js');
    for (const file of ['anna-kovalyova.webp', 'viktor-kane.webp']) {
        assert.ok(statSync(new URL(`../assets/art/portraits/${file}`, import.meta.url)).size > 20_000);
        assert.ok(data.includes(`portrait: "assets/art/portraits/${file}"`));
    }
});

test('dossier design keeps portrait fallbacks and keyboard-accessible evidence', () => {
    const html = read('index.html');
    assert.match(html, /noir-board\.css[\s\S]*noir-dossiers\.css/);
    const css = read('assets/css/noir-dossiers.css');
    assert.match(css, /\.npc-card \.npc-avatar img/);
    assert.match(css, /\.inventory-card\.card-evidence:focus-visible/);
    assert.match(read('assets/js/ui/npcListUI.js'), /data-fallback-icon/);
    assert.match(read('assets/js/ui/inventoryUI.js'), /card\.tabIndex = 0/);
});
