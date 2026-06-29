class EventBus {
    constructor() {
        this._events = {};
        this._onceEvents = {};
    }
    
    // Подписаться на событие
    on(event, callback) {
        if (!this._events[event]) {
            this._events[event] = [];
        }
        this._events[event].push(callback);
        return () => this.off(event, callback);  // Возвращает функцию отписки
    }
    
    // Подписаться на одно срабатывание
    once(event, callback) {
        if (!this._onceEvents[event]) {
            this._onceEvents[event] = [];
        }
        this._onceEvents[event].push(callback);
    }
    
    // Отписаться
    off(event, callback) {
        if (this._events[event]) {
            this._events[event] = this._events[event].filter(cb => cb !== callback);
        }
        if (this._onceEvents[event]) {
            this._onceEvents[event] = this._onceEvents[event].filter(cb => cb !== callback);
        }
    }
    
    // Вызвать событие
    emit(event, data = null) {
        // Постоянные подписчики
        if (this._events[event]) {
            this._events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`EventBus error in ${event}:`, e);
                }
            });
        }
        
        // Одноразовые подписчики
        if (this._onceEvents[event]) {
            const callbacks = [...this._onceEvents[event]];
            this._onceEvents[event] = [];
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error(`EventBus once error in ${event}:`, e);
                }
            });
        }
    }
    
    // Очистить все подписки
    clear() {
        this._events = {};
        this._onceEvents = {};
    }
    
    // Список активных событий (для отладки)
    debug() {
        const events = {};
        for (const [key, cbs] of Object.entries(this._events)) {
            events[key] = cbs.length;
        }
        return events;
    }
}

// Глобальный экземпляр
const events = new EventBus();