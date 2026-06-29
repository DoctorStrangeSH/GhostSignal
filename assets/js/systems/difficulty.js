class DifficultySystem {
    constructor() {
        this.currentDifficulty = storage.get('difficulty', 'normal');
        
        this.levels = {
            easy: {
                name: 'Лёгкий',
                icon: '🟢',
                description: 'Больше подсказок, меньше ограничений',
                maxHints: 5,
                hintPenalty: 0,
                timeMultiplier: 0.7,     // Время идёт медленнее
                evidenceGlow: true,       // Улики подсвечиваются
                npcClues: true           // NPC дают больше подсказок
            },
            normal: {
                name: 'Средний',
                icon: '🟡',
                description: 'Стандартный режим',
                maxHints: 3,
                hintPenalty: 0.5,
                timeMultiplier: 1.0,
                evidenceGlow: false,
                npcClues: false
            },
            hard: {
                name: 'Сложный',
                icon: '🔴',
                description: 'Минимум подсказок, максимум реализма',
                maxHints: 1,
                hintPenalty: 1.0,
                timeMultiplier: 1.3,     // Время идёт быстрее
                evidenceGlow: false,
                npcClues: false
            }
        };
    }
    
    getCurrent() {
        return this.levels[this.currentDifficulty];
    }
    
    setDifficulty(level) {
        if (this.levels[level]) {
            this.currentDifficulty = level;
            storage.set('difficulty', level);
            
            events.emit('notification:show', {
                message: `Сложность: ${this.levels[level].icon} ${this.levels[level].name}`,
                type: 'system',
                duration: 3000
            });
        }
    }
    
    getMaxHints() {
        return this.getCurrent().maxHints;
    }
    
    getTimeMultiplier() {
        return this.getCurrent().timeMultiplier;
    }
}