class ProgressTracker {
    constructor() {
        this.stats = {
            totalCasesSolved: 0,
            totalCasesFailed: 0,
            totalHintsUsed: 0,
            totalTimeSpent: 0,       // В минутах
            totalAttempts: 0,
            casesHistory: []          // История каждого дела
        };
        
        this.caseStartTime = null;
        this.caseHintsUsed = 0;
        this.caseAttempts = 0;
    }
    
    // Начать отслеживание дела
    startCase(caseId) {
        this.caseStartTime = Date.now();
        this.caseHintsUsed = 0;
        this.caseAttempts = 0;
    }
    
    // Использована подсказка
    useHint() {
        this.caseHintsUsed++;
        this.stats.totalHintsUsed++;
    }
    
    // Попытка ответа
    addAttempt() {
        this.caseAttempts++;
        this.stats.totalAttempts++;
    }
    
    // Дело раскрыто
    caseSolved(caseData) {
        const timeSpent = this._calculateTimeSpent();
        this.stats.totalTimeSpent += timeSpent;
        this.stats.totalCasesSolved++;
        
        const record = {
            caseId: caseData.id,
            title: caseData.title,
            result: 'solved',
            timeSpent: timeSpent,
            hintsUsed: this.caseHintsUsed,
            attempts: this.caseAttempts,
            date: new Date().toISOString()
        };
        
        this.stats.casesHistory.push(record);
        
        events.emit('stats:updated', this.getStats());
        
        return record;
    }
    
    // Дело провалено
    caseFailed(caseData) {
        const timeSpent = this._calculateTimeSpent();
        this.stats.totalTimeSpent += timeSpent;
        this.stats.totalCasesFailed++;
        
        const record = {
            caseId: caseData.id,
            title: caseData.title,
            result: 'failed',
            timeSpent: timeSpent,
            hintsUsed: this.caseHintsUsed,
            attempts: this.caseAttempts,
            date: new Date().toISOString()
        };
        
        this.stats.casesHistory.push(record);
        
        events.emit('stats:updated', this.getStats());
        
        return record;
    }
    
    // Получить текущий ранг
    getRank() {
        const solved = this.stats.totalCasesSolved;
        const ranks = CONFIG.ranks;
        
        for (let i = ranks.length - 1; i >= 0; i--) {
            if (solved >= ranks[i].minSolved) {
                return ranks[i];
            }
        }
        return ranks[0];
    }
    
    // Получить следующее звание
    getNextRank() {
        const current = this.getRank();
        const ranks = CONFIG.ranks;
        const currentIndex = ranks.findIndex(r => r.name === current.name);
        
        if (currentIndex < ranks.length - 1) {
            const next = ranks[currentIndex + 1];
            const solved = this.stats.totalCasesSolved;
            return {
                name: next.name,
                need: next.minSolved - solved
            };
        }
        return null;
    }
    
    // Получить звёзды (1-5)
    getStars() {
        const solved = this.stats.totalCasesSolved;
        if (solved >= 15) return 5;
        if (solved >= 10) return 4;
        if (solved >= 6) return 3;
        if (solved >= 3) return 2;
        if (solved >= 1) return 1;
        return 0;
    }
    
    // Процент раскрытия
    getSolveRate() {
        const total = this.stats.totalCasesSolved + this.stats.totalCasesFailed;
        if (total === 0) return 0;
        return Math.round((this.stats.totalCasesSolved / total) * 100);
    }
    
    // Получить всю статистику
    getStats() {
        return {
            ...this.stats,
            rank: this.getRank(),
            nextRank: this.getNextRank(),
            stars: this.getStars(),
            solveRate: this.getSolveRate(),
            formattedTime: this._formatTime(this.stats.totalTimeSpent),
            averageTime: this._getAverageTime()
        };
    }
    
    // Вычислить затраченное время
    _calculateTimeSpent() {
        if (!this.caseStartTime) return 0;
        return Math.floor((Date.now() - this.caseStartTime) / 60000); // В минутах
    }
    
    // Среднее время на дело
    _getAverageTime() {
        const total = this.stats.totalCasesSolved + this.stats.totalCasesFailed;
        if (total === 0) return 0;
        return Math.floor(this.stats.totalTimeSpent / total);
    }
    
    // Форматировать время
    _formatTime(minutes) {
        if (minutes < 60) return `${minutes} мин`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours} ч ${mins} мин`;
    }
    
    // Сериализация
    toJSON() {
        return {
            stats: JSON.parse(JSON.stringify(this.stats))
        };
    }
    
    // Восстановление
    static fromJSON(json) {
        const tracker = new ProgressTracker();
        if (json?.stats) {
            tracker.stats = json.stats;
        }
        return tracker;
    }
}