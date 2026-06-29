class NewspaperUI {
    constructor() {
        this._bindEvents();
    }
    
    _bindEvents() {
        events.on('case:solved', (data) => {
            const newspaperId = data.caseId + '-solved';
            this.showNewspaper(newspaperId);
        });
        
        events.on('case:failed', (data) => {
            const newspaperId = data.caseId + '-failed';
            this.showNewspaper(newspaperId);
        });
    }
    
    showNewspaper(newspaperId) {
        const newspaper = getNewspaper(newspaperId);
        if (!newspaper) return;
        
        // Задержка для драматического эффекта
        setTimeout(() => {
            events.emit('modal:show', {
                title: `📰 ${newspaper.title}`,
                body: `
                    <div class="newspaper">
                        <div class="newspaper-date">${newspaper.date}</div>
                        <h2 class="newspaper-headline">${newspaper.headline}</h2>
                        <h3 class="newspaper-subtitle">${newspaper.subtitle}</h3>
                        <div class="newspaper-content">${newspaper.content}</div>
                    </div>
                `,
                footer: `<button class="terminal-btn" data-bs-dismiss="modal">ПРОДОЛЖИТЬ</button>`
            });
        }, 2000);
    }
}