class MinigameBase {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.description = config.description;
        this.difficulty = config.difficulty || 1;
        this.timeCost = config.timeCost || CONFIG.time.costs.minigame;
        this.reward = config.reward || null; // { type: 'item'|'insight', id: '...' }
        this.isCompleted = false;
        this.isActive = false;
        this.onComplete = config.onComplete || null;
        this.onFail = config.onFail || null;
    }
    
    // Запустить мини-игру
    start() {
        this.isActive = true;
        events.emit('minigame:started', { id: this.id, name: this.name });
    }
    
    // Завершить успешно
    complete() {
        if (this.isCompleted) return;
        
        this.isCompleted = true;
        this.isActive = false;
        
        // Выдаём награду
        if (this.reward) {
            if (this.reward.type === 'item') {
                events.emit('inventory:add', this.reward.id);
            } else if (this.reward.type === 'insight') {
                events.emit('insight:add', this.reward.id);
            }
        }
        
        // Тратим время
        events.emit('time:advance', this.timeCost);
        
        events.emit('minigame:completed', { id: this.id, reward: this.reward });
        
        if (this.onComplete) this.onComplete();
    }
    
    // Провалить
    fail(reason = '') {
        this.isActive = false;
        events.emit('minigame:failed', { id: this.id, reason });
        
        if (this.onFail) this.onFail();
    }
    
    // Сбросить
    reset() {
        this.isCompleted = false;
        this.isActive = false;
    }
    
    // Рендер (переопределяется в наследниках)
    render(container) {
        container.innerHTML = `<p>Мини-игра: ${this.name}</p>`;
    }
    
    // Проверка ответа (переопределяется)
    checkAnswer(answer) {
        return false;
    }
    
    // Подсказка
    getHint(level = 1) {
        return 'Подсказка недоступна';
    }
}