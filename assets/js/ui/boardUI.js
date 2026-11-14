class BoardUI {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.board = null;
        this.inventory = null;
        this.memoryService = null;
        this.locationManager = null;
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

    setMemoryService(service) {
        this.memoryService = service || null;
        this.render();
    }

    setLocationManager(manager) {
        this.locationManager = manager || null;
        this.render();
    }

    _knownAlibiLocations() {
        const active = this.locationManager?.activeCaseData;
        if (!active?.id) return [];
        const allowed = new Set([...(active.locations || []), active.startLocation]);
        return [...(this.locationManager?.visitedLocations || [])].map(id => getLocationById(id))
            .filter(loc => loc && (allowed.has(loc.id) || allowed.has(loc.parentLocation)));
    }
    
    _init() {
        if (!this.container) return;
        events.on('board:updated', () => this.render());
        events.on('inventory:changed', () => this.render());
        events.on('npc:memory_changed', () => this.render());
        events.on('npc:contradiction_presented', () => this.render());
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

            ${this._renderHypotheses()}
            ${this._renderChronology()}
            ${this._renderAlibiReconstruction()}
            ${this._renderTestimonyJournal()}
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

        this._bindHypothesisEvents();
        this._bindChronologyEvents();
        this._bindAlibiEvents();
        this._bindTestimonyEvents();
    }

    _escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
    }

    _renderChronology() {
        const ids = [...new Set([...(this.inventory?.evidence || []), ...(this.board?.evidenceOnBoard || [])])];
        const facts = this.board?.getEvidenceChronology(ids) || [];
        const fmt = minute => String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
        return `<section class="testimony-journal" aria-labelledby="chronology-title">
            <div class="testimony-journal-header"><div><span class="testimony-journal-kicker">СВЕРКА ВРЕМЕНИ</span>
            <h3 id="chronology-title">🕰️ ХРОНОЛОГИЯ УЛИК</h3></div><span class="testimony-count">${facts.length} отметок</span></div>
            <p class="hypothesis-help">Показаны только обнаруженные документы с точными отметками. Запись о запросе не доказывает состоявшийся звонок или личность звонившего.</p>
            ${facts.length ? `<ol>${facts.map(f => `<li><strong>${fmt(f.minute)}</strong> — ${this._escapeHTML(f.label)}
                <small>(${this._escapeHTML(getObjectById(f.evidenceId)?.name || f.evidenceId)}). ${this._escapeHTML(f.caveat)}</small></li>`).join('')}</ol>` : '<p>Найдите документ с временными отметками, чтобы начать реконструкцию.</p>'}
            ${facts.length > 1 ? `<div class="testimony-compare"><label for="chronology-first">Первая отметка</label>
                <select id="chronology-first" class="terminal-input">${facts.map(f => `<option value="${this._escapeHTML(f.id)}">${fmt(f.minute)} · ${this._escapeHTML(f.label)}</option>`).join('')}</select>
                <label for="chronology-second">Вторая отметка</label>
                <select id="chronology-second" class="terminal-input">${facts.map(f => `<option value="${this._escapeHTML(f.id)}">${fmt(f.minute)} · ${this._escapeHTML(f.label)}</option>`).join('')}</select>
                <button id="chronology-compare" type="button" class="terminal-btn">СОПОСТАВИТЬ ВРЕМЯ</button><div id="chronology-result" aria-live="polite"></div></div>` : ''}
        </section>`;
    }

    _bindChronologyEvents() {
        this.container.querySelector('#chronology-compare')?.addEventListener('click', () => {
            const ids = [...new Set([...(this.inventory?.evidence || []), ...(this.board?.evidenceOnBoard || [])])];
            const comparison = this.board.compareChronologyFacts(
                this.container.querySelector('#chronology-first')?.value,
                this.container.querySelector('#chronology-second')?.value, ids);
            const target = this.container.querySelector('#chronology-result');
            if (target) target.textContent = comparison
                ? `${comparison.minutesApart} мин. между отметками. ${comparison.warning}`
                : 'Выберите две разные доступные отметки.';
        });
    }

    _renderAlibiReconstruction() {
        const statements = this.memoryService?.getStatements?.() || [];
        const evidenceIds = [...new Set([...(this.inventory?.evidence || []), ...(this.board?.evidenceOnBoard || [])])];
        const sources = [
            ...statements.filter(s => s.status !== 'superseded').map(s => ({ id: 'statement:' + s.id, label: 'Показание: ' + (s.sourceName || s.npcId) })),
            ...evidenceIds.map(id => ({ id: 'evidence:' + id, label: 'Улика: ' + (getObjectById(id)?.name || id) }))
        ];
        const fmt = minute => String(Math.floor(minute / 60)).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0');
        const claims = this.board?.alibiClaims || [];
        const knownLocations = this._knownAlibiLocations();
        const warnings = [
            ...(this.board?.reviewAlibiClaims(CONFIG?.time?.costs?.travel) || []),
            ...(this.board?.reviewAlibiLocationHours(knownLocations) || []),
            ...(this.board?.reviewAlibiAccessRestrictions(knownLocations) || []),
            ...(this.board?.reviewAlibiRoutes(this.locationManager?.activeCaseData?.alibiRoutes, knownLocations) || [])
        ];
        return `<section class="testimony-journal" aria-labelledby="alibi-title">
            <div class="testimony-journal-header"><div><span class="testimony-journal-kicker">ВЕРСИИ ДЕТЕКТИВА</span><h3 id="alibi-title">📍 ПРОВЕРКА АЛИБИ</h3></div><span class="testimony-count">${claims.length} записей</span></div>
            <p class="hypothesis-help">Это ваша реконструкция по найденным источникам, а не подтверждённый маршрут NPC. Указывайте время, место и степень точности из показания или документа. Интервалы через полночь пока нужно разбивать на две записи.</p>
            <form id="alibi-form" class="hypothesis-form">
                <input class="terminal-input" name="subject" maxlength="100" required placeholder="Персонаж (одно имя для разных записей)" aria-label="Персонаж">
                <input class="terminal-input" name="location" maxlength="120" required placeholder="Предполагаемое место" aria-label="Место">
                <select class="terminal-input" name="locationId" aria-label="Известная локация (необязательно)"><option value="">Не привязывать к известной локации</option>${knownLocations.map(loc => `<option value="${this._escapeHTML(loc.id)}">${this._escapeHTML(loc.name || loc.id)}</option>`).join('')}</select>
                <p class="hypothesis-help">Привязка доступна только для посещённых мест и позволяет проверить обычные часы работы. Закрытая локация не означает невозможность проникновения.</p>
                <label>С <input class="terminal-input" type="time" name="start" required></label>
                <label>По <input class="terminal-input" type="time" name="end" required></label>
                <select class="terminal-input" name="precision" aria-label="Точность"><option value="approximate">Время приблизительное</option><option value="exact">Время указано точно</option></select>
                <select class="terminal-input" name="source" required aria-label="Источник"><option value="">Выберите обнаруженный источник</option>${sources.map(s => `<option value="${this._escapeHTML(s.id)}">${this._escapeHTML(s.label)}</option>`).join('')}</select>
                <button class="terminal-btn btn-sm" type="submit">ДОБАВИТЬ В РЕКОНСТРУКЦИЮ</button>
            </form>
            <ol>${claims.map(c => `<li><strong>${this._escapeHTML(c.subject)}</strong>: ${fmt(c.startMinute)}–${fmt(c.endMinute)} · ${this._escapeHTML(c.location)}
                (${c.precision === 'exact' ? 'точное' : 'приблизительное'} время, ${this._escapeHTML(c.sourceId)}${c.locationId ? ' · привязано к посещённой локации' : ''})
                <button class="terminal-btn btn-sm alibi-remove" data-id="${this._escapeHTML(c.id)}" type="button" aria-label="Удалить версию">✕</button></li>`).join('') || '<li>Пока нет версий местонахождения.</li>'}</ol>
            ${warnings.length ? `<div class="hypothesis-source-review"><strong>ТРЕБУЮТ ПРОВЕРКИ</strong><ul>${warnings.map(w => `<li>${this._escapeHTML(w.subject)}: ${this._escapeHTML(w.reason)}${
                w.status === 'route_time_tight' && this.board?.caseId === 'case-002' &&
                ['кейн', 'виктор кейн'].includes(w.subject.trim().toLocaleLowerCase()) &&
                !this.board.hasPreparedRouteQuestion('business_rival')
                    ? ` <button type="button" class="terminal-btn btn-sm route-question-prepare" data-claim-a="${this._escapeHTML(w.ids[0])}" data-claim-b="${this._escapeHTML(w.ids[1])}">ПОДГОТОВИТЬ ВОПРОС КЕЙНУ</button>` : ''}</li>`).join('')}</ul></div>` : ''}
        </section>`;
    }

    _bindAlibiEvents() {
        this.container.querySelector('#alibi-form')?.addEventListener('submit', e => {
            e.preventDefault();
            const form = e.currentTarget;
            const minutes = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
                ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : NaN;
            const [kind, ...sourceParts] = form.elements.source.value.split(':');
            const result = this.board?.addAlibiClaim({
                subject: form.elements.subject.value, location: form.elements.location.value,
                locationId: form.elements.locationId.value || null,
                startMinute: minutes(form.elements.start.value), endMinute: minutes(form.elements.end.value),
                precision: form.elements.precision.value, kind, sourceId: sourceParts.join(':')
            }, { statements: this.memoryService?.getStatements?.() || [],
                evidenceIds: [...new Set([...(this.inventory?.evidence || []), ...(this.board?.evidenceOnBoard || [])])],
                locations: this._knownAlibiLocations() });
            if (!result) events.emit('notification:show', { message: 'Проверьте интервал, источник и отсутствие дублей.', type: 'warning', duration: 3000 });
        });
        this.container.querySelectorAll('.alibi-remove').forEach(button => button.addEventListener('click', () =>
            this.board?.removeAlibiClaim(button.dataset.id)));
        this.container.querySelectorAll('.route-question-prepare').forEach(button => button.addEventListener('click', () => {
            const finding = this.board?.reviewAlibiRoutes(this.locationManager?.activeCaseData?.alibiRoutes,
                this._knownAlibiLocations()).find(w => w.ids[0] === button.dataset.claimA && w.ids[1] === button.dataset.claimB);
            if (finding && this.board.prepareRouteQuestion(finding, 'business_rival'))
                events.emit('notification:show', { message: 'Вопрос о маршруте подготовлен. Вернитесь к Кейну для повторного допроса.', type: 'info', duration: 5000 });
        }));
    }

    _renderHypotheses() {
        const hypotheses = this.board?.hypotheses || [];
        const evidenceIds = [...new Set([...(this.inventory?.evidence || []), ...(this.board?.evidenceOnBoard || [])])];
        const evidenceOptions = evidenceIds.map(id => {
            const obj = getObjectById(id);
            return obj ? '<option value="evidence:' + this._escapeHTML(id) + '">' + this._escapeHTML(obj.name || id) + '</option>' : '';
        }).join('');
        const statements = this.memoryService?.getStatements?.() || [];
        const statementOptions = statements.map(item =>
            '<option value="statement:' + this._escapeHTML(item.id) + '"' + (item.status === 'superseded' ? ' disabled' : '') + '>' +
            this._escapeHTML((item.sourceName || item.npcId) + ' — ' + (item.summary || item.value) + (item.status === 'superseded' ? ' (архив)' : '')) +
            '</option>'
        ).join('');
        const sourceOptions = evidenceOptions + statementOptions;
        const names = { for: 'Поддерживает', against: 'Противоречит', pending: 'Требует проверки' };
        const labels = { evidence: 'Улика', statement: 'Показание', assumption: 'Допущение' };
        const sourceKinds = { firsthand_claim: 'Заявлено личное наблюдение', unverified: 'Способ получения сведений не установлен', unknown: 'Источник не найден' };
        return `
            <section class="testimony-journal hypothesis-journal" aria-labelledby="hypothesis-title">
                <div class="testimony-journal-header"><div>
                    <span class="testimony-journal-kicker">РАБОЧИЕ ВЕРСИИ ДЕТЕКТИВА</span>
                    <h3 id="hypothesis-title">🧩 ГИПОТЕЗЫ</h3>
                </div><span class="testimony-count">${hypotheses.length} версий</span></div>
                <p class="hypothesis-help">Записи отражают ваши предположения. Игра не подтверждает их автоматически.</p>
                <form id="hypothesis-create-form" class="hypothesis-form">
                    <label for="hypothesis-new-text">Новая версия событий</label>
                    <textarea id="hypothesis-new-text" class="terminal-input" maxlength="240" rows="2" required placeholder="Что, по-вашему, произошло?"></textarea>
                    <button type="submit" class="terminal-btn">ДОБАВИТЬ ВЕРСИЮ</button>
                </form>
                ${hypotheses.map(h => `
                    <article class="testimony-entry hypothesis-entry">
                        <div class="testimony-entry-heading"><strong>${this._escapeHTML(h.title)}</strong>
                            <span>${h.status === 'abandoned' ? 'ОТКЛОНЕНА' : 'НА ПРОВЕРКЕ'}</span></div>
                        <ul class="hypothesis-links">
                            ${h.links.map((link, index) => {
                                const object = link.kind === 'evidence' ? getObjectById(link.sourceId) : null;
                                const statement = link.kind === 'statement' ? statements.find(s => s.id === link.sourceId) : null;
                                const title = object?.name || (statement ? (statement.sourceName || statement.npcId) + ': ' + (statement.summary || statement.value) : link.sourceId);
                                const archived = statement?.status === 'superseded';
                                const missing = link.kind === 'statement' && !statement;
                                const caution = archived ? ' · Показание пересмотрено — проверьте новую версию' : (missing ? ' · Источник недоступен' : '');
                                const provenance = statement ? (statement.directObservation === true ? ' · Со слов свидетеля: видел лично' : ' · Источник сведений не подтверждён') : '';
                                return `<li class="${archived || missing ? 'hypothesis-source-caution' : ''}"><span>${this._escapeHTML(names[link.stance] || link.stance)} · ${this._escapeHTML(labels[link.kind] || link.kind)}: ${this._escapeHTML(title)}${this._escapeHTML(caution)}${this._escapeHTML(provenance)}</span>
                                  ${h.status === 'open' ? `<button type="button" class="terminal-btn btn-sm hypothesis-unlink" data-id="${this._escapeHTML(h.id)}" data-index="${index}" aria-label="Убрать связь">✕</button>` : ''}</li>`;
                            }).join('') || '<li>Пока нет подтверждений или возражений.</li>'}
                        </ul>
                        ${(() => {
                            const review = this.board.reviewHypothesisSources(h.id, statements);
                            if (!review?.sources.length) return '<p class="hypothesis-help">Прикрепите показания, чтобы проверить происхождение свидетельств.</p>';
                            const grouped = review.sources.filter(item => item.origin === 'firsthand_claim').length;
                            const notices = review.warnings.map(item => {
                                if (item.type === 'missing') return 'Источник записи недоступен: ' + item.ids.join(', ');
                                if (item.type === 'superseded') return 'Показание пересмотрено: ' + item.ids.join(', ');
                                if (item.type === 'same_witness') return 'Две записи принадлежат одному свидетелю — это не независимые источники.';
                                if (item.type === 'shared_rumor_reference') return 'Записи ссылаются на общий слух — повторение не является независимым подтверждением.';
                                return '';
                            }).filter(Boolean);
                            return `<div class="hypothesis-source-review">
                                <strong>ПРОВЕРКА ИСТОЧНИКОВ</strong>
                                <p>Показаний: ${review.sources.length}. Заявлены как личное наблюдение: ${grouped}. Остальные требуют выяснения происхождения.</p>
                                ${notices.length ? '<ul>' + [...new Set(notices)].map(note => '<li>' + this._escapeHTML(note) + '</li>').join('') + '</ul>' : '<small>Совпадение источников пока не обнаружено. Это не доказательство независимости.</small>'}
                            </div>`;
                        })()}
                        ${this._renderSourceInquiries(h, statements, evidenceIds)}
                        ${h.status === 'open' ? `
                            <form class="hypothesis-link-form hypothesis-form" data-id="${this._escapeHTML(h.id)}">
                                <select class="terminal-input hypothesis-source" aria-label="Источник"><option value="">Выберите улику или показание</option>${sourceOptions}<option value="assumption:">Собственное допущение</option></select>
                                <input class="terminal-input hypothesis-assumption" maxlength="240" placeholder="Текст допущения" aria-label="Допущение">
                                <select class="terminal-input hypothesis-stance" aria-label="Оценка"><option value="for">Поддерживает</option><option value="against">Противоречит</option><option value="pending">Требует проверки</option></select>
                                <button class="terminal-btn btn-sm" type="submit">ПРИКРЕПИТЬ</button>
                            </form>
                            <button type="button" class="terminal-btn btn-sm hypothesis-revise" data-id="${this._escapeHTML(h.id)}">ИЗМЕНИТЬ ТЕКСТ</button>
                            <button type="button" class="terminal-btn btn-sm hypothesis-abandon" data-id="${this._escapeHTML(h.id)}">ОТКЛОНИТЬ ВЕРСИЮ</button>
                        ` : ''}
                        <details><summary>История изменений (${h.history.length})</summary><ol>${h.history.map(v => `<li>${this._escapeHTML(v.action)}${v.title ? ': ' + this._escapeHTML(v.title) : ''}${v.previous ? ' (было: ' + this._escapeHTML(v.previous) + ')' : ''}${v.sourceId ? ' — ' + this._escapeHTML(v.sourceId) : ''}</li>`).join('')}</ol></details>
                    </article>
                `).join('')}
            </section>
        `;
    }

    _bindHypothesisEvents() {
        this.container.querySelectorAll('.inquiry-start').forEach(button => button.addEventListener('click', () => {
            const statements = this.memoryService?.getStatements?.() || [];
            this.board?.startSourceInquiry(button.dataset.hypothesis, button.dataset.rumor, statements);
        }));
        this.container.querySelectorAll('.inquiry-lead-form').forEach(form => form.addEventListener('submit', e => {
            e.preventDefault();
            const choice = form.querySelector('select')?.value || '';
            const separator = choice.indexOf(':');
            const kind = choice.slice(0, separator), sourceId = choice.slice(separator + 1);
            const ok = this.board?.addSourceInquiryLead(form.dataset.id, kind, sourceId,
                form.querySelector('input')?.value, {
                    statements: this.memoryService?.getStatements?.() || [],
                    evidenceIds: [...new Set([...(this.inventory?.evidence || []), ...(this.board?.evidenceOnBoard || [])])]
                });
            if (!ok) events.emit('notification:show', { message: 'Выберите доступный источник, добавьте заметку. Повторные записи не принимаются.', type: 'warning', duration: 3000 });
        }));
        this.container.querySelectorAll('.inquiry-close-form').forEach(form => form.addEventListener('submit', e => {
            e.preventDefault();
            if (!this.board?.closeSourceInquiry(form.dataset.id, form.querySelector('input')?.value))
                events.emit('notification:show', { message: 'Для вывода нужна хотя бы одна проверенная запись и ваша формулировка.', type: 'warning', duration: 3000 });
        }));
        this.container.querySelector('#hypothesis-create-form')?.addEventListener('submit', e => {
            e.preventDefault();
            this.board?.addHypothesis(this.container.querySelector('#hypothesis-new-text')?.value);
        });
        this.container.querySelectorAll('.hypothesis-link-form').forEach(form => form.addEventListener('submit', e => {
            e.preventDefault();
            const selection = form.querySelector('.hypothesis-source')?.value || '';
            const separator = selection.indexOf(':');
            const kind = separator >= 0 ? selection.slice(0, separator) : '';
            const sourceId = kind === 'assumption' ? form.querySelector('.hypothesis-assumption')?.value : selection.slice(separator + 1);
            if (!this.board?.linkHypothesis(form.dataset.id, kind, sourceId, form.querySelector('.hypothesis-stance')?.value)) {
                events.emit('notification:show', { message: 'Выберите источник или напишите допущение. Повторная связь не добавлена.', type: 'warning', duration: 3000 });
            }
        }));
        this.container.querySelectorAll('.hypothesis-unlink').forEach(button => button.addEventListener('click', () =>
            this.board?.unlinkHypothesis(button.dataset.id, Number(button.dataset.index))));
        this.container.querySelectorAll('.hypothesis-abandon').forEach(button => button.addEventListener('click', () => {
            if (confirm('Отклонить версию? История останется в журнале.')) this.board?.abandonHypothesis(button.dataset.id);
        }));
        this.container.querySelectorAll('.hypothesis-revise').forEach(button => button.addEventListener('click', () => {
            const current = this.board?.hypotheses.find(h => h.id === button.dataset.id);
            if (!current) return;
            const next = prompt('Уточните вашу версию:', current.title);
            if (next !== null) this.board.reviseHypothesis(current.id, next);
        }));
    }

    _renderSourceInquiries(hypothesis, statements, evidenceIds) {
        const review = this.board.reviewHypothesisSources(hypothesis.id, statements);
        const rumors = [...new Set(review.sources.flatMap(source => source.linkedRumorIds))];
        const inquiries = (this.board.sourceInquiries || []).filter(i => i.hypothesisId === hypothesis.id);
        const options = [
            ...statements.filter(s => s.status !== 'superseded').map(s => ({ key: 'statement:' + s.id, label: 'Показание: ' + (s.sourceName || s.npcId) + ' — ' + (s.summary || s.value) })),
            ...evidenceIds.map(id => ({ key: 'evidence:' + id, label: 'Улика: ' + (getObjectById(id)?.name || id) }))
        ].map(o => `<option value="${this._escapeHTML(o.key)}">${this._escapeHTML(o.label)}</option>`).join('');
        if (!rumors.length && !inquiries.length) return '';
        return `<div class="hypothesis-source-review"><strong>РАССЛЕДОВАНИЕ ЦЕПОЧКИ СЛУХА</strong>
            <p>Найдите свидетеля, сопоставьте сведения с уликами и запишите собственный вывод. Записи не доказывают правдивость слуха.</p>
            ${hypothesis.status === 'open' ? rumors.filter(r => !inquiries.some(i => i.rumorId === r)).map(r =>
                `<button type="button" class="terminal-btn btn-sm inquiry-start" data-hypothesis="${this._escapeHTML(hypothesis.id)}" data-rumor="${this._escapeHTML(r)}">ПРОВЕРИТЬ СЛУХ ${this._escapeHTML(r)}</button>`).join('') : ''}
            ${inquiries.map(i => `<section class="testimony-entry">
                <strong>${this._escapeHTML(i.rumorId)} · ${i.status === 'closed' ? 'ВЫВОД ЗАПИСАН' : 'ПРОВЕРЯЕТСЯ'}</strong>
                <ul>${i.leads.map(l => `<li>${l.kind === 'statement' ? 'Показание' : 'Улика'} ${this._escapeHTML(l.sourceId)}: ${this._escapeHTML(l.note)}</li>`).join('') || '<li>Пока нет проверенных связей.</li>'}</ul>
                ${i.conclusion ? `<p>Вывод детектива: ${this._escapeHTML(i.conclusion)}</p>` : ''}
                ${i.status === 'open' && hypothesis.status === 'open' ? `
                    <form class="hypothesis-form inquiry-lead-form" data-id="${this._escapeHTML(i.id)}">
                        <select class="terminal-input" required><option value="">Выберите найденный источник</option>${options}</select>
                        <input class="terminal-input" maxlength="500" required placeholder="Что именно вы выяснили?">
                        <button class="terminal-btn btn-sm" type="submit">ЗАПИСАТЬ СВЯЗЬ</button>
                    </form>
                    <form class="hypothesis-form inquiry-close-form" data-id="${this._escapeHTML(i.id)}">
                        <input class="terminal-input" maxlength="500" required placeholder="Ваш вывод (не вердикт игры)">
                        <button class="terminal-btn btn-sm" type="submit">ЗАКРЫТЬ ПРОВЕРКУ</button>
                    </form>` : ''}
                <details><summary>История проверки (${i.history.length})</summary><ol>${i.history.map(h => `<li>${this._escapeHTML(h.action)}${h.note ? ': ' + this._escapeHTML(h.note) : ''}</li>`).join('')}</ol></details>
            </section>`).join('')}
        </div>`;
    }

    _renderTestimonyJournal() {
        const statements = this.memoryService?.getStatements?.() || [];
        const prepared = this.memoryService?.getPreparedConfrontation?.() || null;
        const options = statements.map(statement => {
            const label = `${statement.sourceName || statement.npcId}: ${statement.summary || statement.value}`;
            const disabled = statement.status === 'superseded' ? 'disabled' : '';
            const suffix = statement.status === 'superseded' ? ' · ПРЕДЫДУЩАЯ ВЕРСИЯ' : '';
            return `<option value="${this._escapeHTML(statement.id)}" ${disabled}>${this._escapeHTML(label + suffix)}</option>`;
        }).join('');
        const preparedTarget = prepared
            ? (prepared.contradiction.first.npcId === prepared.targetNpcId
                ? prepared.contradiction.first.sourceName
                : prepared.contradiction.second.sourceName)
            : '';

        return `
            <section class="testimony-journal" aria-labelledby="testimony-journal-title">
                <div class="testimony-journal-header">
                    <div>
                        <span class="testimony-journal-kicker">АРХИВ РАССЛЕДОВАНИЯ</span>
                        <h3 id="testimony-journal-title">📜 ЖУРНАЛ ПОКАЗАНИЙ</h3>
                    </div>
                    <span class="testimony-count">${statements.length} записей</span>
                </div>
                ${statements.length ? `
                    <div class="testimony-list">
                        ${statements.map(statement => `
                            <article class="testimony-entry">
                                <div class="testimony-entry-heading">
                                    <strong>${this._escapeHTML(statement.sourceName || statement.npcId)}</strong>
                                    <span>${this._escapeHTML(statement.timeLabel || 'Время не указано')} · ${statement.status === 'superseded' ? 'ПРЕДЫДУЩАЯ ВЕРСИЯ' : 'АКТУАЛЬНАЯ · ВЕРСИЯ ' + (statement.version || 1)}</span>
                                </div>
                                <p>${this._escapeHTML(statement.summary || statement.value)}</p>
                                <div class="testimony-entry-meta">
                                    <span>📍 ${this._escapeHTML(statement.location || 'Место не указано')}</span>
                                    ${statement.circumstances ? `<span>${this._escapeHTML(statement.circumstances)}</span>` : ''}
                                    ${statement.revisionReason ? `<span>Основание уточнения: ${this._escapeHTML(statement.revisionReason)}</span>` : ''}
                                </div>
                            </article>
                        `).join('')}
                    </div>
                    <div class="testimony-compare">
                        <div class="testimony-compare-title">СОПОСТАВИТЬ ДВА ПОКАЗАНИЯ</div>
                        <label for="testimony-first">Первое показание</label>
                        <select id="testimony-first" class="terminal-input">
                            <option value="">Выберите запись...</option>${options}
                        </select>
                        <label for="testimony-second">Второе показание</label>
                        <select id="testimony-second" class="terminal-input">
                            <option value="">Выберите запись...</option>${options}
                        </select>
                        <button id="btn-compare-testimony" class="terminal-btn" type="button">СОПОСТАВИТЬ</button>
                        <div id="testimony-comparison-result" aria-live="polite"></div>
                    </div>
                    ${prepared ? `
                        <div class="testimony-prepared">
                            <strong>ДОПРОС ПОДГОТОВЛЕН</strong>
                            <span>Противоречие готово к предъявлению: ${this._escapeHTML(preparedTarget || prepared.targetNpcId)}.</span>
                            <small>Начните разговор с выбранным персонажем — кнопка предъявления появится в окне диалога.</small>
                        </div>
                    ` : ''}
                ` : `
                    <div class="testimony-empty">Показаний пока нет. Разговаривайте со свидетелями и фиксируйте их утверждения.</div>
                `}
            </section>
        `;
    }

    _bindTestimonyEvents() {
        const compareButton = this.container.querySelector('#btn-compare-testimony');
        compareButton?.addEventListener('click', () => {
            const firstId = this.container.querySelector('#testimony-first')?.value;
            const secondId = this.container.querySelector('#testimony-second')?.value;
            const result = this.memoryService?.compareStatements(firstId, secondId);
            const output = this.container.querySelector('#testimony-comparison-result');
            if (!output || !result) return;

            const messages = {
                missing_selection: 'Выберите оба показания.',
                same_statement: 'Нельзя сопоставить одну запись с самой собой.',
                statement_not_found: 'Одна из записей больше недоступна.',
                superseded_statement: 'Это предыдущая версия показания. Сопоставляйте актуальную запись.',
                different_topics: 'Эти показания относятся к разным обстоятельствам.',
                corroboration: 'Показания совпадают и подтверждают друг друга.'
            };
            if (result.status !== 'contradiction') {
                output.innerHTML = `<div class="testimony-result-note">${this._escapeHTML(messages[result.status] || 'Не удалось сопоставить записи.')}</div>`;
                return;
            }

            const { first, second } = result.contradiction;
            const targets = [first, second].filter((item, index, all) =>
                all.findIndex(candidate => candidate.npcId === item.npcId) === index
            );
            output.innerHTML = `
                <div class="testimony-conflict">
                    <strong>ОБНАРУЖЕНЫ НЕСОВМЕСТИМЫЕ ПОКАЗАНИЯ</strong>
                    <div>«${this._escapeHTML(first.summary)}»</div>
                    <div>«${this._escapeHTML(second.summary)}»</div>
                    <label for="testimony-target">Кому предъявить противоречие?</label>
                    <select id="testimony-target" class="terminal-input">
                        <option value="">Выберите персонажа...</option>
                        ${targets.map(item => `<option value="${this._escapeHTML(item.npcId)}">${this._escapeHTML(item.sourceName || item.npcId)}</option>`).join('')}
                    </select>
                    <button id="btn-prepare-confrontation" class="terminal-btn" type="button">ПОДГОТОВИТЬ ПРЕДЪЯВЛЕНИЕ</button>
                </div>
            `;

            output.querySelector('#btn-prepare-confrontation')?.addEventListener('click', () => {
                const targetNpcId = output.querySelector('#testimony-target')?.value;
                const prepared = this.memoryService.prepareConfrontation(first.id, second.id, targetNpcId);
                if (!prepared.prepared) {
                    const text = prepared.reason === 'already_confronted'
                        ? 'Эти показания уже предъявлялись этому персонажу.'
                        : 'Выберите одного из участников показаний.';
                    events.emit('notification:show', { message: text, type: 'warning', duration: 2800 });
                    return;
                }
                events.emit('notification:show', {
                    message: 'Противоречие подготовлено. Предъявите его во время разговора с выбранным персонажем.',
                    type: 'success',
                    duration: 4000
                });
                events.emit('npc:memory_changed', this.memoryService.toJSON());
            });
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
