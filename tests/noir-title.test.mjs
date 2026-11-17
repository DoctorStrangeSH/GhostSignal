import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('main menu loads independent art after base noir stylesheet', () => {
    const html = read('index.html');
    assert.match(html, /noir-world\.css[\s\S]*noir-title\.css/);
    assert.match(html, /class="menu-emblem"[\s\S]*ghost-signal-emblem\.png/);
    const css = read('assets/css/noir-title.css');
    assert.match(css, /detective-office-menu\.webp/);
});

test('all original menu action IDs remain usable', () => {
    const html = read('index.html');
    for (const id of ['btn-open-cases', 'btn-continue', 'btn-stats', 'btn-options']) {
        assert.match(html, new RegExp(`id="${id}"`));
    }
    assert.match(html, /Быстрый выбор: клавиши 1–4/);
    assert.match(read('assets/css/noir-title.css'), /prefers-reduced-motion/);
});

test('production menu illustrations are present in the repository', () => {
    for (const name of ['detective-office-menu.webp', 'ghost-signal-emblem.png']) {
        assert.ok(statSync(new URL(`../assets/art/brand/${name}`, import.meta.url)).size > 20000);
    }
});
