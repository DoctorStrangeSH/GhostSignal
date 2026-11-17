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
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        card.setAttribute('aria-label', `Осмотреть: ${item.name}`);

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
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                card.click();
            }
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
        const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
        const evidenceKind = this._evidenceKind(item);
        const inspection = escape(details.text || item.description || 'Подробности ещё не установлены.');

        events.emit('modal:show', {
            title: `${item.icon || '🔎'} ${item.name}`,
            body: `
                <article class="evidence-inspection ${item.isEvidence ? 'is-evidence' : ''}" aria-label="Осмотр предмета">
                    <header class="evidence-inspection-header">
                        <span class="evidence-inspection-class">${item.isEvidence ? 'МАТЕРИАЛ ДЕЛА' : item.isKeyItem ? 'ВАЖНЫЙ ПРЕДМЕТ' : 'ПРЕДМЕТ'}</span>
                        <span class="evidence-inspection-kind">${escape(evidenceKind)}</span>
                    </header>
                    <div class="evidence-inspection-sheet">
                        <div class="evidence-inspection-mark" aria-hidden="true">${escape(item.icon || '📄')}</div>
                        <h3>${escape(item.name)}</h3>
                        ${item.id === 'bar_photo' ? this._renderBarPhotoStudy() : ''}
                        <p class="evidence-inspection-text">${inspection}</p>
                    </div>
                    <footer class="evidence-inspection-footer">
                        ${item.isEvidence ? '<span>📌 Можно сопоставить с другими уликами на доске расследования.</span>' : ''}
                        ${item.isKeyItem ? '<span>🔑 Ключевой предмет может открыть новый путь расследования.</span>' : ''}
                        <span>Время осмотра: ${Number.isFinite(Number(details.timeCost)) && Number(details.timeCost) > 0 ? Number(details.timeCost) : 5} мин.</span>
                    </footer>
                </article>
            `,
            footer: `
                ${item.takeable ? '' : '<span class="text-dim">Этот предмет нельзя взять с собой</span>'}
            `
        });

        if (item.id === 'bar_photo') this._bindBarPhotoStudy();

        // Тратим время на осмотр
        if (this.inventory) {
            events.emit('time:advance', details.timeCost || 5);
        }
    }

    _renderBarPhotoStudy() {
        const observations = this._barPhotoObservations();
        const studied = Object.keys(observations).filter(id => this.inventory?.hasInsight?.(`bar_photo_observed_${id}`)).length;
        return `<section class="photo-study" aria-label="Подробное изучение снимка">
            <div class="photo-study-frame" id="photo-study-frame"><img src="assets/art/evidence/bar-contact-print.webp" alt="Архивный чёрно-белый снимок бара: мужчина наклоняется у стойки, женщина отворачивается, официант находится за стойкой" loading="lazy"></div>
            <button type="button" class="photo-study-zoom" data-photo-zoom aria-pressed="false" aria-controls="photo-study-frame">⌕ Увеличить снимок</button>
            <p class="photo-study-hint">Выберите участок снимка для наблюдения. Фотография не доказывает, какой предмет был поднят.</p>
            <div class="photo-study-actions" role="group" aria-label="Участки фотографии">
                <button type="button" data-photo-focus="counter" aria-pressed="false" class="terminal-btn">01 · У СТОЙКИ</button>
                <button type="button" data-photo-focus="woman" aria-pressed="false" class="terminal-btn">02 · ПОСЕТИТЕЛЬНИЦА</button>
                <button type="button" data-photo-focus="waiter" aria-pressed="false" class="terminal-btn">03 · ОФИЦИАНТ</button>
            </div>
            <p class="photo-study-progress">Изучено участков: <span id="photo-study-count">${studied}</span> из 3</p>
            <p class="photo-study-observation" id="photo-study-observation" role="status" aria-live="polite">Выберите интересующий фрагмент.</p>
            <details class="photo-study-journal"><summary>Журнал наблюдений (<span id="photo-study-journal-count">${studied}</span>)</summary>
                <ol id="photo-study-journal-list">${this._barPhotoJournalEntries(observations)}</ol>
            </details>
        </section>`;
    }

    _barPhotoObservations() {
        return {
            counter: 'Мужчина наклоняется у стойки и держит салфетку. Небольшой предмет на снимке не опознаётся: по этому кадру нельзя установить, что именно он взял.',
            woman: 'Женщина отворачивается от стойки. Снимок показывает положение людей в один момент, но не позволяет определить, что она видела.',
            waiter: 'Официант находится за стойкой. Направление его взгляда на фотографии неоднозначно; нужно отдельно проверить его показания.'
        };
    }

    _barPhotoJournalEntries(observations = this._barPhotoObservations()) {
        const labels = { counter: 'У стойки', woman: 'Посетительница', waiter: 'Официант' };
        const entries = Object.keys(observations).filter(id => this.inventory?.hasInsight?.(`bar_photo_observed_${id}`));
        return entries.length
            ? entries.map(id => `<li><strong>${labels[id]}</strong><p>${observations[id]}</p></li>`).join('')
            : '<li class="photo-study-empty">Пока нет записей. Изучите участок фотографии.</li>';
    }

    _bindBarPhotoStudy() {
        const panel = document.getElementById('modal-body')?.querySelector('.photo-study');
        if (!panel) return;
        const observations = this._barPhotoObservations();
        const zoom = panel.querySelector('[data-photo-zoom]');
        zoom?.addEventListener('click', () => {
            const enlarged = panel.querySelector('#photo-study-frame')?.classList.toggle('is-enlarged');
            zoom.setAttribute('aria-pressed', String(Boolean(enlarged)));
            zoom.textContent = enlarged ? '⌕ Вернуть размер' : '⌕ Увеличить снимок';
        });
        panel.querySelectorAll('[data-photo-focus]').forEach(button => button.addEventListener('click', () => {
            const focus = button.dataset.photoFocus;
            if (!Object.hasOwn(observations, focus)) return;
            panel.querySelectorAll('[data-photo-focus]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
            panel.querySelector('#photo-study-observation').textContent = observations[focus];
            this.inventory?.addInsight?.(`bar_photo_observed_${focus}`);
            const count = ['counter', 'woman', 'waiter'].filter(id => this.inventory?.hasInsight?.(`bar_photo_observed_${id}`)).length;
            const counter = panel.querySelector('#photo-study-count');
            if (counter) counter.textContent = String(count);
            const journalCount = panel.querySelector('#photo-study-journal-count');
            if (journalCount) journalCount.textContent = String(count);
            const journal = panel.querySelector('#photo-study-journal-list');
            if (journal) journal.innerHTML = this._barPhotoJournalEntries(observations);
        }));
    }

    _evidenceKind(item) {
        const icon = String(item?.icon || '');
        const name = String(item?.name || '').toLowerCase();
        if (/📸|📷|фото|снимок|негатив/.test(icon + name)) return 'ФОТОМАТЕРИАЛ';
        if (/💌|✉|📨|письмо|записка|телеграм/.test(icon + name)) return 'ПЕРЕПИСКА';
        if (/💊|🧪|💉|рецепт|аптек|препарат|яд/.test(icon + name)) return 'ВЕЩЕСТВЕННОЕ ДОКАЗАТЕЛЬСТВО';
        if (/📋|📄|📰|📚|журнал|протокол|выписка|реестр|договор/.test(icon + name)) return 'ДОКУМЕНТ';
        return item?.isEvidence ? 'УЛИКА' : 'ОСМОТР';
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
