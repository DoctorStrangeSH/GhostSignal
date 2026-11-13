/**
 * NPCRelationshipService
 * Data-driven relationship state, autonomous NPC interactions and evidence-gated discovery.
 * Hidden bonds and off-screen events are never exposed to the detective until explicitly revealed.
 */
class NPCRelationshipService {
    constructor(snapshot = null, memoryService = null, npcManager = null, gameTime = null, socialNetwork = null) {
        this.version = 1;
        this.currentCaseId = snapshot?.currentCaseId || null;
        this.cases = this._clone(snapshot?.cases || {});
        this.memoryService = memoryService;
        this.npcManager = npcManager;
        this.gameTime = gameTime;
        this.socialNetwork = socialNetwork;
        this.caseConfig = { bonds: [], autonomousInteractions: [] };
    }

    setDependencies(memoryService, npcManager, gameTime, socialNetwork = this.socialNetwork) {
        this.memoryService = memoryService || null;
        this.npcManager = npcManager || null;
        this.gameTime = gameTime || null;
        this.socialNetwork = socialNetwork || null;
    }

    setSocialNetwork(service) {
        this.socialNetwork = service || null;
    }

    setCase(caseData) {
        if (!caseData?.id || typeof caseData.id !== 'string') return false;
        this.currentCaseId = caseData.id;
        const activeIds = new Set(Array.isArray(caseData.npcs) ? caseData.npcs : []);
        this.caseConfig = this._normalizeConfig(caseData.npcRelationships, activeIds);
        const state = this._ensureState();
        const now = this._now();

        for (const bond of this.caseConfig.bonds) {
            if (!state.relationships[bond.id]) {
                state.relationships[bond.id] = {
                    interactionCount: 0,
                    lastInteractionAt: null,
                    discoveredAt: null
                };
            }
            const forward = this.memoryService?.getMemory(bond.fromNpcId)?.relationshipTrusts?.[bond.toNpcId];
            if (!Number.isFinite(forward)) {
                this.memoryService?.setRelationshipTrust(bond.fromNpcId, bond.toNpcId, bond.trust);
            }
            if (bond.reciprocal) {
                const reverse = this.memoryService?.getMemory(bond.toNpcId)?.relationshipTrusts?.[bond.fromNpcId];
                if (!Number.isFinite(reverse)) {
                    this.memoryService?.setRelationshipTrust(bond.toNpcId, bond.fromNpcId, bond.trust);
                }
            }
        }

        for (const rule of this.caseConfig.autonomousInteractions) {
            if (!state.rules[rule.id]) {
                state.rules[rule.id] = {
                    nextDueAt: now + rule.initialDelayMinutes,
                    lastTriggeredAt: null,
                    occurrences: 0,
                    deferrals: 0,
                    completed: false
                };
            }
        }
        return Boolean(state);
    }

    _normalizeConfig(config, activeIds) {
        const bonds = (Array.isArray(config?.bonds) ? config.bonds : [])
            .filter(item => item && typeof item.id === 'string' &&
                activeIds.has(item.fromNpcId) && activeIds.has(item.toNpcId) &&
                item.fromNpcId !== item.toNpcId)
            .map(item => ({
                id: item.id,
                fromNpcId: item.fromNpcId,
                toNpcId: item.toNpcId,
                relationship: typeof item.relationship === 'string' ? item.relationship : 'acquaintances',
                label: typeof item.label === 'string' ? item.label : 'Знакомые',
                trust: this._clamp(item.trust, 0, 100, 50),
                reciprocal: item.reciprocal === true
            }));
        const bondIds = new Set(bonds.map(item => item.id));
        const autonomousInteractions = (Array.isArray(config?.autonomousInteractions) ? config.autonomousInteractions : [])
            .filter(item => item && typeof item.id === 'string' &&
                activeIds.has(item.fromNpcId) && activeIds.has(item.toNpcId) &&
                item.fromNpcId !== item.toNpcId && bondIds.has(item.relationshipId) &&
                ['support', 'conflict', 'reconcile', 'avoidance'].includes(item.interaction))
            .map(item => {
                const channel = ['in_person', 'phone', 'message'].includes(item.channel) ? item.channel : 'in_person';
                const conditions = item.conditions && typeof item.conditions === 'object' ? item.conditions : item;
                return {
                    id: item.id,
                    relationshipId: item.relationshipId,
                    fromNpcId: item.fromNpcId,
                    toNpcId: item.toNpcId,
                    interaction: item.interaction,
                    channel,
                    requiresSameLocation: item.requiresSameLocation !== false && channel === 'in_person',
                    everyMinutes: Math.round(this._clamp(item.everyMinutes, 30, 10080, 240)),
                    initialDelayMinutes: Math.round(this._clamp(item.initialDelayMinutes, 1, 10080, item.everyMinutes || 240)),
                    retryMinutes: Math.round(this._clamp(item.retryMinutes, 5, 180, 15)),
                    maxDeferrals: Math.round(this._clamp(item.maxDeferrals, 1, 24, 8)),
                    maxOccurrences: Number.isInteger(item.maxOccurrences) ? Math.max(1, item.maxOccurrences) : null,
                    trustDelta: this._clamp(item.trustDelta, -25, 25, 0),
                    reciprocalTrustDelta: this._clamp(item.reciprocalTrustDelta, -25, 25, 0),
                    conditions: {
                        minTrust: this._optionalClamp(conditions.minTrust, 0, 100),
                        maxTrust: this._optionalClamp(conditions.maxTrust, 0, 100),
                        fromPressureAtLeast: this._optionalClamp(conditions.fromPressureAtLeast, 0, 100),
                        fromPressureBelow: this._optionalClamp(conditions.fromPressureBelow, 0, 100),
                        toPressureAtLeast: this._optionalClamp(conditions.toPressureAtLeast, 0, 100),
                        toPressureBelow: this._optionalClamp(conditions.toPressureBelow, 0, 100)
                    },
                    summary: String(item.summary || '').slice(0, 240)
                };
            });
        return { bonds, autonomousInteractions };
    }

    _clamp(value, min, max, fallback) {
        return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
    }

    _optionalClamp(value, min, max) {
        return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : null;
    }

    _ensureState(caseId = this.currentCaseId) {
        if (!caseId) return null;
        if (!this.cases[caseId] || typeof this.cases[caseId] !== 'object') {
            this.cases[caseId] = { relationships: {}, rules: {}, knownRelationshipIds: [], discoveryLog: [] };
        }
        const state = this.cases[caseId];
        state.relationships = state.relationships && typeof state.relationships === 'object' ? state.relationships : {};
        state.rules = state.rules && typeof state.rules === 'object' ? state.rules : {};
        state.knownRelationshipIds = Array.isArray(state.knownRelationshipIds) ? state.knownRelationshipIds : [];
        state.discoveryLog = Array.isArray(state.discoveryLog) ? state.discoveryLog : [];
        return state;
    }

    _now() {
        const day = Math.max(1, Number(this.gameTime?.day) || 1);
        const hour = Math.max(0, Math.min(23, Number(this.gameTime?.hour) || 0));
        const minute = Math.max(0, Math.min(59, Number(this.gameTime?.minute) || 0));
        return (day - 1) * 1440 + hour * 60 + minute;
    }

    _status(trust) {
        if (trust >= 80) return { id: 'close', label: 'Близкие отношения' };
        if (trust >= 60) return { id: 'friendly', label: 'Хорошие отношения' };
        if (trust >= 40) return { id: 'neutral', label: 'Сдержанные отношения' };
        if (trust >= 20) return { id: 'strained', label: 'Напряжённые отношения' };
        return { id: 'hostile', label: 'Враждебность' };
    }

    _findBond(fromNpcId, toNpcId, relationshipId = null) {
        return this.caseConfig.bonds.find(item =>
            (!relationshipId || item.id === relationshipId) &&
            ((item.fromNpcId === fromNpcId && item.toNpcId === toNpcId) ||
             (item.reciprocal && item.fromNpcId === toNpcId && item.toNpcId === fromNpcId))
        ) || null;
    }

    getKnownRelationshipsForNPC(npcId) {
        const state = this._ensureState();
        if (!state || !npcId) return [];
        const known = new Set(state.knownRelationshipIds);
        return this.caseConfig.bonds.filter(bond =>
            known.has(bond.id) && (bond.fromNpcId === npcId || bond.toNpcId === npcId)
        ).map(bond => {
            const otherNpcId = bond.fromNpcId === npcId ? bond.toNpcId : bond.fromNpcId;
            const direction = bond.reciprocal ? 'mutual' : (bond.fromNpcId === npcId ? 'outgoing' : 'incoming');
            const forwardTrust = this.memoryService?.getRelationshipTrust(bond.fromNpcId, bond.toNpcId) ?? bond.trust;
            const reverseTrust = bond.reciprocal
                ? (this.memoryService?.getRelationshipTrust(bond.toNpcId, bond.fromNpcId) ?? bond.trust)
                : forwardTrust;
            const trust = Math.round((forwardTrust + reverseTrust) / 2);
            const status = this._status(trust);
            return {
                id: bond.id,
                npcId: otherNpcId,
                name: this._name(otherNpcId),
                relationship: bond.relationship,
                label: bond.label,
                direction,
                trust,
                status: status.id,
                statusLabel: status.label
            };
        });
    }

    _name(npcId) {
        if (typeof getNPCById === 'function') return getNPCById(npcId)?.name || npcId;
        return npcId;
    }

    isKnownRelationship(relationshipId) {
        return this._ensureState()?.knownRelationshipIds.includes(relationshipId) || false;
    }

    revealRelationships(relationshipIds, discovery = {}) {
        const state = this._ensureState();
        const methods = ['dialogue', 'observation', 'document', 'evidence'];
        if (!state || !methods.includes(discovery.method) ||
            typeof discovery.sourceId !== 'string' || !discovery.sourceId.trim()) {
            return { revealed: [], reason: 'invalid_discovery' };
        }
        const ids = Array.isArray(relationshipIds) ? relationshipIds : [relationshipIds];
        const validIds = new Set(this.caseConfig.bonds.map(item => item.id));
        const revealed = [];
        for (const id of ids) {
            if (typeof id !== 'string' || !validIds.has(id) || state.knownRelationshipIds.includes(id)) continue;
            state.knownRelationshipIds.push(id);
            const record = { relationshipId: id, method: discovery.method, sourceId: discovery.sourceId, atGameMinute: this._now() };
            state.discoveryLog.push(record);
            revealed.push(id);
            this.socialNetwork?.revealEventsForReport(`relationship:${id}`, discovery);
        }
        if (state.discoveryLog.length > 200) state.discoveryLog.splice(0, state.discoveryLog.length - 200);
        return { revealed, reason: revealed.length ? null : 'no_new_matching_relationships' };
    }

    _conditionsMet(rule) {
        const conditions = rule.conditions;
        const trust = this.memoryService?.getRelationshipTrust(rule.fromNpcId, rule.toNpcId) ?? 50;
        const fromPressure = this.memoryService?.getPressure(rule.fromNpcId) ?? 0;
        const toPressure = this.memoryService?.getPressure(rule.toNpcId) ?? 0;
        if (conditions.minTrust !== null && trust < conditions.minTrust) return false;
        if (conditions.maxTrust !== null && trust > conditions.maxTrust) return false;
        if (conditions.fromPressureAtLeast !== null && fromPressure < conditions.fromPressureAtLeast) return false;
        if (conditions.fromPressureBelow !== null && fromPressure >= conditions.fromPressureBelow) return false;
        if (conditions.toPressureAtLeast !== null && toPressure < conditions.toPressureAtLeast) return false;
        if (conditions.toPressureBelow !== null && toPressure >= conditions.toPressureBelow) return false;
        return true;
    }

    _canInteract(rule) {
        if (!this.npcManager?.isNPCAvailable) return false;
        const from = this.npcManager.isNPCAvailable(rule.fromNpcId);
        const to = this.npcManager.isNPCAvailable(rule.toNpcId);
        if (rule.channel === 'message') return true;
        if (!from?.available || !to?.available) return false;
        if (rule.channel === 'phone') return true;
        if (rule.channel === 'in_person') {
            if (!rule.requiresSameLocation) return true;
            return Boolean(from.location && to.location && from.location === to.location);
        }
        return false;
    }

    _eventType(interaction) {
        return {
            support: 'relationship_support',
            conflict: 'relationship_conflict',
            reconcile: 'relationship_reconciled',
            avoidance: 'relationship_avoidance'
        }[interaction] || 'relationship_changed';
    }

    _applyInteraction(rule, now) {
        const before = this.memoryService?.getRelationshipTrust(rule.fromNpcId, rule.toNpcId) ?? 50;
        const after = this._clamp(before + rule.trustDelta, 0, 100, before);
        this.memoryService?.setRelationshipTrust(rule.fromNpcId, rule.toNpcId, after);
        if (this.caseConfig.bonds.find(item => item.id === rule.relationshipId)?.reciprocal) {
            const reverseBefore = this.memoryService?.getRelationshipTrust(rule.toNpcId, rule.fromNpcId) ?? 50;
            this.memoryService?.setRelationshipTrust(rule.toNpcId, rule.fromNpcId,
                this._clamp(reverseBefore + rule.reciprocalTrustDelta, 0, 100, reverseBefore));
        }

        const state = this._ensureState();
        const bondState = state.relationships[rule.relationshipId] || (state.relationships[rule.relationshipId] = {
            interactionCount: 0, lastInteractionAt: null, discoveredAt: null
        });
        bondState.interactionCount++;
        bondState.lastInteractionAt = now;
        const beforeStatus = this._status(before);
        const afterStatus = this._status(after);
        this.socialNetwork?.recordRelationshipEvent(this._eventType(rule.interaction), {
            relationshipId: rule.relationshipId,
            fromNpcId: rule.fromNpcId,
            toNpcId: rule.toNpcId,
            relationship: this.caseConfig.bonds.find(item => item.id === rule.relationshipId)?.relationship,
            channel: rule.channel,
            summary: rule.summary,
            reason: rule.interaction,
            trustBefore: before,
            trustAfter: after,
            statusBefore: beforeStatus.id,
            statusAfter: afterStatus.id
        });
        return { changed: true, before, after, statusBefore, statusAfter };
    }

    recordInteraction(fromNpcId, toNpcId, interaction, options = {}) {
        const bond = this._findBond(fromNpcId, toNpcId, options.relationshipId);
        if (!bond || !this.memoryService) return { changed: false, reason: 'relationship_not_found' };
        const before = this.memoryService.getRelationshipTrust(fromNpcId, toNpcId);
        const trustDelta = this._clamp(options.trustDelta, -25, 25, 0);
        const after = this._clamp(before + trustDelta, 0, 100, before);
        this.memoryService.setRelationshipTrust(fromNpcId, toNpcId, after);
        if (bond.reciprocal) {
            const reverseBefore = this.memoryService.getRelationshipTrust(toNpcId, fromNpcId);
            const reverseDelta = this._clamp(options.reciprocalTrustDelta, -25, 25, trustDelta);
            this.memoryService.setRelationshipTrust(toNpcId, fromNpcId,
                this._clamp(reverseBefore + reverseDelta, 0, 100, reverseBefore));
        }
        const state = this._ensureState();
        const bondState = state.relationships[bond.id] || (state.relationships[bond.id] = {
            interactionCount: 0, lastInteractionAt: null, discoveredAt: null
        });
        bondState.interactionCount++;
        bondState.lastInteractionAt = this._now();
        const type = interaction === 'betrayal' || interaction === 'conflict'
            ? 'relationship_conflict'
            : interaction === 'reconcile' ? 'relationship_reconciled' : 'relationship_support';
        const beforeStatus = this._status(before);
        const afterStatus = this._status(after);
        this.socialNetwork?.recordRelationshipEvent(type, {
            relationshipId: bond.id,
            fromNpcId, toNpcId,
            relationship: bond.relationship,
            channel: options.channel || 'in_person',
            summary: options.summary || '',
            reason: interaction,
            trustBefore: before,
            trustAfter: after,
            statusBefore: beforeStatus.id,
            statusAfter: afterStatus.id
        });
        return { changed: before !== after, before, after, relationshipId: bond.id };
    }

    processDueInteractions() {
        const state = this._ensureState();
        if (!state || !this.memoryService) return { processed: 0, changed: 0, deferred: 0, skipped: 0 };
        const now = this._now();
        let processed = 0, changed = 0, deferred = 0, skipped = 0;
        for (const rule of this.caseConfig.autonomousInteractions) {
            const ruleState = state.rules[rule.id];
            if (!ruleState || ruleState.completed || !Number.isFinite(ruleState.nextDueAt) || ruleState.nextDueAt > now) continue;
            processed++;
            if (rule.maxOccurrences !== null && ruleState.occurrences >= rule.maxOccurrences) {
                ruleState.completed = true;
                continue;
            }
            if (!this._canInteract(rule)) {
                ruleState.deferrals++;
                if (ruleState.deferrals >= rule.maxDeferrals) {
                    ruleState.deferrals = 0;
                    ruleState.nextDueAt = now + rule.everyMinutes;
                    skipped++;
                } else {
                    ruleState.nextDueAt = now + rule.retryMinutes;
                    deferred++;
                }
                continue;
            }
            ruleState.deferrals = 0;
            if (!this._conditionsMet(rule)) {
                ruleState.nextDueAt = now + rule.everyMinutes;
                skipped++;
                continue;
            }
            this._applyInteraction(rule, now);
            ruleState.lastTriggeredAt = now;
            ruleState.occurrences++;
            ruleState.nextDueAt = now + rule.everyMinutes;
            if (rule.maxOccurrences !== null && ruleState.occurrences >= rule.maxOccurrences) ruleState.completed = true;
            changed++;
        }
        return { processed, changed, deferred, skipped };
    }

    resetCase(caseId = this.currentCaseId) {
        if (!caseId) return false;
        delete this.cases[caseId];
        if (caseId === this.currentCaseId) this._ensureState();
        return true;
    }

    toJSON() {
        return { version: this.version, currentCaseId: this.currentCaseId, cases: this._clone(this.cases) };
    }

    static fromJSON(json, memoryService = null, npcManager = null, gameTime = null, socialNetwork = null) {
        return new NPCRelationshipService(json, memoryService, npcManager, gameTime, socialNetwork);
    }

    _clone(value) { return JSON.parse(JSON.stringify(value)); }
}
