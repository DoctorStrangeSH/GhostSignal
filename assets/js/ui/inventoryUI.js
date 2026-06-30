class InventoryUI {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.inventory = null;
        this._selectedItem = null;
        this._init();
    }
    
    setInventory(inventory) {
        this.inventory = inventory;
        this.render();
        
        // Слушаем изменения
        events.on('inventory:changed', () => this.render());
    }
    
    _init() {
        if (!this.container) return;
        
        // Создаём базовую структуру
        this.container.innerHTML = `
            <div class="inventory-header">
                <span class="inv-title">🎒 ИНВЕНТАРЬ</span>
                <span class="inv-weight" id="inv-weight">0/${this.inventory?.maxWeight || 20}</span>
            </div>
            <div class="inventory-grid" id="inventory-grid"></div>
            <div class="inventory-footer">
                <span class="inv-hint">🖱️ Клик — осмотреть</span>
                <span class="inv-hint">🔄 ПКМ — использовать</span>
            </div>
        `;
    }
    
    render() {
        if (!this.inventory || !this.container) return;
        
        const grid = this.container.querySelector('#inventory-grid');
        const weightDisplay = this.container.querySelector('#inv-weight');
        
        if (!grid) return;
        
        const items = this.inventory.getAllItems();
        
        // Обновляем вес
        if (weightDisplay) {
            weightDisplay.textContent = `${this.inventory.currentWeight}/${this.inventory.maxWeight}`;
        }
        
        // Очищаем сетку
        grid.innerHTML = '';
        
        if (items.length === 0) {
            grid.innerHTML = `
                <div class="inventory-empty">
                    <span class="empty-icon">📭</span>
                    <p>Инвентарь пуст</p>
                    <p class="empty-hint">Осматривайте локации, чтобы найти предметы</p>
                </div>
            `;
            return;
        }
        
        // Рендерим предметы
        items.forEach(item => {
            const card = this._createItemCard(item);
            grid.appendChild(card);
        });
    }
    
    _createItemCard(item) {
        const card = document.createElement('div');
        card.className = 'inventory-card';
        card.dataset.itemId = item.id;
        
        if (item.isEvidence) card.classList.add('card-evidence');
        if (item.isKeyItem) card.classList.add('card-key');
        if (item.id === this._selectedItem) card.classList.add('card-selected');
        
        card.innerHTML = `
            <span class="card-icon">${item.icon}</span>
            <span class="card-name">${item.name}</span>
            ${item.isEvidence ? '<span class="card-badge">УЛИКА</span>' : ''}
        `;
        
        // Левый клик — осмотреть
        card.addEventListener('click', () => {
            this._selectItem(item.id);
            this._showItemDetails(item);
        });
        
        // Правый клик — контекстное меню
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this._showContextMenu(e, item);
        });
        
        // Drag & Drop для комбинирования
        card.draggable = true;
        card.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', item.id);
            card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
        });
        
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            card.classList.add('drop-target');
        });
        card.addEventListener('dragleave', () => {
            card.classList.remove('drop-target');
        });
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            card.classList.remove('drop-target');
            const draggedId = e.dataTransfer.getData('text/plain');
            if (draggedId !== item.id && this.inventory) {
                const result = this.inventory.combineItems(draggedId, item.id);
                if (result) {
                    events.emit('notification:show', {
                        message: result.text,
                        type: 'info',
                        duration: 3000
                    });
                }
            }
        });
        
        return card;
    }
    
    _selectItem(itemId) {
        this._selectedItem = this._selectedItem === itemId ? null : itemId;
        this.render();
    }
    
    _showItemDetails(item) {
        const details = item.interactions?.examine || { text: item.description, timeCost: 5 };
        
        events.emit('modal:show', {
            title: `${item.icon} ${item.name}`,
            body: `
                <p>${details.text || item.description}</p>
                ${item.isEvidence ? '<p class="text-accent">📌 Это улика. Она может пригодиться на доске расследования.</p>' : ''}
                ${item.isKeyItem ? '<p class="text-accent">🔑 Ключевой предмет. Может открыть новые локации.</p>' : ''}
            `,
            footer: `
                ${item.takeable ? '' : '<span class="text-dim">Этот предмет нельзя взять с собой</span>'}
            `
        });
        
        // Тратим время на осмотр
        if (this.inventory) {
            events.emit('time:advance', details.timeCost || 5);
        }
    }
    
    _showContextMenu(event, item) {
        // Удаляем старое меню
        document.querySelector('.context-menu')?.remove();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu terminal-modal';
        menu.style.cssText = `
            position: fixed;
            left: ${event.clientX}px;
            top: ${event.clientY}px;
            background: var(--bg-elevated);
            border: 1px solid var(--border-active);
            padding: 4px;
            z-index: 3000;
            min-width: 150px;
        `;
        
        const actions = [
            { label: '🔍 Осмотреть', action: () => this._showItemDetails(item) },
            { label: '🔄 Использовать', action: () => this._useItem(item) },
        ];
        
        if (item.isEvidence) {
            actions.push({ label: '📋 На доску', action: () => {
                events.emit('board:addEvidence', item.id);
            }});
        }
        
        actions.forEach(act => {
            const btn = document.createElement('button');
            btn.className = 'terminal-btn';
            btn.style.cssText = 'display:block;width:100%;padding:6px 12px;font-size:12px;border:none;';
            btn.textContent = act.label;
            btn.addEventListener('click', () => {
                act.action();
                menu.remove();
            });
            menu.appendChild(btn);
        });
        
        document.body.appendChild(menu);
        
        // Клик вне меню — закрыть
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    }
    
    _useItem(item) {
        if (!this.inventory) return;
        
        const result = this.inventory.useItem(item.id);
        events.emit('notification:show', {
            message: result.text,
            type: 'info',
            duration: 3000
        });
    }
}