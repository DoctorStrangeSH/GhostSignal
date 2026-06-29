class NPCManager {
    constructor(gameTime, inventory) {
        this.gameTime = gameTime;
        this.inventory = inventory;
        this.activeNPCs = [];  // NPC, задействованные в текущем деле
        this.npcStates = {};   // Состояния NPC (диалоги, выданные улики)
        this.autoTriggered = []; // Уже авто-сработавшие условия
    }
    
    // Загрузить NPC для дела
    loadNPCsForCase(caseData) {
        this.activeNPCs = getNPCsByCase(caseData);
        this.npcStates = {};
        this.autoTriggered = [];
        
        // Инициализируем состояния
        this.activeNPCs.forEach(npc => {
            this.npcStates[npc.id] = {
                dialoguesCompleted: [],
                evidenceGiven: [],
                insightsGiven: [],
                lastInteraction: null
            };
        });
        
        events.emit('npcs:loaded', { npcs: this.activeNPCs });
    }
    
    // Проверить, доступен ли NPC сейчас
    isNPCAvailable(npcId) {
        const npc = getNPCById(npcId);
        if (!npc) return false;
        
        const currentHour = this.gameTime.hour;
        const schedule = npc.schedule;
        
        // Проверяем, спит ли
        if (this._isInTimeRange(currentHour, schedule.sleeps.start, schedule.sleeps.end)) {
            return { available: false, reason: 'sleeping', message: `${npc.name} сейчас спит` };
        }
        
        // Проверяем, бодрствует ли
        if (!this._isInTimeRange(currentHour, schedule.awake.start, schedule.awake.end)) {
            return { available: false, reason: 'unavailable', message: `${npc.name} недоступен` };
        }
        
        // Проверяем, на работе ли
        if (schedule.atWork) {
            const atWork = this._isInTimeRange(currentHour, schedule.atWork.start, schedule.atWork.end);
            const location = atWork ? schedule.locations.work : schedule.locations.home;
            return { 
                available: true, 
                reason: atWork ? 'at_work' : 'at_home',
                location: location,
                message: atWork ? `${npc.name} на работе` : `${npc.name} дома`
            };
        }
        
        return { available: true, reason: 'awake', location: null, message: `${npc.name} доступен` };
    }
    
    // Получить статус NPC для UI
    getNPCStatus(npcId) {
        const npc = getNPCById(npcId);
        if (!npc) return null;
        
        const availability = this.isNPCAvailable(npcId);
        const state = this.npcStates[npcId] || {};
        
        return {
            ...npc,
            ...availability,
            canCall: npc.availableForCall && availability.available,
            canChat: npc.availableForChat && availability.available,
            lastInteraction: state.lastInteraction,
            insightsGiven: state.insightsGiven || [],
            evidenceGiven: state.evidenceGiven || []
        };
    }
    
    // Получить статусы всех активных NPC
    getAllNPCStatuses() {
        return this.activeNPCs.map(npc => this.getNPCStatus(npc.id));
    }
    
    // Получить NPC на текущей локации
    getNPCsAtLocation(locationId) {
        return this.activeNPCs.filter(npc => {
            const availability = this.isNPCAvailable(npc.id);
            return availability.location === locationId && availability.available;
        });
    }
    
    // Получить диалог для NPC с учётом условий
    getDialogueForNPC(npcId) {
        const npc = getNPCById(npcId);
        if (!npc) return null;
        
        // Проверяем особые условия
        if (npc.specialConditions) {
            for (const condition of npc.specialConditions) {
                if (this._checkCondition(condition.condition)) {
                    return condition.dialogueId;
                }
            }
        }
        
        return npc.dialogueId;
    }
    
    // Проверить и авто-запустить условия
    checkAutoTriggers() {
        if (!this.activeNPCs) return;
        
        this.activeNPCs.forEach(npc => {
            if (!npc.specialConditions) return;
            
            npc.specialConditions.forEach(condition => {
                if (condition.autoTrigger && !this.autoTriggered.includes(condition.id)) {
                    if (this._checkCondition(condition.condition)) {
                        this.autoTriggered.push(condition.id);
                        this._handleAutoTrigger(npc, condition);
                    }
                }
            });
        });
    }
    
    // Отметить, что NPC дал улику
    markEvidenceGiven(npcId, evidenceId) {
        if (this.npcStates[npcId]) {
            this.npcStates[npcId].evidenceGiven.push(evidenceId);
            this.npcStates[npcId].lastInteraction = this.gameTime.getFormatted();
        }
    }
    
    // Отметить, что NPC дал озарение
    markInsightGiven(npcId, insightId) {
        if (this.npcStates[npcId]) {
            this.npcStates[npcId].insightsGiven.push(insightId);
            this.npcStates[npcId].lastInteraction = this.gameTime.getFormatted();
        }
    }
    
    // Внутренние методы
    
    _isInTimeRange(hour, start, end) {
        if (start < end) {
            // Обычный диапазон: 8-18
            return hour >= start && hour < end;
        } else {
            // Ночной диапазон: 20-6
            return hour >= start || hour < end;
        }
    }
    
    _checkCondition(conditionStr) {
        if (!conditionStr) return true;
        
        // hasItem:itemId
        if (conditionStr.startsWith('hasItem:')) {
            const itemId = conditionStr.replace('hasItem:', '');
            return this.inventory?.hasItem(itemId) || false;
        }
        
        // hasInsight:insightId
        if (conditionStr.startsWith('hasInsight:')) {
            const insightId = conditionStr.replace('hasInsight:', '');
            return this.inventory?.hasInsight(insightId) || false;
        }
        
        // evidence_count:N
        if (conditionStr.startsWith('evidence_count:')) {
            const count = parseInt(conditionStr.replace('evidence_count:', ''));
            return (this.inventory?.evidence?.length || 0) >= count;
        }
        
        return false;
    }
    
    _handleAutoTrigger(npc, condition) {
        // Например, сержант сам звонит, когда готов ордер
        events.emit('npc:auto_trigger', {
            npcId: npc.id,
            dialogueId: condition.dialogueId,
            condition: condition.id
        });
        
        events.emit('notification:show', {
            message: `${npc.name} хочет с вами поговорить`,
            type: 'info',
            duration: 5000
        });
    }
    
    // Сериализация
    toJSON() {
        return {
            activeNPCs: [...this.activeNPCs.map(n => n.id)],
            npcStates: JSON.parse(JSON.stringify(this.npcStates)),
            autoTriggered: [...this.autoTriggered]
        };
    }
    
    // Восстановление
    static fromJSON(json, gameTime, inventory) {
        const manager = new NPCManager(gameTime, inventory);
        if (json) {
            manager.npcStates = json.npcStates || {};
            manager.autoTriggered = json.autoTriggered || [];
        }
        return manager;
    }
}