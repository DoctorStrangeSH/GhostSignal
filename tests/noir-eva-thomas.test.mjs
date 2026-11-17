import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

test('Eva and Thomas have dedicated portrait artwork in case two', () => {
    const data = readFileSync(new URL('../assets/data/cases/case-002/npcs.js', import.meta.url), 'utf8');
    for (const [id, filename] of [
        ['woman_in_red', 'eva-kovalyova.webp'],
        ['waiter', 'waiter-thomas.webp']
    ]) {
        assert.match(data, new RegExp(`${id}:\\s*\\{[\\s\\S]*?portrait: "assets/art/portraits/${filename.replaceAll('.', '\\.')}"`));
        assert.ok(statSync(new URL(`../assets/art/portraits/${filename}`, import.meta.url)).size > 20_000);
    }
});
