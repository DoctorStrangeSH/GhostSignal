class DialogueEngine {
    constructor(inventory, gameTime) {
        this.inventory = inventory;
        this.gameTime = gameTime;
        this.currentDialogue = null;
        this.currentNode = null;
        this.currentStableNodeId = null;
        this.dialogueHistory = [];
        this.onNodeChange = null;
        this.memoryService = null;
        this.motivationService = null;
        this.relationshipService = null;
        this.investigationBoard = null;
    }

    setMemoryService(service) {
        this.memoryService = service || null;
    }

    setInvestigationBoard(board) {
        this.investigationBoard = board || null;
    }

    setMotivationService(service) {
        this.motivationService = service || null;
    }

    setRelationshipService(service) {
        this.relationshipService = service || null;
    }

    setSocialNetwork(service) {
        this.socialNetwork = service || null;
    }

    // A read-only preview for contact lists. It must not start a conversation,
    // advance time, or mark the lead as heard merely because a card is rendered.
    getPendingInitiative(dialogueId) {
        const dialogue = getDialogueById(dialogueId);
        if (!dialogue?.npcId || !dialogue.tree?.nodes) return null;
        for (const rule of Array.isArray(dialogue.tree.entryRules) ? dialogue.tree.entryRules : []) {
            if (!rule?.nodeId || !dialogue.tree.nodes[rule.nodeId]) continue;
            if (!this._checkCondition(rule.condition, dialogue)) continue;
            // A higher-priority ordinary entry takes precedence. Never advertise
            // an initiative the player would not actually hear on contact.
            if (!rule.initiative) return null;
            return { npcId: dialogue.npcId, dialogueId, nodeId: rule.nodeId,
                label: typeof rule.initiativeLabel === 'string' ? rule.initiativeLabel : 'Хочет поговорить' };
        }
        return null;
    }

    _personalizeNode(node) {
        const npcId = this.currentDialogue?.npcId;
        const opening = node?.priorCaseOpening;
        if (opening && npcId && !this.memoryService?.hasVisitedNode(npcId, this.currentDialogue.id, node.id)) {
            // Only the NPC's own long-term memories can color their greeting.
            // Do not infer personal knowledge from a global case outcome.
            const remembered = [opening.harmed, opening.helped].find(rule =>
                rule?.memoryTag && rule.text &&
                this.memoryService?.hasLongTermMemoryTagFromPriorCase(npcId, rule.memoryTag)
            );
            if (remembered) node = { ...node, text: `${node.text} ${remembered.text}` };
        }
        if (!node?.rememberRepairFromNpcId || !this.currentDialogue?.npcId) return node;
        const remembered = this.relationshipService?.getLatestRepairRememberedBy?.(
            this.currentDialogue.npcId, node.rememberRepairFromNpcId
        );
        if (!remembered?.summary) return node;
        const helperName = typeof getNPCById === 'function'
            ? getNPCById(node.rememberRepairFromNpcId)?.name : null;
        const reflection = remembered.remainingRepairSteps > 0
            ? 'Но одного хорошего поступка недостаточно, чтобы забыть прежнюю обиду.'
            : 'Мне важно, что за словами последовали настоящие дела.';
        return {
            ...node,
            text: `${node.text} Я помню помощь ${helperName || 'этого человека'}: ${remembered.summary} ${reflection}`
        };
    }

    _recordNodeMemory(node) {
        const npcId = this.currentDialogue?.npcId;
        if (node?.id === 'route_question_response' && npcId === 'business_rival') {
            this.investigationBoard?.markRouteQuestionDiscussed?.(npcId);
        }
        if (!npcId || !this.memoryService || !node) return;
        this.memoryService.recordNodeVisited(npcId, this.currentDialogue.id, node);
        if (Array.isArray(node.revealRelationships) && node.revealRelationships.length) {
            this.relationshipService?.revealRelationships(node.revealRelationships, {
                method: 'dialogue', sourceId: `${this.currentDialogue.id}:${node.id}`
            });
        }
        this._notifyMemoryChanged();
    }

    _notifyMemoryChanged() {
        if (!this.memoryService) return;
        events.emit('npc:memory_changed', this.memoryService.toJSON());
        if (this.socialNetwork) events.emit('npc:social_network_changed', this.socialNetwork.toJSON());
        if (this.relationshipService) events.emit('npc:relationship_changed', this.relationshipService.toJSON());
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
        
        let startId = dialogue.tree.start;
        for (const rule of Array.isArray(dialogue.tree.entryRules) ? dialogue.tree.entryRules : []) {
            if (typeof rule?.condition === 'string' && dialogue.tree.nodes[rule.nodeId] &&
                this._checkCondition(rule.condition)) {
                startId = rule.nodeId;
                break;
            }
        }
        const startNode = dialogue.tree.nodes[startId];
        if (!startNode) {
            console.error('Стартовый узел не найден:', startId);
            return false;
        }

        this.currentStableNodeId = startId;
        this.currentNode = this._personalizeNode({
            id: startId,
            ...startNode
        });

        this.dialogueHistory.push({
            nodeId: startId,
            speaker: startNode.speaker,
            text: this.currentNode.text
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

        this.dialogueHistory.push({
            nodeId: this.currentNode.id,
            speaker: 'player',
            text: String(answer.text || '')
        });
        
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
                const resolution = this.memoryService.resolveAccusation(this.currentDialogue.npcId, answer.resolveAccusation.id, answer.resolveAccusation.outcome, answer.resolveAccusation.reason);
                if (resolution?.resolved && answer.resolveAccusation.outcome === 'retracted') {
                    const published = this.socialNetwork?.publishAccusationRetraction(this.currentDialogue.npcId,
                        answer.resolveAccusation.id, { dialogueId: this.currentDialogue.id, nodeId: this.currentNode.id });
                    if (published?.published) events.emit('npc:social_network_changed', { reason: 'accusation_retracted', npcId: this.currentDialogue.npcId });
                }
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
            if (answer.revealRelationships && this.relationshipService) {
                this.relationshipService.revealRelationships(answer.revealRelationships, {
                    method: 'dialogue',
                    sourceId: `${this.currentDialogue.id}:${this.currentNode.id}:${answerIndex}`
                });
            }
            this._notifyMemoryChanged();
        }

        // Финальная реплика определяется данными диалога, а не названием узла.
        const targetNode = this.currentDialogue.tree.nodes[answer.nextNode];
        if (targetNode?.endDialogue === true) {
            
            const endNode = this.currentDialogue.tree.nodes[answer.nextNode];
            if (endNode) {
                this.currentStableNodeId = answer.nextNode;
                this.currentNode = this._personalizeNode({ id: answer.nextNode, ...endNode });
                this.dialogueHistory.push({
                    nodeId: answer.nextNode,
                    speaker: endNode.speaker,
                    text: this.currentNode.text
                });
                this._recordNodeMemory(this.currentNode);
                this._processNodeEffects(endNode);
            }
            
            if (this.onNodeChange) this.onNodeChange(this.currentNode);
            events.emit('dialogue:completed', {
                npcId: this.currentDialogue.npcId,
                dialogueId: this.currentDialogue.id,
                finalNodeId: this.currentNode?.id || answer.nextNode
            });
            return { ...this.currentNode, endDialogue: true };
        }
        
        // Переходим к следующему узлу
        const nextNode = targetNode;
        if (!nextNode) {
            console.error('Узел не найден:', answer.nextNode);
            return { error: 'Узел не найден' };
        }
        
        this.currentStableNodeId = answer.nextNode;
        this.currentNode = this._personalizeNode({ id: answer.nextNode, ...nextNode });
        
        this.dialogueHistory.push({
            nodeId: answer.nextNode,
            speaker: nextNode.speaker,
            text: this.currentNode.text
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
        
        return this.currentNode.answers
            .map((answer, index) => ({
                ...answer,
                index,
                isAvailable: !answer.condition || this._checkCondition(answer.condition),
                lockReason: answer.condition && !this._checkCondition(answer.condition)
                    ? this._getAnswerLockReason(answer.condition) : null
            }))
            .filter(answer => !answer.hiddenWhenUnavailable || answer.isAvailable);
    }

    // Explain the kind of missing prerequisite without revealing hidden clues or NPC knowledge.
    _getAnswerLockReason(condition) {
        const unmet = condition?.startsWith('all:')
            ? condition.slice(4).split('&').map(part => part.trim()).filter(part => !this._checkCondition(part))
            : [condition];
        if (unmet.some(part => part.startsWith('hasItem:'))) return 'Нужна дополнительная улика';
        if (unmet.some(part => part.startsWith('hasInsight:') || part.startsWith('case_has_claim:') || part.startsWith('has_claim:')))
            return 'Нужно подтвердить сведения';
        if (unmet.some(part => /^(cooperation_|pressure_|trust_|long_term_trust_)/.test(part)))
            return 'Пока недостаточно доверия или готовности говорить';
        return 'Пока недостаточно оснований для этого вопроса';
    }
    
    // Сбросить диалог
    reset() {
        this.currentDialogue = null;
        this.currentNode = null;
        this.currentStableNodeId = null;
        this.dialogueHistory = [];
    }

    // Persist only identifiers and presentation history. Answers are rebuilt
    // from trusted dialogue data during restore, never from local-save payloads.
    toJSON() {
        if (!this.currentDialogue?.id || !this.currentNode?.id) return null;
        return {
            dialogueId: this.currentDialogue.id,
            npcId: this.currentDialogue.npcId || null,
            nodeId: this.currentNode.id,
            stableNodeId: this.currentStableNodeId || this.currentNode.id,
            nodeText: typeof this.currentNode.text === 'string' ? this.currentNode.text : '',
            nodeMood: this.currentNode.mood || null,
            history: this.dialogueHistory.slice(-100).map(entry => ({
                nodeId: entry.nodeId,
                speaker: entry.speaker === 'player' ? 'player' : 'npc',
                text: String(entry.text || '').slice(0, 5000)
            }))
        };
    }

    // Restore without replaying dialogue effects, advancing time, or recording
    // another visit in NPC memory. The active node's answers come from game data.
    restoreFromJSON(snapshot) {
        if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot) ||
            typeof snapshot.dialogueId !== 'string' || typeof snapshot.nodeId !== 'string' ||
            typeof snapshot.stableNodeId !== 'string') return false;

        const dialogue = getDialogueById(snapshot.dialogueId);
        if (!dialogue?.tree?.nodes || !dialogue.npcId || snapshot.npcId !== dialogue.npcId) return false;
        const nodes = dialogue.tree.nodes;
        const stableNode = nodes[snapshot.stableNodeId];
        if (!stableNode) return false;

        let node = nodes[snapshot.nodeId];
        if (!node) {
            let answers = stableNode.answers || [];
            if (snapshot.nodeId.startsWith('evidence_')) {
                const evidenceId = snapshot.nodeId.slice('evidence_'.length);
                if (!evidenceId || typeof getObjectById !== 'function' || !getObjectById(evidenceId)?.isEvidence) return false;
                answers = dialogue.evidenceReactions?.[evidenceId]?.answers || answers;
            } else if (snapshot.nodeId.startsWith('contradiction_')) {
                const topic = snapshot.nodeId.slice('contradiction_'.length);
                if (!topic) return false;
                answers = dialogue.contradictionReactions?.[topic]?.answers || answers;
            } else if (!snapshot.nodeId.startsWith('causal_question_')) {
                return false;
            }
            node = {
                id: snapshot.nodeId,
                speaker: 'npc',
                text: typeof snapshot.nodeText === 'string' ? snapshot.nodeText : '',
                mood: snapshot.nodeMood || 'neutral',
                answers
            };
        } else {
            node = { id: snapshot.nodeId, ...node };
            if (typeof snapshot.nodeText === 'string') node.text = snapshot.nodeText;
            if (snapshot.nodeMood) node.mood = snapshot.nodeMood;
        }

        const history = Array.isArray(snapshot.history) ? snapshot.history.slice(-100).filter(entry =>
            entry && typeof entry.nodeId === 'string' && typeof entry.text === 'string'
        ).map(entry => ({
            nodeId: entry.nodeId,
            speaker: entry.speaker === 'player' ? 'player' : 'npc',
            text: entry.text.slice(0, 5000)
        })) : [];
        if (!history.length || history[history.length - 1].nodeId !== snapshot.nodeId) {
            history.push({ nodeId: snapshot.nodeId, speaker: 'npc', text: node.text || '' });
        }

        this.currentDialogue = dialogue;
        this.currentStableNodeId = snapshot.stableNodeId;
        this.currentNode = node;
        this.dialogueHistory = history;
        return true;
    }
    
    // Получить историю диалога
    getHistory() {
        return [...this.dialogueHistory];
    }

    _getUnscriptedReaction(kind, evidenceName = '') {
        const npcId = this.currentDialogue?.npcId;
        const npc = npcId && typeof getNPCById === 'function' ? getNPCById(npcId) : null;
        const state = this.memoryService?.getPsychologicalState(npcId, npc?.psychology)?.disposition;
        const prefix = kind === 'contradiction' ? '' : `Вы показываете ${evidenceName || 'улику'}.`;
        const reactions = {
            cooperative: ['Персонаж внимательно изучает материал и предлагает проверить его вместе.', 'thoughtful'],
            distrustful: ['Персонаж отодвигает документ: без независимого подтверждения он не готов ничего признать.', 'guarded'],
            pressured: ['Персонаж перечитывает строки, заметно нервничает и просит не торопить его с выводами.', 'nervous'],
            overwhelmed: ['Персонаж замолкает и просит паузу. Сейчас он не может дать надёжный ответ.', 'shaken'],
            reserved: ['Персонаж внимательно изучает материал, но пока не готов сделать вывод.', 'serious']
        };
        const [text, mood] = reactions[state] || reactions.reserved;
        return { text: [prefix, text].filter(Boolean).join(' '), mood };
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
        const fallback = this._getUnscriptedReaction('evidence', object?.name);
        const node = {
            id: `evidence_${evidenceId}`,
            speaker: 'npc',
            text: reaction?.text || fallback.text,
            mood: reaction?.mood || fallback.mood,
            givesInsight: reaction?.givesInsight || null,
            claim: reaction?.claim || null,
            answers: reaction?.answers || this.currentNode?.answers || []
        };

        this.dialogueHistory.push({ nodeId: this.currentNode?.id || '', speaker: 'player', text: `Прошу взглянуть на улику: ${object?.name || evidenceId}.` });
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
        if (!this.memoryService.recordConfrontation(npcId, reaction?.givesInsight || null)) {
            return { success: false, reason: 'already_confronted' };
        }
        const fallback = this._getUnscriptedReaction('contradiction');
        const responseText = reaction?.text ||
            `Вы предъявляете два несовместимых показания: «${first.summary}» и «${second.summary}». ${fallback.text}`;

        const node = {
            id: `contradiction_${prepared.topic}`,
            speaker: 'npc',
            text: responseText,
            mood: reaction?.mood || fallback.mood,
            givesInsight: reaction?.givesInsight || null,
            claim: reaction?.claim || null,
            answers: reaction?.answers || this.currentNode?.answers || []
        };

        this.dialogueHistory.push({ nodeId: this.currentNode?.id || '', speaker: 'player', text: 'Я сопоставил ваши слова с другим свидетельским показанием. Объясните это противоречие.' });
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

    // A causal challenge asks for clarification; it is not an accusation or
    // a scripted admission. The response depends on existing NPC disposition.
    presentPreparedCausalQuestion() {
        const npcId = this.currentDialogue?.npcId;
        const board = this.investigationBoard;
        const prepared = npcId && board?.getPreparedCausalQuestion?.(npcId);
        if (!prepared) return { success: false, reason: 'no_prepared_causal_question' };
        const fallback = this._getUnscriptedReaction('contradiction');
        if (!board.discussCausalQuestion(npcId)) return { success: false, reason: 'already_discussed' };
        const node = { id: `causal_question_${prepared.hypothesisId}`, speaker: 'npc',
            text: `Вы спрашиваете, как объяснить факты, не согласующиеся с версией «${prepared.title}». ${fallback.text} Мне нужно уточнить обстоятельства; одно совпадение ещё не говорит, что события связаны.`,
            mood: fallback.mood, answers: this.currentNode?.answers || [] };
        this.dialogueHistory.push({ nodeId: this.currentNode?.id || '', speaker: 'player', text: 'Есть независимая улика, противоречащая моей версии. Помогите уточнить, что вы действительно знаете.' });
        this.currentNode = node;
        this.dialogueHistory.push({ nodeId: node.id, speaker: node.speaker, text: node.text });
        this._recordNodeMemory(node);
        if (this.gameTime) this.gameTime.advance(CONFIG.time.costs.dialogue);
        if (this.onNodeChange) this.onNodeChange(node);
        return { success: true, node };
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
        if (node.verifiedRestitution && this.currentDialogue?.npcId &&
            this.inventory?.hasInsight?.(node.verifiedRestitution.requiresInsight)) {
            if (this.memoryService?.recordVerifiedRestitution(this.currentDialogue.npcId,
                node.verifiedRestitution.id, node.verifiedRestitution.accusationId,
                node.verifiedRestitution.priorMemoryTag)) {
                const published = this.socialNetwork?.publishVerifiedRestitution(
                    this.currentDialogue.npcId, node.verifiedRestitution.id,
                    node.verifiedRestitution.accusationId,
                    { dialogueId: this.currentDialogue.id, nodeId: this.currentNode?.id }
                );
                if (published?.published) events.emit('npc:social_network_changed', { reason: 'verified_restitution' });
                this._notifyMemoryChanged();
            }
        }
        
        // Спавн предмета (если есть)
        if (node.spawnsItem) {
            events.emit('evidence:from_dialogue', { evidenceId: node.spawnsItem });
        }
    }
    
    _checkCondition(conditionStr, dialogue = this.currentDialogue) {
        if (!conditionStr) return true;

        if (conditionStr.startsWith('not:')) {
            const nested = conditionStr.slice(4).trim();
            return Boolean(nested) && !this._checkCondition(nested, dialogue);
        }
        if (conditionStr.startsWith('all:')) {
            return conditionStr.slice(4).split('&').map(part => part.trim())
                .filter(Boolean).every(part => this._checkCondition(part, dialogue));
        }
        if (conditionStr.startsWith('any:')) {
            return conditionStr.slice(4).split('&').map(part => part.trim())
                .filter(Boolean).some(part => this._checkCondition(part, dialogue));
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

        if (conditionStr === 'has_waiter_photo_comparison') {
            const statements = this.memoryService?.getStatements?.() || [];
            const activeWaiterStatements = new Set(statements.filter(item =>
                item.npcId === 'waiter' && item.status !== 'superseded').map(item => item.id));
            return Boolean(this.inventory?.hasInsight?.('bar_photo_observed_waiter') &&
                this.investigationBoard?.hypotheses?.some(h => h.status === 'open' &&
                    h.title.startsWith('[Фото: Официант]') &&
                    h.links?.some(link => link.kind === 'evidence' && link.sourceId === 'bar_photo') &&
                    h.links?.some(link => link.kind === 'statement' && activeWaiterStatements.has(link.sourceId))));
        }
        
        const npcId = dialogue?.npcId;
        if (conditionStr.startsWith('has_visited_node:')) {
            return Boolean(npcId && this.memoryService?.hasVisitedNode(npcId,
                dialogue?.id, conditionStr.slice('has_visited_node:'.length)));
        }
        if (conditionStr === 'route_question_prepared') {
            return Boolean(npcId && this.investigationBoard?.hasPreparedRouteQuestion(npcId));
        }
        const npc = npcId && typeof getNPCById === 'function' ? getNPCById(npcId) : null;
        const psychology = npcId
            ? this.memoryService?.getPsychologicalState(npcId, npc?.psychology)
            : null;

        if (conditionStr.startsWith('relationship_known:')) {
            return Boolean(this.relationshipService?.isKnownRelationship(conditionStr.slice('relationship_known:'.length)));
        }

        const latestPromiseOutcome = conditionStr.match(/^latest_promise_outcome:([a-z0-9_:-]{1,100}):(kept|broken)$/i);
        if (latestPromiseOutcome) {
            return Boolean(npcId && this.memoryService?.getLatestPromiseOutcome(npcId, latestPromiseOutcome[1]) ===
                latestPromiseOutcome[2].toLowerCase());
        }
        if (conditionStr.startsWith('prior_case_memory:')) {
            return Boolean(npcId && this.memoryService?.hasLongTermMemoryTagFromPriorCase(npcId,
                conditionStr.slice('prior_case_memory:'.length)));
        }
        if (conditionStr.startsWith('long_term_memory:')) {
            return Boolean(npcId && this.memoryService?.hasLongTermMemoryTag(npcId, conditionStr.slice('long_term_memory:'.length)));
        }
        if (conditionStr === 'long_term_pattern:consistent_support') {
            return Boolean(npcId && this.memoryService?.getLongTermBehaviorPattern(npcId)?.consistentSupport);
        }
        if (conditionStr === 'long_term_pattern:repeated_pressure') {
            return Boolean(npcId && this.memoryService?.getLongTermBehaviorPattern(npcId)?.repeatedPressure);
        }
        if (conditionStr === 'long_term_pattern:repeated_false_accusations') {
            return Boolean(npcId && this.memoryService?.getLongTermBehaviorPattern(npcId)?.repeatedFalseAccusations);
        }
        if (conditionStr === 'long_term_pattern:consistent_source_integrity') {
            return Boolean(npcId && this.memoryService?.getLongTermBehaviorPattern(npcId)?.consistentSourceIntegrity);
        }
        if (conditionStr === 'long_term_pattern:repeated_source_overclaim') {
            return Boolean(npcId && this.memoryService?.getLongTermBehaviorPattern(npcId)?.repeatedSourceOverclaim);
        }
        const valueAlignment = conditionStr.match(/^npc_value_alignment:(witness_safety|source_integrity):(upheld|breached|contested)$/);
        if (valueAlignment) {
            return Boolean(npcId && this.memoryService?.getNPCValueAlignment(npcId, valueAlignment[1]) === valueAlignment[2]);
        }
        const longTermTrust = conditionStr.match(/^long_term_trust_(at_least|below):([0-9]+([.][0-9]+)?)$/);
        if (longTermTrust) {
            const [, operator, rawThreshold] = longTermTrust;
            const threshold = Number(rawThreshold);
            const trust = this.memoryService?.getLongTermProfile(npcId)?.trust ?? 50;
            if (!Number.isFinite(threshold)) return false;
            return operator === 'at_least' ? trust >= threshold : trust < threshold;
        }
        if (conditionStr.startsWith('familiarity_at_least:')) {
            const threshold = Number(conditionStr.slice('familiarity_at_least:'.length));
            const familiarity = this.memoryService?.getLongTermProfile(npcId)?.familiarity ?? 0;
            return Number.isFinite(threshold) && familiarity >= threshold;
        }
        if (conditionStr.startsWith('long_term_disposition:')) {
            const disposition = this.memoryService?.getLongTermProfile(npcId)?.disposition;
            return disposition === conditionStr.slice('long_term_disposition:'.length);
        }
        const goalProgressCondition = conditionStr.match(/^npc_goal_progress_at_least:([a-z0-9_:-]{1,64}):([0-9]+)$/i);
        if (goalProgressCondition) {
            const [, goalId, rawProgress] = goalProgressCondition;
            const threshold = Number(rawProgress);
            const progress = this.relationshipService?.getGoalProgress(npcId, goalId) ?? 0;
            return Number.isFinite(threshold) && progress >= threshold;
        }
        const investigationCondition = conditionStr.match(/^npc_investigation_outcome:([a-z0-9_:-]{1,64}):(corroborated|disputed|no_independent_evidence)$/i);
        if (investigationCondition) {
            return Boolean(npcId && this.relationshipService?.getInvestigationOutcome?.(npcId, investigationCondition[1]) === investigationCondition[2].toLowerCase());
        }
        const editorialDecision = conditionStr.match(/^npc_editorial_decision:([a-z0-9_:-]{1,64}):(withheld|review_required)$/i);
        if (editorialDecision) {
            return Boolean(npcId && this.relationshipService?.getEditorialDecision?.(npcId, editorialDecision[1]) === editorialDecision[2].toLowerCase());
        }
        const consultationCondition = conditionStr.match(/^npc_protection_consultation:([a-z0-9_:-]{1,64}):(procedure_guidance|written_request_required)$/i);
        if (consultationCondition) {
            return Boolean(npcId && this.relationshipService?.getProtectionConsultationOutcome?.(npcId, consultationCondition[1]) === consultationCondition[2].toLowerCase());
        }
        const witnessWorkCondition = conditionStr.match(/^npc_witness_work_decision:([a-z0-9_:-]{1,64}):(temporary_leave|document_help)$/i);
        if (witnessWorkCondition) {
            return Boolean(npcId && this.relationshipService?.getWitnessWorkDecision?.(npcId, witnessWorkCondition[1]) === witnessWorkCondition[2].toLowerCase());
        }
        const interviewDecision = conditionStr.match(/^npc_witness_interview_decision:([a-z0-9_:-]{1,100}):(request_joe_present|private_with_boundaries)$/i);
        if (interviewDecision) {
            return Boolean(npcId && this.relationshipService?.getWitnessInterviewDecision?.(npcId, interviewDecision[1]) === interviewDecision[2].toLowerCase());
        }
        const escortResponse = conditionStr.match(/^npc_received_escort_response:([a-z0-9_:-]{1,100}):(available_to_discuss|propose_later)$/i);
        if (escortResponse) {
            return Boolean(npcId && this.relationshipService?.getReceivedEscortResponse?.(npcId, escortResponse[1]) === escortResponse[2].toLowerCase());
        }
        const ownEscortResponse = conditionStr.match(/^npc_escort_response:([a-z0-9_:-]{1,100}):(available_to_discuss|propose_later)$/i);
        if (ownEscortResponse) {
            return Boolean(npcId && this.relationshipService?.getEscortResponse?.(npcId, ownEscortResponse[1]) === ownEscortResponse[2].toLowerCase());
        }
        if (conditionStr.startsWith('npc_action_received:')) {
            const ruleId = conditionStr.slice('npc_action_received:'.length);
            return Boolean(npcId && this.relationshipService?.hasReceivedInteraction?.(npcId, ruleId));
        }
        if (conditionStr.startsWith('npc_action_completed:')) {
            const ruleId = conditionStr.slice('npc_action_completed:'.length);
            return Boolean(npcId && this.relationshipService?.hasCompletedInteraction?.(npcId, ruleId));
        }
        if (conditionStr.startsWith('npc_goal_completed:')) {
            return Boolean(this.relationshipService?.isGoalCompleted?.(
                npcId, conditionStr.slice('npc_goal_completed:'.length)
            ));
        }

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

        const cooperation = npcId
            ? this.memoryService?.getCooperationState(npcId, npc?.psychology)
            : null;
        const cooperationThreshold = conditionStr.match(/^cooperation_(at_least|below):([0-9]+(?:[.][0-9]+)?)$/);
        if (cooperationThreshold) {
            const [, operator, rawThreshold] = cooperationThreshold;
            const threshold = Number(rawThreshold);
            if (!Number.isFinite(threshold)) return false;
            return operator === 'at_least'
                ? (cooperation?.score ?? 50) >= threshold
                : (cooperation?.score ?? 50) < threshold;
        }
        if (conditionStr.startsWith('cooperation_state:')) {
            return cooperation?.state === conditionStr.slice('cooperation_state:'.length);
        }
        const caseClaim = conditionStr.match(/^case_has_claim:([a-z0-9_:-]{1,64}):([a-z0-9_:-]{1,100})$/i);
        if (caseClaim) {
            // A statement previously recorded during the investigation is case knowledge.
            return Boolean(this.memoryService?.hasClaim(caseClaim[1], caseClaim[2]));
        }
        // Promise consequences are local to the person being questioned.
        // A completed case must not make an unrelated witness's promise visible.
        const promiseStatus = conditionStr.match(/^promise_status:([a-z0-9_:-]{1,100}):(pending|fulfilled|broken)$/i);
        if (promiseStatus) {
            if (!npcId) return false;
            return this.memoryService?.getPromises(npcId)
                ?.some(promise => promise.id === promiseStatus[1] &&
                    promise.status === promiseStatus[2].toLowerCase()) || false;
        }
        if (conditionStr.startsWith('has_claim:')) {
            return Boolean(npcId && this.memoryService?.hasClaim(npcId, conditionStr.slice('has_claim:'.length)));
        }
        if (conditionStr.startsWith('has_claim_topic:')) {
            return Boolean(npcId && this.memoryService?.hasClaimTopic(npcId, conditionStr.slice('has_claim_topic:'.length)));
        }

        // A character reacts only to rumors they personally received. Corroboration
        // and challenge must come from independent, authored direct observations.
        const rumorStatusCondition = conditionStr.match(/^rumor_status:([a-z0-9_:-]{1,80}):(unverified|corroborated|disputed)$/i);
        if (rumorStatusCondition) {
            const [, rumorId, expectedStatus] = rumorStatusCondition;
            const rumor = npcId && this.memoryService?.getRumors(npcId)
                ?.find(item => item.id === rumorId);
            return rumor?.status === expectedStatus.toLowerCase();
        }
        const rumorConfidenceCondition = conditionStr.match(/^rumor_confidence_at_least:([a-z0-9_:-]{1,80}):([0-9]+)$/i);
        if (rumorConfidenceCondition) {
            const [, rumorId, rawThreshold] = rumorConfidenceCondition;
            const threshold = Number(rawThreshold);
            const rumor = npcId && this.memoryService?.getRumors(npcId)
                ?.find(item => item.id === rumorId);
            return Boolean(rumor && Number.isFinite(threshold) && threshold <= 100 &&
                rumor.confidence >= threshold);
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
        const accusationStatusCondition = conditionStr.match(/^accusation_status:([a-z0-9_:-]{1,100}):(pending|false|retracted|substantiated)$/i);
        if (accusationStatusCondition) {
            return Boolean(npcId && this.memoryService?.getAccusationStatus(npcId, accusationStatusCondition[1]) === accusationStatusCondition[2]);
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
