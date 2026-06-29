class SceneRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentScene = null;
        this.locationManager = null;
        this.inventory = null;
        
        if (!this.container) {
            console.error('❌ Контейнер сцены не найден:', containerId);
        } else {
            console.log('✅ SceneRenderer готов');
        }
    }
    
    setLocationManager(manager) {
        this.locationManager = manager;
    }
    
    setInventory(inventory) {
        this.inventory = inventory;
    }
    
    renderLocation(locationId) {
        if (!this.container) return;
        
        const location = getLocationById(locationId);
        if (!location) {
            this._showError('Локация не найдена');
            return;
        }
        
        this.currentScene = location;
        
        let isNight = false;
        let periodName = 'День';
        let timeIcon = '☀️';
        
        try {
            if (this.locationManager?.gameTime) {
                isNight = this.locationManager.gameTime.isNighttime();
                periodName = this.locationManager.gameTime.getPeriodName();
                timeIcon = this.locationManager.gameTime.getIcon();
            }
        } catch(e) {}
        
        let bgImage = null;
        if (location.scenes) {
            bgImage = isNight ? (location.scenes.night || location.scenes.day) : location.scenes.day;
        }
        
        this.container.innerHTML = '';
        
        if (bgImage) {
            this._renderImageScene(location, bgImage, isNight, timeIcon, periodName);
        } else {
            this._renderPlaceholder(location, isNight, timeIcon, periodName);
        }
        
        this.container.style.animation = 'none';
        this.container.offsetHeight;
        this.container.style.animation = 'fade-in 0.4s ease-out';
        
        events.emit('scene:rendered', { locationId, location });
    }
    
    _renderPlaceholder(location, isNight, timeIcon, periodName) {
        const items = this.locationManager?.getLocationItems(location.id) || location.defaultItems || [];
        const subLocations = getSubLocations(location.id) || [];
        const npcsHere = this._getNPCsHere(location.id);
        
        const wrapper = document.createElement('div');
        wrapper.className = 'scene-placeholder-wrapper';
        
        // Заголовок
        const header = document.createElement('div');
        header.className = 'scene-placeholder-header';
        header.innerHTML = `
            <div class="scene-icon-large">${location.icon || '📍'}</div>
            <h2 class="scene-title">${location.name}</h2>
            <p class="scene-description">${location.description || ''}</p>
        `;
        wrapper.appendChild(header);
        
        // Инфо-панель
        const infoPanel = document.createElement('div');
        infoPanel.className = 'scene-info-panel';
        
        infoPanel.innerHTML += `
            <div class="scene-info-badge time-badge">
                <span class="badge-icon">${timeIcon}</span>
                <span>${periodName}</span>
            </div>
        `;
        
        const typeInfo = this._getTypeInfo(location.type);
        if (typeInfo) {
            infoPanel.innerHTML += `
                <div class="scene-info-badge type-badge">
                    <span class="badge-icon">${typeInfo.icon}</span>
                    <span>${typeInfo.label}</span>
                </div>
            `;
        }
        
        if (location.hours && !(location.hours.open === 0 && location.hours.close === 24)) {
            const isOpen = this._isLocationOpenNow(location);
            infoPanel.innerHTML += `
                <div class="scene-info-badge hours-badge ${isOpen ? 'open' : 'closed'}">
                    <span class="badge-icon">🕐</span>
                    <span>${location.hours.open}:00–${location.hours.close}:00</span>
                </div>
            `;
        }
        
        wrapper.appendChild(infoPanel);
        
        // NPC
        if (npcsHere.length > 0) {
            const npcSection = document.createElement('div');
            npcSection.className = 'scene-section';
            npcSection.innerHTML = '<h3 class="scene-section-title">👥 Присутствуют</h3>';
            
            const npcList = document.createElement('div');
            npcList.className = 'scene-npc-chips';
            
            npcsHere.forEach(npc => {
                const chip = document.createElement('div');
                chip.className = 'scene-npc-chip';
                chip.innerHTML = `
                    <span class="npc-chip-icon">${npc.icon}</span>
                    <span class="npc-chip-name">${npc.name}</span>
                    <span class="npc-chip-role">${npc.role}</span>
                `;
                chip.addEventListener('click', () => {
                    events.emit('tab:switched', 'tab-npcs');
                });
                npcList.appendChild(chip);
            });
            
            npcSection.appendChild(npcList);
            wrapper.appendChild(npcSection);
        }
        
        // Объекты
        if (items.length > 0) {
            const objectsSection = document.createElement('div');
            objectsSection.className = 'scene-section';
            objectsSection.innerHTML = '<h3 class="scene-section-title">🔍 Объекты</h3>';
            
            const objectsList = document.createElement('div');
            objectsList.className = 'scene-objects-grid';
            
            items.forEach(itemId => {
                const obj = getObjectById(itemId);
                const card = document.createElement('div');
                card.className = 'scene-object-card';
                card.innerHTML = `
                    <span class="object-card-icon">${obj?.icon || '📌'}</span>
                    <span class="object-card-name">${obj?.name || this._formatItemName(itemId)}</span>
                    ${obj?.isEvidence ? '<span class="object-card-badge">УЛИКА</span>' : ''}
                    ${obj?.takeable ? '<span class="object-card-take">✋</span>' : '<span class="object-card-take static">👁️</span>'}
                `;
                
                card.addEventListener('click', () => {
                    this._onObjectClick(itemId, obj);
                    card.style.transform = 'scale(0.95)';
                    setTimeout(() => card.style.transform = '', 150);
                });
                
                objectsList.appendChild(card);
            });
            
            objectsSection.appendChild(objectsList);
            wrapper.appendChild(objectsSection);
        }
        
        // Подлокации
        if (subLocations.length > 0) {
            const subSection = document.createElement('div');
            subSection.className = 'scene-section';
            subSection.innerHTML = '<h3 class="scene-section-title">🚪 Войти</h3>';
            
            const subList = document.createElement('div');
            subList.className = 'scene-sublocations-list';
            
            subLocations.forEach(sub => {
                const btn = document.createElement('button');
                btn.className = 'scene-sublocation-btn';
                btn.innerHTML = `
                    <span class="sublocation-icon">${sub.icon || '📍'}</span>
                    <span class="sublocation-name">${sub.name}</span>
                    <span class="sublocation-arrow">→</span>
                `;
                btn.addEventListener('click', () => {
                    if (this.locationManager) {
                        this.locationManager.travelTo(sub.id);
                    }
                    this.renderLocation(sub.id);
                });
                subList.appendChild(btn);
            });
            
            subSection.appendChild(subList);
            wrapper.appendChild(subSection);
        }
        
        this.container.appendChild(wrapper);
    }
    
    _renderImageScene(location, bgImage, isNight, timeIcon, periodName) {
        const imageWrapper = document.createElement('div');
        imageWrapper.className = 'scene-image-wrapper';
        imageWrapper.style.backgroundImage = `url(${bgImage})`;
        
        const vignette = document.createElement('div');
        vignette.className = 'scene-vignette';
        imageWrapper.appendChild(vignette);
        
        const topBar = document.createElement('div');
        topBar.className = 'scene-top-bar';
        topBar.innerHTML = `
            <span class="scene-top-icon">${location.icon}</span>
            <span class="scene-top-name">${location.name}</span>
            <span class="scene-top-time">${timeIcon} ${periodName}</span>
        `;
        imageWrapper.appendChild(topBar);
        
        const items = this.locationManager?.getLocationItems(location.id) || location.defaultItems || [];
        items.forEach(itemId => {
            const zone = this._createClickZone(itemId);
            if (zone) imageWrapper.appendChild(zone);
        });
        
        const subLocations = getSubLocations(location.id);
        if (subLocations.length > 0) {
            const subPanel = document.createElement('div');
            subPanel.className = 'scene-subpanel';
            
            subLocations.forEach(sub => {
                const btn = document.createElement('button');
                btn.className = 'scene-subpanel-btn';
                btn.textContent = `${sub.icon} ${sub.name}`;
                btn.addEventListener('click', () => {
                    if (this.locationManager) {
                        this.locationManager.travelTo(sub.id);
                    }
                    this.renderLocation(sub.id);
                });
                subPanel.appendChild(btn);
            });
            
            imageWrapper.appendChild(subPanel);
        }
        
        this.container.appendChild(imageWrapper);
        
        const mapBtn = document.createElement('button');
        mapBtn.className = 'scene-map-btn';
        mapBtn.innerHTML = '🗺️';
        mapBtn.title = 'Открыть карту';
        mapBtn.addEventListener('click', () => {
            events.emit('navigation:go', 'screen-map');
        });
        this.container.appendChild(mapBtn);
    }
    
    _createClickZone(itemId) {
        const coords = this._getObjectCoords(itemId);
        if (!coords) return null;
        
        const zone = document.createElement('div');
        zone.className = 'scene-click-zone';
        zone.style.cssText = `
            left: ${coords[0]}%;
            top: ${coords[1]}%;
            width: ${coords[2]}%;
            height: ${coords[3]}%;
        `;
        zone.dataset.object = itemId;
        
        const obj = getObjectById(itemId);
        zone.title = obj?.name || this._formatItemName(itemId);
        
        zone.addEventListener('click', () => this._onObjectClick(itemId, obj));
        
        return zone;
    }
    
    _showError(message) {
        this.container.innerHTML = `
            <div class="scene-error">
                <span class="scene-error-icon">⚠️</span>
                <p>${message}</p>
            </div>
        `;
    }
    
    _onObjectClick(itemId, obj) {
        if (!obj) obj = getObjectById(itemId);
        const name = obj?.name || this._formatItemName(itemId);
        
        // Отправляем событие взаимодействия
        events.emit('object:interact', { 
            itemId, 
            locationId: this.currentScene?.id 
        });
        
        // Показываем модальное окно с описанием предмета
        const description = obj?.description || 'Нет описания';
        const interactions = obj?.interactions || {};
        const examineText = interactions.examine?.text || description;
        
        events.emit('modal:show', {
            title: `${obj?.icon || '📌'} ${name}`,
            body: `
                <div style="font-family: var(--font-serif); font-size: 14px; color: var(--text-primary); line-height: 1.7;">
                    <p>${examineText}</p>
                    ${obj?.isEvidence ? '<p style="color: var(--accent-amber); margin-top: 8px;">📌 Это улика. Она может пригодиться в расследовании.</p>' : ''}
                    ${obj?.takeable ? '<p style="color: var(--accent-green); margin-top: 8px;">✋ Этот предмет можно взять с собой.</p>' : '<p style="color: var(--text-dim); margin-top: 8px;">👁️ Этот предмет нельзя унести.</p>'}
                </div>
            `,
            footer: `
                ${obj?.takeable ? '<span style="font-size: 11px; color: var(--text-dim);">Предмет добавлен в инвентарь</span>' : ''}
                <button class="terminal-btn" data-bs-dismiss="modal">ЗАКРЫТЬ</button>
            `
        });
    }
    
    _getNPCsHere(locationId) {
        try {
            return window.app?.npcManager?.getNPCsAtLocation(locationId) || [];
        } catch(e) {
            return [];
        }
    }
    
    _getTypeInfo(type) {
        const types = {
            'public': { icon: '🏢', label: 'Публичное место' },
            'private': { icon: '🏠', label: 'Частная территория' },
            'crime_scene': { icon: '🚨', label: 'Место преступления' },
            'evening_venue': { icon: '🍸', label: 'Вечернее заведение' },
            'street': { icon: '🏚️', label: 'Улица' }
        };
        return types[type] || null;
    }
    
    _isLocationOpenNow(location) {
        try {
            const hour = this.locationManager?.gameTime?.hour || 12;
            const { open, close } = location.hours;
            if (close > open) return hour >= open && hour < close;
            return hour >= open || hour < close;
        } catch(e) {
            return true;
        }
    }
    
    _getObjectCoords(itemId) {
        const coordsMap = {
            'bed': [15, 50, 30, 25],
            'bed_304': [15, 50, 30, 25],
            'window_304': [70, 15, 20, 30],
            'wardrobe': [5, 15, 20, 35],
            'mirror': [50, 15, 15, 25],
            'carpet_stain': [40, 70, 25, 15],
            'dumpster': [60, 55, 25, 30],
            'graffiti_wall': [5, 10, 30, 40],
            'broken_lamp': [75, 20, 10, 15],
            'bar_counter': [30, 40, 40, 15],
            'desk': [20, 35, 35, 25],
            'bookshelf': [65, 10, 25, 35],
            'safe': [45, 25, 15, 20],
            'photo_frame': [55, 15, 10, 12]
        };
        return coordsMap[itemId] || null;
    }
    
    _formatItemName(id) {
        const names = {
            'bed': 'Кровать', 'bed_304': 'Кровать',
            'window_304': 'Окно', 'wardrobe': 'Шкаф',
            'mirror': 'Зеркало', 'carpet_stain': 'Пятно на ковре',
            'guest_book': 'Журнал регистрации', 'lobby_phone': 'Телефон',
            'bar_counter': 'Барная стойка', 'jukebox': 'Музыкальный автомат',
            'back_door': 'Чёрный ход', 'dumpster': 'Мусорный бак',
            'graffiti_wall': 'Стена с граффити', 'broken_lamp': 'Разбитый фонарь',
            'desk': 'Письменный стол', 'bookshelf': 'Книжный шкаф',
            'safe': 'Сейф', 'photo_frame': 'Фоторамка',
            'hidden_suitcase': 'Спрятанный чемодан'
        };
        return names[id] || id.replace(/_/g, ' ');
    }
}