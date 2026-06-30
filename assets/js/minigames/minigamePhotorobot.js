class MinigamePhotorobot extends MinigameBase {
    constructor(config) {
        super({
            id: config.id || 'photorobot',
            name: 'Фоторобот',
            description: 'Составьте лицо подозреваемого',
            difficulty: 2,
            timeCost: 15,
            ...config
        });
        
        this.features = {
            hair: ['none', 'short', 'long', 'curly', 'bald'],
            eyes: ['small', 'big', 'round', 'narrow', 'wide'],
            nose: ['small', 'big', 'long', 'wide', 'pointy'],
            mouth: ['small', 'big', 'thin', 'thick', 'smirk']
        };
        
        this.current = {
            hair: 0,
            eyes: 0,
            nose: 0,
            mouth: 0
        };
        
        this.target = config.target || {
            hair: 2,   // long
            eyes: 1,   // big
            nose: 4,   // pointy
            mouth: 3   // thick
        };
    }
    
    render(container) {
        this.isActive = true;
        this.current = { hair: 0, eyes: 0, nose: 0, mouth: 0 };
        
        const featureNames = {
            hair: 'Волосы',
            eyes: 'Глаза',
            nose: 'Нос',
            mouth: 'Рот'
        };
        
        const icons = {
            hair: ['🫥', '💇‍♂️', '💇', '👨‍🦱', '👨‍🦲'],
            eyes: ['👁️', '👀', '🥺', '😑', '😳'],
            nose: ['👃', '🐽', '📏', '🍐', '🗡️'],
            mouth: ['👄', '😮', '😗', '😬', '😏']
        };
        
        container.innerHTML = `
            <div class="minigame photorobot-game">
                <div class="mg-header">
                    <h3>👤 ${this.name}</h3>
                    <p class="mg-description">${this.description}</p>
                </div>
                
                <div class="photorobot-face" id="photorobot-face">
                    <div class="face-outline">
                        <div class="face-hair" id="face-hair"></div>
                        <div class="face-eyes" id="face-eyes"></div>
                        <div class="face-nose" id="face-nose"></div>
                        <div class="face-mouth" id="face-mouth"></div>
                    </div>
                </div>
                
                <div class="photorobot-controls">
                    ${Object.keys(this.features).map(feature => `
                        <div class="feature-row">
                            <span class="feature-label">${featureNames[feature]}:</span>
                            <button class="terminal-btn feature-btn" data-feature="${feature}" data-dir="-1">◀</button>
                            <span class="feature-value" id="val-${feature}">${icons[feature][0]}</span>
                            <button class="terminal-btn feature-btn" data-feature="${feature}" data-dir="1">▶</button>
                        </div>
                    `).join('')}
                </div>
                
                <div class="photorobot-actions">
                    <button id="btn-photorobot-check" class="terminal-btn">✅ ПРОВЕРИТЬ</button>
                    <button id="btn-photorobot-hint" class="terminal-btn">💡 ОПИСАНИЕ</button>
                </div>
                
                <div id="photorobot-feedback" class="mg-feedback hidden"></div>
            </div>
        `;
        
        this._updateFace(container);
        this._bindEvents(container);
    }
    
    _updateFace(container) {
        const icons = {
            hair: ['🫥', '💇‍♂️', '💇', '👨‍🦱', '👨‍🦲'],
            eyes: ['👁️', '👀', '🥺', '😑', '😳'],
            nose: ['👃', '🐽', '📏', '🍐', '🗡️'],
            mouth: ['👄', '😮', '😗', '😬', '😏']
        };
        
        Object.keys(this.current).forEach(feature => {
            const val = container.querySelector(`#val-${feature}`);
            if (val) val.textContent = icons[feature][this.current[feature]];
        });
    }
    
    _bindEvents(container) {
        // Кнопки переключения черт
        container.querySelectorAll('.feature-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const feature = btn.dataset.feature;
                const dir = parseInt(btn.dataset.dir);
                const max = this.features[feature].length - 1;
                
                this.current[feature] += dir;
                if (this.current[feature] < 0) this.current[feature] = max;
                if (this.current[feature] > max) this.current[feature] = 0;
                
                this._updateFace(container);
            });
        });
        
        // Проверка
        container.querySelector('#btn-photorobot-check').addEventListener('click', () => {
            const feedback = container.querySelector('#photorobot-feedback');
            feedback.classList.remove('hidden');
            
            let matches = 0;
            let total = Object.keys(this.target).length;
            
            Object.keys(this.target).forEach(feature => {
                if (this.current[feature] === this.target[feature]) matches++;
            });
            
            if (matches === total) {
                feedback.innerHTML = `
                    <div class="feedback-success">
                        ✅ Фоторобот составлен верно!
                    </div>
                `;
                setTimeout(() => this.complete(), 1500);
            } else {
                const hints = Object.keys(this.target).map(f => {
                    if (this.current[f] === this.target[f]) return `✅ ${f}: верно`;
                    const diff = this.target[f] - this.current[f];
                    const dir = diff > 0 ? '→' : '←';
                    return `❌ ${f}: нужно изменить (${dir})`;
                }).join('<br>');
                
                feedback.innerHTML = `
                    <div class="feedback-error">
                        ❌ Совпадает: ${matches}/${total}
                        <br><br>${hints}
                    </div>
                `;
            }
        });
        
        // Подсказка
        container.querySelector('#btn-photorobot-hint').addEventListener('click', () => {
            events.emit('modal:show', {
                title: '💡 Описание подозреваемого',
                body: '<p>Длинные волосы, большие глаза, острый нос, толстые губы.</p>',
                footer: '<button class="terminal-btn" data-bs-dismiss="modal">ПОНЯТНО</button>'
            });
        });
    }
}