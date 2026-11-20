import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function createSyncManager({ local = null, cloud = null, writesBlocked = () => false, cloudSaveResult = true, localSaveResult = true } = {}) {
    const values = {};
    const calls = { cloudLoads: 0, cloudSaves: 0, localSaves: 0 };
    const storage = {
        get(key) { return values[key] ?? null; },
        set(key, value) { values[key] = value; return true; },
        remove(key) { delete values[key]; },
        loadProgress() { return local; },
        saveProgress(value) { calls.localSaves++; if (!localSaveResult) return false; local = value; return true; }
    };
    const events = { on() {}, emit() {} };
    const auth = { isUserLoggedIn: () => true };
    const cloudStorage = {
        async loadFromCloud() { calls.cloudLoads++; return cloud; },
        async saveToCloud(value) { calls.cloudSaves++; calls.lastCloudSave = value; return cloudSaveResult; }
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
    assert.equal(JSON.stringify(values.cloud_conflict_backup.cloud), JSON.stringify(cloud));
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


test("different local and cloud saves are preserved together even when local has no active case", async () => {
    const local = { schemaVersion: 1, activeCase: null, solvedCases: ["case-a"], _sync: { revision: 2, updatedAt: 100 } };
    const cloud = { schemaVersion: 1, activeCase: null, solvedCases: ["case-b"], _sync: { revision: 3, updatedAt: 200 } };
    const { manager, calls, values } = createSyncManager({ local, cloud });
    await manager.syncFromCloud();
    assert.equal(calls.localSaves, 0);
    assert.equal(calls.cloudSaves, 0);
    assert.equal(JSON.stringify(values.cloud_conflict_backup.local), JSON.stringify(local));
    assert.equal(JSON.stringify(values.cloud_conflict_backup.cloud), JSON.stringify(cloud));
    assert.equal(values.cloud_conflict_backup.version, 1);
    assert.equal(manager.hasConflict, true);
    assert.equal(manager.getConflictDetails().local.solvedCases, 1);
    assert.equal(manager.getConflictDetails().cloud.solvedCases, 1);
});

test("failed cloud upload keeps both save versions and the conflict unresolved", async () => {
    const local = { schemaVersion: 1, activeCase: "case-local" };
    const cloud = { schemaVersion: 1, activeCase: "case-cloud" };
    const { manager, values } = createSyncManager({ local, cloud, cloudSaveResult: false });
    await manager.syncFromCloud();
    assert.equal(await manager.resolveConflict("local"), false);
    assert.equal(manager.hasConflict, true);
    assert.equal(JSON.stringify(values.cloud_conflict_backup.local), JSON.stringify(local));
    assert.equal(JSON.stringify(values.cloud_conflict_backup.cloud), JSON.stringify(cloud));
});

test("failed local restore does not clear the conflict backup", async () => {
    const local = { schemaVersion: 1, activeCase: "case-local" };
    const cloud = { schemaVersion: 1, activeCase: "case-cloud" };
    const { manager, values } = createSyncManager({ local, cloud, localSaveResult: false });
    await manager.syncFromCloud();
    assert.equal(await manager.resolveConflict("cloud"), false);
    assert.equal(manager.hasConflict, true);
    assert.equal(JSON.stringify(values.cloud_conflict_backup.local), JSON.stringify(local));
    assert.equal(JSON.stringify(values.cloud_conflict_backup.cloud), JSON.stringify(cloud));
});

test("legacy cloud-only conflict backups remain resolvable", async () => {
    const { manager, values } = createSyncManager({ local: { schemaVersion: 1 } });
    values.cloud_conflict_backup = { schemaVersion: 1, activeCase: "legacy-cloud" };
    manager.hasConflict = true;
    assert.equal(manager.getConflictDetails().cloud.activeCase, "legacy-cloud");
    assert.equal(await manager.resolveConflict("cloud"), true);
    assert.equal(manager.hasConflict, false);
});


test("an existing unresolved conflict is never replaced by a later cloud snapshot", async () => {
    const local = { schemaVersion: 1, activeCase: "case-local" };
    const firstCloud = { schemaVersion: 1, activeCase: "case-cloud-first" };
    const { manager, values } = createSyncManager({ local, cloud: firstCloud });
    await manager.syncFromCloud();
    const preserved = values.cloud_conflict_backup;
    manager.cloudStorage.loadFromCloud = async () => ({ schemaVersion: 1, activeCase: "case-cloud-second" });
    await manager.syncFromCloud();
    assert.deepEqual(values.cloud_conflict_backup, preserved);
});

test("saveEverywhere does not upload when the local storage write fails", async () => {
    const { manager, calls } = createSyncManager({
        local: null,
        localSaveResult: false
    });
    const result = await manager.saveEverywhere({ schemaVersion: 1, activeCase: "case-001" });
    assert.equal(result, false);
    assert.equal(calls.localSaves, 1);
    assert.equal(calls.cloudSaves, 0, "cloud must never receive a snapshot that was not persisted locally");
});
