class SyncManager {
    constructor(authManager, cloudStorage, storageManager) {
        this.authManager = authManager;
        this.cloudStorage = cloudStorage;
        this.storage = storageManager;
        this.syncInProgress = false;
        this.hasConflict = Boolean(this.storage.get('cloud_conflict_backup'));

        this._bindEvents();
    }

    _bindEvents() {
        events.on('auth:login', () => {
            this.syncFromCloud();
        });

        events.on('auth:logout', () => {
            console.log('💾 Работаем локально');
        });
    }

    // Синхронизация с сохранением обеих версий при конфликте.
    async syncFromCloud() {
        if (this.syncInProgress) return;
        this.syncInProgress = true;

        try {
            const cloudData = await this.cloudStorage.loadFromCloud();
            const localData = this.storage.loadProgress();

            if (cloudData) {
                if (!localData || this._isCloudNewer(cloudData, localData)) {
                    // Не перезаписываем активное расследование автоматически.
                    if (localData?.activeCase) {
                        this.storage.set('cloud_conflict_backup', cloudData);
                        this.hasConflict = true;
                        events.emit('sync:conflict', { activeCase: localData.activeCase });
                    } else {
                        this.storage.saveProgress(cloudData);
                        events.emit('notification:show', {
                            message: 'Прогресс загружен из облака',
                            type: 'success',
                            duration: 3000
                        });
                        events.emit('sync:reload_needed');
                    }
                } else if (!this.hasConflict) {
                    await this.cloudStorage.saveToCloud(localData);
                    console.log('💾→☁️ Данные отправлены в облако');
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
        this.storage.saveProgress(progressData);
        const localData = this.storage.loadProgress();

        if (this.hasConflict || this.storage.get('cloud_conflict_backup')) {
            return false;
        }

        if (this.authManager.isUserLoggedIn()) {
            return this.cloudStorage.saveToCloud(localData);
        }
        return true;
    }

    // Пользователь явно выбирает, какую версию оставить.
    async resolveConflict(strategy) {
        const cloudBackup = this.storage.get('cloud_conflict_backup');
        if (!cloudBackup) return false;

        if (strategy === 'cloud') {
            this.storage.saveProgress(cloudBackup);
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
