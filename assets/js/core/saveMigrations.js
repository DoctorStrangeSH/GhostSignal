/**
 * SaveMigrationManager
 * Evolves persisted game data independently from the public game version.
 * Add a new migration for each future schemaVersion; never rewrite old saves in place.
 */
class SaveMigrationManager {
    constructor(currentVersion = 1) {
        this.currentVersion = currentVersion;
        this.migrations = new Map();
        this.register(1, save => ({
            ...save,
            schemaVersion: 1
        }));
    }

    register(targetVersion, migrate) {
        if (!Number.isInteger(targetVersion) || targetVersion < 1 || typeof migrate !== 'function') {
            throw new TypeError('A migration needs a positive integer version and a function.');
        }
        if (this.migrations.has(targetVersion)) {
            throw new Error('Save migration already registered for version ' + targetVersion);
        }
        this.migrations.set(targetVersion, migrate);
        return this;
    }

    createBackup(storage, input) {
        if (!storage || typeof storage.set !== 'function') return false;
        try {
            const data = JSON.parse(JSON.stringify(input));
            return storage.set('save_migration_backup', {
                createdAt: Date.now(),
                schemaVersion: Number.isInteger(data.schemaVersion) ? data.schemaVersion : 0,
                data
            }) === true;
        } catch (error) {
            return false;
        }
    }

    restoreBackup(storage) {
        if (!storage || typeof storage.get !== 'function' || typeof storage.saveProgress !== 'function') return false;
        const backup = storage.get('save_migration_backup');
        if (!backup || !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) return false;
        try {
            return storage.saveProgress(JSON.parse(JSON.stringify(backup.data))) === true;
        } catch (error) {
            return false;
        }
    }

    migrateWithBackup(input, storage, backupRequired = true) {
        const sourceVersion = input && Number.isInteger(input.schemaVersion) && input.schemaVersion >= 0
            ? input.schemaVersion : 0;
        const shouldBackup = backupRequired && sourceVersion < this.currentVersion;
        if (shouldBackup && !this.createBackup(storage, input)) {
            return {
                ok: false,
                reason: 'backup_failed',
                data: input,
                fromVersion: sourceVersion,
                toVersion: sourceVersion,
                applied: [],
                backupCreated: false
            };
        }
        return { ...this.migrate(input), backupCreated: shouldBackup };
    }

    migrate(input) {
        const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
        let data;
        try {
            data = JSON.parse(JSON.stringify(source));
        } catch (error) {
            return { ok: false, reason: 'invalid_save', data: source, fromVersion: null, toVersion: this.currentVersion, applied: [] };
        }

        const fromVersion = Number.isInteger(data.schemaVersion) && data.schemaVersion >= 0
            ? data.schemaVersion : 0;
        if (fromVersion > this.currentVersion) {
            return { ok: false, reason: 'newer_schema', data, fromVersion, toVersion: fromVersion, applied: [] };
        }

        const applied = [];
        let version = fromVersion;
        try {
            while (version < this.currentVersion) {
                const nextVersion = version + 1;
                const migration = this.migrations.get(nextVersion);
                if (!migration) {
                    return { ok: false, reason: 'missing_migration', data, fromVersion, toVersion: version, applied };
                }
                const migrated = migration(data);
                if (!migrated || typeof migrated !== 'object' || Array.isArray(migrated)) {
                    throw new TypeError('Migration ' + nextVersion + ' did not return a save object.');
                }
                data = migrated;
                data.schemaVersion = nextVersion;
                applied.push(nextVersion);
                version = nextVersion;
            }
        } catch (error) {
            return { ok: false, reason: 'migration_failed', error, data: source, fromVersion, toVersion: fromVersion, applied: [] };
        }

        return { ok: true, reason: applied.length ? 'migrated' : 'current', data, fromVersion, toVersion: version, applied };
    }
}

const SAVE_SCHEMA_VERSION = 1;
