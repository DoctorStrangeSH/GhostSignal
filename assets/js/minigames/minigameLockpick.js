class MinigameLockpick extends MinigameBase {
    constructor(config) {
        super({
            id: config.id || 'lockpick',
            name: 'Взлом замка',
            description: 'Подберите отмычку к замку',
            difficulty: 3,
            timeCost: 20,
            ...config
        });
        
        this.pins = config.pins || 5;          // Количество пинов
        this.pinStates = [];                    // false = не взломан
        this.currentPin = 0;
        this.tension = 0;                       // 0-100 (натяжение)
        this.isPicking = false;
        this.pickPosition = 50;                 // Позиция отмычки (0-100)
    }
    
    render(container) {
        this.isActive = true;
        this.pinStates = new Array(this.pins).fill(false);
        this.currentPin = 0;
        this.tension = 0;
        
        container.innerHTML = `
            <div class="minigame lockpick-game">
                <div class="mg-header">
                    <h3>🔓 ${this.name}</h3>
                    <p class="mg-description">${this.description}</p>
                </div>
                
                <div class="lockpick-lock">
                    <div class="lock-body">
                        <div class="lock-keyhole"></div>
                        <div class="lock-pins" id="lock-pins">
                            ${this.pinStates.map((_, i) => `
                                <div class="lock-pin" id="pin-${i}">
                                    <div class="pin-driver"></div>
                                    <div class="pin-key"></div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="lockpick-tools">
                        <div class="tension-wrench">
                            <div class="wrench-label">Натяжение</div>
                            <div class="tension-bar">
                                <div class="tension-fill" id="tension-fill"></div>
                            </div>
                            <input type="range" id="tension-slider" min="0" max="100" value="0" class="tension-slider">
                        </div>
                        
                        <div class="pick-tool">
                            <div class="pick-label">Отмычка (позиция: <span id="pick-pos">50</span>)</div>
                            <input type="range" id="pick-slider" min="0" max="100" value="50" class="pick-slider">
                            <button id="btn-pick" class="terminal-btn">🔧 ПОДДЕТЬ</button>
                        </div>
                    </div>
                </div>
                
                <div class="lockpick-info">
                    Текущий пин: <span id="current-pin">1</span> / ${this.pins}
                </div>
                
                <div id="lockpick-feedback" class="mg-feedback hidden"></div>
            </div>
        `;
        
        this._bindEvents(container);
    }
    
    _bindEvents(container) {
        const tensionSlider = container.querySelector('#tension-slider');
        const pickSlider = container.querySelector('#pick-slider');
        const pickBtn = container.querySelector('#btn-pick');
        const tensionFill = container.querySelector('#tension-fill');
        const pickPos = container.querySelector('#pick-pos');
        
        // Слайдер натяжения
        tensionSlider.addEventListener('input', () => {
            this.tension = parseInt(tensionSlider.value);
            tensionFill.style.width = this.tension + '%';
        });
        
        // Слайдер отмычки
        pickSlider.addEventListener('input', () => {
            this.pickPosition = parseInt(pickSlider.value);
            pickPos.textContent = this.pickPosition;
        });
        
        // Попытка взлома
        pickBtn.addEventListener('click', () => {
            if (this.currentPin >= this.pins) return;
            
            const feedback = container.querySelector('#lockpick-feedback');
            feedback.classList.remove('hidden');
            
            // Логика взлома: нужно правильное сочетание tension + position
            const targetTension = 30 + this.currentPin * 15;
            const targetPosition = 20 + this.currentPin * 18;
            
            const tensionOk = Math.abs(this.tension - targetTension) <= 10;
            const positionOk = Math.abs(this.pickPosition - targetPosition) <= 8;
            
            if (tensionOk && positionOk) {
                this.pinStates[this.currentPin] = true;
                
                const pinEl = container.querySelector(`#pin-${this.currentPin}`);
                if (pinEl) pinEl.classList.add('picked');
                
                this.currentPin++;
                container.querySelector('#current-pin').textContent = this.currentPin + 1;
                
                feedback.innerHTML = '<div class="feedback-success">✅ Пин взломан!</div>';
                
                // Анимация
                if (pinEl) {
                    pinEl.style.animation = 'none';
                    pinEl.offsetHeight;
                    pinEl.style.animation = 'pin-click 0.3s ease-out';
                }
                
                // Все пины взломаны?
                if (this.currentPin >= this.pins) {
                    feedback.innerHTML = '<div class="feedback-success">🔓 Замок открыт!</div>';
                    setTimeout(() => this.complete(), 1200);
                }
            } else {
                // Сброс при ошибке
                this.tension = 0;
                tensionSlider.value = 0;
                tensionFill.style.width = '0%';
                
                feedback.innerHTML = `
                    <div class="feedback-error">
                        ❌ Неверно! Замок сброшен.
                        <br>Подсказка: tension=${targetTension}±10, position=${targetPosition}±8
                    </div>
                `;
            }
        });
    }
}