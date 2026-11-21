class SyncManager {
    constructor(authManager, cloudStorage, storageManager, writesBlocked = () => false) {
        this.authManager = authManager;
        this.cloudStorage = cloudStorage;
        this.storage = storageManager;
        this.writesBlocked = writesBlocked;
        this.syncInProgress = false;
        this.hasConflict = Boolean(this.storage.get('cloud_conflict_backup'));
        this._bindEvents();
    }

    _isSaveCompatible(data) {
        if (typeof SaveMigrationManager === 'undefined' || typeof SAVE_SCHEMA_VERSION === 'undefined') return true;
        return new SaveMigrationManager(SAVE_SCHEMA_VERSION).migrate(data).ok;
    }

    _bindEvents() {
        events.on('auth:login', () => {
            this.syncFromCloud();
        });

        events.on('auth:logout', () => {
            console.log('💾 Работаем локально');
        });
    }

    _readConflict() {
        const stored = this.storage.get('cloud_conflict_backup');
        if (!stored) return null;
        if (stored.version === 1 && stored.cloud) return stored;
        return { version: 1, reason: 'legacy_conflict', createdAt: null, local: null, cloud: stored };
    }

    _saveConflict(localData, cloudData, reason = 'different_progress') {
        const existing = this._readConflict();
        if (existing) {
            this.hasConflict = true;
            return existing;
        }
        let conflict;
        try {
            conflict = {
                version: 1, reason, createdAt: Date.now(),
                local: localData ? JSON.parse(JSON.stringify(localData)) : null,
                cloud: JSON.parse(JSON.stringify(cloudData))
            };
        } catch (error) { return null; }
        if (!this.storage.set('cloud_conflict_backup', conflict)) return null;
        this.hasConflict = true;
        return conflict;
    }

    getConflictDetails() {
        const conflict = this._readConflict();
        if (!conflict) return null;
        const describe = data => data ? ({
            activeCase: data.activeCase || null,
            solvedCases: Array.isArray(data.solvedCases) ? data.solvedCases.length : 0,
            updatedAt: Number(data._sync?.updatedAt) || null,
            revision: Number(data._sync?.revision) || null,
            schemaVersion: Number.isInteger(data.schemaVersion) ? data.schemaVersion : 0
        }) : null;
        return {
            reason: conflict.reason, createdAt: conflict.createdAt,
            local: describe(conflict.local || this.storage.loadProgress()),
            cloud: describe(conflict.cloud)
        };
    }

    // Синхронизация с сохранением обеих версий при конфликте.
    async syncFromCloud() {
        if (this.syncInProgress || this.writesBlocked()) return;
        const existingLocal = this.storage.loadProgress();
        if (existingLocal && !this._isSaveCompatible(existingLocal)) {
            console.warn('Cloud sync paused: local save requires an unavailable migration.');
            return;
        }
        this.syncInProgress = true;

        try {
            const cloudData = await this.cloudStorage.loadFromCloud();
            const localData = this.storage.loadProgress();

            if (cloudData && !this._isSaveCompatible(cloudData)) {
                const conflict = this._saveConflict(localData, cloudData, 'unsupported_cloud_schema');
                if (conflict) events.emit('sync:conflict', this.getConflictDetails());
                return;
            }

            if (cloudData) {
                if (!localData) {
                    const saved = this.storage.saveProgress(cloudData);
                    if (saved) {
                        events.emit('notification:show', {
                            message: 'Прогресс загружен из облака', type: 'success', duration: 3000
                        });
                        events.emit('sync:reload_needed');
                    }
                } else if (this._areSavesDifferent(localData, cloudData)) {
                    const reason = this._isCloudNewer(cloudData, localData) ? 'cloud_newer' : 'local_newer_or_diverged';
                    const conflict = this._saveConflict(localData, cloudData, reason);
                    if (conflict) events.emit('sync:conflict', this.getConflictDetails());
                }
            } else if (localData && !this.hasConflict) {
                await this.cloudStorage.saveToCloud(localData);
            }
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    // Сохранить локально; облако обновляется только если нет неразрешённого конфликта.
    async saveEverywhere(progressData) {
        if (this.writesBlocked() || !this._isSaveCompatible(progressData)) return false;
        // Never upload a snapshot that failed to persist locally. Otherwise a
        // quota/storage error could still publish stale or missing local data.
        const localSaved = this.storage.saveProgress(progressData);
        if (localSaved !== true) return false;
        const localData = this.storage.loadProgress();
        if (!localData) return false;

        if (this.hasConflict || this.storage.get('cloud_conflict_backup')) {
            return false;
        }

        if (this.authManager.isUserLoggedIn()) {
            return this.cloudStorage.saveToCloud(localData);
        }
        return true;
    }

    _areSavesDifferent(first, second) {
        const normalize = data => { const copy = { ...data }; delete copy._sync; return JSON.stringify(copy); };
        return normalize(first) !== normalize(second);
    }

    // Пользователь явно выбирает, какую версию оставить.
    async resolveConflict(strategy) {
        if (this.writesBlocked()) return false;
        const conflict = this._readConflict();
        if (!conflict) return false;
        const cloudBackup = conflict.cloud;
        if (!this._isSaveCompatible(cloudBackup)) return false;
        if (strategy === 'local' && !this._isSaveCompatible(this.storage.loadProgress())) return false;

        if (strategy === 'cloud') {
            const saved = this.storage.saveProgress(cloudBackup);
            if (!saved) return false;
            this.storage.remove('cloud_conflict_backup');
            this.hasConflict = false;
            events.emit('sync:reload_needed');
            return true;
        }

        if (strategy === 'local') {
            const localData = this.storage.loadProgress();
            const saved = await this.cloudStorage.saveToCloud(localData);
            if (!saved) return false;

            this.storage.remove('cloud_conflict_backup');
            this.hasConflict = false;
            return true;
        }

        return false;
    }

    _isCloudNewer(cloudData, localData) {
        const cloudUpdatedAt = Number(cloudData?._sync?.updatedAt) || 0;
        const localUpdatedAt = Number(localData?._sync?.updatedAt) || 0;

        if (cloudUpdatedAt !== localUpdatedAt) {
            if (!cloudUpdatedAt) return false;
            if (!localUpdatedAt) return true;
            return cloudUpdatedAt > localUpdatedAt;
        }

        const cloudSolved = cloudData?.solvedCases?.length || 0;
        const localSolved = localData?.solvedCases?.length || 0;
        return cloudSolved > localSolved;
    }
}
