class NotesManager {
    constructor() {
        this.collectedNotes = [];     // ID полученных заметок
        this.highlightedFragments = []; // Сохранённые выделения
        this.activeNote = null;       // Открытая заметка
    }
    
    // Получить заметку
    collectNote(noteId) {
        if (this.collectedNotes.includes(noteId)) return false;
        
        const note = getNoteById(noteId);
        if (!note) return false;
        
        this.collectedNotes.push(noteId);
        
        events.emit('note:collected', { noteId, note });
        events.emit('notification:show', {
            message: `Новый документ: ${note.title}`,
            type: 'success',
            duration: 3000
        });
        
        return true;
    }
    
    // Сохранить выделенный фрагмент
    saveFragment(noteId, text) {
        const fragment = {
            id: `fragment-${Date.now()}`,
            noteId,
            text: text.trim(),
            timestamp: new Date().toISOString()
        };
        
        // Проверяем на дубликат
        const duplicate = this.highlightedFragments.find(f => 
            f.noteId === noteId && f.text === fragment.text
        );
        
        if (duplicate) return null;
        
        this.highlightedFragments.push(fragment);
        
        events.emit('fragment:saved', fragment);
        events.emit('notification:show', {
            message: 'Фрагмент сохранён в заметки',
            type: 'info',
            duration: 2000
        });
        
        return fragment;
    }
    
    // Удалить фрагмент
    removeFragment(fragmentId) {
        this.highlightedFragments = this.highlightedFragments.filter(f => f.id !== fragmentId);
        events.emit('fragment:removed', { fragmentId });
    }
    
    // Получить все заметки
    getAllNotes() {
        return this.collectedNotes.map(id => getNoteById(id)).filter(Boolean);
    }
    
    // Получить заметки по типу
    getNotesByType(type) {
        return this.getAllNotes().filter(note => note.type === type);
    }
    
    // Получить фрагменты по заметке
    getFragmentsForNote(noteId) {
        return this.highlightedFragments.filter(f => f.noteId === noteId);
    }
    
    // Получить все фрагменты
    getAllFragments() {
        return [...this.highlightedFragments];
    }
    
    // Проверить, есть ли заметка
    hasNote(noteId) {
        return this.collectedNotes.includes(noteId);
    }
    
    // Открыть заметку
    openNote(noteId) {
        const note = getNoteById(noteId);
        if (!note) return null;
        
        this.activeNote = noteId;
        return note;
    }
    
    // Закрыть заметку
    closeNote() {
        this.activeNote = null;
    }
    
    // Сериализация
    toJSON() {
        return {
            collectedNotes: [...this.collectedNotes],
            highlightedFragments: [...this.highlightedFragments]
        };
    }
    
    // Восстановление
    static fromJSON(json) {
        const manager = new NotesManager();
        if (json) {
            manager.collectedNotes = json.collectedNotes || [];
            manager.highlightedFragments = json.highlightedFragments || [];
        }
        return manager;
    }
}