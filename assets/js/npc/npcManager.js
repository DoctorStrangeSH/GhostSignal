class NPCManager {
    constructor(gameTime, inventory) {
        this.gameTime = gameTime;
        this.inventory = inventory;
        this.activeNPCs = [];
        this.npcStates = {};
        this.autoTriggered = [];
    }

    loadNPCsForCase(caseData) {
        if (!caseData?.npcs || !Array.isArray(caseData.npcs)) {
            console.warn('⚠️ В деле нет списка NPC');
            this.activeNPCs = [];
            events.emit('npcs:loaded', { npcs: [] });
            return;
        }

        this.activeNPCs = caseData.npcs
            .map(id => getNPCById(id))
            .filter(Boolean);

        this.npcStates = {};
        this.autoTriggered = [];

        this.activeNPCs.forEach(npc => {
            this.npcStates[npc.id] = {
                dialoguesCompleted: [],
                evidenceGiven: [],
                insightsGiven: [],
                lastInteraction: null
            };
        });

        console.log('👥 NPC загружены для дела:', this.activeNPCs.length);
        events.emit('npcs:loaded', { npcs: this.activeNPCs });
    }

    isNPCAvailable(npcId) {
        const npc = getNPCById(npcId);
        if (!npc) return { available: false, reason: 'not_found', message: 'NPC не найден' };

        const currentHour = this.gameTime.hour;
        const schedule = npc.schedule;

        if (schedule.sleeps && this._isInTimeRange(currentHour, schedule.sleeps.start, schedule.sleeps.end)) {
            return { available: false, reason: 'sleeping', message: `${npc.name} сейчас спит` };
        }

        if (schedule.awake && !this._isInTimeRange(currentHour, schedule.awake.start, schedule.awake.end)) {
            return { available: false, reason: 'unavailable', message: `${npc.name} недоступен` };
        }

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

        return { available: true, reason: 'awake', location: schedule.locations?.work || null, message: `${npc.name} доступен` };
    }

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

    getAllNPCStatuses() {
        if (!this.activeNPCs || this.activeNPCs.length === 0) return [];
        return this.activeNPCs.map(npc => this.getNPCStatus(npc.id)).filter(Boolean);
    }

    getNPCsAtLocation(locationId) {
        const location = getLocationById(locationId);
        if (!location) return [];

        const npcsHere = this.activeNPCs.filter(npc => {
            const availability = this.isNPCAvailable(npc.id);
            return availability.location === locationId && availability.available;
        });

        if (npcsHere.length === 0 && location.parentLocation) {
            return this.activeNPCs.filter(npc => {
                const availability = this.isNPCAvailable(npc.id);
                return availability.location === location.parentLocation && availability.available;
            });
        }

        return npcsHere;
    }

    getDialogueForNPC(npcId) {
        const npc = getNPCById(npcId);
        if (!npc) return null;

        if (npc.specialConditions) {
            for (const condition of npc.specialConditions) {
                if (this._checkCondition(condition.condition) && condition.dialogueId) {
                    return condition.dialogueId;
                }
            }
        }

        return npc.dialogueId;
    }

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

    markEvidenceGiven(npcId, evidenceId) {
        if (this.npcStates[npcId]) {
            this.npcStates[npcId].evidenceGiven.push(evidenceId);
            this.npcStates[npcId].lastInteraction = this.gameTime.getFormatted();
        }
    }

    markInsightGiven(npcId, insightId) {
        if (this.npcStates[npcId]) {
            this.npcStates[npcId].insightsGiven.push(insightId);
            this.npcStates[npcId].lastInteraction = this.gameTime.getFormatted();
        }
    }

    _isInTimeRange(hour, start, end) {
        if (start < end) {
            return hour >= start && hour < end;
        } else {
            return hour >= start || hour < end;
        }
    }

    _checkCondition(conditionStr) {
        if (!conditionStr) return true;

        if (conditionStr.startsWith('hasItem:')) {
            const itemId = conditionStr.replace('hasItem:', '');
            return this.inventory?.hasItem(itemId) || false;
        }

        if (conditionStr.startsWith('hasInsight:')) {
            const insightId = conditionStr.replace('hasInsight:', '');
            return this.inventory?.hasInsight(insightId) || false;
        }

        if (conditionStr.startsWith('evidence_count:')) {
            const count = parseInt(conditionStr.replace('evidence_count:', ''));
            return (this.inventory?.evidence?.length || 0) >= count;
        }

        return false;
    }

    _handleAutoTrigger(npc, condition) {
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

    toJSON() {
        return {
            activeNPCs: this.activeNPCs.map(n => n.id),
            npcStates: JSON.parse(JSON.stringify(this.npcStates)),
            autoTriggered: [...this.autoTriggered]
        };
    }

    static fromJSON(json, gameTime, inventory) {
        const manager = new NPCManager(gameTime, inventory);
        if (json) {
            manager.npcStates = json.npcStates || {};
            manager.autoTriggered = json.autoTriggered || [];
            if (json.activeNPCs && json.activeNPCs.length > 0) {
                manager.activeNPCs = json.activeNPCs.map(id => getNPCById(id)).filter(Boolean);
            }
        }
        return manager;
    }
}