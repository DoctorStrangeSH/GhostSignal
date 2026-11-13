/**
 * SaveController
 * Builds the serializable game snapshot and persists it through StorageManager.
 * Cloud synchronization remains owned by SyncManager.
 */
class SaveController {
    constructor(app, storageManager) {
        this.app = app;
        this.storage = storageManager;
    }

    saveProgress() {
        if (!this.app.progress) return false;
        this.storage.saveProgress(this.app.progress);
        return true;
    }

    quickSave() {
        const app = this.app;
        if (!app.progress) return false;

        app.progress.gameTime = app.gameTime?.toJSON();
        app.progress.locationData = app.locationManager?.toJSON();
        app.progress.inventoryData = app.inventory?.toJSON();
        app.progress.caseData = app.caseManager?.toJSON();
        app.progress.npcData = app.npcManager?.toJSON();
        app.progress.boardData = app.investigationBoard?.toJSON();
        app.progress.notesData = app.notesManager?.toJSON();
        app.progress.trackerData = app.progressTracker?.toJSON();
        app.progress.reputationData = app.reputationSystem?.toJSON();
        app.progress.stakeoutData = app.stakeoutSystem?.toJSON();
        app.progress.chainData = app.evidenceChainSystem?.toJSON();
        app.progress.weatherData = app.weatherSystem?.toJSON();
        app.progress.interrogationData = app.interrogationSystem?.toJSON();
        app.progress.npcMemoryData = app.npcMemoryService?.toJSON();
        app.progress.npcSocialData = app.npcSocialNetwork?.toJSON();
        app.progress.npcRelationshipData = app.npcRelationshipService?.toJSON();

        return this.saveProgress();
    }
}
