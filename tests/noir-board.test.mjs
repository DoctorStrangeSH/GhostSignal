import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import vm from 'node:vm';

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
    assert.match(ui, /data-slot-id="\$\{this\._escapeHTML\(slot\.id\)\}" role="button" tabindex="0"/);
    assert.match(ui, /isActive = slotFrom\.evidenceId && slotTo\.evidenceId/);
    assert.match(ui, /Красная нить показывает соседство карточек, а не доказанную связь/);
});

test('hypothesis board exposes alternative creation and clearly labels grouped versions', () => {
    const ui = read('assets/js/ui/boardUI.js');
    const css = read('assets/css/components/board.css');
    assert.match(ui, /hypothesis-alternative/);
    assert.match(ui, /createAlternativeHypothesis\(current\.id, title\)/);
    assert.match(ui, /getHypothesisAlternatives\?\.\(h\.id\)/);
    assert.match(ui, /Версии независимы\. Общая группа не определяет, какая из них верна\./);
    assert.match(ui, /prompt\('Сформулируйте альтернативную версию:'/);
    assert.match(css, /\.hypothesis-alternatives/);
    assert.match(css, /\.hypothesis-alternatives li\.is-current/);
});
test('hypothesis UI renders shared, unique and pending material for alternative versions', () => {
    const context = vm.createContext({ document: { getElementById: () => null }, events: { on() {}, emit() {} },
        getObjectById: id => ({ id, name: 'Улика ' + id }) });
    vm.runInContext(read('assets/js/ui/boardUI.js'), context);
    const ui = vm.runInContext('Object.create(BoardUI.prototype)', context);
    ui.inventory = { evidence: ['photo', 'station-log'] };
    ui.memoryService = { getStatements: () => [] };
    ui._renderSourceInquiries = () => '';
    vm.runInContext(read('assets/js/systems/board.js'), context);
    ui.board = vm.runInContext('new InvestigationBoard()', context);
    const first = ui.board.addHypothesis('Кейн действовал один');
    const second = ui.board.createAlternativeHypothesis(first, '<сообщник>');
    ui.board.linkHypothesis(first, 'evidence', 'photo', 'for');
    ui.board.linkHypothesis(first, 'assumption', 'Скрытый выход', 'pending');
    ui.board.linkHypothesis(second, 'evidence', 'photo', 'against');
    ui.board.linkHypothesis(second, 'evidence', 'station-log', 'for');
    const html = ui._renderHypotheses();
    assert.match(html, /СОПОСТАВЛЕНИЕ С «&lt;сообщник&gt;»/);
    assert.match(html, /Общие источники: 1/);
    assert.match(html, /оценки различаются/);
    assert.match(html, /Только в этой версии/);
    assert.match(html, /Только в альтернативе/);
    assert.match(html, /Требуют проверки: Скрытый выход/);
    assert.match(html, /не создаёт независимого подтверждения/);
    assert.match(html, /позиция детектива, а не установленное противоречие/);
});
test('chronology UI exposes explicit uncertainty windows and avoids exact-order wording for overlaps', () => {
    const ui = read('assets/js/ui/boardUI.js');
    const css = read('assets/css/components/board.css');
    assert.match(ui, /ОКНО ±/);
    assert.match(ui, /Временные окна пересекаются\./);
    assert.match(ui, /Порядок событий не установлен\./);
    assert.match(css, /\.noir-timeline-uncertainty/);
});
test('alibi UI collects explicit timing uncertainty and displays route compatibility categories', () => {
    const ui = read('assets/js/ui/boardUI.js');
    assert.match(ui, /reviewAlibiRouteWindows\(this\.locationManager\?\.activeCaseData\?\.alibiRoutes, knownLocations, evidenceIds\)/);
    assert.match(ui, /name="uncertaintyMinutes"/);
    assert.match(ui, /ВОЗМОЖНО/);
    assert.match(ui, /НЕДОСТАТОЧНО ДАННЫХ/);
    assert.match(ui, /ТРЕБУЕТ ПРОВЕРКИ/);
});
test('board cards escape evidence metadata and slot labels before rendering HTML', () => {
    const data = { id: 'photo', name: '<img src=x onerror=alert(1)>', icon: '<svg onload=alert(1)>' };
    const context = vm.createContext({
        document: { getElementById: () => null }, events: { on() {} },
        getObjectById: () => data, getObjectsByIds: () => [data]
    });
    vm.runInContext(read('assets/js/ui/boardUI.js'), context);
    const ui = vm.runInContext('Object.create(BoardUI.prototype)', context);
    ui.board = {
        slots: [{ id: 'slot-1', label: '<b>Свидетель</b>', x: 50, y: 50, evidenceId: 'photo' }],
        getAvailableEvidence: () => ['photo']
    };
    ui.inventory = { evidence: ['photo'] };
    const slotMarkup = ui._renderSlots();
    const poolMarkup = ui._renderEvidencePool();
    for (const markup of [slotMarkup, poolMarkup]) {
        assert.doesNotMatch(markup, /<img|<svg/);
        assert.match(markup, /&lt;img|&lt;svg/);
    }
    assert.match(slotMarkup, /&lt;b&gt;Свидетель&lt;\/b&gt;/);
});
