class MinigameManager {
    constructor() {
        this.games = {};
        this.currentGame = null;
        this.container = null;
    }
    
    setContainer(containerId) {
        this.container = document.getElementById(containerId);
    }
    
    // Зарегистрировать мини-игру
    registerGame(gameConfig) {
        let game;
        
        switch (gameConfig.type) {
            case 'cipher':
                game = new MinigameCipher(gameConfig);
                break;
            case 'search':
                game = new MinigameSearch(gameConfig);
                break;
            case 'lock':
                game = new MinigameLock(gameConfig);
                break;
            default:
                console.warn('Неизвестный тип мини-игры:', gameConfig.type);
                return null;
        }
        
        this.games[game.id] = game;
        return game;
    }
    
    // Запустить мини-игру
    startGame(gameId) {
        const game = this.games[gameId];
        if (!game) {
            console.error('Мини-игра не найдена:', gameId);
            return;
        }
        
        if (game.isCompleted) {
            events.emit('notification:show', {
                message: 'Эта мини-игра уже пройдена',
                type: 'info',
                duration: 2000
            });
            return;
        }
        
        this.currentGame = game;
        
        // Показываем в модальном окне
        const modalBody = document.getElementById('modal-body');
        const modalTitle = document.getElementById('modal-title');
        
        if (modalBody && modalTitle) {
            modalTitle.textContent = `🎮 ${game.name}`;
            game.render(modalBody);
            
            const modal = new bootstrap.Modal(document.getElementById('universal-modal'));
            modal.show();
            
            // При закрытии модалки останавливаем игру
            document.getElementById('universal-modal').addEventListener('hidden.bs.modal', () => {
                if (game.isActive) {
                    game.fail('cancelled');
                }
            }, { once: true });
        }
    }
    
    // Получить игру по ID
    getGame(gameId) {
        return this.games[gameId] || null;
    }
    
    // Проверить, пройдена ли игра
    isGameCompleted(gameId) {
        return this.games[gameId]?.isCompleted || false;
    }
    
    // Сбросить все игры
    resetAll() {
        Object.values(this.games).forEach(game => game.reset());
    }
}