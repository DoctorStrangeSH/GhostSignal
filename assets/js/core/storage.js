class StorageManager {
    constructor() {
        this.prefix = 'detective_archive_';
        this.version = CONFIG.version;
        this._checkVersion();
    }
    
    // Проверка версии сохранений
    _checkVersion() {
        const savedVersion = localStorage.getItem(this.prefix + 'version');
        if (savedVersion && savedVersion !== this.version) {
            console.warn(`Storage version mismatch: ${savedVersion} -> ${this.version}`);
            // В будущем: миграция данных
        }
        localStorage.setItem(this.prefix + 'version', this.version);
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
    
    // Сохранить весь прогресс игры
    saveProgress(data) {
        return this.set('progress', data);
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