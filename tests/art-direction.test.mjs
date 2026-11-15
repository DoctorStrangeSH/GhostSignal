import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { statSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../assets/css/art-direction.css', import.meta.url), 'utf8');
const icon = readFileSync(new URL('../assets/icons/ghost-signal.svg', import.meta.url), 'utf8');
const alley = readFileSync(new URL('../assets/art/locations/noir-alley.svg', import.meta.url), 'utf8');
const hotel = readFileSync(new URL('../assets/art/locations/grand-hotel.svg', import.meta.url), 'utf8');
const room = readFileSync(new URL('../assets/art/locations/room-304.svg', import.meta.url), 'utf8');
const bar = readFileSync(new URL('../assets/art/locations/joes-bar.svg', import.meta.url), 'utf8');
const mansion = readFileSync(new URL('../assets/art/locations/blackwood-mansion.svg', import.meta.url), 'utf8');
const sceneRenderer = readFileSync(new URL('../assets/js/ui/sceneRenderer.js', import.meta.url), 'utf8');
const npcData = readFileSync(new URL('../assets/data/cases/case-001/npcs.js', import.meta.url), 'utf8');
const npcList = readFileSync(new URL('../assets/js/ui/npcListUI.js', import.meta.url), 'utf8');
const callInterface = readFileSync(new URL('../assets/js/npc/callInterface.js', import.meta.url), 'utf8');
const inventoryUI = readFileSync(new URL('../assets/js/ui/inventoryUI.js', import.meta.url), 'utf8');

test('evidence board uses readable dossier cards and selected evidence contrast', () => {
    assert.match(css, /\.board-slot \.slot-evidence-name\s*\{/);
    assert.match(css, /\.board-evidence-pool\s*\{/);
    assert.match(css, /\.evidence-pool-item\.is-selected/);
    assert.match(css, /\.board-slot\.drop-target/);
});

test('inventory evidence can be inspected with keyboard as well as mouse', () => {
    assert.match(inventoryUI, /setAttribute\('role', 'button'\)/);
    assert.match(inventoryUI, /card\.tabIndex = 0/);
    assert.match(inventoryUI, /event\.key === 'Enter' \|\| event\.key === ' '/);
    assert.match(css, /\.inventory-card:focus-visible/);
});

test('interview transcripts distinguish testimony, questions and verified contradictions', () => {
    assert.match(css, /content: 'ПОКАЗАНИЕ'/);
    assert.match(css, /content: 'ВОПРОС'/);
    assert.match(css, /\.prepared-contradiction-kicker/);
    assert.match(callInterface, /role="log" aria-label="Протокол разговора"/);
    assert.match(callInterface, /if \(result\.success\) \{\s*this\._appendPlayerStatement\('Я сопоставил/);
});

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

test('location-specific art does not leak to other locations of the same category', () => {
    assert.match(sceneRenderer, /scene-location-\$\{sceneLocation\}/);
    assert.match(css, /\.scene-location-hotel_grand\s*\{/);
    assert.match(css, /url\('\.\.\/art\/locations\/grand-hotel\.svg'\)/);
    assert.match(hotel, /<title id="title">Лобби отеля Гранд<\/title>/);
});

test('room 304 art keeps secret discoveries out of its illustration', () => {
    assert.match(css, /\.scene-location-hotel_room_304\s*\{/);
    assert.match(room, /<title id="title">Номер 304 отеля Гранд<\/title>/);
    for (const discovery of ['hidden_note', 'wire_fragment', 'wall_safe', 'small_key']) {
        assert.ok(!room.includes(discovery), `Visual art must not prematurely reveal ${discovery}`);
    }
});

test('Joe bar scene has dedicated art without pre-revealing inspectable clues', () => {
    assert.match(css, /\.scene-location-bar_joe\s*\{/);
    assert.match(css, /url\('\.\.\/art\/locations\/joes-bar\.svg'\)/);
    assert.match(bar, /<title id="title">Бар У Джо<\/title>/);
    assert.ok(!bar.includes('matchbox') && !bar.includes('fabric_clue'));
});

test('Blackwood mansion has unique art without revealing document discoveries', () => {
    assert.match(css, /\.scene-location-blackwood_mansion\s*\{/);
    assert.match(css, /url\('\.\.\/art\/locations\/blackwood-mansion\.svg'\)/);
    assert.match(mansion, /<title id="title">Особняк Блэквудов<\/title>/);
    assert.ok(!mansion.includes('phone_records'));
});

test('Frank portrait is a local image and is shown in dossiers and calls', () => {
    assert.ok(statSync(new URL('../assets/art/portraits/porter-frank.webp', import.meta.url)).size > 10_000);
    assert.match(npcData, /portrait: "assets\/art\/portraits\/porter-frank\.webp"/);
    assert.match(npcList, /npc\.portrait/);
    assert.match(callInterface, /npc\.portrait/);
});

test('Joe portrait is available in the same NPC portrait pipeline', () => {
    assert.ok(statSync(new URL('../assets/art/portraits/bartender-joe.webp', import.meta.url)).size > 10_000);
    assert.match(npcData, /portrait: "assets\/art\/portraits\/bartender-joe\.webp"/);
    assert.match(npcList, /npc\.portrait/);
    assert.match(callInterface, /npc\.portrait/);
});

test('Mary portrait is available in dossier and call interfaces', () => {
    assert.ok(statSync(new URL('../assets/art/portraits/housekeeper-mary.webp', import.meta.url)).size > 10_000);
    assert.match(npcData, /portrait: "assets\/art\/portraits\/housekeeper-mary\.webp"/);
    assert.match(npcList, /npc\.portrait/);
    assert.match(callInterface, /npc\.portrait/);
});

test('Sergeant Mills portrait is available in dossier and call interfaces', () => {
    assert.ok(statSync(new URL('../assets/art/portraits/sergeant-mills.webp', import.meta.url)).size > 10_000);
    assert.match(npcData, /portrait: "assets\/art\/portraits\/sergeant-mills\.webp"/);
    assert.match(npcList, /npc\.portrait/);
    assert.match(callInterface, /npc\.portrait/);
});

test('Elias Vaughn portrait is available in dossier and call interfaces', () => {
    assert.ok(statSync(new URL('../assets/art/portraits/elias-vaughn.webp', import.meta.url)).size > 10_000);
    assert.match(npcData, /portrait: "assets\/art\/portraits\/elias-vaughn\.webp"/);
    assert.match(npcList, /npc\.portrait/);
    assert.match(callInterface, /npc\.portrait/);
});

test('hanging up during ringing cannot reconnect a cancelled call', () => {
    const timers = new Map();
    let nextTimer = 1;
    const context = {
        getNPCById: id => ({ id, name: id, icon: '📞' }),
        events: { emit() {} },
        setTimeout(callback) { const id = nextTimer++; timers.set(id, callback); return id; },
        clearTimeout(id) { timers.delete(id); }
    };
    const CallInterface = runInNewContext(`${callInterface}\nCallInterface`, context);
    CallInterface.prototype._createCallModal = function () {};
    CallInterface.prototype._showCallingScreen = function () {};
    CallInterface.prototype._playRingtone = function () {};
    let connections = 0;
    CallInterface.prototype._connectCall = function () { connections++; };
    const call = new CallInterface();
    call.startCall('porter');
    assert.equal(timers.size, 1);
    const staleConnection = [...timers.values()][0];
    call.endCall();
    assert.equal(timers.size, 0);
    staleConnection();
    assert.equal(connections, 0);
    call.startCall('bartender');
    [...timers.values()][0]();
    assert.equal(connections, 1);
});
