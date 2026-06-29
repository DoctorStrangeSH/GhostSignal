class ReputationSystem {
    constructor() {
        this.reputation = 50;        // 0-100 (старт: нейтрально)
        this.npcRelations = {};      // Отношения с каждым NPC: -10 до 10
        this.actions = [];           // История действий
        this.title = this._getTitle();
    }
    
    // === РЕПУТАЦИЯ ===
    
    addReputation(amount, reason = '') {
        this.reputation = Math.min(100, Math.max(0, this.reputation + amount));
        this.actions.push({ type: 'rep', amount, reason, time: Date.now() });
        
        const oldTitle = this.title;
        this.title = this._getTitle();
        
        if (oldTitle !== this.title) {
            events.emit('reputation:title_changed', { oldTitle, newTitle: this.title });
        }
        
        events.emit('reputation:changed', { reputation: this.reputation, title: this.title });
    }
    
    getReputation() {
        return this.reputation;
    }
    
    _getTitle() {
        if (this.reputation >= 90) return 'ЛЕГЕНДА';
        if (this.reputation >= 75) return 'УВАЖАЕМЫЙ ДЕТЕКТИВ';
        if (this.reputation >= 60) return 'ОПЫТНЫЙ СЫЩИК';
        if (this.reputation >= 40) return 'ДЕТЕКТИВ';
        if (this.reputation >= 25) return 'НОВИЧОК';
        return 'ПОЗОР УЧАСТКА';
    }
    
    // === ОТНОШЕНИЯ С NPC ===
    
    getNPCRelation(npcId) {
        return this.npcRelations[npcId] || 0;
    }
    
    changeNPCRelation(npcId, amount) {
        const current = this.npcRelations[npcId] || 0;
        this.npcRelations[npcId] = Math.min(10, Math.max(-10, current + amount));
        
        const relation = this.npcRelations[npcId];
        events.emit('npc:relation_changed', { npcId, relation, change: amount });
        
        // Если отношения испорчены — NPC может отказаться говорить
        if (relation <= -7) {
            events.emit('npc:hostile', { npcId });
        }
    }
    
    getRelationStatus(npcId) {
        const rel = this.npcRelations[npcId] || 0;
        if (rel >= 7) return { status: 'ally', label: 'Доверяет', icon: '🤝' };
        if (rel >= 3) return { status: 'friendly', label: 'Дружелюбен', icon: '🙂' };
        if (rel >= -2) return { status: 'neutral', label: 'Нейтрален', icon: '😐' };
        if (rel >= -6) return { status: 'wary', label: 'Насторожен', icon: '😟' };
        return { status: 'hostile', label: 'Враждебен', icon: '😠' };
    }
    
    // === ПОСЛЕДСТВИЯ ДЕЙСТВИЙ ===
    
    // Раскрыл дело
    caseSolved(caseData) {
        this.addReputation(15, `Раскрыто дело: ${caseData.title}`);
        
        // Улучшаем отношения с сержантом
        this.changeNPCRelation('sergeant', 2);
        
        events.emit('notification:show', {
            message: `Репутация +15. Текущий статус: ${this.title}`,
            type: 'success',
            duration: 4000
        });
    }
    
    // Провалил дело
    caseFailed(caseData) {
        this.addReputation(-10, `Провалено дело: ${caseData.title}`);
        this.changeNPCRelation('sergeant', -3);
        
        events.emit('notification:show', {
            message: `Репутация -10. Сержант недоволен.`,
            type: 'error',
            duration: 4000
        });
    }
    
    // Использовал подсказку
    usedHint() {
        this.addReputation(-2, 'Использована подсказка');
    }
    
    // Грубо допросил NPC
    rudeInterrogation(npcId) {
        this.changeNPCRelation(npcId, -4);
        this.addReputation(-3, `Грубый допрос: ${npcId}`);
        
        events.emit('notification:show', {
            message: `${getNPCById(npcId)?.name || npcId} теперь относится к вам хуже`,
            type: 'warning',
            duration: 3000
        });
    }
    
    // Помог NPC
    helpedNPC(npcId) {
        this.changeNPCRelation(npcId, 3);
        this.addReputation(5, `Помощь: ${npcId}`);
    }
    
    // === БОНУСЫ ЗВАНИЙ ===
    
    getBonuses() {
        const bonuses = [];
        
        if (this.reputation >= 90) {
            bonuses.push({ name: 'Секретные дела', description: 'Доступ к делам категории X' });
            bonuses.push({ name: 'Доверие информаторов', description: 'NPC дают +1 улику при допросе' });
        }
        if (this.reputation >= 75) {
            bonuses.push({ name: 'Быстрый анализ', description: 'Мини-игры на 20% быстрее' });
        }
        if (this.reputation >= 60) {
            bonuses.push({ name: 'Уважение коллег', description: 'Сержант выдаёт ордер без запроса' });
        }
        if (this.reputation >= 40) {
            bonuses.push({ name: 'Базовый доступ', description: 'Все публичные локации открыты' });
        }
        
        return bonuses;
    }
    
    // === СЕРИАЛИЗАЦИЯ ===
    
    toJSON() {
        return {
            reputation: this.reputation,
            npcRelations: { ...this.npcRelations },
            title: this.title
        };
    }
    
    static fromJSON(json) {
        const system = new ReputationSystem();
        if (json) {
            system.reputation = json.reputation || 50;
            system.npcRelations = json.npcRelations || {};
            system.title = system._getTitle();
        }
        return system;
    }
}