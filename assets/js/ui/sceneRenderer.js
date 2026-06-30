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

    setLocationManager(manager) { this.locationManager = manager; }
    setInventory(inventory) { this.inventory = inventory; }

    renderLocation(locationId) {
        if (!this.container) return;

        const location = getLocationById(locationId);
        if (!location) {
            this._showError('Локация не найдена: ' + locationId);
            return;
        }

        this.currentScene = location;

        // Очищаем и рендерим
        this.container.innerHTML = '';
        this._renderPlaceholder(location);

        // Анимация появления
        this.container.style.opacity = '0';
        this.container.style.transition = 'opacity 0.3s ease';
        requestAnimationFrame(() => {
            this.container.style.opacity = '1';
        });

        events.emit('scene:rendered', { locationId, location });
    }

    _renderPlaceholder(location) {
        const wrapper = document.createElement('div');
        wrapper.className = 'scene-placeholder-wrapper';

        const isNight = this.locationManager?.gameTime?.isNighttime() || false;
        const timeIcon = isNight ? '🌙' : '☀️';
        const periodName = isNight ? 'Ночь' : 'День';

        let items = [];
        try {
            items = this.locationManager?.getLocationItems(location.id) || location.defaultItems || [];
        } catch (e) {
            items = location.defaultItems || [];
        }

        const subLocations = getSubLocations(location.id) || [];
        const npcsHere = this._getNPCsHere(location.id);

        // === НАВИГАЦИОННАЯ ПАНЕЛЬ ===
        const navBar = document.createElement('div');
        navBar.className = 'scene-nav-bar';

        // Кнопка "Выйти" для подлокаций
        if (location.parentLocation) {
            const exitBtn = document.createElement('button');
            exitBtn.className = 'scene-nav-btn exit-btn';
            exitBtn.innerHTML = '← ВЫЙТИ';
            exitBtn.addEventListener('click', () => {
                if (this.locationManager) {
                    this.locationManager.travelTo(location.parentLocation);
                }
                this.renderLocation(location.parentLocation);
            });
            navBar.appendChild(exitBtn);
        }

        wrapper.appendChild(navBar);

        // === ЗАГОЛОВОК ===
        const header = document.createElement('div');
        header.className = 'scene-placeholder-header';
        header.innerHTML = `
            <div class="scene-icon-large">${location.icon || '📍'}</div>
            <h2 class="scene-title">${location.name}</h2>
            <p class="scene-description">${location.description || ''}</p>
        `;
        wrapper.appendChild(header);

        // === ИНФО-ПАНЕЛЬ ===
        const infoPanel = document.createElement('div');
        infoPanel.className = 'scene-info-panel';
        infoPanel.innerHTML = `
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
            infoPanel.innerHTML += `
                <div class="scene-info-badge hours-badge open">
                    <span class="badge-icon">🕐</span>
                    <span>${location.hours.open}:00–${location.hours.close}:00</span>
                </div>
            `;
        }
        wrapper.appendChild(infoPanel);

        // === NPC ===
        if (npcsHere.length > 0) {
            const sec = document.createElement('div');
            sec.className = 'scene-section';
            sec.innerHTML = '<h3 class="scene-section-title">👥 Присутствуют</h3><div class="scene-npc-chips"></div>';
            const list = sec.querySelector('.scene-npc-chips');
            npcsHere.forEach(npc => {
                const chip = document.createElement('div');
                chip.className = 'scene-npc-chip';
                chip.innerHTML = `
                    <span class="npc-chip-icon">${npc.icon}</span>
                    <span class="npc-chip-name">${npc.name}</span>
                    <span class="npc-chip-role">${npc.role}</span>
                `;
                chip.addEventListener('click', () => {
                    if (npc.availableForChat) events.emit('npc:chat', npc.id);
                    else events.emit('npc:call', npc.id);
                });
                list.appendChild(chip);
            });
            wrapper.appendChild(sec);
        }

        // === ОБЪЕКТЫ ===
        if (items.length > 0) {
            const sec = document.createElement('div');
            sec.className = 'scene-section';
            sec.innerHTML = '<h3 class="scene-section-title">🔍 Объекты для осмотра</h3><div class="scene-objects-grid"></div>';
            const grid = sec.querySelector('.scene-objects-grid');

            items.forEach(itemId => {
                const obj = getObjectById(itemId);
                if (!obj) return;

                const card = document.createElement('div');
                card.className = 'scene-object-card';
                card.innerHTML = `
                    <span class="object-card-icon">${obj.icon || '📌'}</span>
                    <span class="object-card-name">${obj.name || itemId}</span>
                    ${obj.isEvidence ? '<span class="object-card-badge">УЛИКА</span>' : ''}
                `;
                card.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this._onObjectClick(itemId, obj);
                });
                grid.appendChild(card);
            });
            wrapper.appendChild(sec);
        }

        // === ПОДЛОКАЦИИ ===
        if (subLocations.length > 0) {
            const sec = document.createElement('div');
            sec.className = 'scene-section';
            sec.innerHTML = '<h3 class="scene-section-title">🚪 Войти</h3><div class="scene-sublocations-list"></div>';
            const list = sec.querySelector('.scene-sublocations-list');
            subLocations.forEach(sub => {
                const btn = document.createElement('button');
                btn.className = 'scene-sublocation-btn';
                btn.innerHTML = `
                    <span class="sublocation-icon">${sub.icon || '📍'}</span>
                    <span class="sublocation-name">${sub.name}</span>
                    <span class="sublocation-arrow">→</span>
                `;
                btn.addEventListener('click', () => {
                    if (this.locationManager) this.locationManager.travelTo(sub.id);
                    this.renderLocation(sub.id);
                });
                list.appendChild(btn);
            });
            wrapper.appendChild(sec);
        }

        this.container.appendChild(wrapper);
    }

    _onObjectClick(itemId, obj) {
        if (!obj) obj = getObjectById(itemId);
        if (!obj) return;

        const name = obj.name || itemId;
        events.emit('object:interact', { itemId, locationId: this.currentScene?.id });

        const description = obj.description || 'Описание отсутствует.';
        const examineText = obj.interactions?.examine?.text || description;

        events.emit('modal:show', {
            title: `${obj.icon || '📌'} ${name}`,
            body: `
                <div style="font-family: var(--font-serif); font-size: 15px; color: var(--text-primary); line-height: 1.8;">
                    <p>${examineText}</p>
                    ${obj.isEvidence ? '<p style="color: var(--accent-amber); margin-top: 10px; padding: 8px 12px; background: rgba(212, 160, 23, 0.05); border-left: 3px solid var(--accent-amber);">📌 <strong>Это улика.</strong></p>' : ''}
                    ${obj.takeable ? '<p style="color: var(--accent-amber-glow); margin-top: 6px;">✋ Можно взять с собой.</p>' : '<p style="color: var(--text-dim); margin-top: 6px; font-style: italic;">👁️ Нельзя унести.</p>'}
                </div>
            `,
            footer: `
                ${obj.takeable ? '<span style="font-size: 11px; color: var(--text-dim); margin-right: auto;">Добавлено в инвентарь</span>' : ''}
                <button class="terminal-btn" data-bs-dismiss="modal">ЗАКРЫТЬ</button>
            `
        });
    }

    _showError(msg) {
        this.container.innerHTML = `<div class="scene-error"><span class="scene-error-icon">⚠️</span><p>${msg}</p></div>`;
    }

    _getNPCsHere(locId) {
        try { return window.app?.npcManager?.getNPCsAtLocation(locId) || []; }
        catch (e) { return []; }
    }

    _getTypeInfo(type) {
        const t = {
            'public': { icon: '🏢', label: 'Публичное место' },
            'private': { icon: '🏠', label: 'Частная территория' },
            'crime_scene': { icon: '🚨', label: 'Место преступления' },
            'evening_venue': { icon: '🍸', label: 'Вечернее заведение' },
            'street': { icon: '🏚️', label: 'Улица' }
        };
        return t[type] || null;
    }
}