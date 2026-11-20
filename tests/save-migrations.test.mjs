import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadManager() {
    const context = vm.createContext({});
    const source = readFileSync(resolve(root, "assets/js/core/saveMigrations.js"), "utf8");
    vm.runInContext(source + "\n;globalThis.__Manager = SaveMigrationManager; globalThis.__VERSION = SAVE_SCHEMA_VERSION;", context);
    return { Manager: context.__Manager, version: context.__VERSION };
}

test("legacy saves migrate to the current schema without losing gameplay data", () => {
    const { Manager, version } = loadManager();
    const legacy = { solvedCases: ["case-001"], activeCase: "case-002", customExtension: { flag: true } };
    const result = new Manager(version).migrate(legacy);
    assert.equal(result.ok, true);
    assert.equal(result.fromVersion, 0);
    assert.equal(result.toVersion, 1);
    assert.deepEqual(Array.from(result.applied), [1]);
    assert.equal(result.data.schemaVersion, 1);
    assert.deepEqual(Array.from(result.data.solvedCases), ["case-001"]);
    assert.equal(result.data.customExtension.flag, true);
    assert.equal(legacy.schemaVersion, undefined, "migration must not mutate the original save");
});

test("migrating an already current save is idempotent", () => {
    const { Manager, version } = loadManager();
    const manager = new Manager(version);
    const first = manager.migrate({ schemaVersion: version, solvedCases: ["case-001"] });
    const second = manager.migrate(first.data);
    assert.equal(first.ok, true);
    assert.equal(first.reason, "current");
    assert.equal(second.ok, true);
    assert.equal(second.reason, "current");
    assert.deepEqual(Array.from(second.applied), []);
    assert.deepEqual(JSON.parse(JSON.stringify(second.data)), JSON.parse(JSON.stringify(first.data)));
});

test("future save schemas are preserved and never downgraded", () => {
    const { Manager, version } = loadManager();
    const future = { schemaVersion: version + 2, solvedCases: ["case-future"], newSystemData: { value: 42 } };
    const result = new Manager(version).migrate(future);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "newer_schema");
    assert.equal(result.data.schemaVersion, version + 2);
    assert.equal(result.data.newSystemData.value, 42);
});

test("missing intermediate migrations fail safely without partial writes", () => {
    const { Manager } = loadManager();
    const manager = new Manager(3);
    manager.register(3, save => ({ ...save, schemaVersion: 3 }));
    const source = { solvedCases: ["case-001"] };
    const result = manager.migrate(source);
    assert.equal(result.ok, false);
    assert.equal(result.reason, "missing_migration");
    assert.equal(result.toVersion, 1);
    assert.equal(source.schemaVersion, undefined);
});

test("future versions can be added as isolated sequential migrations", () => {
    const { Manager } = loadManager();
    const manager = new Manager(3);
    manager.register(2, save => ({ ...save, newFeatureData: { enabled: false } }));
    manager.register(3, save => ({ ...save, newFeatureData: { ...save.newFeatureData, enabled: true } }));
    const result = manager.migrate({ schemaVersion: 1, solvedCases: ["case-002"] });
    assert.equal(result.ok, true);
    assert.deepEqual(Array.from(result.applied), [2, 3]);
    assert.equal(result.data.newFeatureData.enabled, true);
    assert.equal(result.data.schemaVersion, 3);
});


test("migration backup preserves the exact legacy snapshot before conversion", () => {
    const { Manager, version } = loadManager();
    const original = { solvedCases: ["case-001"], activeCase: "case-002", extensionData: { keep: true } };
    let stored = null;
    const storage = { set(key, value) { assert.equal(key, "save_migration_backup"); stored = value; return true; } };
    const manager = new Manager(version);
    assert.equal(manager.createBackup(storage, original), true);
    const migrated = manager.migrate(original);
    assert.equal(migrated.ok, true);
    assert.equal(stored.schemaVersion, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(stored.data)), original);
    assert.equal(original.schemaVersion, undefined);
});

test("migration backup failure is reported and can block applying a migration", () => {
    const { Manager, version } = loadManager();
    const manager = new Manager(version);
    const original = { solvedCases: ["case-001"] };
    const storage = { set() { return false; } };
    assert.equal(manager.createBackup(storage, original), false);
    assert.equal(original.schemaVersion, undefined);
});

test("latest migration backup can restore the previous save without mutating the backup", () => {
    const { Manager } = loadManager();
    const original = { schemaVersion: 0, activeCase: "case-001", customData: { note: "keep" } };
    const backup = { schemaVersion: 0, createdAt: 123, data: original };
    let restored = null;
    const storage = {
        get(key) { assert.equal(key, "save_migration_backup"); return backup; },
        saveProgress(data) { restored = data; return true; }
    };
    assert.equal(new Manager(1).restoreBackup(storage), true);
    assert.deepEqual(JSON.parse(JSON.stringify(restored)), original);
    assert.deepEqual(backup.data, original);
});

test("restore refuses missing or malformed backups", () => {
    const { Manager } = loadManager();
    const storage = { get() { return { data: [] }; }, saveProgress() { throw new Error("must not write"); } };
    assert.equal(new Manager(1).restoreBackup(storage), false);
});


test("migrateWithBackup refuses to run transformations when the backup cannot be stored", () => {
    const { Manager } = loadManager();
    const manager = new Manager(2);
    let migrationCalls = 0;
    manager.register(2, save => { migrationCalls++; return { ...save, migrated: true }; });
    const original = { schemaVersion: 1, activeCase: "case-001" };
    const result = manager.migrateWithBackup(original, { set() { return false; } });
    assert.equal(result.ok, false);
    assert.equal(result.reason, "backup_failed");
    assert.equal(result.backupCreated, false);
    assert.equal(migrationCalls, 0);
    assert.deepEqual(original, { schemaVersion: 1, activeCase: "case-001" });
});

test("migrateWithBackup stores the source snapshot before applying migrations", () => {
    const { Manager } = loadManager();
    const manager = new Manager(2);
    const order = [];
    manager.register(2, save => { order.push("migration"); return { ...save, upgraded: true }; });
    const storage = { set(key, value) { order.push("backup"); this.backup = value; return true; } };
    const result = manager.migrateWithBackup({ schemaVersion: 1, activeCase: "case-002" }, storage);
    assert.equal(result.ok, true);
    assert.equal(result.backupCreated, true);
    assert.deepEqual(order, ["backup", "migration"]);
    assert.equal(storage.backup.data.schemaVersion, 1);
    assert.equal(result.data.schemaVersion, 2);
});
