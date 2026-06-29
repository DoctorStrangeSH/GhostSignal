class MinigameAnalyze extends MinigameBase {
    constructor(config) {
        super({
            id: config.id || 'analyze',
            name: 'Анализ яда',
            description: 'Смешайте реактивы в правильной пропорции, чтобы определить яд',
            difficulty: 2,
            timeCost: 15,
            ...config
        });
        
        this.targetRatio = config.targetRatio || [2, 1, 3]; // Красный, Синий, Зелёный
        this.currentRatio = [0, 0, 0];
        this.maxDrops = config.maxDrops || 10;
        this.dropsUsed = 0;
        this.reagents = [
            { name: 'Красный', icon: '🔴', color: '#ff4444' },
            { name: 'Синий', icon: '🔵', color: '#4444ff' },
            { name: 'Зелёный', icon: '🟢', color: '#44ff44' }
        ];
    }
    
    render(container) {
        this.isActive = true;
        this.currentRatio = [0, 0, 0];
        this.dropsUsed = 0;
        
        container.innerHTML = `
            <div class="minigame analyze-game">
                <div class="mg-header">
                    <h3>🧪 ${this.name}</h3>
                    <p class="mg-description">${this.description}</p>
                    <p class="mg-clue">💡 Смешайте реактивы. Целевой цвет покажет, когда пропорция верна.</p>
                </div>
                
                <div class="analyze-lab">
                    <div class="analyze-target">
                        <span>Целевой цвет:</span>
                        <div class="target-color" id="target-color"></div>
                    </div>
                    
                    <div class="analyze-beaker" id="analyze-beaker">
                        <div class="beaker-liquid" id="beaker-liquid"></div>
                        <div class="beaker-label">Пробирка</div>
                    </div>
                    
                    <div class="analyze-drops-info">
                        Капель использовано: <span id="drops-used">0</span> / ${this.maxDrops}
                    </div>
                </div>
                
                <div class="analyze-reagents">
                    ${this.reagents.map((r, i) => `
                        <button class="reagent-btn" data-index="${i}">
                            <span class="reagent-icon">${r.icon}</span>
                            <span>${r.name}</span>
                            <span class="reagent-count" id="reagent-count-${i}">0</span>
                        </button>
                    `).join('')}
                </div>
                
                <div class="analyze-controls">
                    <button id="btn-analyze-check" class="terminal-btn">🔬 ПРОВЕРИТЬ</button>
                    <button id="btn-analyze-reset" class="terminal-btn">🔄 СБРОС</button>
                </div>
                
                <div id="analyze-feedback" class="mg-feedback hidden"></div>
            </div>
        `;
        
        this._updateTargetColor();
        this._bindEvents(container);
    }
    
    _updateTargetColor() {
        const target = document.getElementById('target-color');
        const beaker = document.getElementById('beaker-liquid');
        
        if (target) {
            // Вычисляем целевой цвет
            const r = Math.min(255, this.targetRatio[0] * 40);
            const g = Math.min(255, this.targetRatio[2] * 40);
            const b = Math.min(255, this.targetRatio[1] * 40);
            target.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
        }
    }
    
    _updateBeakerColor() {
        const beaker = document.getElementById('beaker-liquid');
        if (!beaker) return;
        
        const r = Math.min(255, this.currentRatio[0] * 40);
        const g = Math.min(255, this.currentRatio[2] * 40);
        const b = Math.min(255, this.currentRatio[1] * 40);
        beaker.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    }
    
    _bindEvents(container) {
        // Кнопки реактивов
        container.querySelectorAll('.reagent-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.dropsUsed >= this.maxDrops) return;
                
                const index = parseInt(btn.dataset.index);
                this.currentRatio[index]++;
                this.dropsUsed++;
                
                container.querySelector(`#reagent-count-${index}`).textContent = this.currentRatio[index];
                container.querySelector('#drops-used').textContent = this.dropsUsed;
                
                this._updateBeakerColor();
                
                // Анимация
                const beaker = document.getElementById('beaker-liquid');
                if (beaker) {
                    beaker.style.animation = 'none';
                    beaker.offsetHeight;
                    beaker.style.animation = 'bubble 0.5s ease-out';
                }
            });
        });
        
        // Проверка
        container.querySelector('#btn-analyze-check').addEventListener('click', () => {
            const feedback = container.querySelector('#analyze-feedback');
            feedback.classList.remove('hidden');
            
            // Проверяем пропорцию (с容忍)
            let match = true;
            for (let i = 0; i < 3; i++) {
                if (this.currentRatio[i] !== this.targetRatio[i]) {
                    match = false;
                    break;
                }
            }
            
            if (match) {
                feedback.innerHTML = `
                    <div class="feedback-success">
                        ✅ Яд определён! Это цианид.
                    </div>
                `;
                setTimeout(() => this.complete(), 1500);
            } else {
                const hints = this.currentRatio.map((val, i) => {
                    const target = this.targetRatio[i];
                    if (val < target) return `${this.reagents[i].name}: добавьте ещё ${target - val}`;
                    if (val > target) return `${this.reagents[i].name}: слишком много (лишнее: ${val - target})`;
                    return `${this.reagents[i].name}: ✓`;
                }).join('<br>');
                
                feedback.innerHTML = `
                    <div class="feedback-error">
                        ❌ Пропорция неверна.<br><br>${hints}
                    </div>
                `;
                
                if (this.dropsUsed >= this.maxDrops) {
                    feedback.innerHTML += `
                        <div class="feedback-error">
                            <br>Капли закончились. Сбросьте и попробуйте снова.
                        </div>
                    `;
                }
            }
        });
        
        // Сброс
        container.querySelector('#btn-analyze-reset').addEventListener('click', () => {
            this.currentRatio = [0, 0, 0];
            this.dropsUsed = 0;
            
            this.reagents.forEach((r, i) => {
                const el = container.querySelector(`#reagent-count-${i}`);
                if (el) el.textContent = '0';
            });
            
            const dropsEl = container.querySelector('#drops-used');
            if (dropsEl) dropsEl.textContent = '0';
            
            this._updateBeakerColor();
            container.querySelector('#analyze-feedback').classList.add('hidden');
        });
    }
}