class InterrogationSystem {
    constructor() {
        this.activeNPC = null;
        this.patience = 0;
        this.maxPatience = 5;
        this.questionsAsked = 0;
        this.npcGone = {}; // npcId -> true если NPC ушёл
        this.backupPaths = {}; // Запасные пути для улик
    }

    // Начать допрос
    startInterrogation(npcId) {
        const npc = getNPCById(npcId);
        if (!npc) return null;

        // Проверяем, не ушёл ли NPC
        if (this.npcGone[npcId]) {
            events.emit('notification:show', {
                message: `${npc.name} отказывается говорить. Поищите другие зацепки.`,
                type: 'warning',
                duration: 4000
            });
            return null;
        }

        this.activeNPC = npc;
        this.patience = this.maxPatience;
        this.questionsAsked = 0;

        return {
            npc,
            patience: this.patience,
            maxPatience: this.maxPatience
        };
    }

    // Задать вопрос
    askQuestion(questionType) {
        if (!this.activeNPC) return null;

        const costs = {
            calm: 1,      // Спокойный
            direct: 1,    // Прямой
            aggressive: 2 // Агрессивный
        };

        const cost = costs[questionType] || 1;
        this.patience -= cost;
        this.questionsAsked++;

        // Проверяем последствия
        if (this.patience <= 0) {
            const npcId = this.activeNPC.id;
            this.npcGone[npcId] = true;

            // Подсказываем альтернативу
            const backup = this.backupPaths[npcId];
            if (backup) {
                setTimeout(() => {
                    events.emit('notification:show', {
                        message: `${this.activeNPC.name} ушёл. ${backup.hint}`,
                        type: 'warning',
                        duration: 5000
                    });
                }, 1000);
            }

            events.emit('interrogation:failed', {
                npcId: this.activeNPC.id,
                reason: 'patience_depleted'
            });

            this.activeNPC = null;
            return { success: false, reason: 'patience_depleted', npc: this.activeNPC };
        }

        // Агрессивный вопрос может сразу прогнать NPC
        if (questionType === 'aggressive' && Math.random() < 0.3) {
            const npcId = this.activeNPC.id;
            this.npcGone[npcId] = true;
            this.activeNPC = null;

            events.emit('interrogation:failed', {
                npcId: npcId,
                reason: 'npc_offended'
            });

            return { success: false, reason: 'npc_offended' };
        }

        return {
            success: true,
            patienceLeft: this.patience,
            questionsLeft: Math.floor(this.patience / costs[questionType])
        };
    }

    // Зарегистрировать запасной путь
    registerBackup(npcId, hint, alternativeMethod) {
        this.backupPaths[npcId] = {
            hint: hint,
            method: alternativeMethod
        };
    }

    // Сбросить NPC (возвращается через сутки)
    resetNPC(npcId) {
        this.npcGone[npcId] = false;
    }

    // Проверить, доступен ли NPC для допроса
    isNPCAvailable(npcId) {
        return !this.npcGone[npcId];
    }

    // Сериализация
    toJSON() {
        return {
            npcGone: { ...this.npcGone },
            backupPaths: { ...this.backupPaths }
        };
    }

    static fromJSON(json) {
        const system = new InterrogationSystem();
        if (json) {
            system.npcGone = json.npcGone || {};
            system.backupPaths = json.backupPaths || {};
        }
        return system;
    }
}