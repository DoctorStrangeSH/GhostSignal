import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function createInspection() {
    const emitted = [];
    const UI = runInNewContext(`${read('assets/js/ui/inventoryUI.js')}\nInventoryUI`, {
        events: { emit: (type, payload) => emitted.push({ type, payload }) }
    });
    const instance = Object.create(UI.prototype);
    instance.inventory = {};
    return { instance, emitted };
}

test('evidence inspection shows a readable document and never treats raw descriptions as HTML', () => {
    const { instance, emitted } = createInspection();
    instance._showItemDetails({ id: 'note', name: 'Письмо <опасное>', icon: '✉', isEvidence: true,
        description: 'Описание', interactions: { examine: { text: 'Найдено <script>alert(1)</script>', timeCost: 10 } }
    });
    const modal = emitted.find(event => event.type === 'modal:show')?.payload;
    assert.ok(modal);
    assert.match(modal.body, /ПЕРЕПИСКА/);
    assert.match(modal.body, /МАТЕРИАЛ ДЕЛА/);
    assert.match(modal.body, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(modal.body, /<script>/);
    assert.match(modal.body, /Письмо &lt;опасное&gt;/);
    assert.equal(emitted.find(event => event.type === 'time:advance')?.payload, 10);
});

test('photos and ordinary items have distinct labels, without inventing evidence status', () => {
    const { instance, emitted } = createInspection();
    instance._showItemDetails({ name: 'Фотография из бара', icon: '📸', isEvidence: true, description: 'На снимке не всё различимо.' });
    instance._showItemDetails({ name: 'Фонарик', icon: '🔦', isEvidence: false, description: 'Тяжёлый.' });
    assert.match(emitted[0].payload.body, /ФОТОМАТЕРИАЛ/);
    assert.match(emitted[2].payload.body, /ПРЕДМЕТ/);
    assert.doesNotMatch(emitted[2].payload.body, /Можно сопоставить с другими уликами/);
});

test('inspection stylesheet is present after previous noir art styles', () => {
    assert.match(read('index.html'), /noir-dossiers\.css[\s\S]*noir-evidence-inspection\.css/);
    assert.match(read('assets/css/noir-evidence-inspection.css'), /\.evidence-inspection-sheet/);
});
