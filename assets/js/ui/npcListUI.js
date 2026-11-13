class NPCListUI {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.npcManager = null;
        this._init();
    }
    
    setNPCManager(manager) {
        this.npcManager = manager;
        events.on('npcs:loaded', () => this.render());
        events.on('time:changed', () => this.render());
        events.on('npc:memory_changed', () => this.render());
        events.on('npc:contradiction_presented', () => this.render());
        this.render();
    }
    
    _init() {
        if (!this.container) {
            console.error('❌ Контейнер NPC не найден');
            return;
        }
        this.render();
    }
    
    render() {
        if (!this.container) return;
        
        // Если менеджера нет — показываем заглушку
        if (!this.npcManager) {
            this.container.innerHTML = `
                <div class="npcs-empty">
                    <span class="empty-icon">👥</span>
                    <p>Загрузите дело чтобы увидеть контакты</p>
                </div>
            `;
            return;
        }
        
        const npcs = this.npcManager.getAllNPCStatuses();
        
        if (!npcs || npcs.length === 0) {
            this.container.innerHTML = `
                <div class="npcs-empty">
                    <span class="empty-icon">👥</span>
                    <p>Нет доступных контактов</p>
                </div>
            `;
            return;
        }
        
        // Рендерим карточки
        this.container.innerHTML = npcs.map(npc => this._createNPCCard(npc)).join('');
        
        // Вешаем обработчики
        this._bindEvents();
    }
    
    _createNPCCard(npc) {
        const statusIcons = {
            'at_work': '💼',
            'at_home': '🏠',
            'sleeping': '😴',
            'unavailable': '🚫',
            'awake': '✅'
        };
        
        const statusColors = {
            'at_work': 'status-work',
            'at_home': 'status-home',
            'sleeping': 'status-sleep',
            'unavailable': 'status-offline'
        };
        
        const moodEmojis = {
            'nervous': '😰', 'friendly': '😊', 'anxious': '😟',
            'professional': '😐', 'suspicious': '🤨', 'angry': '😠',
            'sad': '😢', 'crying': '😭', 'scared': '😱',
            'cold': '😒', 'arrogant': '😏', 'defensive': '😤',
            'hopeful': '🥹', 'broken': '💔', 'sharp': '🧐',
            'confident': '😎'
        };
        
        return `
            <div class="npc-card ${npc.available ? '' : 'npc-unavailable'}">
                <div class="npc-header">
                    <span class="npc-avatar">${npc.icon || '👤'}</span>
                    <div class="npc-info">
                        <span class="npc-name">${npc.name || 'Неизвестно'}</span>
                        <span class="npc-role">${npc.role || ''}</span>
                    </div>
                    <span class="npc-mood" title="${npc.mood || 'neutral'}">${moodEmojis[npc.mood] || '😐'}</span>
                </div>
                
                <div class="npc-status ${statusColors[npc.reason] || ''}">
                    ${statusIcons[npc.reason] || '❓'} ${npc.message || 'Статус неизвестен'}
                </div>
                
                ${npc.description ? `<div class="npc-description">${npc.description}</div>` : ''}
                
                <div class="npc-actions">
                    ${npc.canCall ? `<button class="terminal-btn npc-call-btn" data-npc-id="${npc.id}">📞 ЗВОНОК</button>` : ''}
                    ${npc.canChat ? `<button class="terminal-btn npc-chat-btn" data-npc-id="${npc.id}">💬 ЧАТ</button>` : ''}
                    ${npc.location ? `<button class="terminal-btn npc-visit-btn" data-location="${npc.location}">📍 НАВЕСТИТЬ</button>` : ''}
                    ${npc.available ? `<button class="terminal-btn npc-talk-btn" data-npc-id="${npc.id}">💬 ГОВОРИТЬ</button>` : ''}
                    ${!npc.available ? `<button class="terminal-btn npc-wait-btn" disabled>⏳ НЕДОСТУПЕН</button>` : ''}
                </div>
                
                ${npc.memory ? `
                    <div class="npc-memory">
                        <div class="npc-memory-heading"><span>ДОВЕРИЕ</span><strong>${npc.memory.trust}%</strong></div>
                        <div class="npc-trust-track"><span style="width: ${npc.memory.trust}%;"></span></div>
                        <div class="npc-memory-meta">Разговоров: ${npc.memory.conversations} · Улик предъявлено: ${npc.memory.presentedEvidence.length}</div>
                        ${npc.psychology ? `
                            <div class="npc-psychology-state state-${npc.psychology.disposition}">
                                <span>СОСТОЯНИЕ</span><strong>${npc.psychology.label}</strong>
                            </div>
                        ` : ''}
                        ${npc.socialLinks?.length ? `
                            <div class="npc-social-links">
                                <div class="npc-social-links-heading">СОЦИАЛЬНЫЕ СВЯЗИ</div>
                                ${npc.socialLinks.slice(0, 4).map(link => `
                                    <div class="npc-social-link">
                                        <span>${link.name}</span>
                                        <small>${link.label} · ${link.trust}%</small>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        ${npc.memory.liesExposed?.length ? `
                            <div class="npc-lies-exposed">⚠ Раскрыто ложных показаний: ${npc.memory.liesExposed.length}</div>
                        ` : ''}
                        ${npc.rumors?.length ? `
                            <div class="npc-rumors">
                                <div class="npc-rumors-heading">СВЕДЕНИЯ О ДЕТЕКТИВЕ</div>
                                ${[...npc.rumors].slice(-2).reverse().map(rumor => `
                                    <div class="npc-rumor">
                                        <span>ПЕРЕДАЛ ${rumor.reportedByName || 'СВИДЕТЕЛЬ'}${rumor.originalSourceName && rumor.originalSourceName !== rumor.reportedByName ? ' · ИСТОЧНИК: ' + rumor.originalSourceName : ''} · ${{ unverified: 'НЕПРОВЕРЕНО', corroborated: 'ПОДТВЕРЖДЕНО', disputed: 'ОСПАРИВАЕТСЯ' }[rumor.status] || 'НЕПРОВЕРЕНО'}</span>
                                        <p>${rumor.text}</p>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        ${npc.memory.accusations?.length ? `
                            <div class="npc-accusations">
                                <div class="npc-accusations-heading">ОБВИНЕНИЯ ДЕТЕКТИВА</div>
                                ${[...npc.memory.accusations].slice(-2).reverse().map(accusation => {
                                    const labels = { pending: 'НЕ СНЯТО', false: 'ЛОЖНОЕ ОБВИНЕНИЕ', retracted: 'ОТОЗВАНО', substantiated: 'ПОДТВЕРЖДЕНО' };
                                    return `<div class="npc-accusation accusation-${accusation.status}">
                                        <span>${labels[accusation.status] || 'ЗАПИСАНО'}</span>
                                        <p>${accusation.text}</p>
                                    </div>`;
                                }).join('')}
                            </div>
                        ` : ''}
                        ${npc.promises?.length ? `
                            <div class="npc-promises">
                                <div class="npc-promises-heading">ОБЕЩАНИЯ ДЕТЕКТИВА</div>
                                ${[...npc.promises].slice(-2).reverse().map(promise => {
                                    const labels = { pending: 'ОЖИДАЕТ', fulfilled: 'ВЫПОЛНЕНО', broken: 'НАРУШЕНО' };
                                    return `<div class="npc-promise promise-${promise.status}">
                                        <span>${labels[promise.status] || 'ЗАПИСАНО'}</span>
                                        <p>${promise.text}</p>
                                    </div>`;
                                }).join('')}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
                ${npc.insightsGiven && npc.insightsGiven.length > 0 ? `
                    <div class="npc-insights">💡 Поделился информацией: ${npc.insightsGiven.length}</div>
                ` : ''}
            </div>
        `;
    }
    
    _bindEvents() {
        if (!this.container) return;
        
        this.container.querySelectorAll('.npc-call-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const npcId = btn.dataset.npcId;
                if (npcId) events.emit('npc:call', npcId);
            });
        });
        
        this.container.querySelectorAll('.npc-chat-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const npcId = btn.dataset.npcId;
                if (npcId) events.emit('npc:chat', npcId);
            });
        });
        
        this.container.querySelectorAll('.npc-visit-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const locationId = btn.dataset.location;
                if (locationId) events.emit('location:travel', locationId);
            });
        });
        
        this.container.querySelectorAll('.npc-talk-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const npcId = btn.dataset.npcId;
                const npc = getNPCById(npcId);
                if (npc?.availableForChat) {
                    events.emit('npc:chat', npcId);
                } else {
                    events.emit('npc:call', npcId);
                }
            });
        });
    }
}