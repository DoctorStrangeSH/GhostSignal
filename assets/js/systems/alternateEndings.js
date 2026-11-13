class AlternateEndings {
    constructor() {
        this.endings = {};
    }

    // Определить концовку на основе собранных улик и выборов
    determineEnding(caseData, inventory, evidenceCount = 0, socialContext = {}) {
        const registered = typeof window !== 'undefined'
            ? Object.values(window.ENDINGS || {}).filter(ending => ending.caseId === caseData?.id)
            : [];
        const configured = registered.length
            ? registered
            : Object.values(this.endings).filter(ending => ending.caseId === caseData?.id);
        const hasInsight = insightId => Boolean(
            inventory?.hasInsight?.(insightId) || inventory?.insights?.includes(insightId)
        );

        const perfect = configured.find(ending =>
            ending.condition &&
            ending.condition !== 'default' &&
            !ending.condition.startsWith('evidence_count_') &&
            hasInsight(ending.condition)
        );
        let selected = perfect;

        const collectedCount = Number.isFinite(evidenceCount)
            ? evidenceCount
            : (inventory?.items || []).length;
        const partial = configured
            .filter(ending => ending.condition?.startsWith('evidence_count_'))
            .sort((a, b) => Number(b.condition.split('_').pop()) - Number(a.condition.split('_').pop()))
            .find(ending => collectedCount >= Number(ending.condition.split('_').pop()));
        if (!selected && partial) selected = partial;
        if (!selected) selected = configured.find(ending => ending.condition === 'default') || this._getDefaultEnding(caseData);

        return this._applySocialConsequences(
            selected,
            socialContext?.npcMemoryService?.getCaseSocialSummary?.(caseData?.id)
        );
    }

    _applySocialConsequences(ending, summary) {
        if (!ending || !summary?.npcs || !ending.socialConsequences) return ending;
        const paragraphs = [];
        for (const [npcId, rules] of Object.entries(ending.socialConsequences)) {
            const npc = summary.npcs[npcId];
            if (!npc || !rules) continue;
            if (npc.promises.fulfilled > 0 && rules.promiseFulfilled) paragraphs.push(rules.promiseFulfilled);
            if (npc.promises.broken > 0 && rules.promiseBroken) paragraphs.push(rules.promiseBroken);
            if (Number.isFinite(rules.lowTrustThreshold) && npc.trust <= rules.lowTrustThreshold && rules.lowTrust) {
                paragraphs.push(rules.lowTrust);
            }
            if (npc.rumors.disputed > 0 && rules.disputedRumor) paragraphs.push(rules.disputedRumor);
            if (npc.accusations.false > 0 && rules.falseAccusation) paragraphs.push(rules.falseAccusation);
            if (npc.accusations.pending > 0 && rules.pendingAccusation) paragraphs.push(rules.pendingAccusation);
        }
        if (!paragraphs.length) return ending;
        return {
            ...ending,
            text: [ending.text || '', ...paragraphs].filter(Boolean).join('\n\n'),
            socialConsequencesApplied: paragraphs.length
        };
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