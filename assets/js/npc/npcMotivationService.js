/**
 * NPCMotivationService
 * Resolves case-authored motives and loyalty under player pressure.
 * Motive profiles remain private narrative state; they are never exposed by NPC dossiers.
 */
class NPCMotivationService {
    constructor(memoryService = null) {
        this.memoryService = memoryService;
        this.currentCaseId = null;
        this.activeNpcIds = new Set();
        this.profiles = {};
    }

    setMemoryService(service) {
        this.memoryService = service || null;
    }

    setCase(caseData) {
        if (!caseData?.id || typeof caseData.id !== 'string') return false;
        this.currentCaseId = caseData.id;
        this.activeNpcIds = new Set(Array.isArray(caseData.npcs) ? caseData.npcs : []);
        this.profiles = {};

        const profiles = caseData.npcMotivations && typeof caseData.npcMotivations === 'object'
            ? caseData.npcMotivations
            : {};

        for (const [npcId, profile] of Object.entries(profiles)) {
            if (!this.activeNpcIds.has(npcId) || !profile || typeof profile !== 'object') continue;
            const motives = (Array.isArray(profile.motives) ? profile.motives : [])
                .filter(item => item && typeof item.id === 'string')
                .map(item => ({
                    id: item.id,
                    weight: this._clamp(item.weight, 0, 100, 50),
                    pressureResistance: this._clamp(item.pressureResistance, 0, 1, 0.25)
                }));
            const loyalties = (Array.isArray(profile.loyalties) ? profile.loyalties : [])
                .filter(item => item && typeof item.npcId === 'string' && this.activeNpcIds.has(item.npcId))
                .map(item => ({
                    npcId: item.npcId,
                    strength: this._clamp(item.strength, 0, 100, 50),
                    protectThreshold: this._clamp(item.protectThreshold, 0, 100, 60),
                    appliesTo: Array.isArray(item.appliesTo) ? item.appliesTo.filter(value => typeof value === 'string') : ['*'],
                    motiveId: typeof item.motiveId === 'string' ? item.motiveId : null,
                    reason: typeof item.reason === 'string' ? item.reason : 'protecting_relationship'
                }));
            this.profiles[npcId] = { motives, loyalties };
        }
        return true;
    }

    _clamp(value, min, max, fallback) {
        return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
    }

    _getProfile(npcId) {
        return this.currentCaseId && this.activeNpcIds.has(npcId)
            ? this.profiles[npcId] || { motives: [], loyalties: [] }
            : null;
    }

    hasMotive(npcId, motiveId) {
        if (!motiveId) return false;
        return Boolean(this._getProfile(npcId)?.motives.some(item => item.id === motiveId));
    }

    getEffectiveLoyalty(npcId, protectedNpcId) {
        const profile = this._getProfile(npcId);
        if (!profile || !protectedNpcId) return null;
        const loyalty = profile.loyalties.find(item => item.npcId === protectedNpcId);
        if (!loyalty) return null;

        const totalWeight = profile.motives.reduce((sum, item) => sum + item.weight, 0);
        const pressureResistance = totalWeight > 0
            ? profile.motives.reduce((sum, item) => sum + item.weight * item.pressureResistance, 0) / totalWeight
            : 0.25;
        const pressure = this._clamp(this.memoryService?.getPressure(npcId) ?? 0, 0, 100, 0);
        const effectiveScore = this._clamp(
            loyalty.strength - pressure * (1 - pressureResistance),
            0, 100, loyalty.strength
        );

        return {
            npcId,
            protectedNpcId,
            baseScore: loyalty.strength,
            score: Math.round(effectiveScore),
            threshold: loyalty.protectThreshold,
            pressure: Math.round(pressure),
            pressureResistance: Number(pressureResistance.toFixed(3)),
            motiveId: loyalty.motiveId,
            reason: loyalty.reason,
            protects: effectiveScore >= loyalty.protectThreshold
        };
    }

    evaluateDisclosure(npcId, report, edge = {}) {
        const protectedNpcId = report?.targetNpcId;
        if (!protectedNpcId || edge?.to === protectedNpcId) return { matched: false, allowed: true, reason: null };

        const profile = this._getProfile(npcId);
        if (!profile) return { matched: false, allowed: true, reason: null };
        const loyalty = profile.loyalties.find(item =>
            item.npcId === protectedNpcId &&
            (item.appliesTo.includes('*') || item.appliesTo.includes(report.kind))
        );
        if (!loyalty) return { matched: false, allowed: true, reason: null };

        const result = this.getEffectiveLoyalty(npcId, protectedNpcId);
        if (!result) return { matched: false, allowed: true, reason: null };
        return {
            ...result,
            matched: true,
            allowed: !result.protects,
            reason: result.protects ? 'loyalty_protection' : 'loyalty_broken',
            motiveReason: result.reason,
            recipientNpcId: edge.to || null
        };
    }
}
