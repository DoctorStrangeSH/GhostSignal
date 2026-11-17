import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('noir world stylesheet is loaded after base art direction', () => {
    const html = read('index.html');
    assert.match(html, /assets\/css\/art-direction\.css[\s\S]*assets\/css\/noir-world\.css/);
});

test('precinct and atlas use shipped artwork instead of placeholder backgrounds', () => {
    const css = read('assets/css/noir-world.css');
    assert.match(css, /scene-location-police_station[\s\S]*police-precinct-noir\.webp/);
    assert.match(css, /map-background[\s\S]*city-map-noir\.webp/);
    for (const name of ['police-precinct-noir.webp', 'city-map-noir.webp']) {
        const file = new URL(`../assets/art/world/${name}`, import.meta.url);
        assert.ok(statSync(file).size > 20000, `${name} is missing or too small`);
    }
});

test('city locations are keyboard-accessible buttons', () => {
    const renderer = read('assets/js/ui/mapRenderer.js');
    assert.match(renderer, /document\.createElement\('button'\)/);
    assert.match(renderer, /el\.type = 'button'/);
    assert.match(renderer, /setAttribute\('aria-label'/);
    assert.match(read('assets/css/noir-world.css'), /\.map-marker:focus-visible/);
});
