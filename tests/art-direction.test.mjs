import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../assets/css/art-direction.css', import.meta.url), 'utf8');
const icon = readFileSync(new URL('../assets/icons/ghost-signal.svg', import.meta.url), 'utf8');
const alley = readFileSync(new URL('../assets/art/locations/noir-alley.svg', import.meta.url), 'utf8');

test('Midnight Archive design assets are linked after existing component styles', () => {
    assert.match(html, /href="assets\/icons\/ghost-signal\.svg"/);
    assert.match(html, /href="assets\/css\/art-direction\.css"/);
    assert.ok(html.indexOf('assets/css/responsive.css') < html.indexOf('assets/css/art-direction.css'));
    assert.match(icon, /<svg\b/);
});

test('the new main menu preserves existing game actions and accessible copy', () => {
    for (const id of ['btn-open-cases', 'btn-continue', 'btn-stats', 'btn-options']) {
        assert.match(html, new RegExp(`id="${id}"`));
    }
    assert.match(html, /<h1>GHOST <em>SIGNAL<\/em><\/h1>/);
    assert.match(html, /У каждой тайны есть свидетель/);
});

test('visual theme defines legacy newspaper colors and reduced-motion behavior', () => {
    for (const token of ['--noir-paper', '--noir-ink', '--noir-sepia']) {
        assert.ok(css.includes(`${token}:`));
    }
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /:focus-visible/);
});

test('street locations use a local illustrated asset without changing scene semantics', () => {
    assert.match(css, /url\('\.\.\/art\/locations\/noir-alley\.svg'\)/);
    assert.match(alley, /<title id="title">Ночной переулок<\/title>/);
    assert.match(alley, /viewBox="0 0 1200 440"/);
});
