/**
 * NPCRelationshipService
 * Data-driven relationship state, autonomous NPC interactions and evidence-gated discovery.
 * Hidden bonds and off-screen events are never exposed to the detective until explicitly revealed.
 */
class NPCRelationshipService {
    constructor(snapshot = null, memoryService = null, npcManager = null, gameTime = null, socialNetwork = null) {
        this.version = 3;
        this.currentCaseId = snapshot?.currentCaseId || null;
        this.cases = this._clone(snapshot?.cases || {});
        this.worldTrusts = this._clone(snapshot?.worldTrusts || {});
        this.worldGoals = this._clone(snapshot?.worldGoals || {});
        this.memoryService = memoryService;
        this.npcManager = npcManager;
        this.gameTime = gameTime;
        this.socialNetwork = socialNetwork;
        this.caseConfig = { bonds: [], autonomousInteractions: [], goals: [] };
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

    _getWorldTrust(fromNpcId, toNpcId) {
        const value = this.worldTrusts?.[fromNpcId]?.[toNpcId];
        return Number.isFinite(value) ? this._clamp(value, 0, 100, 50) : null;
    }

    _setWorldTrust(fromNpcId, toNpcId, trust) {
        if (!fromNpcId || !toNpcId || fromNpcId === toNpcId || !Number.isFinite(trust)) return null;
        if (!this.worldTrusts || typeof this.worldTrusts !== 'object' || Array.isArray(this.worldTrusts)) this.worldTrusts = {};
        if (!this.worldTrusts[fromNpcId] || typeof this.worldTrusts[fromNpcId] !== 'object') this.worldTrusts[fromNpcId] = {};
        this.worldTrusts[fromNpcId][toNpcId] = this._clamp(trust, 0, 100, 50);
        return this.worldTrusts[fromNpcId][toNpcId];
    }

    _hydrateBondTrust(bond) {
        const caseForward = this.memoryService?.getMemory(bond.fromNpcId)?.relationshipTrusts?.[bond.toNpcId];
        const worldForward = this._getWorldTrust(bond.fromNpcId, bond.toNpcId);
        const forward = worldForward ?? (Number.isFinite(caseForward) ? caseForward : bond.trust);
        this._setWorldTrust(bond.fromNpcId, bond.toNpcId, forward);
        if (!Number.isFinite(caseForward) || caseForward !== forward) {
            this.memoryService?.setRelationshipTrust(bond.fromNpcId, bond.toNpcId, forward);
        }

        if (bond.reciprocal) {
            const caseReverse = this.memoryService?.getMemory(bond.toNpcId)?.relationshipTrusts?.[bond.fromNpcId];
            const worldReverse = this._getWorldTrust(bond.toNpcId, bond.fromNpcId);
            const reverse = worldReverse ?? (Number.isFinite(caseReverse) ? caseReverse : bond.trust);
            this._setWorldTrust(bond.toNpcId, bond.fromNpcId, reverse);
            if (!Number.isFinite(caseReverse) || caseReverse !== reverse) {
                this.memoryService?.setRelationshipTrust(bond.toNpcId, bond.fromNpcId, reverse);
            }
        }
    }

    setCase(caseData) {
        if (!caseData?.id || typeof caseData.id !== 'string') return false;
        this.currentCaseId = caseData.id;
        const activeIds = new Set(Array.isArray(caseData.npcs) ? caseData.npcs : []);
        this.caseConfig = this._normalizeConfig(caseData.npcRelationships, activeIds);
        const state = this._ensureState();
        const now = this._now();

        for (const goal of this.caseConfig.goals) this._ensureGoalState(goal);

        for (const bond of this.caseConfig.bonds) {
            if (!state.relationships[bond.id]) {
                state.relationships[bond.id] = {
                    interactionCount: 0,
                    lastInteractionAt: null,
                    discoveredAt: null
                };
            }
            this._hydrateBondTrust(bond);
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
        const goals = (Array.isArray(config?.goals) ? config.goals : [])
            .filter(item => item && typeof item.id === 'string' && /^[a-z0-9_:-]{1,64}$/i.test(item.id) &&
                activeIds.has(item.npcId))
            .map(item => ({
                id: item.id,
                npcId: item.npcId,
                title: String(item.title || item.id).slice(0, 100),
                description: String(item.description || '').slice(0, 240),
                priority: Math.round(this._clamp(item.priority, 0, 100, 50)),
                target: Math.round(this._clamp(item.target, 1, 20, 1))
            }));
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
                    goalId: typeof item.goalId === 'string' ? item.goalId : null,
                    goalNpcId: typeof item.goalNpcId === 'string' ? item.goalNpcId : item.fromNpcId,
                    goalProgress: this._clamp(item.goalProgress, -10, 10, 1),
                    toNpcId: item.toNpcId,
                    interaction: item.interaction,
                    consultationPolicy: item.consultationPolicy === 'witness_protection' ? item.consultationPolicy : null,
                    witnessDecisionPolicy: item.witnessDecisionPolicy === 'work_after_protection_delay' ? item.witnessDecisionPolicy : null,
                    investigatesRumorId: typeof item.investigatesRumorId === 'string' && item.investigatesRumorId === conditions.fromRumorId ? item.investigatesRumorId : null,
                    channel,
                    requiresSameLocation: item.requiresSameLocation !== false && channel === 'in_person',
                    everyMinutes: Math.round(this._clamp(item.everyMinutes, 30, 10080, 240)),
                    initialDelayMinutes: Math.round(this._clamp(item.initialDelayMinutes, 1, 10080, item.everyMinutes || 240)),
                    retryMinutes: Math.round(this._clamp(item.retryMinutes, 5, 180, 15)),
                    maxDeferrals: Math.round(this._clamp(item.maxDeferrals, 1, 24, 8)),
                    maxOccurrences: Number.isInteger(item.maxOccurrences) ? Math.max(1, item.maxOccurrences) : null,
                    trustDelta: this._clamp(item.trustDelta, -25, 25, 0),
                    reciprocalTrustDelta: this._clamp(item.reciprocalTrustDelta, -25, 25, 0),
                    fromCooperationDelta: this._optionalClamp(item.fromCooperationDelta, -25, 25),
                    toCooperationDelta: this._optionalClamp(item.toCooperationDelta, -25, 25),
                    conditions: {
                        minTrust: this._optionalClamp(conditions.minTrust, 0, 100),
                        maxTrust: this._optionalClamp(conditions.maxTrust, 0, 100),
                        fromPressureAtLeast: this._optionalClamp(conditions.fromPressureAtLeast, 0, 100),
                        fromPressureBelow: this._optionalClamp(conditions.fromPressureBelow, 0, 100),
                        toPressureAtLeast: this._optionalClamp(conditions.toPressureAtLeast, 0, 100),
                        toPressureBelow: this._optionalClamp(conditions.toPressureBelow, 0, 100),
                        goalId: typeof conditions.requiresGoalId === 'string' ? conditions.requiresGoalId : null,
                        goalNpcId: typeof conditions.requiresGoalNpcId === 'string' ? conditions.requiresGoalNpcId : item.fromNpcId,
                        goalStatus: ['active', 'completed', 'abandoned'].includes(conditions.requiresGoalStatus) ? conditions.requiresGoalStatus : null,
                        goalProgressAtLeast: this._optionalClamp(conditions.requiresGoalProgressAtLeast, 0, 20),
                        goalProgressBelow: this._optionalClamp(conditions.requiresGoalProgressBelow, 0, 20),
                        // Rumors belong to the acting NPC; never consult another character's private knowledge.
                        fromRumorId: typeof conditions.fromRumorId === 'string' && /^[a-z0-9_:-]{1,100}$/i.test(conditions.fromRumorId) ? conditions.fromRumorId : null,
                        fromRumorStatus: ['unverified', 'corroborated', 'disputed'].includes(conditions.fromRumorStatus) ? conditions.fromRumorStatus : null,
                        fromRumorConfidenceAtLeast: this._optionalClamp(conditions.fromRumorConfidenceAtLeast, 0, 100),
                        fromRumorAgeMinutesAtLeast: this._optionalClamp(conditions.fromRumorAgeMinutesAtLeast, 0, 10080),
                        requiresActionId: typeof conditions.requiresActionId === 'string' ? conditions.requiresActionId : null,
                        requiresInvestigationOutcome: ['corroborated', 'disputed', 'no_independent_evidence'].includes(conditions.requiresInvestigationOutcome) ? conditions.requiresInvestigationOutcome : null,
                        requiresConsultationOutcome: ['procedure_guidance', 'written_request_required'].includes(conditions.requiresConsultationOutcome) ? conditions.requiresConsultationOutcome : null,
                        requiresActionAgeMinutes: this._optionalClamp(conditions.requiresActionAgeMinutes, 0, 10080),
                        requiresReceivedActionId: typeof conditions.requiresReceivedActionId === 'string' ? conditions.requiresReceivedActionId : null,
                        requiresReceivedActionAgeMinutes: this._optionalClamp(conditions.requiresReceivedActionAgeMinutes, 0, 10080),
                        fromDialogueId: typeof conditions.fromDialogueId === 'string' ? conditions.fromDialogueId : null,
                        fromDialogueNodeId: typeof conditions.fromDialogueNodeId === 'string' ? conditions.fromDialogueNodeId : null
                    },
                    summary: String(item.summary || '').slice(0, 240)
                };
            });
        return { bonds, autonomousInteractions, goals };
    }

    _clamp(value, min, max, fallback) {
        return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
    }

    _optionalClamp(value, min, max) {
        return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : null;
    }

    _ensureGoalState(definition) {
        if (!definition?.npcId || !definition?.id) return null;
        if (!this.worldGoals || typeof this.worldGoals !== 'object' || Array.isArray(this.worldGoals)) this.worldGoals = {};
        if (!this.worldGoals[definition.npcId] || typeof this.worldGoals[definition.npcId] !== 'object') {
            this.worldGoals[definition.npcId] = {};
        }
        let goal = this.worldGoals[definition.npcId][definition.id];
        if (!goal || typeof goal !== 'object') {
            goal = this.worldGoals[definition.npcId][definition.id] = {
                id: definition.id,
                npcId: definition.npcId,
                title: definition.title,
                description: definition.description,
                priority: definition.priority,
                target: definition.target,
                progress: 0,
                status: 'active',
                createdInCaseId: this.currentCaseId,
                updatedAt: null,
                history: []
            };
        } else {
            goal.title = definition.title;
            goal.description = definition.description;
            goal.priority = definition.priority;
            goal.target = Math.max(Number.isFinite(goal.progress) ? goal.progress : 0, definition.target);
            goal.progress = this._clamp(goal.progress, 0, goal.target, 0);
            goal.history = Array.isArray(goal.history) ? goal.history : [];
            if (!['active', 'completed', 'abandoned'].includes(goal.status)) goal.status = 'active';
            if (goal.progress >= goal.target) goal.status = 'completed';
            else if (goal.status === 'completed') goal.status = 'active';
        }
        return goal;
    }

    getGoalProgress(npcId, goalId) {
        const progress = this.worldGoals?.[npcId]?.[goalId]?.progress;
        return Number.isFinite(progress) ? progress : 0;
    }

    isGoalCompleted(npcId, goalId) {
        return this.worldGoals?.[npcId]?.[goalId]?.status === 'completed';
    }

    getPersonalGoals(npcId) {
        const goals = this.worldGoals?.[npcId];
        if (!goals || typeof goals !== 'object') return [];
        return this._clone(Object.values(goals).sort((a, b) => b.priority - a.priority));
    }

    _advanceGoal(rule, now) {
        if (!rule.goalId) return null;
        const definition = this.caseConfig.goals.find(item =>
            item.id === rule.goalId && item.npcId === rule.goalNpcId
        );
        if (!definition) return null;
        const goal = this._ensureGoalState(definition);
        if (!goal || goal.status !== 'active') return null;
        const delta = Number.isFinite(rule.goalProgress) ? rule.goalProgress : 1;
        const before = goal.progress;
        goal.progress = this._clamp(before + delta, 0, goal.target, before);
        goal.updatedAt = now;
        goal.status = goal.progress >= goal.target ? 'completed' : 'active';
        goal.history.push({
            caseId: this.currentCaseId,
            ruleId: rule.id,
            delta: goal.progress - before,
            progress: goal.progress,
            atGameMinute: now,
            summary: rule.summary
        });
        if (goal.history.length > 40) goal.history.splice(0, goal.history.length - 40);
        return { npcId: goal.npcId, goalId: goal.id, before, progress: goal.progress, status: goal.status };
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
            if (!state.relationships[id]) state.relationships[id] = { interactionCount: 0, lastInteractionAt: null, discoveredAt: null };
            state.relationships[id].discoveredAt = this._now();
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
        if (conditions.fromDialogueId && conditions.fromDialogueNodeId) {
            const witnessed = this.memoryService?.getMemory(rule.fromNpcId)?.dialogueHistory?.some(item =>
                item.type === 'node' && item.dialogueId === conditions.fromDialogueId &&
                item.nodeId === conditions.fromDialogueNodeId
            );
            if (!witnessed) return false;
        }
        if (conditions.fromRumorId) {
            const rumor = this.memoryService?.getRumors(rule.fromNpcId)?.find(item => item.id === conditions.fromRumorId);
            if (!rumor) return false;
            if (conditions.fromRumorStatus && rumor.status !== conditions.fromRumorStatus) return false;
            if (conditions.fromRumorConfidenceAtLeast !== null && rumor.confidence < conditions.fromRumorConfidenceAtLeast) return false;
            if (conditions.fromRumorAgeMinutesAtLeast !== null &&
                (!Number.isFinite(rumor.receivedAtGameMinute) ||
                    this._now() - rumor.receivedAtGameMinute < conditions.fromRumorAgeMinutesAtLeast)) return false;
        }
        if (conditions.requiresActionId) {
            const prerequisite = this.caseConfig.autonomousInteractions.find(item =>
                item.id === conditions.requiresActionId && item.fromNpcId === rule.fromNpcId && item.id !== rule.id
            );
            const prior = prerequisite ? this.cases[this.currentCaseId]?.rules?.[prerequisite.id] : null;
            if (!prior || !Number.isInteger(prior.occurrences) || prior.occurrences < 1) return false;
            if (conditions.requiresInvestigationOutcome &&
                prior.investigationOutcome !== conditions.requiresInvestigationOutcome) return false;
            if (conditions.requiresConsultationOutcome &&
                (prerequisite?.consultationPolicy !== 'witness_protection' ||
                    prior.consultationOutcome !== conditions.requiresConsultationOutcome)) return false;
            if (conditions.requiresActionAgeMinutes !== null &&
                (!Number.isFinite(prior.lastTriggeredAt) ||
                    this._now() - prior.lastTriggeredAt < conditions.requiresActionAgeMinutes)) return false;
        }
        if (conditions.requiresReceivedActionId) {
            // A character may act on a message addressed to them, not on private actions of others.
            const received = this.caseConfig.autonomousInteractions.find(item =>
                item.id === conditions.requiresReceivedActionId && item.toNpcId === rule.fromNpcId && item.id !== rule.id
            );
            const prior = received ? this.cases[this.currentCaseId]?.rules?.[received.id] : null;
            if (!prior || !Number.isInteger(prior.occurrences) || prior.occurrences < 1) return false;
            if (conditions.requiresReceivedActionAgeMinutes !== null &&
                (!Number.isFinite(prior.lastTriggeredAt) ||
                    this._now() - prior.lastTriggeredAt < conditions.requiresReceivedActionAgeMinutes)) return false;
        }
        if (conditions.goalId) {
            const goal = this.worldGoals?.[conditions.goalNpcId]?.[conditions.goalId];
            if (!goal) return false;
            if (conditions.goalStatus && goal.status !== conditions.goalStatus) return false;
            if (conditions.goalProgressAtLeast !== null && goal.progress < conditions.goalProgressAtLeast) return false;
            if (conditions.goalProgressBelow !== null && goal.progress >= conditions.goalProgressBelow) return false;
        }
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

    _investigateRumor(rule) {
        const rumorId = rule.investigatesRumorId;
        if (!rumorId) return null;
        const rumor = this.memoryService?.getRumors(rule.fromNpcId)?.find(item => item.id === rumorId);
        if (!rumor) return 'unavailable';
        // This action represents an actual contact with rule.toNpcId, not omniscient
        // access to everyone else's private statements.
        const witnessId = rule.toNpcId;
        if (witnessId === rumor.reportedBy || witnessId === rumor.originalSourceNpcId) return 'no_independent_evidence';
        const claims = (this.memoryService?.getMemory(witnessId)?.claims || []).filter(claim =>
            claim.directObservation === true && claim.status !== 'superseded' &&
            (claim.corroboratesRumorIds?.includes(rumorId) || claim.refutesRumorIds?.includes(rumorId))
        );
        // Ambiguous or conflicting testimony is not a reliable automatic verdict.
        if (claims.length !== 1) return 'no_independent_evidence';
        const claim = claims[0];
        if (claim.refutesRumorIds?.includes(rumorId) && claim.corroboratesRumorIds?.includes(rumorId)) {
            return 'no_independent_evidence';
        }
        if (claim.corroboratesRumorIds?.includes(rumorId)) {
            return this.memoryService.corroborateRumor(rule.fromNpcId, rumorId, witnessId, claim.id).corroborated
                ? 'corroborated' : 'no_independent_evidence';
        }
        return this.memoryService.challengeRumor(rule.fromNpcId, rumorId, witnessId, claim.id).challenged
            ? 'disputed' : 'no_independent_evidence';
    }

    getInvestigationOutcome(npcId, ruleId) {
        if (!this.hasCompletedInteraction(npcId, ruleId)) return null;
        const rule = this.caseConfig.autonomousInteractions.find(item => item.id === ruleId);
        if (!rule?.investigatesRumorId) return null;
        return this.cases[this.currentCaseId]?.rules?.[ruleId]?.investigationOutcome || null;
    }

    // Editorial decisions require an actually completed independent check.
    // Corroboration permits review, never automatic publication.
    getEditorialDecision(npcId, ruleId) {
        if (npcId !== 'journalist') return null;
        const outcome = this.getInvestigationOutcome(npcId, ruleId);
        if (outcome === 'corroborated') return 'review_required';
        if (outcome === 'disputed' || outcome === 'no_independent_evidence') return 'withheld';
        return null;
    }

    // A consultation response is decided when contact occurs and persisted.
    // Better rapport can yield procedural guidance, never an automatic protection order.
    getProtectionConsultationOutcome(npcId, ruleId) {
        if (!this.hasCompletedInteraction(npcId, ruleId)) return null;
        const rule = this.caseConfig.autonomousInteractions.find(item =>
            item.id === ruleId && item.fromNpcId === npcId
        );
        if (rule?.consultationPolicy !== 'witness_protection') return null;
        return this.cases[this.currentCaseId]?.rules?.[ruleId]?.consultationOutcome || null;
    }

    // This is the witness's own response to an actual received warning.
    // Snapshot the decision; later pressure changes must not rewrite the past.
    getWitnessWorkDecision(npcId, ruleId) {
        if (!this.hasCompletedInteraction(npcId, ruleId)) return null;
        const rule = this.caseConfig.autonomousInteractions.find(item =>
            item.id === ruleId && item.fromNpcId === npcId
        );
        if (rule?.witnessDecisionPolicy !== 'work_after_protection_delay') return null;
        return this.cases[this.currentCaseId]?.rules?.[ruleId]?.witnessWorkDecision || null;
    }

    _applyInteraction(rule, now) {
        const before = this.memoryService?.getRelationshipTrust(rule.fromNpcId, rule.toNpcId) ?? 50;
        const after = this._clamp(before + rule.trustDelta, 0, 100, before);
        this.memoryService?.setRelationshipTrust(rule.fromNpcId, rule.toNpcId, after);
        this._setWorldTrust(rule.fromNpcId, rule.toNpcId, after);
        if (rule.fromCooperationDelta !== null) {
            this.memoryService?.adjustCooperation(rule.fromNpcId, rule.fromCooperationDelta, 'npc_relationship:' + rule.id);
        }
        if (rule.toCooperationDelta !== null) {
            this.memoryService?.adjustCooperation(rule.toNpcId, rule.toCooperationDelta, 'npc_relationship:' + rule.id);
        }
        if (this.caseConfig.bonds.find(item => item.id === rule.relationshipId)?.reciprocal) {
            const reverseBefore = this.memoryService?.getRelationshipTrust(rule.toNpcId, rule.fromNpcId) ?? 50;
            const reverseAfter = this._clamp(reverseBefore + rule.reciprocalTrustDelta, 0, 100, reverseBefore);
            this.memoryService?.setRelationshipTrust(rule.toNpcId, rule.fromNpcId, reverseAfter);
            this._setWorldTrust(rule.toNpcId, rule.fromNpcId, reverseAfter);
        }

        const state = this._ensureState();
        if (rule.investigatesRumorId) state.rules[rule.id].investigationOutcome = this._investigateRumor(rule);
        if (rule.consultationPolicy === 'witness_protection' && !state.rules[rule.id].consultationOutcome) {
            state.rules[rule.id].consultationOutcome = before >= 65 ? 'procedure_guidance' : 'written_request_required';
        }
        if (rule.witnessDecisionPolicy === 'work_after_protection_delay' && !state.rules[rule.id].witnessWorkDecision) {
            const pressure = this.memoryService?.getPressure(rule.fromNpcId) ?? 0;
            const decision = pressure >= 50 ? 'temporary_leave' : 'document_help';
            state.rules[rule.id].witnessWorkDecision = decision;
            this.memoryService?.adjustCooperation(rule.fromNpcId, decision === 'temporary_leave' ? -6 : 3,
                'npc_witness_decision:' + rule.id);
        }
        const bondState = state.relationships[rule.relationshipId] || (state.relationships[rule.relationshipId] = {
            interactionCount: 0, lastInteractionAt: null, discoveredAt: null
        });
        bondState.interactionCount++;
        bondState.lastInteractionAt = now;
        const beforeStatus = this._status(before);
        const afterStatus = this._status(after);
        const goalProgress = this._advanceGoal(rule, now);
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
            statusAfter: afterStatus.id,
            goalProgress
        });
        return { changed: true, before, after, statusBefore: beforeStatus, statusAfter: afterStatus, goalProgress };
    }

    recordInteraction(fromNpcId, toNpcId, interaction, options = {}) {
        const bond = this._findBond(fromNpcId, toNpcId, options.relationshipId);
        if (!bond || !this.memoryService) return { changed: false, reason: 'relationship_not_found' };
        const before = this.memoryService.getRelationshipTrust(fromNpcId, toNpcId);
        const trustDelta = this._clamp(options.trustDelta, -25, 25, 0);
        const after = this._clamp(before + trustDelta, 0, 100, before);
        this.memoryService.setRelationshipTrust(fromNpcId, toNpcId, after);
        this._setWorldTrust(fromNpcId, toNpcId, after);
        if (bond.reciprocal) {
            const reverseBefore = this.memoryService.getRelationshipTrust(toNpcId, fromNpcId);
            const reverseDelta = this._clamp(options.reciprocalTrustDelta, -25, 25, trustDelta);
            const reverseAfter = this._clamp(reverseBefore + reverseDelta, 0, 100, reverseBefore);
            this.memoryService.setRelationshipTrust(toNpcId, fromNpcId, reverseAfter);
            this._setWorldTrust(toNpcId, fromNpcId, reverseAfter);
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

    hasReceivedInteraction(npcId, ruleId) {
        if (!npcId || !ruleId || !this.currentCaseId) return false;
        const rule = this.caseConfig.autonomousInteractions.find(item =>
            item.id === ruleId && item.toNpcId === npcId
        );
        if (!rule) return false;
        const state = this.cases[this.currentCaseId]?.rules?.[ruleId];
        return Boolean(state && Number.isInteger(state.occurrences) && state.occurrences > 0);
    }

    hasCompletedInteraction(npcId, ruleId) {
        if (!npcId || !ruleId || !this.currentCaseId) return false;
        const rule = this.caseConfig.autonomousInteractions.find(item =>
            item.id === ruleId && item.fromNpcId === npcId
        );
        if (!rule) return false;
        const state = this.cases[this.currentCaseId]?.rules?.[ruleId];
        return Boolean(state && Number.isInteger(state.occurrences) && state.occurrences > 0);
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
        return {
            version: this.version,
            currentCaseId: this.currentCaseId,
            cases: this._clone(this.cases),
            worldTrusts: this._clone(this.worldTrusts),
            worldGoals: this._clone(this.worldGoals)
        };
    }

    static fromJSON(json, memoryService = null, npcManager = null, gameTime = null, socialNetwork = null) {
        return new NPCRelationshipService(json, memoryService, npcManager, gameTime, socialNetwork);
    }

    _clone(value) { return JSON.parse(JSON.stringify(value)); }
}
