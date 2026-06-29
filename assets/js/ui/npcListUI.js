class NPCListUI {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.npcManager = null;
        this._init();
    }
    
    setNPCManager(manager) {
        this.npcManager = manager;
        this.render();
        
        // Слушаем обновления
        events.on('npcs:loaded', () => this.render());
        events.on('time:changed', () => this.render());
    }
    
    _init() {
        if (!this.container) return;
        this.render();
    }
    
    render() {
        if (!this.container || !this.npcManager) return;
        
        const npcs = this.npcManager.getAllNPCStatuses();
        
        if (npcs.length === 0) {
            this.container.innerHTML = `
                <div class="npcs-empty">
                    <span class="empty-icon">👥</span>
                    <p>Нет доступных контактов</p>
                </div>
            `;
            return;
        }
        
        this.container.innerHTML = npcs.map(npc => this._createNPCCard(npc)).join('');
        
        // Вешаем обработчики
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
            'nervous': '😰',
            'friendly': '😊',
            'anxious': '😟',
            'professional': '😐',
            'suspicious': '🤨',
            'angry': '😠'
        };
        
        return `
            <div class="npc-card ${npc.available ? '' : 'npc-unavailable'}">
                <div class="npc-header">
                    <span class="npc-avatar">${npc.icon}</span>
                    <div class="npc-info">
                        <span class="npc-name">${npc.name}</span>
                        <span class="npc-role">${npc.role}</span>
                    </div>
                    <span class="npc-mood" title="${npc.mood}">${moodEmojis[npc.mood] || '😐'}</span>
                </div>
                
                <div class="npc-status ${statusColors[npc.reason] || ''}">
                    ${statusIcons[npc.reason] || '❓'} ${npc.message}
                </div>
                
                ${npc.description ? `
                    <div class="npc-description">${npc.description}</div>
                ` : ''}
                
                <div class="npc-actions">
                    ${npc.canCall ? `
                        <button class="terminal-btn npc-call-btn" data-npc-id="${npc.id}">
                            📞 ЗВОНОК
                        </button>
                    ` : ''}
                    
                    ${npc.canChat ? `
                        <button class="terminal-btn npc-chat-btn" data-npc-id="${npc.id}">
                            💬 ЧАТ
                        </button>
                    ` : ''}
                    
                    ${npc.location ? `
                        <button class="terminal-btn npc-visit-btn" data-location="${npc.location}">
                            📍 НАВЕСТИТЬ
                        </button>
                    ` : ''}
                    
                    ${!npc.available ? `
                        <button class="terminal-btn npc-wait-btn" disabled>
                            ⏳ НЕДОСТУПЕН
                        </button>
                    ` : ''}
                </div>
                
                ${npc.insightsGiven.length > 0 ? `
                    <div class="npc-insights">
                        💡 Поделился информацией: ${npc.insightsGiven.length}
                    </div>
                ` : ''}
            </div>
        `;
    }
}