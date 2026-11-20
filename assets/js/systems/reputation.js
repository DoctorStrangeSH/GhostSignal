class ReputationSystem {
    constructor() {
        this.reputation = 50;        // 0-100 (старт: нейтрально)
        this.npcRelations = {};      // Отношения с каждым NPC: -10 до 10
        this.actions = [];           // История действий
        this.factionReputation = { police: 50, press: 50, residents: 50, witnesses: 50, underworld: 50 };
        this.factionActionIds = [];
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
    
    // === РЕПУТАЦИЯ СРЕДИ СООБЩЕСТВ ===
    getFactionReputation(factionId) {
        return Number.isFinite(this.factionReputation[factionId]) ? this.factionReputation[factionId] : null;
    }

    getFactionStanding(factionId) {
        const score = this.getFactionReputation(factionId);
        if (score === null) return null;
        if (score >= 80) return { score, status: 'trusted', label: 'Высокое доверие' };
        if (score >= 60) return { score, status: 'favorable', label: 'Хорошая репутация' };
        if (score >= 40) return { score, status: 'neutral', label: 'Нейтральное отношение' };
        if (score >= 20) return { score, status: 'wary', label: 'Настороженность' };
        return { score, status: 'hostile', label: 'Плохая репутация' };
    }

    changeFactionReputation(factionId, amount, reason = '', eventId = null) {
        const validFactions = ['police', 'press', 'residents', 'witnesses', 'underworld'];
        if (!validFactions.includes(factionId) || !Number.isFinite(amount) || amount === 0) return { changed: false, reason: 'invalid_change' };
        if (eventId !== null && (typeof eventId !== 'string' || !eventId.trim())) return { changed: false, reason: 'invalid_event_id' };
        if (eventId && this.factionActionIds.includes(eventId)) return { changed: false, reason: 'already_applied' };
        const previous = this.factionReputation[factionId];
        const current = Math.max(0, Math.min(100, previous + amount));
        const applied = current - previous;
        if (eventId) { this.factionActionIds.push(eventId); this.factionActionIds = this.factionActionIds.slice(-500); }
        if (applied === 0) return { changed: false, reason: 'at_limit', score: current };
        this.factionReputation[factionId] = current;
        const action = { type: 'faction_rep', factionId, amount: applied, reason: String(reason || '').slice(0, 240), eventId };
        this.actions.push(action);
        if (typeof events !== 'undefined' && events?.emit) events.emit('reputation:faction_changed', { factionId, previous, reputation: current, change: applied, standing: this.getFactionStanding(factionId) });
        return { changed: true, previous, score: current, change: applied, standing: this.getFactionStanding(factionId) };
    }

    getFactionSummary() {
        return Object.fromEntries(Object.keys(this.factionReputation).map(id => [id, this.getFactionStanding(id)]));
    }
    // === СЕРИАЛИЗАЦИЯ ===
    
    toJSON() {
        return {
            reputation: this.reputation,
            npcRelations: { ...this.npcRelations },
            title: this.title,
            factionReputation: { ...this.factionReputation },
            factionActionIds: [...this.factionActionIds],
            actions: this.actions.map(action => ({ ...action }))
        };
    }
    
    static fromJSON(json) {
        const system = new ReputationSystem();
        if (json) {
            system.reputation = json.reputation || 50;
            system.npcRelations = json.npcRelations || {};
            system.title = system._getTitle();
            const factions = json.factionReputation && typeof json.factionReputation === 'object' ? json.factionReputation : {};
            for (const id of Object.keys(system.factionReputation)) {
                if (Number.isFinite(factions[id])) system.factionReputation[id] = Math.max(0, Math.min(100, factions[id]));
            }
            system.factionActionIds = Array.isArray(json.factionActionIds)
                ? [...new Set(json.factionActionIds.filter(id => typeof id === 'string' && id.trim()).slice(-500))] : [];
            system.actions = Array.isArray(json.actions) ? json.actions.slice(-500).map(action => ({ ...action })) : [];
        }
        return system;
    }
}