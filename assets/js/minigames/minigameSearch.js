class MinigameSearch extends MinigameBase {
    constructor(config) {
        super({
            id: config.id || 'search',
            name: 'Поиск предметов',
            description: 'Найдите скрытые предметы на изображении',
            difficulty: 1,
            timeCost: 15,
            ...config
        });
        
        this.backgroundImage = config.backgroundImage || '';
        this.itemsToFind = config.itemsToFind || []; // [{id, name, x, y, width, height}]
        this.foundItems = [];
        this.totalItems = this.itemsToFind.length;
        this.timeLimit = config.timeLimit || 60; // секунд
        this.timerInterval = null;
        this.timeLeft = this.timeLimit;
    }
    
    render(container) {
        this.isActive = true;
        this.foundItems = [];
        this.timeLeft = this.timeLimit;
        
        container.innerHTML = `
            <div class="minigame search-game">
                <div class="mg-header">
                    <h3>🔍 ${this.name}</h3>
                    <p class="mg-description">${this.description}</p>
                    <div class="search-progress">
                        Найдено: <span id="search-found">0</span> / ${this.totalItems}
                        | Время: <span id="search-time">${this.timeLeft}</span>с
                    </div>
                </div>
                
                <div class="search-scene" id="search-scene">
                    <img src="${this.backgroundImage}" alt="Сцена поиска" class="search-image">
                    <div class="search-zones" id="search-zones"></div>
                </div>
                
                <div class="search-items-list">
                    <h4>Найти:</h4>
                    <div id="search-items-remaining">
                        ${this.itemsToFind.map(item => `
                            <span class="search-item-tag" data-item-id="${item.id}">
                                📌 ${item.name}
                            </span>
                        `).join('')}
                    </div>
                </div>
                
                <div id="search-feedback" class="mg-feedback hidden"></div>
            </div>
        `;
        
        this._createClickZones(container);
        this._startTimer(container);
    }
    
    _createClickZones(container) {
        const zonesContainer = container.querySelector('#search-zones');
        
        this.itemsToFind.forEach(item => {
            const zone = document.createElement('div');
            zone.className = 'search-click-zone';
            zone.dataset.itemId = item.id;
            zone.style.cssText = `
                position: absolute;
                left: ${item.x}%;
                top: ${item.y}%;
                width: ${item.width}%;
                height: ${item.height}%;
                cursor: pointer;
                border-radius: 50%;
            `;
            
            zone.addEventListener('click', () => {
                if (this.foundItems.includes(item.id)) return;
                
                this.foundItems.push(item.id);
                zone.classList.add('found');
                zone.style.border = '2px solid var(--accent-green)';
                zone.style.background = 'rgba(0, 255, 65, 0.2)';
                zone.style.pointerEvents = 'none';
                
                // Обновляем счётчик
                container.querySelector('#search-found').textContent = this.foundItems.length;
                
                // Отмечаем в списке
                const tag = container.querySelector(`[data-item-id="${item.id}"]`);
                if (tag) {
                    tag.classList.add('found');
                    tag.innerHTML = `✅ ${item.name}`;
                }
                
                // Звук
                events.emit('sfx:play', 'evidence');
                
                // Проверяем завершение
                if (this.foundItems.length >= this.totalItems) {
                    this._stopTimer();
                    container.querySelector('#search-feedback').classList.remove('hidden');
                    container.querySelector('#search-feedback').innerHTML = `
                        <div class="feedback-success">✅ Все предметы найдены!</div>
                    `;
                    setTimeout(() => this.complete(), 1500);
                }
            });
            
            zonesContainer.appendChild(zone);
        });
    }
    
    _startTimer(container) {
        const timeDisplay = container.querySelector('#search-time');
        
        this.timerInterval = setInterval(() => {
            this.timeLeft--;
            timeDisplay.textContent = this.timeLeft;
            
            if (this.timeLeft <= 10) {
                timeDisplay.style.color = 'var(--accent-red-bright)';
            }
            
            if (this.timeLeft <= 0) {
                this._stopTimer();
                this.fail('time_out');
                container.querySelector('#search-feedback').classList.remove('hidden');
                container.querySelector('#search-feedback').innerHTML = `
                    <div class="feedback-error">⏰ Время вышло!</div>
                `;
                
                // Показываем оставшиеся
                container.querySelectorAll('.search-click-zone').forEach(zone => {
                    if (!zone.classList.contains('found')) {
                        zone.style.border = '2px dashed var(--accent-red-bright)';
                        zone.style.background = 'rgba(255, 48, 48, 0.1)';
                    }
                });
            }
        }, 1000);
    }
    
    _stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    reset() {
        super.reset();
        this._stopTimer();
        this.foundItems = [];
        this.timeLeft = this.timeLimit;
    }
}