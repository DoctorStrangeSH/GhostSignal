class StakeoutSystem {
    constructor(gameTime) {
        this.gameTime = gameTime;
        this.activeStakeouts = [];
        this.completedStakeouts = [];
    }
    
    // Начать слежку
    startStakeout(config) {
        const stakeout = {
            id: config.id,
            locationId: config.locationId,
            targetNPC: config.targetNPC,
            targetTime: config.targetTime,     // { hour: 22, minute: 0 }
            duration: config.duration || 30,   // минут ожидания
            reward: config.reward,             // { type: 'insight'|'evidence', id: '...' }
            description: config.description,
            startTime: this.gameTime.getFormatted(),
            isActive: true,
            isCompleted: false
        };
        
        this.activeStakeouts.push(stakeout);
        
        events.emit('stakeout:started', stakeout);
        events.emit('notification:show', {
            message: `Слежка начата: ${config.description}`,
            type: 'info',
            duration: 3000
        });
        
        // Проверяем условия сразу
        this._checkStakeout(stakeout);
        
        return stakeout;
    }
    
    // Проверить условия слежки
    _checkStakeout(stakeout) {
        if (!stakeout.isActive) return;
        
        const currentHour = this.gameTime.hour;
        const currentMinute = this.gameTime.minute;
        const currentLocation = window.app?.locationManager?.currentLocation;
        
        // Проверяем: правильное ли время и локация?
        const timeMatch = currentHour === stakeout.targetTime.hour && 
                          Math.abs(currentMinute - (stakeout.targetTime.minute || 0)) <= 15;
        const locationMatch = currentLocation === stakeout.locationId;
        
        if (timeMatch && locationMatch) {
            this._completeStakeout(stakeout);
        }
    }
    
    _completeStakeout(stakeout) {
        stakeout.isActive = false;
        stakeout.isCompleted = true;
        this.completedStakeouts.push(stakeout.id);
        
        // Выдаём награду
        if (stakeout.reward) {
            if (stakeout.reward.type === 'insight') {
                events.emit('insight:add', stakeout.reward.id);
            } else if (stakeout.reward.type === 'evidence') {
                events.emit('evidence:from_stakeout', stakeout.reward.id);
            }
        }
        
        events.emit('stakeout:completed', stakeout);
        events.emit('notification:show', {
            message: `👁️ Слежка завершена! Вы заметили кое-что важное.`,
            type: 'success',
            duration: 4000
        });
    }
    
    // Проверить все активные слежки (вызывается при смене времени/локации)
    checkAll() {
        this.activeStakeouts.forEach(s => this._checkStakeout(s));
    }
    
    // Получить доступные слежки для дела
    getAvailableStakeouts(caseData) {
        // В деле можно указать конфигурации слежек
        return caseData?.stakeouts || [];
    }
    
    // Сериализация
    toJSON() {
        return {
            activeStakeouts: this.activeStakeouts.map(s => ({ ...s })),
            completedStakeouts: [...this.completedStakeouts]
        };
    }
    
    static fromJSON(json, gameTime) {
        const system = new StakeoutSystem(gameTime);
        if (json) {
            system.completedStakeouts = json.completedStakeouts || [];
        }
        return system;
    }
}