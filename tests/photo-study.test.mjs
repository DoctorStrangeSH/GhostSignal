import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the bar photograph ships as a real optimized image, not an icon placeholder', () => {
    assert.ok(statSync(new URL('../assets/art/evidence/bar-contact-print.webp', import.meta.url)).size > 40_000);
    assert.match(read('index.html'), /noir-evidence-inspection\.css[\s\S]*noir-photo-study\.css/);
});

test('photo study offers three separate, cautious observations and remembers already studied areas', () => {
    const UI = runInNewContext(`${read('assets/js/ui/inventoryUI.js')}\nInventoryUI`, {});
    const ui = Object.create(UI.prototype);
    const saved = new Set(['bar_photo_observed_counter']);
    ui.inventory = { hasInsight: id => saved.has(id) };
    const markup = ui._renderBarPhotoStudy();
    assert.match(markup, /Изучено участков:[\s\S]*>1<\/span> из 3/);
    for (const focus of ['counter', 'woman', 'waiter']) assert.ok(markup.includes(`data-photo-focus="${focus}"`));
    const code = read('assets/js/ui/inventoryUI.js');
    assert.match(code, /Небольшой предмет на снимке не опознаётся/);
    assert.match(code, /не позволяет определить, что она видела/);
    assert.match(code, /нужно отдельно проверить его показания/);
    assert.match(code, /this\.inventory\?\.addInsight\?\./);
});

test('photo study only appears for the genuine bar_photo inventory item', () => {
    const code = read('assets/js/ui/inventoryUI.js');
    assert.match(code, /item\.id === 'bar_photo' \? this\._renderBarPhotoStudy\(\) : ''/);
    assert.match(code, /if \(item\.id === 'bar_photo'\) this\._bindBarPhotoStudy\(\)/);
});

test('the photo journal retains only discovered observations and never presents unseen notes', () => {
    const UI = runInNewContext(`${read('assets/js/ui/inventoryUI.js')}\nInventoryUI`, {});
    const ui = Object.create(UI.prototype);
    const found = new Set(['bar_photo_observed_woman']);
    ui.inventory = { hasInsight: id => found.has(id) };
    let markup = ui._renderBarPhotoStudy();
    assert.match(markup, /Журнал наблюдений \(<span id="photo-study-journal-count">1/);
    assert.match(markup, /Женщина отворачивается от стойки/);
    assert.doesNotMatch(markup, /Мужчина наклоняется у стойки/);
    assert.doesNotMatch(markup, /Официант находится за стойкой/);
    found.add('bar_photo_observed_waiter');
    markup = ui._renderBarPhotoStudy();
    assert.match(markup, /photo-study-journal-count">2/);
    assert.match(markup, /Официант находится за стойкой/);
    assert.match(markup, /data-photo-zoom aria-pressed="false"/);
});

test('zoom is an accessible reversible toggle without new evidence or time cost', () => {
    const source = read('assets/js/ui/inventoryUI.js');
    assert.match(source, /classList\.toggle\('is-enlarged'\)/);
    assert.match(source, /zoom\.setAttribute\('aria-pressed', String\(Boolean\(enlarged\)\)\)/);
    assert.match(read('assets/css/noir-photo-study.css'), /\.photo-study-frame\.is-enlarged img \{ width: 200%/);
});
