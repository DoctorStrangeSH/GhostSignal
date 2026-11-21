/**
 * AchievementScreen
 * Dedicated collection screen for the extensible achievement registry.
 */
class AchievementScreen {
    constructor(containerId, achievementSystem = null) {
        this.container = document.getElementById(containerId);
        this.achievementSystem = achievementSystem;
        this.filter = 'all';
        this.bound = false;
        this.onBack = null;
    }

    setOnBack(handler) {
        this.onBack = typeof handler === 'function' ? handler : null;
    }

    setSystem(system) {
        this.achievementSystem = system || null;
    }

    _escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    }

    _date(value) {
        if (!value) return 'Получено ранее';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Получено ранее';
        return new Intl.DateTimeFormat('ru-RU', {
            day: '2-digit', month: 'long', year: 'numeric'
        }).format(date);
    }

    _visibleItems(items) {
        return items.filter(item => {
            if (this.filter === 'unlocked') return item.unlocked;
            if (this.filter === 'locked') return !item.unlocked;
            if (this.filter === 'secret') return item.secret && !item.unlocked;
            return true;
        });
    }

    render() {
        if (!this.container || !this.achievementSystem) return;
        const items = this.achievementSystem.getAll();
        const summary = this.achievementSystem.getSummary();
        const visible = this._visibleItems(items);
        const filters = [
            ['all', 'Все'], ['unlocked', 'Полученные'], ['locked', 'Не полученные'], ['secret', 'Секретные']
        ];

        this.container.innerHTML = `
            <div class="achievement-screen">
                <header class="achievement-screen-header">
                    <div>
                        <div class="achievement-eyebrow">ЛИЧНОЕ ДОСЬЕ · НАГРАДЫ И ЗАСЛУГИ</div>
                        <h2>АРХИВ ДОСТИЖЕНИЙ</h2>
                        <p>Каждая раскрытая тайна оставляет след. Некоторые награды ещё предстоит обнаружить.</p>
                    </div>
                    <button class="terminal-btn btn-back" data-achievement-back>← В МЕНЮ</button>
                </header>

                <section class="achievement-overview" aria-label="Общий прогресс достижений">
                    <div class="achievement-overview-emblem">🏆</div>
                    <div class="achievement-overview-copy">
                        <span class="achievement-overview-label">ОБЩИЙ ПРОГРЕСС</span>
                        <strong><span data-achievement-count>${summary.unlocked}</span> / ${summary.total}</strong>
                        <div class="achievement-progress-track" role="progressbar" aria-label="Прогресс достижений" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${summary.percent}">
                            <span style="width:${summary.percent}%"></span>
                        </div>
                    </div>
                    <div class="achievement-overview-percent">${summary.percent}%</div>
                </section>

                <nav class="achievement-filters" aria-label="Фильтр достижений">
                    ${filters.map(([id, label]) => `<button type="button" class="achievement-filter ${this.filter === id ? 'active' : ''}" data-achievement-filter="${id}" aria-pressed="${this.filter === id}">${label}</button>`).join('')}
                </nav>

                <div class="achievement-collection-meta">
                    <span>ПОКАЗАНО: ${visible.length}</span>
                    <span>КОЛЛЕКЦИЯ · ${items.length} ЗАПИСЕЙ</span>
                </div>
                <div class="achievement-collection" aria-live="polite">
                    ${visible.length ? visible.map(item => {
                        const secret = item.secret && !item.unlocked;
                        const record = this.achievementSystem.records?.[item.id];
                        const rarity = this._escape(item.rarity || 'common');
                        const category = item.caseId ? 'ОСОБОЕ ДЕЛО' : 'КАРЬЕРА ДЕТЕКТИВА';
                        return `
                            <article class="achievement-entry ${item.unlocked ? 'is-unlocked' : 'is-locked'} ${secret ? 'is-secret' : ''}">
                                <div class="achievement-entry-icon" aria-hidden="true">${item.unlocked ? this._escape(item.icon || '◆') : secret ? '？' : '🔒'}</div>
                                <div class="achievement-entry-content">
                                    <div class="achievement-entry-topline">
                                        <span class="achievement-entry-category">${category}</span>
                                        <span class="achievement-rarity rarity-${rarity}">${rarity}</span>
                                    </div>
                                    <h3>${secret ? 'СЕКРЕТНОЕ ДОСТИЖЕНИЕ' : this._escape(item.name)}</h3>
                                    <p>${secret ? 'Условие скрыто. Продолжайте расследование.' : this._escape(item.description)}</p>
                                    <div class="achievement-entry-date">${item.unlocked ? '✓ ' + this._escape(this._date(record?.unlockedAt)) : 'ЕЩЁ НЕ ПОЛУЧЕНО'}</div>
                                </div>
                            </article>`;
                    }).join('') : '<div class="achievement-empty">В этой категории пока нет записей.</div>'}
                </div>
            </div>`;

        this.container.querySelector('[data-achievement-back]')?.addEventListener('click', () => this.onBack?.());

        if (!this.bound) {
            this.container.addEventListener('click', event => {
                const button = event.target.closest('[data-achievement-filter]');
                if (!button) return;
                this.filter = button.dataset.achievementFilter;
                this.render();
            });
            this.bound = true;
        }
    }
}
