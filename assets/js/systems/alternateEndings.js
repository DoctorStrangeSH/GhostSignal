class AlternateEndings {
    constructor() {
        this.endings = {};
    }

    // Определить концовку на основе собранных улик и выборов
    determineEnding(caseData, inventory, evidenceCount = 0) {
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
        if (perfect) return perfect;

        const collectedCount = Number.isFinite(evidenceCount)
            ? evidenceCount
            : (inventory?.items || []).length;
        const partial = configured
            .filter(ending => ending.condition?.startsWith('evidence_count_'))
            .sort((a, b) => Number(b.condition.split('_').pop()) - Number(a.condition.split('_').pop()))
            .find(ending => collectedCount >= Number(ending.condition.split('_').pop()));
        if (partial) return partial;

        return configured.find(ending => ending.condition === 'default') || this._getDefaultEnding(caseData);
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