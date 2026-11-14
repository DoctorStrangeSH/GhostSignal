import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadSaveController(globals = {}) {
    const context = vm.createContext({ console, ...globals });
    const source = readFileSync(resolve(root, "assets/js/controllers/saveController.js"), "utf8");
    vm.runInContext(source + "\n;globalThis.__exported = SaveController;", context);
    return context.__exported;
}

test("SaveController captures every persistent system before saving", () => {
    const saved = [];
    const storage = { saveProgress(progress) { saved.push(structuredClone(progress)); return true; } };
    const serialize = key => ({ source: key });
    const app = {
        progress: { activeCase: "case-002" },
        gameTime: { toJSON: () => serialize("gameTime") },
        locationManager: { toJSON: () => serialize("locationData") },
        inventory: { toJSON: () => serialize("inventoryData") },
        caseManager: { toJSON: () => serialize("caseData") },
        npcManager: { toJSON: () => serialize("npcData") },
        investigationBoard: { toJSON: () => serialize("boardData") },
        notesManager: { toJSON: () => serialize("notesData") },
        progressTracker: { toJSON: () => serialize("trackerData") },
        reputationSystem: { toJSON: () => serialize("reputationData") },
        stakeoutSystem: { toJSON: () => serialize("stakeoutData") },
        evidenceChainSystem: { toJSON: () => serialize("chainData") },
        weatherSystem: { toJSON: () => serialize("weatherData") },
        interrogationSystem: { toJSON: () => serialize("interrogationData") },
        npcMemoryService: { toJSON: () => serialize("npcMemoryData") }
    };
    const SaveController = loadSaveController();
    const controller = new SaveController(app, storage);

    assert.equal(controller.quickSave(), true);
    assert.equal(saved.length, 1);
    for (const key of [
        "gameTime", "locationData", "inventoryData", "caseData", "npcData",
        "boardData", "notesData", "trackerData", "reputationData", "stakeoutData",
        "chainData", "weatherData", "interrogationData", "npcMemoryData"
    ]) {
        assert.deepEqual(saved[0][key], { source: key });
    }
    assert.equal(saved[0].activeCase, "case-002");
});

test("SaveController safely skips saves before progress is initialized", () => {
    let writes = 0;
    const storage = { saveProgress() { writes++; } };
    const app = { progress: null };
    const SaveController = loadSaveController();
    const controller = new SaveController(app, storage);

    assert.equal(controller.saveProgress(), false);
    assert.equal(controller.quickSave(), false);
    assert.equal(writes, 0);
});

test("SaveController can persist progress without rebuilding a full snapshot", () => {
    const progress = { activeCase: "case-001", solvedCases: [] };
    let saved = null;
    const storage = { saveProgress(value) { saved = value; return true; } };
    const app = { progress };
    const SaveController = loadSaveController();
    const controller = new SaveController(app, storage);

    assert.equal(controller.saveProgress(), true);
    assert.equal(saved, progress);
});

test("SaveController reports failed writes and does not claim a successful quick save", () => {
    const progress = { activeCase: "case-001" };
    let attempts = 0;
    const storage = {
        saveProgress() { attempts++; return false; }
    };
    const app = {
        progress,
        npcMemoryService: { toJSON() { return { cases: { "case-001": { witness: true } } }; } },
        npcSocialNetwork: { toJSON() { return { cases: { "case-001": { rumor: true } } }; } },
        npcRelationshipService: { toJSON() { return { cases: { "case-001": { trust: 42 } } }; } }
    };
    const controller = new (loadSaveController())(app, storage);

    assert.equal(controller.quickSave(), false);
    assert.equal(attempts, 1);
    assert.deepEqual(progress.npcMemoryData.cases["case-001"], { witness: true });
    assert.deepEqual(progress.npcSocialData.cases["case-001"], { rumor: true });
    assert.deepEqual(progress.npcRelationshipData.cases["case-001"], { trust: 42 });
    assert.equal(controller.saveProgress(), false);
    assert.equal(attempts, 2);
});

test("save errors notify the player once until storage recovers", () => {
    const notices = [];
    let writable = false;
    const storage = { saveProgress() { return writable; } };
    const bus = { emit(name, detail) { notices.push({ name, detail }); } };
    const controller = new (loadSaveController())({ progress: { activeCase: "case-001" } }, storage, bus);

    assert.equal(controller.saveProgress(), false);
    assert.equal(controller.saveProgress(), false);
    assert.equal(notices.length, 1);
    assert.equal(notices[0].name, "notification:show");
    assert.equal(notices[0].detail.type, "error");
    assert.match(notices[0].detail.message, /не сохранён/i);

    writable = true;
    assert.equal(controller.saveProgress(), true);
    assert.equal(notices.length, 2);
    assert.equal(notices[1].detail.type, "success");
    assert.equal(controller.saveProgress(), true);
    assert.equal(notices.length, 2);

    writable = false;
    assert.equal(controller.saveProgress(), false);
    assert.equal(notices.length, 3);
});

test("unexpected storage exceptions surface as a failed save without breaking the app", () => {
    const notices = [];
    const errors = [];
    const SaveController = loadSaveController({
        console: { error(...args) { errors.push(args); } }
    });
    const controller = new SaveController(
        { progress: { activeCase: "case-002" } },
        { saveProgress() { throw new Error("Storage unavailable"); } },
        { emit(name, detail) { notices.push({ name, detail }); } }
    );
    assert.equal(controller.saveProgress(), false);
    assert.equal(controller.saveProgress(), false);
    assert.equal(notices.length, 1);
    assert.equal(notices[0].detail.type, "error");
    assert.equal(errors.length, 2);
});
