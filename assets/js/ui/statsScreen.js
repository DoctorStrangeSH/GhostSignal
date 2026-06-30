class StatsScreen {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.progressTracker = null;
    }
    
    setTracker(tracker) {
        this.progressTracker = tracker;
    }
    
    render() {
        if (!this.container || !this.progressTracker) return;
        
        const stats = this.progressTracker.getStats();
        const rank = stats.rank;
        const stars = '⭐'.repeat(stats.stars) + '☆'.repeat(5 - stats.stars);
        
        this.container.innerHTML = `
            <div class="stats-screen">
                <div class="stats-header">
                    <h2>📊 СТАТИСТИКА ДЕТЕКТИВА</h2>
                    <button class="terminal-btn btn-back" data-screen="screen-main-menu">← НАЗАД</button>
                </div>
                
                <div class="stats-grid">
                    <!-- Ранг -->
                    <div class="stats-card rank-card">
                        <div class="rank-badge">
                            <span class="rank-icon">🕵️</span>
                            <h3>${rank.name}</h3>
                            <div class="rank-stars">${stars}</div>
                        </div>
                        ${stats.nextRank ? `
                            <div class="rank-progress">
                                <div class="progress-label">
                                    До «${stats.nextRank.name}»: ${stats.nextRank.need} дел
                                </div>
                                <div class="terminal-progress">
                                    <div class="progress-fill" style="width: ${(stats.totalCasesSolved / (stats.totalCasesSolved + stats.nextRank.need)) * 100}%"></div>
                                </div>
                            </div>
                        ` : `
                            <div class="rank-max">🏆 Максимальный ранг!</div>
                        `}
                    </div>
                    
                    <!-- Общая статистика -->
                    <div class="stats-card">
                        <h4>📋 ОБЩАЯ СТАТИСТИКА</h4>
                        <div class="stat-row">
                            <span>Раскрыто дел:</span>
                            <span class="stat-value success">${stats.totalCasesSolved}</span>
                        </div>
                        <div class="stat-row">
                            <span>Провалено:</span>
                            <span class="stat-value fail">${stats.totalCasesFailed}</span>
                        </div>
                        <div class="stat-row">
                            <span>Процент раскрытия:</span>
                            <span class="stat-value">${stats.solveRate}%</span>
                        </div>
                        <div class="stat-row">
                            <span>Всего попыток:</span>
                            <span class="stat-value">${stats.totalAttempts}</span>
                        </div>
                    </div>
                    
                    <!-- Время -->
                    <div class="stats-card">
                        <h4>⏱️ ВРЕМЯ</h4>
                        <div class="stat-row">
                            <span>Общее время:</span>
                            <span class="stat-value">${stats.formattedTime}</span>
                        </div>
                        <div class="stat-row">
                            <span>Среднее на дело:</span>
                            <span class="stat-value">${stats.averageTime} мин</span>
                        </div>
                        <div class="stat-row">
                            <span>Использовано подсказок:</span>
                            <span class="stat-value">${stats.totalHintsUsed}</span>
                        </div>
                    </div>
                </div>
                
                <!-- История дел -->
                <div class="stats-card history-card">
                    <h4>📜 ИСТОРИЯ ДЕЛ</h4>
                    ${stats.casesHistory.length === 0 ? `
                        <div class="history-empty">Вы ещё не завершили ни одного дела</div>
                    ` : `
                        <div class="history-list">
                            ${stats.casesHistory.slice().reverse().map(record => `
                                <div class="history-item ${record.result}">
                                    <span class="history-icon">${record.result === 'solved' ? '✅' : '❌'}</span>
                                    <div class="history-info">
                                        <span class="history-title">${record.title}</span>
                                        <span class="history-details">
                                            ${record.result === 'solved' ? 'Раскрыто' : 'Провалено'} · 
                                            ${record.timeSpent} мин · 
                                            ${record.attempts} попыток · 
                                            ${record.hintsUsed} подсказок
                                        </span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
        
        // Кнопка назад
        this.container.querySelector('.btn-back')?.addEventListener('click', () => {
            events.emit('navigation:go', 'screen-main-menu');
        });
    }
}