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
