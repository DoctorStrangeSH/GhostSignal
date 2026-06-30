class CaseListUI {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.progress = null;
        this._init();
    }
    
    setProgress(progress) {
        this.progress = progress;
        this.render();
    }
    
    _init() {
        if (!this.container) return;
        this.render();
    }
    
    render() {
        if (!this.container) return;
        
        const cases = getAllCases();
        const solvedCases = this.progress?.solvedCases || [];
        
        if (cases.length === 0) {
            this.container.innerHTML = `
                <div class="cases-empty">
                    <p>Нет доступных дел</p>
                </div>
            `;
            return;
        }
        
        this.container.innerHTML = cases.map(caseData => {
            const isSolved = solvedCases.includes(caseData.id);
            const isActive = this.progress?.activeCase === caseData.id;
            const difficultyStars = '⭐'.repeat(caseData.difficulty);
            
            return `
                <div class="case-card ${isSolved ? 'case-solved' : ''} ${isActive ? 'case-active' : ''}">
                    <div class="case-card-header">
                        <span class="case-id">ДЕЛО №${caseData.id.replace('case-', '')}</span>
                        <span class="case-difficulty">${difficultyStars}</span>
                    </div>
                    <h3 class="case-title">${caseData.title}</h3>
                    <p class="case-description">${caseData.description}</p>
                    <div class="case-card-footer">
                        ${isSolved ? 
                            '<span class="case-badge solved">✅ РАСКРЫТО</span>' : 
                            isActive ?
                            '<span class="case-badge active">🟢 В ПРОЦЕССЕ</span>' :
                            '<span class="case-badge available">📋 ДОСТУПНО</span>'
                        }
                        <button class="terminal-btn case-btn" data-case-id="${caseData.id}">
                            ${isSolved ? 'ПРОСМОТР' : isActive ? 'ПРОДОЛЖИТЬ' : 'НАЧАТЬ'}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Вешаем обработчики
        this.container.querySelectorAll('.case-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const caseId = btn.dataset.caseId;
                events.emit('case:select', caseId);
            });
        });
    }
}