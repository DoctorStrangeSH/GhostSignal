class MinigameCipher extends MinigameBase {
    constructor(config) {
        super({
            id: config.id || 'cipher',
            name: 'Шифр',
            description: 'Расшифруйте секретное сообщение',
            difficulty: 2,
            timeCost: 15,
            ...config
        });
        
        this.cipherType = config.cipherType || 'caesar'; // caesar, substitution, vigenere
        this.encryptedText = config.encryptedText || '';
        this.decryptedText = config.decryptedText || '';
        this.shift = config.shift || 3;
        this.hint = config.hint || '';
        this.attempts = 0;
        this.maxAttempts = config.maxAttempts || 5;
    }
    
    render(container) {
        this.isActive = true;
        
        container.innerHTML = `
            <div class="minigame cipher-game">
                <div class="mg-header">
                    <h3>🔐 ${this.name}</h3>
                    <p class="mg-description">${this.description}</p>
                    ${this.hint ? `<p class="mg-hint">💡 Подсказка: ${this.hint}</p>` : ''}
                </div>
                
                <div class="cipher-encrypted">
                    <label>Зашифрованный текст:</label>
                    <div class="cipher-text encrypted">${this.encryptedText}</div>
                </div>
                
                <div class="cipher-input-area">
                    <label for="cipher-answer">Ваша расшифровка:</label>
                    <input type="text" id="cipher-answer" class="terminal-input" 
                           placeholder="Введите расшифрованный текст..." autocomplete="off">
                    <div class="cipher-hint-text">
                        <span>Сдвиг: попробуйте угадать или используйте подсказку</span>
                    </div>
                </div>
                
                <div class="cipher-controls">
                    <button id="btn-cipher-check" class="terminal-btn">✅ ПРОВЕРИТЬ</button>
                    <button id="btn-cipher-hint" class="terminal-btn">💡 ПОДСКАЗКА (${this.maxAttempts - this.attempts})</button>
                    <button id="btn-cipher-reset" class="terminal-btn">🔄 СБРОС</button>
                </div>
                
                <div id="cipher-feedback" class="mg-feedback hidden"></div>
                
                <div class="cipher-attempts">
                    Попыток: <span id="cipher-attempts-count">${this.attempts}</span> / ${this.maxAttempts}
                </div>
            </div>
        `;
        
        this._bindEvents(container);
    }
    
    _bindEvents(container) {
        const input = container.querySelector('#cipher-answer');
        const checkBtn = container.querySelector('#btn-cipher-check');
        const hintBtn = container.querySelector('#btn-cipher-hint');
        const resetBtn = container.querySelector('#btn-cipher-reset');
        const feedback = container.querySelector('#cipher-feedback');
        const attemptsCount = container.querySelector('#cipher-attempts-count');
        
        // Проверка по Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') checkBtn.click();
        });
        
        // Проверка ответа
        checkBtn.addEventListener('click', () => {
            const answer = input.value.trim().toLowerCase();
            const correct = this.decryptedText.toLowerCase();
            
            this.attempts++;
            attemptsCount.textContent = this.attempts;
            
            // Проверка с容忍 опечаток
            const distance = this._levenshtein(answer, correct);
            const maxDistance = Math.floor(correct.length * 0.2); // 20% опечаток
            
            feedback.classList.remove('hidden');
            
            if (answer === correct || distance <= maxDistance) {
                feedback.innerHTML = `
                    <div class="feedback-success">
                        ✅ Верно! Сообщение расшифровано.
                    </div>
                `;
                input.disabled = true;
                checkBtn.disabled = true;
                
                setTimeout(() => this.complete(), 1500);
            } else {
                feedback.innerHTML = `
                    <div class="feedback-error">
                        ❌ Неверно. Попробуйте ещё раз.
                        ${distance <= correct.length * 0.4 ? '<br>💡 Вы близко к разгадке!' : ''}
                    </div>
                `;
                
                if (this.attempts >= this.maxAttempts) {
                    feedback.innerHTML += `
                        <div class="feedback-error">
                            <br>Исчерпаны все попытки.
                        </div>
                    `;
                    checkBtn.disabled = true;
                    input.disabled = true;
                    this.fail('max_attempts');
                }
            }
        });
        
        // Подсказка
        hintBtn.addEventListener('click', () => {
            if (this.attempts >= this.maxAttempts) return;
            
            // Показываем подсказку (например, первую букву)
            const hint = this.decryptedText.substring(0, this.attempts + 1);
            input.value = hint;
            input.focus();
            
            events.emit('notification:show', {
                message: `Подсказка: первые буквы — "${hint}"`,
                type: 'info',
                duration: 3000
            });
        });
        
        // Сброс
        resetBtn.addEventListener('click', () => {
            input.value = '';
            feedback.classList.add('hidden');
            input.disabled = false;
            checkBtn.disabled = false;
            input.focus();
        });
        
        // Фокус на ввод
        setTimeout(() => input.focus(), 100);
    }
    
    _levenshtein(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        return matrix[b.length][a.length];
    }
}