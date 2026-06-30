class AlternateEndings {
    constructor() {
        this.endings = {};
    }

    // Определить концовку на основе собранных улик и выборов
    determineEnding(caseData, inventory, insights) {
        const endingId = this._evaluate(caseData, inventory, insights);
        return this.endings[endingId] || this._getDefaultEnding(caseData);
    }

    _evaluate(caseData, inventory, insights) {
        if (caseData.id === 'case-001') {
            const hasAll = inventory.hasItem('train_ticket') && 
                          inventory.hasItem('victim_diary') && 
                          inventory.hasItem('torn_photo') &&
                          insights.includes('mary_confession');
            
            const hasPartial = inventory.hasItem('torn_photo') || 
                               insights.includes('blackwood_affair');
            
            const maidEscaped = !insights.includes('mary_confession') && 
                                inventory.hasItem('train_ticket');

            if (hasAll) return 'perfect';
            if (maidEscaped) return 'maid_escaped';
            if (hasPartial) return 'partial';
            return 'failed';
        }

        if (caseData.id === 'case-002') {
            const rivalGuilty = insights.includes('rival_took_vial');
            const annaGuilty = insights.includes('suicide_plan') && !rivalGuilty;
            const sisterRevealed = insights.includes('sisters_revealed');

            if (rivalGuilty && sisterRevealed) return 'rival_caught';
            if (annaGuilty) return 'anna_confession';
            return 'mystery';
        }

        return 'default';
    }

    _getDefaultEnding(caseData) {
        return {
            id: 'default',
            title: 'Дело закрыто',
            text: 'Вы собрали достаточно улик чтобы закрыть дело.',
            bonus: 0
        };
    }

    // Зарегистрировать концовку
    registerEnding(id, config) {
        this.endings[id] = config;
    }
}