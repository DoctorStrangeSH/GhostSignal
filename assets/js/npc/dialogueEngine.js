class DialogueEngine {
    constructor(inventory, gameTime) {
        this.inventory = inventory;
        this.gameTime = gameTime;
        this.currentDialogue = null;
        this.currentNode = null;
        this.dialogueHistory = [];
        this.onNodeChange = null;
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
    
    // ============ ВНУТРЕННИЕ МЕТОДЫ ============
    
    _processNodeEffects(node) {
        if (!node) return;
        
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