import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function createSyncManager({ local = null, cloud = null, writesBlocked = () => false } = {}) {
    const values = {};
    const calls = { cloudLoads: 0, cloudSaves: 0, localSaves: 0 };
    const storage = {
        get(key) { return values[key] ?? null; },
        set(key, value) { values[key] = value; return true; },
        remove(key) { delete values[key]; },
        loadProgress() { return local; },
        saveProgress(value) { calls.localSaves++; local = value; return true; }
    };
    const events = { on() {}, emit() {} };
    const auth = { isUserLoggedIn: () => true };
    const cloudStorage = {
        async loadFromCloud() { calls.cloudLoads++; return cloud; },
        async saveToCloud() { calls.cloudSaves++; return true; }
    };
    const context = vm.createContext({ console, events, SAVE_SCHEMA_VERSION: 1 });
    const migrationSource = readFileSync(resolve(root, "assets/js/core/saveMigrations.js"), "utf8");
    const syncSource = readFileSync(resolve(root, "assets/js/firebase/syncManager.js"), "utf8");
    vm.runInContext(migrationSource + "\n" + syncSource + "\nglobalThis.SyncManagerExport = SyncManager;", context);
    return { manager: new context.SyncManagerExport(auth, cloudStorage, storage, writesBlocked), calls, values };
}

test("cloud sync pauses when the local save requires an unavailable migration", async () => {
    const { manager, calls } = createSyncManager({ local: { schemaVersion: 3, futureData: true } });
    await manager.syncFromCloud();
    assert.equal(calls.cloudLoads, 0);
    assert.equal(calls.cloudSaves, 0);
    assert.equal(calls.localSaves, 0);
});

test("unsupported cloud saves are preserved as conflicts, not written over local progress", async () => {
    const local = { schemaVersion: 1, activeCase: "case-001" };
    const cloud = { schemaVersion: 3, futureData: { clue: "preserve" } };
    const { manager, calls, values } = createSyncManager({ local, cloud });
    await manager.syncFromCloud();
    assert.equal(calls.localSaves, 0);
    assert.equal(calls.cloudSaves, 0);
    assert.deepEqual(values.cloud_conflict_backup, cloud);
    assert.equal(manager.hasConflict, true);
});

test("saveEverywhere refuses to upload a save with an unsupported schema", async () => {
    const { manager, calls } = createSyncManager();
    const result = await manager.saveEverywhere({ schemaVersion: 5, futureData: true });
    assert.equal(result, false);
    assert.equal(calls.localSaves, 0);
    assert.equal(calls.cloudSaves, 0);
});


test("cloud sync and conflict resolution stay disabled when backup creation blocks writes", async () => {
    const { manager, calls } = createSyncManager({
        local: { schemaVersion: 0, activeCase: "case-001" },
        cloud: { schemaVersion: 1, activeCase: null },
        writesBlocked: () => true
    });
    await manager.syncFromCloud();
    assert.equal(calls.cloudLoads, 0);
    assert.equal(calls.cloudSaves, 0);
    assert.equal(calls.localSaves, 0);
    assert.equal(await manager.saveEverywhere({ schemaVersion: 1 }), false);
    assert.equal(await manager.resolveConflict("cloud"), false);
});
