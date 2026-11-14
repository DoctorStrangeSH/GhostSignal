class StorageManager {
    constructor() {
        this.prefix = 'detective_archive_';
        this.version = CONFIG.version;
        this.versionMismatch = false;
        this.savedVersion = null;
        this._checkVersion();
    }
    
    // Проверка версии сохранений
    _checkVersion() {
        const savedVersion = localStorage.getItem(this.prefix + 'version');
        this.savedVersion = savedVersion;

        if (!savedVersion) {
            localStorage.setItem(this.prefix + 'version', this.version);
            return;
        }

        if (savedVersion !== this.version) {
            this.versionMismatch = true;
            console.warn(`Storage version mismatch: ${savedVersion} -> ${this.version}. Existing saves are preserved until a migration is available.`);
            return;
        }
    }
    
    // Сохранить значение
    set(key, value) {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(this.prefix + key, serialized);
            return true;
        } catch (e) {
            console.error('Storage full or unavailable:', e);
            return false;
        }
    }
    
    // Загрузить значение
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(this.prefix + key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Storage read error:', e);
            return defaultValue;
        }
    }
    
    // Удалить значение
    remove(key) {
        localStorage.removeItem(this.prefix + key);
    }
    
    // Сохранить весь прогресс игры с метаданными для безопасной синхронизации.
    saveProgress(data) {
        const currentData = data && typeof data === 'object' ? { ...data } : {};
        const previous = this.loadProgress();
        const nextComparable = { ...currentData };
        delete nextComparable._sync;

        const previousComparable = previous && typeof previous === 'object' ? { ...previous } : null;
        if (previousComparable) delete previousComparable._sync;

        const changed = !previousComparable ||
            JSON.stringify(nextComparable) !== JSON.stringify(previousComparable);
        const previousMeta = previous?._sync || {};
        const incomingMeta = currentData._sync || {};
        const revision = Math.max(
            Number(previousMeta.revision) || 0,
            Number(incomingMeta.revision) || 0
        ) + (changed ? 1 : 0);
        const updatedAt = changed
            ? Date.now()
            : Math.max(Number(previousMeta.updatedAt) || 0, Number(incomingMeta.updatedAt) || 0);

        delete currentData._sync;
        return this.set('progress', {
            ...currentData,
            _sync: { revision: revision || 1, updatedAt }
        });
    }
    
    // Загрузить весь прогресс
    loadProgress() {
        return this.get('progress', null);
    }
    
    // Проверить, есть ли сохранение
    hasSave() {
        return localStorage.getItem(this.prefix + 'progress') !== null;
    }
    
    // Очистить все данные игры
    clearAll() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(this.prefix));
        keys.forEach(k => localStorage.removeItem(k));
    }
    
    // Экспорт сохранения (для отладки)
    exportSave() {
        const data = {};
        const keys = Object.keys(localStorage).filter(k => k.startsWith(this.prefix));
        keys.forEach(k => { data[k] = localStorage.getItem(k); });
        return JSON.stringify(data, null, 2);
    }
}

// Глобальный экземпляр
const storage = new StorageManager();