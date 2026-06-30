class NotesUI {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.notesManager = null;
        this._init();
    }
    
    setNotesManager(manager) {
        this.notesManager = manager;
        this.render();
    }
    
    _init() {
        if (!this.container) return;
        
        events.on('note:collected', () => this.render());
        events.on('fragment:saved', () => this.render());
        events.on('fragment:removed', () => this.render());
    }
    
    render() {
        if (!this.container || !this.notesManager) return;
        
        const notes = this.notesManager.getAllNotes();
        const fragments = this.notesManager.getAllFragments();
        
        // Группируем по типу
        const grouped = {
            police_report: { title: '📋 Отчёты', notes: [] },
            medical_report: { title: '🧪 Медицина', notes: [] },
            personal_document: { title: '📔 Личное', notes: [] },
            newspaper: { title: '📰 Газеты', notes: [] },
            radio: { title: '📻 Радио', notes: [] }
        };
        
        notes.forEach(note => {
            if (grouped[note.type]) {
                grouped[note.type].notes.push(note);
            }
        });
        
        this.container.innerHTML = `
            <div class="notes-header">
                <span class="notes-title">📝 ЗАМЕТКИ</span>
                <span class="notes-count">${notes.length} док.</span>
            </div>
            
            <div class="notes-tabs">
                <button class="notes-tab active" data-view="documents">📄 ДОКУМЕНТЫ</button>
                <button class="notes-tab" data-view="fragments">💬 ФРАГМЕНТЫ (${fragments.length})</button>
            </div>
            
            <div class="notes-view" id="notes-documents-view">
                ${this._renderDocuments(grouped)}
            </div>
            
            <div class="notes-view hidden" id="notes-fragments-view">
                ${this._renderFragments(fragments)}
            </div>
        `;
        
        this._bindEvents();
    }
    
    _renderDocuments(grouped) {
        let html = '';
        
        Object.values(grouped).forEach(group => {
            if (group.notes.length === 0) return;
            
            html += `
                <div class="notes-group">
                    <h4 class="notes-group-title">${group.title}</h4>
                    ${group.notes.map(note => `
                        <div class="notes-item" data-note-id="${note.id}">
                            <span class="notes-item-icon">${note.icon}</span>
                            <div class="notes-item-info">
                                <span class="notes-item-title">${note.title}</span>
                                <span class="notes-item-meta">${note.author} · ${note.date}</span>
                            </div>
                            <button class="notes-open-btn" data-note-id="${note.id}">📖</button>
                        </div>
                    `).join('')}
                </div>
            `;
        });
        
        if (html === '') {
            html = `
                <div class="notes-empty">
                    <span class="empty-icon">📭</span>
                    <p>Нет документов</p>
                    <p class="empty-hint">Находите документы на локациях и у NPC</p>
                </div>
            `;
        }
        
        return html;
    }
    
    _renderFragments(fragments) {
        if (fragments.length === 0) {
            return `
                <div class="notes-empty">
                    <span class="empty-icon">💬</span>
                    <p>Нет сохранённых фрагментов</p>
                    <p class="empty-hint">Выделяйте важный текст в документах, чтобы сохранить его здесь</p>
                </div>
            `;
        }
        
        return fragments.map(f => {
            const note = getNoteById(f.noteId);
            return `
                <div class="fragment-item">
                    <div class="fragment-text">${f.text}</div>
                    <div class="fragment-meta">
                        Из: ${note?.title || 'неизвестно'}
                        <button class="fragment-remove-btn" data-fragment-id="${f.id}">✕</button>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    _bindEvents() {
        // Переключение вкладок
        this.container.querySelectorAll('.notes-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.container.querySelectorAll('.notes-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const view = tab.dataset.view;
                document.getElementById('notes-documents-view')?.classList.add('hidden');
                document.getElementById('notes-fragments-view')?.classList.add('hidden');
                
                if (view === 'documents') {
                    document.getElementById('notes-documents-view')?.classList.remove('hidden');
                } else {
                    document.getElementById('notes-fragments-view')?.classList.remove('hidden');
                }
            });
        });
        
        // Открытие документа
        this.container.querySelectorAll('.notes-open-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const noteId = btn.dataset.noteId;
                this._openNoteModal(noteId);
            });
        });
        
        this.container.querySelectorAll('.notes-item').forEach(item => {
            item.addEventListener('click', () => {
                const noteId = item.dataset.noteId;
                this._openNoteModal(noteId);
            });
        });
        
        // Удаление фрагмента
        this.container.querySelectorAll('.fragment-remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const fragmentId = btn.dataset.fragmentId;
                this.notesManager?.removeFragment(fragmentId);
            });
        });
    }
    
    _openNoteModal(noteId) {
        const note = this.notesManager?.openNote(noteId);
        if (!note) return;
        
        const modalBody = document.getElementById('modal-body');
        const modalTitle = document.getElementById('modal-title');
        const modalFooter = document.getElementById('modal-footer');
        
        if (!modalBody || !modalTitle || !modalFooter) return;
        
        modalTitle.innerHTML = `${note.icon} ${note.title}`;
        
        modalBody.innerHTML = `
            <div class="note-document">
                <div class="note-meta">
                    <span>${note.author || ''}</span>
                    ${note.date ? `<span>· ${note.date}</span>` : ''}
                    <span>· ${note.type}</span>
                </div>
                <div class="note-content" id="note-content">
                    ${note.content || note.transcript || ''}
                </div>
                <div class="note-hint">
                    💡 Выделяйте важные фрагменты текста — они сохранятся в заметках
                </div>
            </div>
        `;
        
        modalFooter.innerHTML = `
            <button id="btn-save-fragment" class="terminal-btn">💾 СОХРАНИТЬ ВЫДЕЛЕННОЕ</button>
            <button class="terminal-btn" data-bs-dismiss="modal">ЗАКРЫТЬ</button>
        `;
        
        // Показываем модалку
        const modal = new bootstrap.Modal(document.getElementById('universal-modal'));
        modal.show();
        
        // Обработчик выделения
        const noteContent = document.getElementById('note-content');
        const saveBtn = document.getElementById('btn-save-fragment');
        let selectedText = '';
        
        noteContent?.addEventListener('mouseup', () => {
            selectedText = window.getSelection().toString().trim();
            if (selectedText) {
                saveBtn.style.borderColor = 'var(--accent-green)';
                saveBtn.style.color = 'var(--accent-green)';
            }
        });
        
        saveBtn?.addEventListener('click', () => {
            if (selectedText) {
                this.notesManager?.saveFragment(noteId, selectedText);
                saveBtn.style.borderColor = 'var(--border-color)';
                saveBtn.style.color = 'var(--text-bright)';
            }
        });
        
        // Тратим время
        events.emit('time:advance', CONFIG.time.costs.readNote);
    }
}