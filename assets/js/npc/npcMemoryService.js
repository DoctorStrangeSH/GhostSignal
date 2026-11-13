/**
 * NPCMemoryService
 * Stores per-case NPC interaction history, trust, presented evidence and claims.
 * Claims are explicit narrative facts; contradictions are only raised when two
 * claims share a topic but assert different normalized values.
 */
class NPCMemoryService {
    constructor(snapshot = null, currentCaseId = null) {
        this.version = 7;
        this.currentCaseId = currentCaseId || snapshot?.currentCaseId || null;
        this.cases = this._clone(snapshot?.cases || {});
        if (this.currentCaseId) this._ensureCase(this.currentCaseId);
    }

    setCase(caseId) {
        if (!caseId || typeof caseId !== 'string') return false;
        this.currentCaseId = caseId;
        this._ensureCase(caseId);
        return true;
    }

    _ensureCase(caseId = this.currentCaseId) {
        if (!caseId) return null;
        if (!this.cases[caseId]) this.cases[caseId] = {};
        return this.cases[caseId];
    }

    _ensureNPC(npcId) {
        if (!npcId || !this.currentCaseId) return null;
        const caseMemory = this._ensureCase();
        if (!caseMemory[npcId]) {
            caseMemory[npcId] = {
                trust: 50,
                pressure: 0,
                conversations: 0,
                dialogueHistory: [],
                presentedEvidence: [],
                claims: [],
                liesExposed: [],
                relationshipTrusts: {},
                lastInteraction: null
            };
        }
        const memory = caseMemory[npcId];
        memory.trust = Number.isFinite(memory.trust) ? Math.max(0, Math.min(100, memory.trust)) : 50;
        memory.pressure = Number.isFinite(memory.pressure) ? Math.max(0, Math.min(100, memory.pressure)) : 0;
        memory.conversations = Number.isInteger(memory.conversations) ? Math.max(0, memory.conversations) : 0;
        memory.dialogueHistory = Array.isArray(memory.dialogueHistory) ? memory.dialogueHistory : [];
        memory.presentedEvidence = Array.isArray(memory.presentedEvidence) ? memory.presentedEvidence : [];
        memory.claims = Array.isArray(memory.claims) ? memory.claims : [];
        for (const claim of memory.claims) {
            claim.version = Number.isInteger(claim.version) && claim.version > 0 ? claim.version : 1;
            claim.status = claim.status === 'superseded' ? 'superseded' : 'active';
            claim.revisionOf = typeof claim.revisionOf === 'string' ? claim.revisionOf : null;
            claim.revisionReason = typeof claim.revisionReason === 'string' ? claim.revisionReason : null;
        }
        memory.liesExposed = Array.isArray(memory.liesExposed) ? memory.liesExposed : [];
        memory.promises = Array.isArray(memory.promises) ? memory.promises : [];
        memory.relationshipTrusts = memory.relationshipTrusts &&
            typeof memory.relationshipTrusts === 'object' && !Array.isArray(memory.relationshipTrusts)
            ? memory.relationshipTrusts
            : {};
        memory.rumors = Array.isArray(memory.rumors) ? memory.rumors : [];
        for (const rumor of memory.rumors) {
            rumor.sourceTrust = Number.isFinite(rumor.sourceTrust)
                ? Math.max(0, Math.min(100, rumor.sourceTrust))
                : 50;
            rumor.confidence = Number.isFinite(rumor.confidence)
                ? Math.max(0, Math.min(100, rumor.confidence))
                : 60;
            rumor.corroborations = Array.isArray(rumor.corroborations) ? rumor.corroborations : [];
            rumor.challenges = Array.isArray(rumor.challenges) ? rumor.challenges : [];
            if (!['unverified', 'corroborated', 'disputed'].includes(rumor.status)) {
                rumor.status = rumor.challenges.length ? 'disputed'
                    : rumor.corroborations.length ? 'corroborated' : 'unverified';
            }
        }
        return memory;
    }

    _append(memory, entry) {
        memory.dialogueHistory.push({ ...entry, at: entry.at || Date.now() });
        if (memory.dialogueHistory.length > 100) memory.dialogueHistory.splice(0, memory.dialogueHistory.length - 100);
        memory.lastInteraction = memory.dialogueHistory[memory.dialogueHistory.length - 1].at;
    }

    recordDialogueStarted(npcId, dialogueId) {
        const memory = this._ensureNPC(npcId);
        if (!memory) return false;
        memory.conversations++;
        this._append(memory, { type: 'dialogue_started', dialogueId });
        return true;
    }

    recordNodeVisited(npcId, dialogueId, node) {
        const memory = this._ensureNPC(npcId);
        if (!memory || !node?.id) return false;
        this._append(memory, {
            type: 'node',
            dialogueId,
            nodeId: node.id,
            speaker: node.speaker || 'npc',
            text: node.text || ''
        });
        return true;
    }

    recordAnswerSelected(npcId, dialogueId, nodeId, answer) {
        const memory = this._ensureNPC(npcId);
        if (!memory || !answer) return false;
        const toneEffects = {
            calm: { trust: 1, pressure: -1 },
            reassuring: { trust: 3, pressure: -3 },
            direct: { trust: 0, pressure: 2 },
            aggressive: { trust: -3, pressure: 8 },
            threatening: { trust: -5, pressure: 12 },
            neutral: { trust: 0, pressure: 0 }
        };
        const effect = toneEffects[answer.tone || 'neutral'] || toneEffects.neutral;
        const trustDelta = Number.isFinite(answer.trustDelta) ? answer.trustDelta : effect.trust;
        const pressureDelta = Number.isFinite(answer.pressureDelta) ? answer.pressureDelta : effect.pressure;
        memory.trust = Math.max(0, Math.min(100, memory.trust + trustDelta));
        memory.pressure = Math.max(0, Math.min(100, memory.pressure + pressureDelta));
        this._append(memory, {
            type: 'answer',
            dialogueId,
            nodeId,
            answerText: answer.text || '',
            tone: answer.tone || 'neutral',
            trustDelta,
            pressureDelta
        });
        return true;
    }

    recordEvidencePresented(npcId, dialogueId, evidenceId) {
        const memory = this._ensureNPC(npcId);
        if (!memory || !evidenceId) return { recorded: false, reason: 'invalid_context' };
        if (memory.presentedEvidence.includes(evidenceId)) {
            return { recorded: false, reason: 'already_presented' };
        }
        memory.presentedEvidence.push(evidenceId);
        this._append(memory, { type: 'evidence_presented', dialogueId, evidenceId });
        return { recorded: true, reason: null };
    }

    hasPresentedEvidence(npcId, evidenceId) {
        const memory = this.cases[this.currentCaseId]?.[npcId];
        return memory?.presentedEvidence?.includes(evidenceId) || false;
    }

    recordClaim(npcId, claim) {
        const memory = this._ensureNPC(npcId);
        if (!memory || !claim?.id || !claim?.topic || claim.value === undefined || claim.value === null) {
            return { added: false, contradictions: [] };
        }
        if (memory.claims.some(existing => existing.id === claim.id)) {
            return { added: false, reason: 'duplicate_claim', contradictions: this.getContradictions() };
        }
        const previous = claim.revisesClaimId
            ? memory.claims.find(existing => existing.id === claim.revisesClaimId)
            : null;
        if (claim.revisesClaimId && !previous) {
            return { added: false, reason: 'revision_source_not_found', contradictions: this.getContradictions() };
        }
        if (previous?.status === 'superseded') {
            return { added: false, reason: 'revision_source_superseded', contradictions: this.getContradictions() };
        }
        if (previous && previous.topic !== claim.topic) {
            return { added: false, reason: 'revision_topic_mismatch', contradictions: this.getContradictions() };
        }

        const normalizedValue = String(claim.value).trim().toLowerCase().replace(/\s+/g, ' ');
        const storedClaim = {
            id: claim.id,
            npcId,
            topic: claim.topic,
            value: normalizedValue,
            summary: claim.summary || '',
            sourceName: claim.sourceName || npcId,
            location: claim.location || null,
            timeLabel: claim.timeLabel || null,
            circumstances: claim.circumstances || null,
            deception: claim.deception ? this._clone(claim.deception) : null,
            directObservation: claim.directObservation === true,
            corroboratesRumorIds: Array.isArray(claim.corroboratesRumorIds)
                ? [...new Set(claim.corroboratesRumorIds.filter(id => typeof id === 'string' && id.trim()))]
                : [],
            refutesRumorIds: Array.isArray(claim.refutesRumorIds)
                ? [...new Set(claim.refutesRumorIds.filter(id => typeof id === 'string' && id.trim()))]
                : [],
            version: previous ? (previous.version || 1) + 1 : 1,
            status: 'active',
            revisionOf: previous?.id || null,
            revisionReason: previous ? (claim.revisionReason || 'new_information') : null,
            dialogueId: claim.dialogueId || null,
            nodeId: claim.nodeId || null,
            at: Date.now()
        };
        if (previous) {
            previous.status = 'superseded';
            previous.supersededBy = storedClaim.id;
            previous.supersededAt = storedClaim.at;
            const journal = this._ensureJournal();
            if (journal?.preparedConfrontation &&
                [journal.preparedConfrontation.firstId, journal.preparedConfrontation.secondId].includes(previous.id)) {
                journal.preparedConfrontation = null;
            }
        }
        memory.claims.push(storedClaim);
        this._append(memory, {
            type: 'claim',
            dialogueId: storedClaim.dialogueId,
            nodeId: storedClaim.nodeId,
            claimId: storedClaim.id,
            topic: storedClaim.topic,
            value: storedClaim.value,
            summary: storedClaim.summary,
            revisionOf: storedClaim.revisionOf,
            revisionReason: storedClaim.revisionReason,
            version: storedClaim.version
        });
        return { added: true, contradictions: this.getContradictions() };
    }

    setRelationshipTrust(npcId, otherNpcId, trust) {
        if (!npcId || !otherNpcId || npcId === otherNpcId || !Number.isFinite(trust)) return null;
        const memory = this._ensureNPC(npcId);
        if (!memory) return null;
        memory.relationshipTrusts[otherNpcId] = Math.max(0, Math.min(100, trust));
        this._append(memory, {
            type: 'relationship_trust_changed',
            otherNpcId,
            trust: memory.relationshipTrusts[otherNpcId]
        });
        return memory.relationshipTrusts[otherNpcId];
    }

    getRelationshipTrust(npcId, otherNpcId) {
        const trust = this.cases[this.currentCaseId]?.[npcId]?.relationshipTrusts?.[otherNpcId];
        return Number.isFinite(trust) ? Math.max(0, Math.min(100, trust)) : 50;
    }

    shareExperience(fromNpcId, toNpcId, report, sourceEvent, options = {}) {
        if (!fromNpcId || !toNpcId || fromNpcId === toNpcId ||
            !report?.id || !report?.text || report.kind !== 'detective_behavior' ||
            !sourceEvent?.dialogueId || !sourceEvent?.nodeId || !sourceEvent?.answerText) {
            return { shared: false, reason: 'invalid_report' };
        }

        const source = this.cases[this.currentCaseId]?.[fromNpcId];
        const witnessed = source?.dialogueHistory?.some(entry =>
            entry.type === 'answer' &&
            entry.dialogueId === sourceEvent.dialogueId &&
            entry.nodeId === sourceEvent.nodeId &&
            entry.answerText === sourceEvent.answerText
        );
        if (!witnessed) return { shared: false, reason: 'source_event_not_found' };

        const recipient = this._ensureNPC(toNpcId);
        if (!recipient) return { shared: false, reason: 'invalid_context' };
        if (recipient.rumors.some(item => item.id === report.id && item.reportedBy === fromNpcId)) {
            return { shared: false, reason: 'already_shared' };
        }

        const sourceTrust = Number.isFinite(options.recipientTrust)
            ? Math.max(0, Math.min(100, options.recipientTrust))
            : this.getRelationshipTrust(toNpcId, fromNpcId);
        const confidence = Number.isFinite(options.confidence)
            ? Math.max(0, Math.min(100, options.confidence))
            : Math.round(30 + sourceTrust * 0.6);
        const rumor = {
            id: report.id,
            kind: report.kind,
            text: String(report.text).slice(0, 500),
            reportedBy: fromNpcId,
            reportedByName: report.sourceName || fromNpcId,
            sourceDialogueId: sourceEvent.dialogueId,
            sourceNodeId: sourceEvent.nodeId,
            sourceAnswerText: sourceEvent.answerText,
            tone: sourceEvent.tone || 'neutral',
            sourceTrust,
            confidence,
            corroborations: [],
            challenges: [],
            status: 'unverified',
            at: Date.now()
        };
        recipient.rumors.push(rumor);
        this._append(recipient, {
            type: 'rumor_received',
            rumorId: rumor.id,
            fromNpcId,
            kind: rumor.kind
        });
        return { shared: true, rumor: this._clone(rumor) };
    }

    getRumors(npcId) {
        const existing = this.cases[this.currentCaseId]?.[npcId];
        if (!Array.isArray(existing?.rumors)) return [];
        return this._clone(this._ensureNPC(npcId).rumors);
    }

    hasRumor(npcId, rumorId) {
        return this.cases[this.currentCaseId]?.[npcId]?.rumors?.some(rumor => rumor.id === rumorId) || false;
    }

    _findRumor(npcId, rumorId) {
        return this.cases[this.currentCaseId]?.[npcId]?.rumors?.find(rumor => rumor.id === rumorId) || null;
    }

    corroborateRumor(recipientNpcId, rumorId, witnessNpcId, claimId) {
        const rumor = this._findRumor(recipientNpcId, rumorId);
        if (!rumor) return { corroborated: false, reason: 'rumor_not_found' };
        if (!witnessNpcId || witnessNpcId === rumor.reportedBy) {
            return { corroborated: false, reason: 'not_independent' };
        }
        const witnessMemory = this.cases[this.currentCaseId]?.[witnessNpcId];
        const claim = witnessMemory?.claims?.find(item => item.id === claimId);
        if (!claim?.directObservation || !claim.corroboratesRumorIds?.includes(rumorId)) {
            return { corroborated: false, reason: 'independent_witness_not_found' };
        }
        if (rumor.corroborations.some(item => item.witnessNpcId === witnessNpcId) ||
            rumor.challenges.some(item => item.witnessNpcId === witnessNpcId)) {
            return { corroborated: false, reason: 'witness_already_recorded' };
        }

        rumor.corroborations.push({ witnessNpcId, claimId, at: Date.now() });
        rumor.confidence = Math.min(100, rumor.confidence + 20);
        rumor.status = rumor.challenges.length ? 'disputed' : 'corroborated';
        const recipientMemory = this._ensureNPC(recipientNpcId);
        this._append(recipientMemory, {
            type: 'rumor_corroborated', rumorId, witnessNpcId, claimId, confidence: rumor.confidence
        });
        return { corroborated: true, rumor: this._clone(rumor) };
    }

    challengeRumor(recipientNpcId, rumorId, witnessNpcId, claimId) {
        const rumor = this._findRumor(recipientNpcId, rumorId);
        if (!rumor) return { challenged: false, reason: 'rumor_not_found' };
        if (!witnessNpcId || witnessNpcId === rumor.reportedBy) {
            return { challenged: false, reason: 'not_independent' };
        }
        const witnessMemory = this.cases[this.currentCaseId]?.[witnessNpcId];
        const claim = witnessMemory?.claims?.find(item => item.id === claimId);
        if (!claim?.directObservation || !claim.refutesRumorIds?.includes(rumorId)) {
            return { challenged: false, reason: 'independent_witness_not_found' };
        }
        if (rumor.corroborations.some(item => item.witnessNpcId === witnessNpcId) ||
            rumor.challenges.some(item => item.witnessNpcId === witnessNpcId)) {
            return { challenged: false, reason: 'witness_already_recorded' };
        }

        rumor.challenges.push({ witnessNpcId, claimId, at: Date.now() });
        rumor.confidence = Math.max(0, rumor.confidence - 20);
        rumor.status = 'disputed';
        const recipientMemory = this._ensureNPC(recipientNpcId);
        this._append(recipientMemory, {
            type: 'rumor_challenged', rumorId, witnessNpcId, claimId, confidence: rumor.confidence
        });
        return { challenged: true, rumor: this._clone(rumor) };
    }

    getStatements() {
        const caseMemory = this._ensureCase();
        if (!caseMemory) return [];
        return Object.keys(caseMemory)
            .filter(npcId => npcId !== '__journal')
            .flatMap(npcId => this._ensureNPC(npcId).claims || [])
            .map(claim => this._clone(claim))
            .sort((a, b) => (a.at || 0) - (b.at || 0));
    }

    getStatementById(statementId) {
        return this.getStatements().find(statement => statement.id === statementId) || null;
    }

    getClaimHistory(npcId, claimId) {
        const claims = this.cases[this.currentCaseId]?.[npcId]?.claims || [];
        let current = claims.find(claim => claim.id === claimId);
        if (!current) return [];
        while (current.revisionOf) {
            const previous = claims.find(claim => claim.id === current.revisionOf);
            if (!previous) break;
            current = previous;
        }
        const history = [];
        let next = claims.find(claim => claim.id === current.id);
        while (next) {
            history.push(this._clone(next));
            next = claims.find(claim => claim.revisionOf === next.id);
        }
        return history;
    }

    compareStatements(firstId, secondId) {
        if (!firstId || !secondId) return { status: 'missing_selection' };
        if (firstId === secondId) return { status: 'same_statement' };
        const first = this.getStatementById(firstId);
        const second = this.getStatementById(secondId);
        if (!first || !second) return { status: 'statement_not_found' };
        if (first.status === 'superseded' || second.status === 'superseded') {
            return { status: 'superseded_statement', first, second };
        }
        if (first.topic !== second.topic) return { status: 'different_topics', first, second };
        if (first.value === second.value) return { status: 'corroboration', first, second };
        return {
            status: 'contradiction',
            contradiction: {
                id: [first.id, second.id].sort().join('::'),
                topic: first.topic,
                first,
                second
            }
        };
    }

    _ensureJournal() {
        const caseMemory = this._ensureCase();
        if (!caseMemory) return null;
        if (!caseMemory.__journal || typeof caseMemory.__journal !== 'object') {
            caseMemory.__journal = { preparedConfrontation: null, confrontedPairs: [] };
        }
        const journal = caseMemory.__journal;
        journal.confrontedPairs = Array.isArray(journal.confrontedPairs) ? journal.confrontedPairs : [];
        return journal;
    }

    _confrontationKey(targetNpcId, firstId, secondId) {
        return [targetNpcId, ...[firstId, secondId].sort()].join('::');
    }

    hasConfronted(targetNpcId, firstId, secondId) {
        const journal = this._ensureJournal();
        if (!journal) return false;
        const key = this._confrontationKey(targetNpcId, firstId, secondId);
        return journal.confrontedPairs.some(item => item.key === key);
    }

    prepareConfrontation(firstId, secondId, targetNpcId) {
        const comparison = this.compareStatements(firstId, secondId);
        if (comparison.status !== 'contradiction') {
            return { prepared: false, reason: comparison.status, comparison };
        }
        const { first, second } = comparison.contradiction;
        if (![first.npcId, second.npcId].includes(targetNpcId)) {
            return { prepared: false, reason: 'target_not_involved', comparison };
        }
        if (this.hasConfronted(targetNpcId, firstId, secondId)) {
            return { prepared: false, reason: 'already_confronted', comparison };
        }
        const journal = this._ensureJournal();
        journal.preparedConfrontation = {
            targetNpcId,
            firstId,
            secondId,
            topic: comparison.contradiction.topic,
            preparedAt: Date.now()
        };
        return { prepared: true, reason: null, confrontation: this._clone(journal.preparedConfrontation) };
    }

    getPreparedConfrontation(targetNpcId = null) {
        const journal = this._ensureJournal();
        const prepared = journal?.preparedConfrontation;
        if (!prepared || (targetNpcId && prepared.targetNpcId !== targetNpcId)) return null;
        const comparison = this.compareStatements(prepared.firstId, prepared.secondId);
        if (comparison.status !== 'contradiction') return null;
        return this._clone({ ...prepared, contradiction: comparison.contradiction });
    }

    recordConfrontation(targetNpcId, responseId = null) {
        const journal = this._ensureJournal();
        const prepared = journal?.preparedConfrontation;
        if (!prepared || prepared.targetNpcId !== targetNpcId) return false;
        const comparison = this.compareStatements(prepared.firstId, prepared.secondId);
        if (comparison.status !== 'contradiction') return false;
        const key = this._confrontationKey(targetNpcId, prepared.firstId, prepared.secondId);
        if (journal.confrontedPairs.some(item => item.key === key)) return false;

        journal.confrontedPairs.push({
            key,
            targetNpcId,
            firstId: prepared.firstId,
            secondId: prepared.secondId,
            topic: prepared.topic,
            responseId,
            at: Date.now()
        });
        const memory = this._ensureNPC(targetNpcId);
        const confrontationPressure = 10;
        const pressureBeforeConfrontation = memory.pressure;
        memory.pressure = Math.min(100, memory.pressure + confrontationPressure);
        const targetClaim = [comparison.contradiction.first, comparison.contradiction.second]
            .find(claim => claim.npcId === targetNpcId);
        if (targetClaim?.deception?.deliberate && !memory.liesExposed.includes(targetClaim.id)) {
            memory.liesExposed.push(targetClaim.id);
            memory.pressure = Math.min(100, memory.pressure + 15);
            this._append(memory, {
                type: 'lie_exposed',
                claimId: targetClaim.id,
                motive: targetClaim.deception.motive || null
            });
        }
        this._append(memory, {
            type: 'contradiction_presented',
            firstId: prepared.firstId,
            secondId: prepared.secondId,
            topic: prepared.topic,
            responseId,
            pressureDelta: memory.pressure - pressureBeforeConfrontation
        });
        journal.preparedConfrontation = null;
        return true;
    }

    getContradictions(npcId = null) {
        const caseMemory = this._ensureCase();
        if (!caseMemory) return [];
        const claims = Object.keys(caseMemory)
            .filter(npcId => npcId !== '__journal')
            .flatMap(npcId => this._ensureNPC(npcId).claims || []);
        const contradictions = [];
        for (let i = 0; i < claims.length; i++) {
            for (let j = i + 1; j < claims.length; j++) {
                const first = claims[i];
                const second = claims[j];
                if (first.status === 'superseded' || second.status === 'superseded') continue;
                if (first.topic !== second.topic || first.value === second.value) continue;
                if (npcId && first.npcId !== npcId && second.npcId !== npcId) continue;
                contradictions.push({
                    id: [first.id, second.id].sort().join('::'),
                    topic: first.topic,
                    first,
                    second
                });
            }
        }
        return contradictions;
    }

    getMemory(npcId) {
        const existing = this.cases[this.currentCaseId]?.[npcId];
        if (!existing) return null;
        return this._clone(this._ensureNPC(npcId));
    }

    getTrust(npcId) {
        return this.cases[this.currentCaseId]?.[npcId]?.trust ?? 50;
    }

    getPressure(npcId) {
        return this.cases[this.currentCaseId]?.[npcId]?.pressure ?? 0;
    }

    hasExposedLie(npcId, claimId) {
        return this.cases[this.currentCaseId]?.[npcId]?.liesExposed?.includes(claimId) || false;
    }

    getPsychologicalState(npcId, profile = {}) {
        if (!npcId || !this.currentCaseId) return null;
        const memory = this.cases[this.currentCaseId]?.[npcId] || {
            trust: 50,
            pressure: 0,
            liesExposed: []
        };
        const pressureThreshold = Number.isFinite(profile.pressureThreshold) ? profile.pressureThreshold : 60;
        const opennessThreshold = Number.isFinite(profile.opennessThreshold) ? profile.opennessThreshold : 65;
        const calmPressureLimit = Number.isFinite(profile.calmPressureLimit)
            ? profile.calmPressureLimit
            : Math.round(pressureThreshold * 0.25);
        let disposition = 'reserved';
        if (memory.pressure >= pressureThreshold) disposition = 'overwhelmed';
        else if (memory.trust >= opennessThreshold && memory.pressure <= calmPressureLimit) disposition = 'cooperative';
        else if (memory.pressure >= pressureThreshold * 0.5) disposition = 'pressured';
        else if (memory.trust < 35) disposition = 'distrustful';
        const labels = {
            cooperative: 'Готов к разговору',
            reserved: 'Сдержан',
            pressured: 'Под давлением',
            overwhelmed: 'Потрясён',
            distrustful: 'Не доверяет'
        };
        return {
            disposition,
            label: profile.labels?.[disposition] || labels[disposition],
            trust: memory.trust,
            pressure: memory.pressure,
            pressureThreshold,
            liesExposed: memory.liesExposed.length
        };
    }

    adjustTrust(npcId, delta) {
        const memory = this._ensureNPC(npcId);
        if (!memory || !Number.isFinite(delta)) return null;
        memory.trust = Math.max(0, Math.min(100, memory.trust + delta));
        this._append(memory, { type: 'trust_changed', delta, trust: memory.trust });
        return memory.trust;
    }

    recordPromise(npcId, promise) {
        const fulfillment = promise?.fulfillment;
        const validFulfillment = fulfillment && (
            (fulfillment.type === 'case_solved' && typeof fulfillment.caseId === 'string' && fulfillment.caseId) ||
            (fulfillment.type === 'insight_gained' && typeof fulfillment.insightId === 'string' && fulfillment.insightId) ||
            (fulfillment.type === 'item_acquired' && typeof fulfillment.itemId === 'string' && fulfillment.itemId)
        );
        if (!npcId || !promise?.id || !promise?.text || !validFulfillment) {
            return { recorded: false, reason: 'invalid_promise' };
        }

        const memory = this._ensureNPC(npcId);
        if (!memory) return { recorded: false, reason: 'invalid_context' };
        if (memory.promises.some(item => item.id === promise.id)) {
            return { recorded: false, reason: 'already_recorded' };
        }

        const stored = {
            id: promise.id,
            text: promise.text,
            caseId: promise.caseId || this.currentCaseId,
            fulfillment: this._clone(fulfillment),
            fulfilledTrustDelta: Number.isFinite(promise.fulfilledTrustDelta) ? promise.fulfilledTrustDelta : 3,
            brokenTrustDelta: Number.isFinite(promise.brokenTrustDelta) ? promise.brokenTrustDelta : -6,
            status: 'pending',
            createdAt: Date.now(),
            resolvedAt: null,
            resolutionEvent: null
        };
        memory.promises.push(stored);
        this._append(memory, { type: 'promise_made', promiseId: stored.id, text: stored.text });
        return { recorded: true, promise: this._clone(stored) };
    }

    getPromises(npcId) {
        const memory = this.cases[this.currentCaseId]?.[npcId];
        return Array.isArray(memory?.promises) ? this._clone(memory.promises) : [];
    }

    resolvePromisesForEvent(event) {
        if (!event?.type || !this.currentCaseId) return [];
        const matches = (fulfillment) => {
            if (fulfillment.type !== event.type) return false;
            if (event.type === 'insight_gained') return fulfillment.insightId === event.insightId;
            if (event.type === 'item_acquired') return fulfillment.itemId === event.itemId;
            if (event.type === 'case_solved') return fulfillment.caseId === event.caseId;
            return false;
        };
        const changes = [];
        const caseMemory = this.cases[this.currentCaseId] || {};
        for (const [npcId, memory] of Object.entries(caseMemory)) {
            if (npcId === '__journal' || !Array.isArray(memory?.promises)) continue;
            for (const promise of memory.promises) {
                if (promise.status !== 'pending' || promise.caseId !== this.currentCaseId || !matches(promise.fulfillment || {})) continue;
                promise.status = 'fulfilled';
                promise.resolvedAt = Date.now();
                promise.resolutionEvent = this._clone(event);
                const delta = Number.isFinite(promise.fulfilledTrustDelta) ? promise.fulfilledTrustDelta : 3;
                memory.trust = Math.max(0, Math.min(100, (Number.isFinite(memory.trust) ? memory.trust : 50) + delta));
                memory.pressure = Math.max(0, Math.min(100, (Number.isFinite(memory.pressure) ? memory.pressure : 0) - 2));
                this._append(memory, { type: 'promise_fulfilled', promiseId: promise.id, trustDelta: delta });
                changes.push({ npcId, promiseId: promise.id, status: promise.status, trust: memory.trust });
            }
        }
        return changes;
    }

    settlePromisesForCase(caseId, outcome) {
        if (!caseId || !['solved', 'failed'].includes(outcome)) return [];
        const caseMemory = this.cases[caseId];
        if (!caseMemory) return [];
        const changes = [];
        for (const [npcId, memory] of Object.entries(caseMemory)) {
            if (npcId === '__journal' || !Array.isArray(memory?.promises)) continue;
            for (const promise of memory.promises) {
                if (promise.status !== 'pending' || promise.caseId !== caseId) continue;
                const fulfilledByOutcome = outcome === 'solved' &&
                    promise.fulfillment?.type === 'case_solved' &&
                    promise.fulfillment.caseId === caseId;
                const status = fulfilledByOutcome ? 'fulfilled' : 'broken';
                const delta = fulfilledByOutcome
                    ? (Number.isFinite(promise.fulfilledTrustDelta) ? promise.fulfilledTrustDelta : 3)
                    : (Number.isFinite(promise.brokenTrustDelta) ? promise.brokenTrustDelta : -6);
                promise.status = status;
                promise.resolvedAt = Date.now();
                promise.resolutionEvent = { type: 'case_' + outcome, caseId };
                memory.trust = Math.max(0, Math.min(100, (Number.isFinite(memory.trust) ? memory.trust : 50) + delta));
                memory.pressure = Math.max(0, Math.min(100, (Number.isFinite(memory.pressure) ? memory.pressure : 0) + (fulfilledByOutcome ? -2 : 5)));
                this._append(memory, {
                    type: fulfilledByOutcome ? 'promise_fulfilled' : 'promise_broken',
                    promiseId: promise.id,
                    trustDelta: delta,
                    outcome
                });
                changes.push({ npcId, promiseId: promise.id, status, trust: memory.trust });
            }
        }
        return changes;
    }

    getCaseSocialSummary(caseId = this.currentCaseId) {
        const caseMemory = this.cases[caseId];
        if (!caseMemory) return { caseId, npcs: {} };
        const npcs = {};
        for (const [npcId, memory] of Object.entries(caseMemory)) {
            if (npcId === '__journal') continue;
            const promises = Array.isArray(memory.promises) ? memory.promises : [];
            const rumors = Array.isArray(memory.rumors) ? memory.rumors : [];
            const claims = Array.isArray(memory.claims) ? memory.claims : [];
            npcs[npcId] = {
                trust: Number.isFinite(memory.trust) ? Math.max(0, Math.min(100, memory.trust)) : 50,
                promises: {
                    pending: promises.filter(item => item.status === 'pending').length,
                    fulfilled: promises.filter(item => item.status === 'fulfilled').length,
                    broken: promises.filter(item => item.status === 'broken').length
                },
                rumors: {
                    unverified: rumors.filter(item => item.status === 'unverified').length,
                    corroborated: rumors.filter(item => item.status === 'corroborated').length,
                    disputed: rumors.filter(item => item.status === 'disputed').length
                },
                claims: {
                    active: claims.filter(item => item.status !== 'superseded').length,
                    superseded: claims.filter(item => item.status === 'superseded').length
                },
                liesExposed: Array.isArray(memory.liesExposed) ? memory.liesExposed.length : 0
            };
        }
        return { caseId, npcs };
    }

    toJSON() {
        return {
            version: this.version,
            currentCaseId: this.currentCaseId,
            cases: this._clone(this.cases)
        };
    }

    static fromJSON(json, currentCaseId = null) {
        return new NPCMemoryService(json, currentCaseId);
    }

    _clone(value) {
        return JSON.parse(JSON.stringify(value));
    }
}
