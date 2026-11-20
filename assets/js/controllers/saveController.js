/**
 * SaveController
 * Builds the serializable game snapshot and persists it through StorageManager.
 * Cloud synchronization remains owned by SyncManager.
 */
class SaveController {
    constructor(app, storageManager, eventBus = typeof events !== 'undefined' ? events : null) {
        this.app = app;
        this.storage = storageManager;
        this.eventBus = eventBus;
        this.saveFailed = false;
    }

    saveProgress() {
        if (!this.app.progress || this.app.saveBlocked) return false;
        this.app.progress.schemaVersion = typeof SAVE_SCHEMA_VERSION !== 'undefined' ? SAVE_SCHEMA_VERSION : 1;
        let saved = false;
        try {
            saved = this.storage.saveProgress(this.app.progress) === true;
        } catch (error) {
            console.error('Unable to save investigation:', error);
        }
        if (!saved && !this.saveFailed) {
            this.eventBus?.emit('notification:show', {
                message: '⚠️ Прогресс не сохранён! Проверьте доступное место и настройки браузера. Не закрывайте вкладку.',
                type: 'error', duration: 10000
            });
        } else if (saved && this.saveFailed) {
            this.eventBus?.emit('notification:show', {
                message: '✅ Сохранение восстановлено. Прогресс записан.',
                type: 'success', duration: 5000
            });
        }
        this.saveFailed = !saved;
        return saved;
    }

    quickSave() {
        const app = this.app;
        if (!app.progress || app.saveBlocked) return false;

        // Build the complete snapshot off to the side. If any serializer fails,
        // the last known-good in-memory progress and persisted save stay intact.
        let snapshot;
        try {
            snapshot = {
                gameTime: app.gameTime?.toJSON(),
                locationData: app.locationManager?.toJSON(),
                inventoryData: app.inventory?.toJSON(),
                caseData: app.caseManager?.toJSON(),
                npcData: app.npcManager?.toJSON(),
                boardData: app.investigationBoard?.toJSON(),
                notesData: app.notesManager?.toJSON(),
                trackerData: app.progressTracker?.toJSON(),
                achievementData: app.achievementSystem?.toJSON(),
                reputationData: app.reputationSystem?.toJSON(),
                stakeoutData: app.stakeoutSystem?.toJSON(),
                chainData: app.evidenceChainSystem?.toJSON(),
                weatherData: app.weatherSystem?.toJSON(),
                interrogationData: app.interrogationSystem?.toJSON(),
                npcMemoryData: app.npcMemoryService?.toJSON(),
                npcSocialData: app.npcSocialNetwork?.toJSON(),
                npcRelationshipData: app.npcRelationshipService?.toJSON(),
                dialogueData: app.dialogueEngine?.toJSON()
                    ? { ...app.dialogueEngine.toJSON(), caseId: app.progress.activeCase || null }
                    : null
            };
        } catch (error) {
            console.error('Unable to build investigation snapshot:', error);
            this.eventBus?.emit('notification:show', {
                message: '⚠️ Не удалось подготовить сохранение. Предыдущая копия не изменена.',
                type: 'error', duration: 10000
            });
            return false;
        }

        Object.assign(app.progress, snapshot);
        return this.saveProgress();
    }
}
