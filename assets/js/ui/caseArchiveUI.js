/**
 * CaseArchiveUI
 * Read-only archive of completed investigation runs. Replay is delegated to the
 * existing case lifecycle so it always starts through the normal game systems.
 */
class CaseArchiveUI {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.progress = null;
        this.filter = 'all';
        this.query = '';
        this.selectedRunId = null;
        this.view = 'history';
    }

    setProgress(progress) {
        this.progress = progress || {};
        this.render();
    }

    _escape(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    }

    _records() {
        const records = Array.isArray(this.progress?.trackerData?.stats?.casesHistory)
            ? this.progress.trackerData.stats.casesHistory : [];
        return records.slice().sort((a, b) => {
            const dateA = Date.parse(a.date) || 0;
            const dateB = Date.parse(b.date) || 0;
            return dateB - dateA;
        });
    }

    render() {
        if (!this.container) return;
        const records = this._records();
        const filtered = records.filter(record => {
            const matchesFilter = this.filter === 'all' || record.result === this.filter;
            const text = (String(record.title || '') + ' ' + String(record.caseId || '')).toLocaleLowerCase('ru');
            return matchesFilter && text.includes(this.query.toLocaleLowerCase('ru'));
        });
        const solved = records.filter(record => record.result === 'solved').length;
        const failed = records.filter(record => record.result === 'failed').length;
        const selected = records.find(record => record.runId === this.selectedRunId) || null;
        if (this.view === 'endings') {
            this._renderEndings(records);
            return;
        }

        this.container.innerHTML = `
            <div class="case-archive">
                <header class="case-archive-header">
                    <div>
                        <span class="case-archive-kicker">ЛИЧНОЕ ДОСЬЕ · ДОСТУП ДЕТЕКТИВА</span>
                        <h2>АРХИВ РАССЛЕДОВАНИЙ</h2>
                        <p>Каждая попытка оставляет след. Даже если истина так и не была найдена.</p>
                    </div>
                    <div class="case-archive-header-actions">
                        <button class="terminal-btn active" data-archive-view="history">ИСТОРИЯ ДЕЛ</button>
                        <button class="terminal-btn" data-archive-view="endings">КОЛЛЕКЦИЯ КОНЦОВОК</button>
                        <button class="terminal-btn" data-archive-back>← В ТЕРМИНАЛ</button>
                    </div>
                </header>
                <div class="case-archive-summary">
                    <div><strong>${records.length}</strong><span>ВСЕГО ПОПЫТОК</span></div>
                    <div><strong>${solved}</strong><span>РАСКРЫТО</span></div>
                    <div><strong>${failed}</strong><span>ПРОВАЛЕНО</span></div>
                </div>
                <div class="case-archive-toolbar">
                    <label class="case-archive-search"><span>ПОИСК ПО ДЕЛАМ</span>
                        <input type="search" data-archive-search value="${this._escape(this.query)}" placeholder="Название или номер дела..." />
                    </label>
                    <div class="case-archive-filters" role="group" aria-label="Фильтр архива">
                        <button class="terminal-btn ${this.filter === 'all' ? 'active' : ''}" data-archive-filter="all">ВСЕ</button>
                        <button class="terminal-btn ${this.filter === 'solved' ? 'active' : ''}" data-archive-filter="solved">РАСКРЫТЫЕ</button>
                        <button class="terminal-btn ${this.filter === 'failed' ? 'active' : ''}" data-archive-filter="failed">ПРОВАЛЕННЫЕ</button>
                    </div>
                </div>
                <div class="case-archive-layout">
                    <div class="case-archive-list">
                        ${filtered.length ? filtered.map((record, index) => {
                            const id = this._escape(record.runId || (record.caseId + ':' + index));
                            const date = record.date ? new Date(record.date).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }) : 'Дата неизвестна';
                            const isSolved = record.result === 'solved';
                            return `
                                <button class="case-archive-entry ${isSolved ? 'is-solved' : 'is-failed'} ${record.runId === this.selectedRunId ? 'is-selected' : ''}" data-archive-record="${id}">
                                    <span class="case-archive-entry-status">${isSolved ? 'РАСКРЫТО' : 'ПРОВАЛЕНО'}</span>
                                    <strong>${this._escape(record.title || record.caseId || 'Без названия')}</strong>
                                    <span>${this._escape(record.caseId || 'Дело без номера')} · ${this._escape(date)}</span>
                                    <small>${Number(record.timeSpent) || 0} мин · ${Number(record.attempts) || 0} попыток · ${Number(record.hintsUsed) || 0} подсказок</small>
                                </button>`;
                        }).join('') : '<div class="case-archive-empty">По этому запросу записей не найдено.</div>'}
                    </div>
                    <aside class="case-archive-detail" aria-live="polite">
                        ${selected ? this._renderDetail(selected) : '<div class="case-archive-empty"><span>◈</span><strong>ВЫБЕРИТЕ ЗАПИСЬ</strong><p>Здесь появятся подробности выбранного прохождения.</p></div>'}
                    </aside>
                </div>
            </div>`;

        this.container.querySelector('[data-archive-back]')?.addEventListener('click', () => events.emit('navigation:go', 'screen-main-menu'));
        this.container.querySelectorAll('[data-archive-view]').forEach(button => button.addEventListener('click', () => {
            this.view = button.dataset.archiveView;
            this.render();
        }));
        this.container.querySelector('[data-archive-search]')?.addEventListener('input', event => {
            this.query = event.target.value;
            const cursor = this.query.length;
            this.render();
            const input = this.container.querySelector('[data-archive-search]');
            input?.focus();
            input?.setSelectionRange(cursor, cursor);
        });
        this.container.querySelectorAll('[data-archive-filter]').forEach(button => button.addEventListener('click', () => {
            this.filter = button.dataset.archiveFilter;
            this.render();
        }));
        this.container.querySelectorAll('[data-archive-record]').forEach(button => button.addEventListener('click', () => {
            this.selectedRunId = button.dataset.archiveRecord;
            this.render();
        }));
        this.container.querySelector('[data-archive-replay]')?.addEventListener('click', event => {
            const caseId = event.currentTarget.dataset.archiveReplay;
            if (caseId) events.emit('case:replay', caseId);
        });
    }


    _renderEndings(records) {
        const discovered = new Map();
        records.filter(record => record.result === 'solved' && record.endingId).forEach(record => {
            if (!discovered.has(record.endingId)) discovered.set(record.endingId, record);
        });
        const registry = typeof window !== 'undefined' && window.ENDINGS ? Object.values(window.ENDINGS) : [];
        const known = new Map(registry.map(ending => [ending.id, ending]));
        // Keep historical endings visible even if their data pack was removed or renamed.
        discovered.forEach((record, id) => {
            if (!known.has(id)) known.set(id, {
                id, caseId: record.caseId, title: record.endingTitle || 'Сохранённая концовка',
                text: record.endingText || ''
            });
        });
        const endings = [...known.values()].sort((a, b) =>
            String(a.caseId || '').localeCompare(String(b.caseId || ''), 'ru') ||
            String(a.id || '').localeCompare(String(b.id || ''), 'ru')
        );
        const found = endings.filter(ending => discovered.has(ending.id));
        this.container.innerHTML = `
            <div class="case-archive case-ending-codex">
                <header class="case-archive-header">
                    <div>
                        <span class="case-archive-kicker">ЛИЧНОЕ ДОСЬЕ · ЗАПЕЧАТАННЫЕ ПРОТОКОЛЫ</span>
                        <h2>КОЛЛЕКЦИЯ КОНЦОВОК</h2>
                        <p>Не все истины открываются с первого раза. Каждая найденная развязка остаётся в архиве.</p>
                    </div>
                    <div class="case-archive-header-actions">
                        <button class="terminal-btn" data-archive-view="history">ИСТОРИЯ ДЕЛ</button>
                        <button class="terminal-btn active" data-archive-view="endings">КОЛЛЕКЦИЯ КОНЦОВОК</button>
                        <button class="terminal-btn" data-archive-back>← В ТЕРМИНАЛ</button>
                    </div>
                </header>
                <div class="case-archive-summary">
                    <div><strong>${found.length}</strong><span>ОТКРЫТО</span></div>
                    <div><strong>${endings.length}</strong><span>ИЗВЕСТНО В ИГРЕ</span></div>
                    <div><strong>${Math.max(0, endings.length - found.length)}</strong><span>ЕЩЁ СКРЫТО</span></div>
                </div>
                <div class="case-ending-grid">
                    ${endings.length ? endings.map(ending => {
                        const record = discovered.get(ending.id);
                        const unlocked = Boolean(record);
                        return `
                            <article class="case-ending-card ${unlocked ? 'is-discovered' : 'is-hidden'}">
                                <span class="case-ending-status">${unlocked ? '◈ ЗАПИСЬ ВОССТАНОВЛЕНА' : '▧ ПРОТОКОЛ ЗАПЕЧАТАН'}</span>
                                <h3>${unlocked ? this._escape(record.endingTitle || ending.title || 'Без названия') : 'НЕИЗВЕСТНАЯ КОНЦОВКА'}</h3>
                                <span class="case-ending-case">${unlocked ? this._escape(record.caseId || ending.caseId || 'Дело') : 'Данные скрыты до обнаружения'}</span>
                                <p>${unlocked ? this._escape(record.endingText || ending.text || 'Текст концовки не сохранён.') : 'Завершите расследование и найдите эту развязку, чтобы открыть запись.'}</p>
                                ${unlocked ? '<span class="case-ending-stamp">ДОКАЗАНО</span>' : '<span class="case-ending-lock">ДОСТУП ЗАКРЫТ</span>'}
                            </article>`;
                    }).join('') : '<div class="case-archive-empty">Реестр концовок пока пуст.</div>'}
                </div>
            </div>`;
        this.container.querySelector('[data-archive-back]')?.addEventListener('click', () => events.emit('navigation:go', 'screen-main-menu'));
        this.container.querySelectorAll('[data-archive-view]').forEach(button => button.addEventListener('click', () => {
            this.view = button.dataset.archiveView;
            this.render();
        }));
    }

    _renderDetail(record) {
        const isSolved = record.result === 'solved';
        const date = record.date ? new Date(record.date).toLocaleString('ru-RU', { dateStyle: 'full', timeStyle: 'short' }) : 'Дата неизвестна';
        return `
            <span class="case-archive-kicker">ПРОТОКОЛ ПРОХОЖДЕНИЯ</span>
            <div class="case-archive-detail-status ${isSolved ? 'is-solved' : 'is-failed'}">${isSolved ? '✓ ДЕЛО РАСКРЫТО' : '× РАССЛЕДОВАНИЕ ПРОВАЛЕНО'}</div>
            <h3>${this._escape(record.title || 'Без названия')}</h3>
            <p class="case-archive-detail-date">${this._escape(date)}</p>
            <dl class="case-archive-metrics">
                <div><dt>Время</dt><dd>${Number(record.timeSpent) || 0} мин</dd></div>
                <div><dt>Попытки ответа</dt><dd>${Number(record.attempts) || 0}</dd></div>
                <div><dt>Подсказки</dt><dd>${Number(record.hintsUsed) || 0}</dd></div>
            </dl>
            ${record.endingTitle ? `<section class="case-archive-ending"><span>ИТОГОВЫЙ ВЕРДИКТ</span><strong>${this._escape(record.endingTitle)}</strong><p>${this._escape(record.endingText || '')}</p></section>` : ''}
            <button class="terminal-btn case-archive-replay" data-archive-replay="${this._escape(record.caseId || '')}">ПОВТОРИТЬ РАССЛЕДОВАНИЕ ↗</button>
            <p class="case-archive-note">Повторный запуск начнётся как новое прохождение. История и прежний результат останутся в архиве.</p>`;
    }
}
