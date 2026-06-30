class AchievementSystem {
    constructor() {
        this.achievements = [];
        this.unlocked = [];
        
        this._defineAchievements();
        this._bindEvents();
    }
    
    _defineAchievements() {
        this.achievements = [
            {
                id: 'first_case',
                name: 'Первое дело',
                description: 'Раскройте первое дело',
                icon: '🔍',
                rarity: 'common',
                condition: () => (window.app?.progress?.solvedCases?.length || 0) >= 1
            },
            {
                id: 'three_cases',
                name: 'Опытный сыщик',
                description: 'Раскройте 3 дела',
                icon: '⭐',
                rarity: 'rare',
                condition: () => (window.app?.progress?.solvedCases?.length || 0) >= 3
            },
            {
                id: 'no_hints',
                name: 'Без подсказок',
                description: 'Раскройте дело без единой подсказки',
                icon: '🧠',
                rarity: 'rare',
                condition: null // Отслеживается вручную
            },
            {
                id: 'perfect_case',
                name: 'Идеальное расследование',
                description: 'Раскройте дело с первой попытки',
                icon: '🎯',
                rarity: 'epic',
                condition: null
            },
            {
                id: 'all_evidence',
                name: 'Коллекционер улик',
                description: 'Найдите все улики в деле',
                icon: '📦',
                rarity: 'common',
                condition: null
            },
            {
                id: 'night_owl',
                name: 'Полуночник',
                description: 'Проведите расследование глубокой ночью',
                icon: '🦉',
                rarity: 'common',
                condition: () => {
                    const hour = window.app?.gameTime?.hour || 12;
                    return hour >= 2 && hour <= 5;
                }
            },
            {
                id: 'social_detective',
                name: 'Душа компании',
                description: 'Поговорите со всеми NPC в деле',
                icon: '💬',
                rarity: 'uncommon',
                condition: null
            },
            {
                id: 'speedy',
                name: 'Быстрый детектив',
                description: 'Раскройте дело менее чем за 30 игровых минут',
                icon: '⚡',
                rarity: 'epic',
                condition: null
            },
            {
                id: 'board_master',
                name: 'Мастер доски',
                description: 'Заполните все слоты на доске расследования',
                icon: '📋',
                rarity: 'uncommon',
                condition: null
            },
            {
                id: 'legend',
                name: 'Легенда участка',
                description: 'Достигните репутации 90+',
                icon: '👑',
                rarity: 'legendary',
                condition: () => {
                    return (window.app?.reputationSystem?.getReputation() || 0) >= 90;
                }
            }
        ];
    }
    
    _bindEvents() {
        // Проверяем достижения при раскрытии дела
        events.on('case:solved', (data) => {
            this.checkAll();
        });
        
        // Проверяем периодически
        setInterval(() => this.checkAll(), 30000);
    }
    
    checkAll() {
        this.achievements.forEach(achievement => {
            if (this.unlocked.includes(achievement.id)) return;
            
            if (achievement.condition && achievement.condition()) {
                this._unlock(achievement);
            }
        });
    }
    
    // Ручная разблокировка
    unlock(achievementId) {
        const achievement = this.achievements.find(a => a.id === achievementId);
        if (achievement && !this.unlocked.includes(achievementId)) {
            this._unlock(achievement);
        }
    }
    
    _unlock(achievement) {
        this.unlocked.push(achievement.id);
        
        // Эффект
        const rarityColors = {
            common: 'var(--accent-green)',
            uncommon: '#5588cc',
            rare: '#aa66ff',
            epic: '#ff8800',
            legendary: '#ffd700'
        };
        
        events.emit('notification:show', {
            message: `🏆 Достижение: ${achievement.icon} ${achievement.name} — ${achievement.description}`,
            type: 'success',
            duration: 5000
        });
        
        // Сохраняем
        storage.set('achievements', this.unlocked);
    }
    
    getUnlocked() {
        return this.achievements.filter(a => this.unlocked.includes(a.id));
    }
    
    getAll() {
        return this.achievements.map(a => ({
            ...a,
            unlocked: this.unlocked.includes(a.id)
        }));
    }
    
    // Загрузка
    load() {
        this.unlocked = storage.get('achievements', []);
    }
}