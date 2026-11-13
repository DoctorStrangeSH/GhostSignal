class DialogueEngine {
    constructor(inventory, gameTime) {
        this.inventory = inventory;
        this.gameTime = gameTime;
        this.currentDialogue = null;
        this.currentNode = null;
        this.dialogueHistory = [];
        this.onNodeChange = null;
        this.memoryService = null;
        this.motivationService = null;
    }

    setMemoryService(service) {
        this.memoryService = service || null;
    }

    setMotivationService(service) {
        this.motivationService = service || null;
    }

    setSocialNetwork(service) {
        this.socialNetwork = service || null;
    }

    _recordNodeMemory(node) {
        const npcId = this.currentDialogue?.npcId;
        if (!npcId || !this.memoryService || !node) return;
        this.memoryService.recordNodeVisited(npcId, this.currentDialogue.id, node);
        this._notifyMemoryChanged();
    }

    _notifyMemoryChanged() {
        if (!this.memoryService) return;
        events.emit('npc:memory_changed', this.memoryService.toJSON());
        if (this.socialNetwork) events.emit('npc:social_network_changed', this.socialNetwork.toJSON());
    }
    
    // Начать диалог
    startDialogue(dialogueId) {
        const dialogue = getDialogueById(dialogueId);
        if (!dialogue) {
            console.error('Диалог не найден:', dialogueId);
            return false;
        }
        
        this.currentDialogue = dialogue;
        this.dialogueHistory = [];
        
        const startNode = dialogue.tree.nodes[dialogue.tree.start];
        if (!startNode) {
            console.error('Стартовый узел не найден:', dialogue.tree.start);
            return false;
        }
        
        this.currentNode = {
            id: dialogue.tree.start,
            ...startNode
        };
        
        this.dialogueHistory.push({
            nodeId: dialogue.tree.start,
            speaker: startNode.speaker,
            text: startNode.text
        });

        if (this.memoryService) {
            this.memoryService.recordDialogueStarted(dialogue.npcId, dialogue.id);
            this._recordNodeMemory(this.currentNode);
        }
        this._processNodeEffects(startNode);
        
        if (this.gameTime) {
            this.gameTime.advance(CONFIG.time.costs.dialogue);
        }
        
        if (this.onNodeChange) {
            this.onNodeChange(this.currentNode);
        }
        
        return true;
    }
    
    // Выбрать ответ
    selectAnswer(answerIndex) {
        if (!this.currentNode?.answers) return null;
        
        const answer = this.currentNode.answers[answerIndex];
        if (!answer) return null;
        
        // Проверяем условие
        if (answer.condition && !this._checkCondition(answer.condition)) {
            return { error: 'Условие не выполнено' };
        }
        
        if (this.memoryService && this.currentDialogue?.npcId) {
            this.memoryService.recordAnswerSelected(
                this.currentDialogue.npcId,
                this.currentDialogue.id,
                this.currentNode.id,
                answer
            );
            if (answer.promise) {
                this.memoryService.recordPromise(this.currentDialogue.npcId, answer.promise);
            }
            if (answer.accusation) {
                this.memoryService.recordAccusation(this.currentDialogue.npcId, {
                    ...answer.accusation,
                    dialogueId: this.currentDialogue.id,
                    nodeId: this.currentNode.id
                });
            }
            if (answer.resolveAccusation) {
                this.memoryService.resolveAccusation(this.currentDialogue.npcId, answer.resolveAccusation.id, answer.resolveAccusation.outcome, answer.resolveAccusation.reason);
            }
            if (answer.report?.id && answer.report.networkPropagation && this.socialNetwork) {
                this.socialNetwork.publish(this.currentDialogue.npcId, answer.report, {
                    dialogueId: this.currentDialogue.id, nodeId: this.currentNode.id,
                    answerText: answer.text, tone: answer.tone || 'neutral',
                    gameMinute: this.gameTime ? (Math.max(1, this.gameTime.day || 1) - 1) * 1440 + this.gameTime.hour * 60 + this.gameTime.minute : null
                });
            } else if (answer.report?.id && Array.isArray(answer.report.recipients)) {
                for (const recipient of answer.report.recipients) {
                    const recipientConfig = typeof recipient === 'string' ? { npcId: recipient } : recipient;
                    if (!recipientConfig?.npcId) continue;
                    this.memoryService.shareExperience(
                        this.currentDialogue.npcId,
                        recipientConfig.npcId,
                        answer.report,
                        {
                            dialogueId: this.currentDialogue.id,
                            nodeId: this.currentNode.id,
                            answerText: answer.text,
                            tone: answer.tone || 'neutral'
                        },
                        { recipientTrust: recipientConfig.recipientTrust }
                    );
                }
            }
            if (answer.revealSocialEvents && this.socialNetwork) {
                const discovery = answer.revealSocialEvents;
                this.socialNetwork.revealEventsForReport(discovery.reportId, {
                    ...discovery,
                    method: 'dialogue',
                    sourceId: `${this.currentDialogue.id}:${this.currentNode.id}:${answerIndex}`
                });
            }
            this._notifyMemoryChanged();
        }

        // Если диалог завершается
        if (answer.nextNode === 'end_call' || answer.nextNode === 'end_talk' || 
            answer.nextNode === 'end_briefing' || answer.nextNode === 'end_elias' ||
            answer.nextNode === 'end_wife' || answer.nextNode === 'end_red' ||
            answer.nextNode === 'end_anna' || answer.nextNode === 'end_eva' ||
            answer.nextNode === 'end_rival' || answer.nextNode === 'end_pharmacist' ||
            answer.nextNode === 'end_waiter' || answer.nextNode === 'end_journalist' ||
            answer.nextNode === 'end_bartender2' || answer.nextNode === 'end_red_scarf') {
            
            const endNode = this.currentDialogue.tree.nodes[answer.nextNode];
            if (endNode) {
                this.currentNode = { id: answer.nextNode, ...endNode };
                this.dialogueHistory.push({
                    nodeId: answer.nextNode,
                    speaker: endNode.speaker,
                    text: endNode.text
                });
                this._recordNodeMemory(this.currentNode);
                this._processNodeEffects(endNode);
            }
            
            if (this.onNodeChange) this.onNodeChange(this.currentNode);
            return { endDialogue: true };
        }
        
        // Переходим к следующему узлу
        const nextNode = this.currentDialogue.tree.nodes[answer.nextNode];
        if (!nextNode) {
            console.error('Узел не найден:', answer.nextNode);
            return { error: 'Узел не найден' };
        }
        
        this.currentNode = { id: answer.nextNode, ...nextNode };
        
        this.dialogueHistory.push({
            nodeId: answer.nextNode,
            speaker: nextNode.speaker,
            text: nextNode.text
        });

        this._recordNodeMemory(this.currentNode);
        this._processNodeEffects(nextNode);
        
        if (this.gameTime) {
            this.gameTime.advance(CONFIG.time.costs.dialogue);
        }
        
        if (this.onNodeChange) {
            this.onNodeChange(this.currentNode);
        }
        
        return this.currentNode;
    }
    
    // Проверить, завершён ли диалог
    isDialogueEnded() {
        return this.currentNode?.endDialogue === true;
    }
    
    // Получить доступные ответы с учётом условий
    getAvailableAnswers() {
        if (!this.currentNode?.answers) return [];
        
        return this.currentNode.answers.map((answer, index) => ({
            ...answer,
            index,
            isAvailable: !answer.condition || this._checkCondition(answer.condition)
        }));
    }
    
    // Сбросить диалог
    reset() {
        this.currentDialogue = null;
        this.currentNode = null;
        this.dialogueHistory = [];
    }
    
    // Получить историю диалога
    getHistory() {
        return [...this.dialogueHistory];
    }
    
    // Предъявить собранную улику текущему персонажу.
    presentEvidence(evidenceId) {
        const dialogue = this.currentDialogue;
        const npcId = dialogue?.npcId;
        if (!dialogue || !npcId || !evidenceId) return { success: false, reason: 'no_active_dialogue' };
        const evidenceObject = getObjectById(evidenceId);
        const isCollectedEvidence = this.inventory?.hasItem?.(evidenceId) ||
            this.inventory?.evidence?.includes(evidenceId);
        if (!isCollectedEvidence || !evidenceObject?.isEvidence) {
            return { success: false, reason: 'evidence_not_available' };
        }

        if (this.memoryService) {
            const recorded = this.memoryService.recordEvidencePresented(npcId, dialogue.id, evidenceId);
            if (!recorded.recorded) return { success: false, reason: recorded.reason };
        }

        const reaction = dialogue.evidenceReactions?.[evidenceId];
        const object = getObjectById(evidenceId);
        const node = {
            id: `evidence_${evidenceId}`,
            speaker: 'npc',
            text: reaction?.text || `Вы показываете ${object?.name || 'улику'}. Персонаж внимательно изучает её, но пока не готов сделать вывод.`,
            mood: reaction?.mood || 'serious',
            givesInsight: reaction?.givesInsight || null,
            claim: reaction?.claim || null,
            answers: reaction?.answers || this.currentNode?.answers || []
        };

        this.currentNode = node;
        this.dialogueHistory.push({ nodeId: node.id, speaker: node.speaker, text: node.text });
        this._recordNodeMemory(node);
        this._processNodeEffects(node);
        if (this.gameTime) this.gameTime.advance(CONFIG.time.costs.dialogue);
        if (this.onNodeChange) this.onNodeChange(this.currentNode);
        return { success: true, reaction: Boolean(reaction), node: this.currentNode };
    }

    // Предъявить NPC заранее сопоставленные несовместимые показания.
    presentPreparedContradiction() {
        const dialogue = this.currentDialogue;
        const npcId = dialogue?.npcId;
        if (!dialogue || !npcId || !this.memoryService) {
            return { success: false, reason: 'no_active_dialogue' };
        }

        const prepared = this.memoryService.getPreparedConfrontation(npcId);
        if (!prepared) return { success: false, reason: 'no_prepared_confrontation' };

        const reaction = dialogue.contradictionReactions?.[prepared.topic] || null;
        const first = prepared.contradiction.first;
        const second = prepared.contradiction.second;
        const responseText = reaction?.text ||
            `Вы предъявляете два несовместимых показания: «${first.summary}» и «${second.summary}». Персонаж перечитывает записи и просит время, чтобы обдумать ответ.`;

        if (!this.memoryService.recordConfrontation(npcId, reaction?.givesInsight || null)) {
            return { success: false, reason: 'already_confronted' };
        }

        const node = {
            id: `contradiction_${prepared.topic}`,
            speaker: 'npc',
            text: responseText,
            mood: reaction?.mood || 'guarded',
            givesInsight: reaction?.givesInsight || null,
            claim: reaction?.claim || null,
            answers: reaction?.answers || this.currentNode?.answers || []
        };

        this.currentNode = node;
        this.dialogueHistory.push({ nodeId: node.id, speaker: node.speaker, text: node.text });
        this._recordNodeMemory(node);
        this._processNodeEffects(node);
        events.emit('npc:contradiction_presented', {
            npcId,
            topic: prepared.topic,
            firstId: prepared.firstId,
            secondId: prepared.secondId
        });
        this._notifyMemoryChanged();

        if (this.gameTime) this.gameTime.advance(CONFIG.time.costs.dialogue);
        if (this.onNodeChange) this.onNodeChange(this.currentNode);
        return { success: true, reaction: Boolean(reaction), node: this.currentNode };
    }

    // ============ ВНУТРЕННИЕ МЕТОДЫ ============
    
    _processNodeEffects(node) {
        if (!node) return;

        if (node.claim && this.memoryService && this.currentDialogue?.npcId) {
            const result = this.memoryService.recordClaim(
                this.currentDialogue.npcId,
                {
                    ...node.claim,
                    dialogueId: this.currentDialogue.id,
                    nodeId: node.id
                }
            );
            const discovered = (result.contradictions || []).filter(item =>
                item.first.id === node.claim.id || item.second.id === node.claim.id
            );
            if (discovered.length) {
                events.emit('npc:contradiction_detected', {
                    npcId: this.currentDialogue.npcId,
                    dialogueId: this.currentDialogue.id,
                    contradictions: discovered
                });
            }
            if (result.added) this._notifyMemoryChanged();
        }
        
        // Выдача улики
        if (node.givesEvidence) {
            events.emit('evidence:from_dialogue', { evidenceId: node.givesEvidence });
        }
        
        // Выдача озарения
        if (node.givesInsight) {
            this.inventory?.addInsight(node.givesInsight);
        }
        
        // Спавн предмета (если есть)
        if (node.spawnsItem) {
            events.emit('evidence:from_dialogue', { evidenceId: node.spawnsItem });
        }
    }
    
    _checkCondition(conditionStr) {
        if (!conditionStr) return true;

        if (conditionStr.startsWith('all:')) {
            return conditionStr.slice(4).split('&').map(part => part.trim())
                .filter(Boolean).every(part => this._checkCondition(part));
        }
        if (conditionStr.startsWith('any:')) {
            return conditionStr.slice(4).split('&').map(part => part.trim())
                .filter(Boolean).some(part => this._checkCondition(part));
        }
        
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
        
        const npcId = this.currentDialogue?.npcId;
        const npc = npcId && typeof getNPCById === 'function' ? getNPCById(npcId) : null;
        const psychology = npcId
            ? this.memoryService?.getPsychologicalState(npcId, npc?.psychology)
            : null;

        if (conditionStr.startsWith('motive:')) {
            return Boolean(npcId && this.motivationService?.hasMotive(npcId, conditionStr.slice('motive:'.length)));
        }
        const loyaltyCondition = conditionStr.match(/^loyalty_(at_least|below):([^:]+):(\d+(?:\.\d+)?)$/);
        if (loyaltyCondition) {
            const [, operator, protectedNpcId, rawThreshold] = loyaltyCondition;
            const threshold = Number(rawThreshold);
            const loyalty = npcId && this.motivationService?.getEffectiveLoyalty(npcId, protectedNpcId);
            if (!loyalty || !Number.isFinite(threshold)) return false;
            return operator === 'at_least' ? loyalty.score >= threshold : loyalty.score < threshold;
        }

        if (conditionStr.startsWith('trust_at_least:')) {
            const threshold = Number(conditionStr.slice('trust_at_least:'.length));
            return Number.isFinite(threshold) && (psychology?.trust ?? 50) >= threshold;
        }
        if (conditionStr.startsWith('trust_below:')) {
            const threshold = Number(conditionStr.slice('trust_below:'.length));
            return Number.isFinite(threshold) && (psychology?.trust ?? 50) < threshold;
        }
        if (conditionStr.startsWith('pressure_at_least:')) {
            const threshold = Number(conditionStr.slice('pressure_at_least:'.length));
            return Number.isFinite(threshold) && (psychology?.pressure ?? 0) >= threshold;
        }
        if (conditionStr.startsWith('pressure_below:')) {
            const threshold = Number(conditionStr.slice('pressure_below:'.length));
            return Number.isFinite(threshold) && (psychology?.pressure ?? 0) < threshold;
        }
        if (conditionStr.startsWith('heard_rumor:')) {
            const rumorId = conditionStr.slice('heard_rumor:'.length);
            return Boolean(npcId && this.memoryService?.hasRumor(npcId, rumorId));
        }
        if (conditionStr.startsWith('has_accusation:')) {
            const accusationId = conditionStr.slice('has_accusation:'.length);
            return Boolean(npcId && this.memoryService?.hasAccusation(npcId, accusationId));
        }
        if (conditionStr.startsWith('lie_exposed:')) {
            const claimId = conditionStr.slice('lie_exposed:'.length);
            return Boolean(npcId && this.memoryService?.hasExposedLie(npcId, claimId));
        }
        if (conditionStr.startsWith('disposition:')) {
            return psychology?.disposition === conditionStr.slice('disposition:'.length);
        }

        // evidence_count:N
        if (conditionStr.startsWith('evidence_count:')) {
            const count = parseInt(conditionStr.replace('evidence_count:', ''));
            return (this.inventory?.evidence?.length || 0) >= count;
        }
        
        // hasMagnifier
        if (conditionStr === 'hasMagnifier') {
            return this.inventory?.hasItem('magnifying_glass') || false;
        }
        
        // hasLight
        if (conditionStr === 'hasLight') {
            return true; // Пока всегда true
        }
        
        return false;
    }
}