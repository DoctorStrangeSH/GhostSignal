class BoardUI {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.board = null;
        this.inventory = null;
        this._draggedEvidence = null;
        this._init();
    }
    
    setBoard(board) {
        this.board = board;
        this.render();
    }
    
    setInventory(inventory) {
        this.inventory = inventory;
        this.render();
    }
    
    _init() {
        if (!this.container) return;
        events.on('board:updated', () => this.render());
        events.on('inventory:changed', () => this.render());
    }
    
    render() {
        if (!this.container || !this.board) return;
        
        this.container.innerHTML = `
            <div class="board-header">
                <span class="board-title">📋 ДОСКА РАССЛЕДОВАНИЯ</span>
                <button id="btn-board-reset" class="terminal-btn btn-sm">🔄 СБРОС</button>
            </div>
            
            <div class="board-canvas" id="board-canvas">
                <svg class="board-connections" id="board-connections"></svg>
                <div class="board-slots" id="board-slots">${this._renderSlots()}</div>
            </div>
            
            <div class="board-evidence-pool">
                <h4>📦 Доступные улики:</h4>
                <div class="evidence-pool-items" id="evidence-pool">${this._renderEvidencePool()}</div>
            </div>
        `;
        
        this._bindEvents();
        setTimeout(() => this._drawConnections(), 100);
    }
    
    _renderSlots() {
        if (!this.board) return '';
        return this.board.slots.map(slot => {
            const evidence = slot.evidenceId ? getObjectById(slot.evidenceId) : null;
            return `
                <div class="board-slot ${evidence ? 'slot-filled' : 'slot-empty'}"
                     id="${slot.id}"
                     style="left: ${slot.x}%; top: ${slot.y}%;"
                     data-slot-id="${slot.id}">
                    <div class="slot-label">${slot.label}</div>
                    <div class="slot-content">
                        ${evidence ? `
                            <span class="slot-evidence-icon">${evidence.icon}</span>
                            <span class="slot-evidence-name">${evidence.name}</span>
                            <button class="slot-remove-btn" data-slot="${slot.id}">✕</button>
                        ` : `
                            <span class="slot-placeholder">Перетащите улику</span>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    _renderEvidencePool() {
        if (!this.inventory || !this.board) return '';
        const available = this.board.getAvailableEvidence(this.inventory.evidence);
        const evidenceObjects = getObjectsByIds(available);
        if (evidenceObjects.length === 0) return '<div class="pool-empty">Все улики на доске</div>';
        return evidenceObjects.map(ev => `
            <div class="evidence-pool-item" draggable="true" data-evidence-id="${ev.id}">
                <span class="pool-icon">${ev.icon}</span>
                <span class="pool-name">${ev.name}</span>
            </div>
        `).join('');
    }
    
    _bindEvents() {
        // Drag & Drop из пула в слоты
        this.container.querySelectorAll('.evidence-pool-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this._draggedEvidence = item.dataset.evidenceId;
                item.classList.add('dragging');
                e.dataTransfer.setData('text/plain', item.dataset.evidenceId);
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                this._draggedEvidence = null;
            });
        });
        
        // Слоты принимают улики
        this.container.querySelectorAll('.board-slot').forEach(slot => {
            slot.addEventListener('dragover', (e) => {
                e.preventDefault();
                slot.classList.add('drop-target');
            });
            slot.addEventListener('dragleave', () => {
                slot.classList.remove('drop-target');
            });
            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                slot.classList.remove('drop-target');
                const evidenceId = e.dataTransfer.getData('text/plain') || this._draggedEvidence;
                const slotId = slot.dataset.slotId;
                if (evidenceId && slotId && this.board) {
                    this.board.placeEvidence(evidenceId, slotId);
                }
            });
        });
        
        // Мобильный Drag & Drop (touch)
        this.container.querySelectorAll('.evidence-pool-item').forEach(item => {
            item.addEventListener('touchstart', (e) => {
                this._draggedEvidence = item.dataset.evidenceId;
                item.classList.add('dragging');
            });
            item.addEventListener('touchend', () => {
                item.classList.remove('dragging');
            });
        });
        
        this.container.querySelectorAll('.board-slot').forEach(slot => {
            slot.addEventListener('touchmove', (e) => e.preventDefault());
            slot.addEventListener('touchend', (e) => {
                if (this._draggedEvidence && this.board) {
                    const touch = e.changedTouches[0];
                    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
                    const targetSlot = targetEl?.closest('.board-slot');
                    if (targetSlot) {
                        const slotId = targetSlot.dataset.slotId;
                        this.board.placeEvidence(this._draggedEvidence, slotId);
                    }
                }
                this._draggedEvidence = null;
            });
        });
        
        // Кнопки удаления
        this.container.querySelectorAll('.slot-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const slotId = btn.dataset.slot;
                if (slotId && this.board) this.board.removeEvidence(slotId);
            });
        });
        
        // Сброс доски
        this.container.querySelector('#btn-board-reset')?.addEventListener('click', () => {
            if (this.board) this.board.reset();
        });
    }
    
    _drawConnections() {
        const svg = this.container?.querySelector('#board-connections');
        if (!svg || !this.board) return;
        
        const canvas = this.container.querySelector('#board-canvas');
        if (!canvas) return;
        
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.style.width = width + 'px';
        svg.style.height = height + 'px';
        
        let linesHTML = '';
        
        this.board.connections.forEach(conn => {
            const slotFrom = this.board.slots.find(s => s.id === conn.from);
            const slotTo = this.board.slots.find(s => s.id === conn.to);
            
            if (slotFrom && slotTo) {
                const x1 = (slotFrom.x / 100) * width;
                const y1 = (slotFrom.y / 100) * height;
                const x2 = (slotTo.x / 100) * width;
                const y2 = (slotTo.y / 100) * height;
                
                const isActive = slotFrom.evidenceId && slotTo.evidenceId;
                
                linesHTML += `
                    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                          class="connection-line ${conn.type} ${isActive ? 'active' : ''}"
                          stroke-dasharray="${conn.type === 'dashed' ? '8,6' : 'none'}"/>
                `;
            }
        });
        
        svg.innerHTML = linesHTML;
    }
}