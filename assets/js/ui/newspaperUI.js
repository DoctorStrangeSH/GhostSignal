class NewspaperUI {
    constructor() {
        this.pendingSolved = new Map();
        this._bindEvents();
    }
    
    _bindEvents() {
        events.on('case:solved', (data) => {
            const newspaperId = data.caseId + '-solved';
            // Fallback for resolutions without a separate ending report.
            const timer = setTimeout(() => {
                this.pendingSolved.delete(data.caseId);
                this.showNewspaper(newspaperId, 0);
            }, 2000);
            this.pendingSolved.set(data.caseId, timer);
        });

        events.on('ending:determined', ({ caseId, ending }) => {
            const timer = this.pendingSolved.get(caseId);
            if (timer === undefined) return;
            clearTimeout(timer);
            this.pendingSolved.delete(caseId);

            const newspaperId = ending?.newspaperId || caseId + '-solved';
            const modal = document.getElementById('universal-modal');
            if (!modal) {
                this.showNewspaper(newspaperId, 2000, ending);
                return;
            }
            // The report opens shortly after this event. Only queue the paper
            // after that specific report is shown and subsequently dismissed.
            modal.addEventListener('shown.bs.modal', () => {
                modal.addEventListener('hidden.bs.modal', () => {
                    this.showNewspaper(newspaperId, 0, ending);
                }, { once: true });
            }, { once: true });
        });
        
        events.on('case:failed', (data) => {
            const newspaperId = data.caseId + '-failed';
            this.showNewspaper(newspaperId);
        });
    }
    
    showNewspaper(newspaperId, delay = 2000, ending = null) {
        const newspaper = getNewspaper(newspaperId);
        if (!newspaper) return;
        const publicScrutiny = ending?.outcomeQuality === 'compromised'
            ? '<p class="editor-note">Редакция отмечает: несмотря на раскрытие преступления, действия детектива вызвали вопросы. Свидетели сообщают о нарушенных обещаниях или необоснованных обвинениях. Установленная вина преступника не отменяет ответственности следствия перед невиновными.</p>'
            : '';
        
        // Задержка для драматического эффекта
        setTimeout(() => {
            events.emit('modal:show', {
                title: `📰 ${newspaper.title}`,
                body: `
                    <div class="newspaper">
                        <div class="newspaper-date">${newspaper.date}</div>
                        <h2 class="newspaper-headline">${newspaper.headline}</h2>
                        <h3 class="newspaper-subtitle">${newspaper.subtitle}</h3>
                        <div class="newspaper-content">${newspaper.content}${publicScrutiny}</div>
                    </div>
                `,
                footer: `<button class="terminal-btn" data-bs-dismiss="modal">ПРОДОЛЖИТЬ</button>`
            });
        }, delay);
    }
}
