class SyncManager {
    constructor(authManager, cloudStorage, storageManager) {
        this.authManager = authManager;
        this.cloudStorage = cloudStorage;
        this.storage = storageManager;
        this.syncInProgress = false;
        
        this._bindEvents();
    }
    
    _bindEvents() {
        // При входе — синхронизируем
        events.on('auth:login', () => {
            this.syncFromCloud();
        });
        
        // При выходе — сохраняем локально
        events.on('auth:logout', () => {
            console.log('💾 Работаем локально');
        });
    }
    
    // Синхронизация: облако → локально
    async syncFromCloud() {
        if (this.syncInProgress) return;
        this.syncInProgress = true;
        
        try {
            const cloudData = await this.cloudStorage.loadFromCloud();
            
            if (cloudData) {
                const localData = this.storage.loadProgress();
                
                // Определяем, какие данные новее
                if (!localData || this._isCloudNewer(cloudData, localData)) {
                    // Облачные данные новее — загружаем
                    this.storage.saveProgress(cloudData);
                    console.log('☁️→💾 Данные синхронизированы из облака');
                    
                    events.emit('notification:show', {
                        message: 'Прогресс загружен из облака',
                        type: 'success',
                        duration: 3000
                    });
                    
                    // Перезагружаем игру
                    events.emit('sync:reload_needed');
                } else {
                    // Локальные данные новее — отправляем в облако
                    await this.cloudStorage.saveToCloud(localData);
                    console.log('💾→☁️ Данные отправлены в облако');
                }
            } else {
                // В облаке пусто — отправляем локальные
                const localData = this.storage.loadProgress();
                if (localData) {
                    await this.cloudStorage.saveToCloud(localData);
                }
            }
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
        }
        
        this.syncInProgress = false;
    }
    
    // Сохранить и локально и в облако
    async saveEverywhere(progressData) {
        // Локально
        this.storage.saveProgress(progressData);
        
        // В облако (если онлайн и авторизован)
        if (this.authManager.isUserLoggedIn()) {
            await this.cloudStorage.saveToCloud(progressData);
        }
    }
    
    _isCloudNewer(cloudData, localData) {
        // Простое сравнение: если в облаке больше раскрытых дел
        const cloudSolved = cloudData?.solvedCases?.length || 0;
        const localSolved = localData?.solvedCases?.length || 0;
        
        return cloudSolved > localSolved;
    }
}