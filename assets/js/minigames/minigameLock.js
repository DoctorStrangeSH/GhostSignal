class MinigameLock extends MinigameBase {
    constructor(config) {
        super({
            id: config.id || 'lock',
            name: 'Кодовый замок',
            description: 'Подберите трёхзначный код',
            difficulty: 2,
            timeCost: 10,
            ...config
        });
        
        this.code = config.code || '000'; // Правильный код (строка из цифр)
        this.codeLength = config.codeLength || 3;
        this.digits = [0, 0, 0, 0]; // Текущие цифры
        this.attempts = 0;
        this.maxAttempts = config.maxAttempts || 5;
        this.hintText = config.hintText || '';
        this.clue = config.clue || ''; // Подсказка к коду (текст)
    }
    
    render(container) {
        this.isActive = true;
        this.digits = new Array(this.codeLength).fill(0);
        this.attempts = 0;
        
        container.innerHTML = `
            <div class="minigame lock-game">
                <div class="mg-header">
                    <h3>🔒 ${this.name}</h3>
                    <p class="mg-description">${this.description}</p>
                    ${this.clue ? `<p class="mg-clue">📝 ${this.clue}</p>` : ''}
                </div>
                
                <div class="lock-display">
                    <div class="lock-digits" id="lock-digits">
                        ${this.digits.map((d, i) => `
                            <div class="lock-digit-container">
                                <button class="lock-arrow up" data-index="${i}">▲</button>
                                <div class="lock-digit" id="digit-${i}">${d}</div>
                                <button class="lock-arrow down" data-index="${i}">▼</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="lock-controls">
                    <button id="btn-lock-check" class="terminal-btn">🔓 ОТКРЫТЬ</button>
                    <button id="btn-lock-reset" class="terminal-btn">🔄 СБРОС</button>
                </div>
                
                <div id="lock-feedback" class="mg-feedback hidden"></div>
                
                <div class="lock-attempts">
                    Попыток: <span id="lock-attempts-count">${this.attempts}</span> / ${this.maxAttempts}
                </div>
                
                ${this.hintText ? `
                    <div class="lock-hint-area">
                        <button id="btn-lock-hint" class="terminal-btn btn-sm">💡 ПОКАЗАТЬ ПОДСКАЗКУ</button>
                    </div>
                ` : ''}
            </div>
        `;
        
        this._bindEvents(container);
    }
    
    _bindEvents(container) {
        // Стрелки
        container.querySelectorAll('.lock-arrow').forEach(arrow => {
            arrow.addEventListener('click', () => {
                const index = parseInt(arrow.dataset.index);
                const direction = arrow.classList.contains('up') ? 1 : -1;
                
                this.digits[index] = (this.digits[index] + direction + 10) % 10;
                container.querySelector(`#digit-${index}`).textContent = this.digits[index];
                
                // Анимация
                container.querySelector(`#digit-${index}`).style.animation = 'none';
                container.querySelector(`#digit-${index}`).offsetHeight; // reflow
                container.querySelector(`#digit-${index}`).style.animation = 'digit-flip 0.2s ease-out';
            });
        });
        
        // Проверка
        container.querySelector('#btn-lock-check').addEventListener('click', () => {
            this.attempts++;
            container.querySelector('#lock-attempts-count').textContent = this.attempts;
            
            const enteredCode = this.digits.join('');
            const feedback = container.querySelector('#lock-feedback');
            feedback.classList.remove('hidden');
            
            if (enteredCode === this.code) {
                feedback.innerHTML = `
                    <div class="feedback-success">
                        ✅ Замок открыт! Код: ${this.code}
                    </div>
                `;
                container.querySelector('#btn-lock-check').disabled = true;
                
                setTimeout(() => this.complete(), 1500);
            } else {
                // Подсказка: сколько цифр правильные
                let correctDigits = 0;
                for (let i = 0; i < this.codeLength; i++) {
                    if (enteredCode[i] === this.code[i]) correctDigits++;
                }
                
                feedback.innerHTML = `
                    <div class="feedback-error">
                        ❌ Неверный код.
                        <br>💡 Правильных цифр на своих местах: ${correctDigits} / ${this.codeLength}
                    </div>
                `;
                
                if (this.attempts >= this.maxAttempts) {
                    feedback.innerHTML += `
                        <div class="feedback-error">
                            <br>Попытки исчерпаны. Правильный код: ${this.code}
                        </div>
                    `;
                    container.querySelector('#btn-lock-check').disabled = true;
                    this.fail('max_attempts');
                }
            }
        });
        
        // Сброс
        container.querySelector('#btn-lock-reset').addEventListener('click', () => {
            this.digits = new Array(this.codeLength).fill(0);
            this.digits.forEach((d, i) => {
                container.querySelector(`#digit-${i}`).textContent = d;
            });
            container.querySelector('#lock-feedback').classList.add('hidden');
        });
        
        // Подсказка
        const hintBtn = container.querySelector('#btn-lock-hint');
        if (hintBtn) {
            hintBtn.addEventListener('click', () => {
                events.emit('modal:show', {
                    title: '💡 Подсказка',
                    body: `<p>${this.hintText}</p>`,
                    footer: `<button class="terminal-btn" data-bs-dismiss="modal">ПОНЯТНО</button>`
                });
            });
        }
    }
}