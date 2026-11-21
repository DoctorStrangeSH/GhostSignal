import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function createLocationManager(location) {
    const context = vm.createContext({
        window: { app: null },
        events: { emit() {} },
        getLocationById: (id) => id === location.id ? location : null,
        getSubLocations: () => []
    });
    const source = read('assets/js/systems/locationManager.js');
    const LocationManager = vm.runInContext(`${source}\nLocationManager;`, context);
    return new LocationManager(null);
}

test('revealed scene objects are added once, survive save/load, and reset between cases', () => {
    const location = { id: 'hotel_room_304', defaultItems: ['mirror', 'wardrobe'] };
    const manager = createLocationManager(location);

    assert.deepEqual(Array.from(manager.getLocationItems(location.id)), ['mirror', 'wardrobe']);
    assert.equal(manager.revealObject(location.id, 'wall_safe'), true);
    assert.equal(manager.revealObject(location.id, 'wall_safe'), false);
    assert.deepEqual(Array.from(manager.getLocationItems(location.id)), ['mirror', 'wardrobe', 'wall_safe']);

    const restored = manager.constructor.fromJSON(manager.toJSON(), null);
    assert.deepEqual(Array.from(restored.getLocationItems(location.id)), ['mirror', 'wardrobe', 'wall_safe']);

    restored.beginCase({ id: 'case-002' });
    assert.deepEqual(Array.from(restored.getLocationItems(location.id)), ['mirror', 'wardrobe']);
});

test('normal app bootstrap restores revealed objects from saved location data', () => {
    const app = read('assets/js/core/app.js');
    assert.match(app, /revealedObjectsByLocation = new Map\(/);
    assert.match(app, /Object\.entries\(s\.revealedObjectsByLocation \|\| \{\}\)/);
    assert.match(app, /locationId,\s*new Set\(Array\.isArray\(objectIds\) \? objectIds : \[\]\)/);
});

test('case one hides the wall safe until the mirror is examined', () => {
    const locations = read('assets/data/cases/case-001/locations.js');
    const objects = read('assets/data/cases/case-001/objects.js');
    const room = locations.match(/hotel_room_304:\s*\{([\s\S]*?)\n\s{4}\},/);

    assert.ok(room, 'hotel room 304 must exist');
    assert.match(room[1], /defaultItems:\s*\[[^\]]*["']mirror["'][^\]]*\]/);
    assert.doesNotMatch(room[1], /["']wall_safe["']/);
    assert.match(objects, /mirror:\s*\{[\s\S]*?revealsObject:\s*["']wall_safe["']/);
    assert.match(objects, /wall_safe:\s*\{[\s\S]*?condition:\s*["']hasItem:small_key["'][\s\S]*?spawnsItem:\s*["']victim_diary["']/);
});

test('object interaction applies the reveal and refreshes the current scene', () => {
    const controller = read('assets/js/controllers/eventController.js');
    assert.match(controller, /obj\.interactions\?\.examine\?\.revealsObject/);
    assert.match(controller, /app\.locationManager\?\.revealObject\(data\.locationId, revealedObjectId\)/);
    assert.match(controller, /app\.sceneRenderer\.renderLocation\(data\.locationId\)/);
    assert.match(controller, /on\('inventory:add',[\s\S]*?app\.inventory\.addItem\(itemId\)/);
    assert.match(controller, /on\('insight:add',[\s\S]*?app\.inventory\.addInsight\(insightId\)/);

    const minigameManager = read('assets/js/minigames/minigameManager.js');
    assert.match(minigameManager, /bootstrap\.Modal\.getOrCreateInstance\(document\.getElementById\('universal-modal'\)\)/);
    assert.doesNotMatch(minigameManager, /new bootstrap\.Modal\(document\.getElementById\('universal-modal'\)\)/);
});
