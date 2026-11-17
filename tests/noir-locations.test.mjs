import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the hotel and bar are represented by real shipped artwork', () => {
    const css = read('assets/css/noir-locations.css');
    assert.match(css, /scene-location-hotel_grand/);
    assert.match(css, /grand-hotel-noir\.webp/);
    assert.match(css, /scene-location-bar_joe/);
    assert.match(css, /joes-bar-noir\.webp/);
    for (const name of ['grand-hotel-noir.webp', 'joes-bar-noir.webp']) {
        assert.ok(statSync(new URL(`../assets/art/world/${name}`, import.meta.url)).size > 20000);
    }
});

test('location art stylesheet loads last and location IDs remain unchanged', () => {
    assert.match(read('index.html'), /noir-title\.css[\s\S]*noir-locations\.css/);
    const locations = read('assets/data/cases/case-001/locations.js');
    assert.match(locations, /hotel_grand:/);
    assert.match(locations, /bar_joe:/);
});

test('Blackwood mansion and newspaper office ship matching cinematic scenes', () => {
    const css = read('assets/css/noir-locations.css');
    const locations1 = read('assets/data/cases/case-001/locations.js');
    const locations2 = read('assets/data/cases/case-002/locations.js');
    for (const [id, image, data] of [
        ['blackwood_mansion', 'blackwood-mansion-noir.webp', locations1],
        ['newspaper_office', 'newspaper-office-noir.webp', locations2],
    ]) {
        assert.match(data, new RegExp(`${id}:`));
        assert.ok(css.includes(`.scene-location-${id}`));
        assert.ok(css.includes(image));
        assert.ok(statSync(new URL(`../assets/art/world/${image}`, import.meta.url)).size > 20000);
    }
});
