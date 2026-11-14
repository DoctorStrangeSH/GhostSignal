/**
 * NPCMemoryService
 * Stores per-case NPC interaction history, trust, presented evidence and claims.
 * Claims are explicit narrative facts; contradictions are only raised when two
 * claims share a topic but assert different normalized values.
 */
class NPCMemoryService {
    constructor(snapshot = null, currentCaseId = null) {
        this.version = 10;
        this.currentCaseId = currentCaseId || snapshot?.currentCaseId || null;
        this.cases = this._clone(snapshot?.cases || {});
        this.people = this._clone(snapshot?.people || {});
        // Run the targeted migration before any incoming event can resolve an old promise.
        const legacyPromises = this.cases?.['case-002']?.waiter?.promises;
        if (Array.isArray(legacyPromises)) {
            for (const promise of legacyPromises) {
                if (promise?.id === 'thomas-family-protection' && promise.status === 'pending' &&
                    promise.fulfillment?.type === 'insight_gained' &&
                    promise.fulfillment.insightId === 'full_confession_kane') {
                    promise.fulfillment.insightId = 'thomas_family_protected';
                }
            }
        }
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

    _ensurePerson(npcId) {
        if (!npcId || typeof npcId !== 'string') return null;
        if (!this.people || typeof this.people !== 'object' || Array.isArray(this.people)) this.people = {};
        if (!this.people[npcId] || typeof this.people[npcId] !== 'object') {
            const legacyTrust = this.cases?.[this.currentCaseId]?.[npcId]?.trust;
            this.people[npcId] = {
                trust: Number.isFinite(legacyTrust) ? Math.max(0, Math.min(100, legacyTrust)) : 50,
                familiarity: 0,
                interactions: 0,
                lastSeenCaseId: null,
                lastSeenAt: null,
                memories: [],
                nextMemoryId: 1
            };
        }
        const person = this.people[npcId];
        person.trust = Number.isFinite(person.trust) ? Math.max(0, Math.min(100, person.trust)) : 50;
        person.familiarity = Number.isFinite(person.familiarity) ? Math.max(0, Math.min(100, person.familiarity)) : 0;
        person.interactions = Number.isInteger(person.interactions) ? Math.max(0, person.interactions) : 0;
        person.memories = Array.isArray(person.memories) ? person.memories : [];
        person.nextMemoryId = Number.isInteger(person.nextMemoryId) && person.nextMemoryId > 0
            ? person.nextMemoryId : person.memories.length + 1;
        return person;
    }

    _recordLongTermMemory(npcId, details = {}) {
        const person = this._ensurePerson(npcId);
        if (!person || typeof details.type !== 'string' || !details.type) return null;
        const trustDelta = Number.isFinite(details.trustDelta)
            ? Math.max(-10, Math.min(10, details.trustDelta)) : 0;
        person.trust = Math.max(0, Math.min(100, Math.round((person.trust + trustDelta) * 10) / 10));
        const familiarityDelta = Number.isFinite(details.familiarityDelta) ? details.familiarityDelta : 0;
        person.familiarity = Math.max(0, Math.min(100, person.familiarity + familiarityDelta));
        person.interactions++;
        person.lastSeenCaseId = this.currentCaseId || person.lastSeenCaseId;
        person.lastSeenAt = Date.now();

        const summary = String(details.summary || '').trim().slice(0, 220);
        const importance = Number.isFinite(details.importance)
            ? Math.max(1, Math.min(5, Math.round(details.importance))) : 1;
        const tags = Array.isArray(details.tags)
            ? [...new Set(details.tags.filter(tag => typeof tag === 'string' && /^[a-z0-9_:-]{1,48}$/i.test(tag)))]
            : [];
        if (summary || importance >= 2 || tags.length) {
            const entry = {
                id: npcId + ':memory:' + person.nextMemoryId++,
                type: details.type,
                caseId: this.currentCaseId || null,
                summary: summary || 'Персонаж запомнил важный момент общения.',
                sentiment: ['positive', 'negative', 'neutral', 'mixed'].includes(details.sentiment)
                    ? details.sentiment : 'neutral',
                importance,
                tags,
                trustDelta,
                at: Date.now()
            };
            person.memories.push(entry);
            if (person.memories.length > 60) {
                const removable = person.memories
                    .map((item, index) => ({ item, index }))
                    .filter(item => item.item.importance < 5)
                    .sort((a, b) => a.item.importance - b.item.importance || a.item.at - b.item.at)[0];
                person.memories.splice(removable ? removable.index : 0, 1);
            }
            return this._clone(entry);
        }
        return null;
    }

    getLongTermProfile(npcId) {
        const person = this.people?.[npcId];
        if (!person) return {
            npcId, trust: 50, familiarity: 0, interactions: 0,
            lastSeenCaseId: null, memoryCount: 0, disposition: 'unfamiliar'
        };
        const trust = Number.isFinite(person.trust) ? Math.max(0, Math.min(100, person.trust)) : 50;
        const familiarity = Number.isFinite(person.familiarity) ? Math.max(0, Math.min(100, person.familiarity)) : 0;
        const disposition = trust >= 70 ? 'warm'
            : trust >= 55 ? 'open'
            : trust >= 40 ? 'cautious'
            : trust >= 20 ? 'guarded' : 'hostile';
        return {
            npcId, trust, familiarity,
            interactions: Number.isInteger(person.interactions) ? person.interactions : 0,
            lastSeenCaseId: person.lastSeenCaseId || null,
            memoryCount: Array.isArray(person.memories) ? person.memories.length : 0,
            disposition
        };
    }

    getLongTermMemories(npcId, options = {}) {
        const memories = this.people?.[npcId]?.memories;
        if (!Array.isArray(memories)) return [];
        const tag = typeof options.tag === 'string' ? options.tag : null;
        const limit = Number.isInteger(options.limit) ? Math.max(1, Math.min(60, options.limit)) : 20;
        return this._clone(memories
            .filter(item => !tag || item.tags?.includes(tag))
            .slice()
            .sort((a, b) => b.at - a.at)
            .slice(0, limit));
    }

    hasLongTermMemoryTag(npcId, tag) {
        if (!npcId || !tag) return false;
        return this.people?.[npcId]?.memories?.some(item => item.tags?.includes(tag)) || false;
    }

    _ensureNPC(npcId) {
        if (!npcId || !this.currentCaseId) return null;
        const caseMemory = this._ensureCase();
        if (!caseMemory[npcId]) {
            caseMemory[npcId] = {
                trust: this._ensurePerson(npcId)?.trust ?? 50,
                pressure: 0,
                cooperation: 50,
                cooperationHistory: [],
                conversations: 0,
                dialogueHistory: [],
                presentedEvidence: [],
                claims: [],
                liesExposed: [],
                relationshipTrusts: {},
                accusations: [],
                lastInteraction: null
            };
        }
        const memory = caseMemory[npcId];
        memory.trust = Number.isFinite(memory.trust) ? Math.max(0, Math.min(100, memory.trust)) : 50;
        memory.pressure = Number.isFinite(memory.pressure) ? Math.max(0, Math.min(100, memory.pressure)) : 0;
        memory.cooperation = Number.isFinite(memory.cooperation) ? Math.max(0, Math.min(100, memory.cooperation)) : 50;
        memory.cooperationHistory = Array.isArray(memory.cooperationHistory) ? memory.cooperationHistory : [];
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
        for (const promise of memory.promises) {
            if (!Number.isFinite(promise.fulfilledCooperationDelta)) promise.fulfilledCooperationDelta = 10;
            if (!Number.isFinite(promise.brokenCooperationDelta)) promise.brokenCooperationDelta = -18;
        }
        memory.relationshipTrusts = memory.relationshipTrusts &&
            typeof memory.relationshipTrusts === 'object' && !Array.isArray(memory.relationshipTrusts)
            ? memory.relationshipTrusts
            : {};
        memory.accusations = Array.isArray(memory.accusations) ? memory.accusations : [];
        for (const accusation of memory.accusations) {
            if (!['pending', 'false', 'retracted', 'substantiated'].includes(accusation.status)) accusation.status = 'pending';
            accusation.basisEvidenceIds = Array.isArray(accusation.basisEvidenceIds) ? accusation.basisEvidenceIds : [];
        }
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
        this._recordLongTermMemory(npcId, {
            type: 'conversation', summary: 'Персонаж снова встретился с детективом.',
            sentiment: 'neutral', importance: 1, tags: ['conversation'], familiarityDelta: 1
        });
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
            pressureDelta,
            cooperationDelta: Number.isFinite(answer.cooperationDelta)
                ? Math.max(-25, Math.min(25, answer.cooperationDelta)) : 0
        });
        if (Number.isFinite(answer.cooperationDelta) && answer.cooperationDelta !== 0) {
            this.adjustCooperation(npcId, answer.cooperationDelta, 'player_answer:' + (answer.tone || 'neutral'));
        }
        const tone = answer.tone || 'neutral';
        const memorableTones = {
            reassuring: { importance: 3, tag: 'player_reassured', sentiment: 'positive' },
            threatening: { importance: 4, tag: 'player_threatened', sentiment: 'negative' },
            aggressive: { importance: 3, tag: 'player_aggressive', sentiment: 'negative' },
            calm: { importance: 1, tag: 'player_calm', sentiment: 'positive' }
        };
        const memoryTone = memorableTones[tone];
        const explicitImportance = Number.isFinite(answer.memoryImportance) ? answer.memoryImportance : null;
        const importance = explicitImportance ?? memoryTone?.importance ?? 0;
        if (importance >= 2 || answer.remember === true) {
            this._recordLongTermMemory(npcId, {
                type: 'player_interaction',
                summary: answer.memorySummary || answer.text || 'Детектив оставил сильное впечатление.',
                sentiment: memoryTone?.sentiment || (trustDelta > 0 ? 'positive' : trustDelta < 0 ? 'negative' : 'neutral'),
                importance: importance || 2,
                tags: [...(memoryTone ? [memoryTone.tag] : []), ...(Array.isArray(answer.memoryTags) ? answer.memoryTags : [])],
                trustDelta: trustDelta * 0.25
            });
        } else if (trustDelta !== 0) {
            this._recordLongTermMemory(npcId, {
                type: 'lasting_impression',
                trustDelta: trustDelta * 0.15,
                importance: 1
            });
        }
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
        const activeTopicClaims = claim.revisesActiveClaimTopic === true
            ? memory.claims.filter(existing => existing.topic === claim.topic && existing.status !== 'superseded')
            : [];
        if (claim.revisesActiveClaimTopic === true && activeTopicClaims.length !== 1) {
            return {
                added: false,
                reason: activeTopicClaims.length ? 'revision_source_ambiguous' : 'active_claim_not_found',
                contradictions: this.getContradictions()
            };
        }
        const previous = claim.revisesClaimId
            ? memory.claims.find(existing => existing.id === claim.revisesClaimId)
            : activeTopicClaims[0] || null;
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

    receiveSocialRumor(recipientNpcId, report, transmission = {}) {
        if (!recipientNpcId || !report?.id || !report?.text || !report?.kind ||
            !transmission.fromNpcId || !transmission.originalSourceNpcId ||
            !transmission.sourceEvent?.dialogueId || !transmission.sourceEvent?.nodeId ||
            !transmission.sourceEvent?.answerText) return { received: false, reason: 'invalid_transmission' };
        const recipient = this._ensureNPC(recipientNpcId);
        if (!recipient) return { received: false, reason: 'invalid_context' };
        if (recipient.rumors.some(item => item.id === report.id)) return { received: false, reason: 'already_received' };
        const sourceTrust = Number.isFinite(transmission.recipientTrust)
            ? Math.max(0, Math.min(100, transmission.recipientTrust))
            : this.getRelationshipTrust(recipientNpcId, transmission.fromNpcId);
        const hops = Number.isInteger(transmission.hops) ? Math.max(1, transmission.hops) : 1;
        const rumor = {
            id: report.id, kind: report.kind, text: String(report.text).slice(0, 500),
            targetNpcId: report.targetNpcId || null,
            reportedBy: transmission.fromNpcId,
            reportedByName: transmission.fromNpcName || transmission.fromNpcId,
            originalSourceNpcId: transmission.originalSourceNpcId,
            originalSourceName: transmission.originalSourceName || transmission.originalSourceNpcId,
            sourceDialogueId: transmission.sourceEvent.dialogueId,
            sourceNodeId: transmission.sourceEvent.nodeId,
            sourceAnswerText: transmission.sourceEvent.answerText,
            tone: transmission.sourceEvent.tone || 'neutral',
            sourceTrust,
            confidence: Math.max(0, Math.min(100, Math.round(30 + sourceTrust * 0.6 - Math.max(0, hops - 1) * 5))),
            corroborations: [], challenges: [], status: 'unverified',
            transmissionPath: Array.isArray(transmission.path) ? [...transmission.path] : [transmission.originalSourceNpcId, recipientNpcId],
            hops, channel: transmission.channel || 'message',
            receivedAtGameMinute: Number.isFinite(transmission.receivedAtGameMinute) ? transmission.receivedAtGameMinute : null,
            at: Date.now()
        };
        recipient.rumors.push(rumor);
        this._append(recipient, {
            type: 'rumor_received', rumorId: rumor.id, fromNpcId: transmission.fromNpcId,
            originalSourceNpcId: transmission.originalSourceNpcId, channel: rumor.channel, hops
        });
        return { received: true, rumor: this._clone(rumor) };
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
        if (!witnessNpcId || witnessNpcId === rumor.reportedBy || witnessNpcId === rumor.originalSourceNpcId) {
            return { corroborated: false, reason: 'not_independent' };
        }
        const witnessMemory = this.cases[this.currentCaseId]?.[witnessNpcId];
        const claim = witnessMemory?.claims?.find(item => item.id === claimId);
        if (!claim?.directObservation || claim.status === 'superseded' || !claim.corroboratesRumorIds?.includes(rumorId)) {
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
        if (!witnessNpcId || witnessNpcId === rumor.reportedBy || witnessNpcId === rumor.originalSourceNpcId) {
            return { challenged: false, reason: 'not_independent' };
        }
        const witnessMemory = this.cases[this.currentCaseId]?.[witnessNpcId];
        const claim = witnessMemory?.claims?.find(item => item.id === claimId);
        if (!claim?.directObservation || claim.status === 'superseded' || !claim.refutesRumorIds?.includes(rumorId)) {
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

    hasClaim(npcId, claimId) {
        return Boolean(this.cases[this.currentCaseId]?.[npcId]?.claims?.some(claim =>
            claim.id === claimId && claim.status !== 'superseded'
        ));
    }

    hasClaimTopic(npcId, topic) {
        if (!npcId || !topic) return false;
        return Boolean(this.cases[this.currentCaseId]?.[npcId]?.claims?.some(claim =>
            claim.topic === topic && claim.status !== 'superseded'
        ));
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
        return this.cases[this.currentCaseId]?.[npcId]?.trust ?? this.people?.[npcId]?.trust ?? 50;
    }

    getPressure(npcId) {
        return this.cases[this.currentCaseId]?.[npcId]?.pressure ?? 0;
    }

    _adjustCooperationMemory(memory, npcId, delta, reason = 'unspecified') {
        if (!memory || !Number.isFinite(delta)) return null;
        memory.dialogueHistory = Array.isArray(memory.dialogueHistory) ? memory.dialogueHistory : [];
        const before = Number.isFinite(memory.cooperation) ? Math.max(0, Math.min(100, memory.cooperation)) : 50;
        const after = Math.max(0, Math.min(100, before + Math.max(-25, Math.min(25, delta))));
        memory.cooperation = after;
        memory.cooperationHistory = Array.isArray(memory.cooperationHistory) ? memory.cooperationHistory : [];
        if (after === before) return after;
        const entry = { delta: after - before, before, after, reason: String(reason || 'unspecified').slice(0, 100), at: Date.now() };
        memory.cooperationHistory.push(entry);
        if (memory.cooperationHistory.length > 40) memory.cooperationHistory.splice(0, memory.cooperationHistory.length - 40);
        this._append(memory, { type: 'cooperation_changed', ...entry });
        return after;
    }

    adjustCooperation(npcId, delta, reason = 'unspecified') {
        const memory = this._ensureNPC(npcId);
        return this._adjustCooperationMemory(memory, npcId, delta, reason);
    }

    getCooperationState(npcId, profile = {}) {
        if (!npcId || !this.currentCaseId) return null;
        const memory = this.cases[this.currentCaseId]?.[npcId] || {};
        const base = Number.isFinite(memory.cooperation) ? Math.max(0, Math.min(100, memory.cooperation)) : 50;
        const trust = Number.isFinite(memory.trust) ? Math.max(0, Math.min(100, memory.trust)) : 50;
        const pressure = Number.isFinite(memory.pressure) ? Math.max(0, Math.min(100, memory.pressure)) : 0;
        const longTermTrust = this.people?.[npcId]?.trust ?? 50;
        const resistance = Number.isFinite(profile.cooperationResistance)
            ? Math.max(0, Math.min(1, profile.cooperationResistance)) : 0.35;
        const score = Math.max(0, Math.min(100,
            base + (trust - 50) * 0.2 + (longTermTrust - 50) * 0.1 - pressure * (1 - resistance) * 0.35
        ));
        const thresholds = profile.cooperationThresholds || {};
        const withdrawn = Number.isFinite(thresholds.withdrawn) ? thresholds.withdrawn : 20;
        const reluctant = Number.isFinite(thresholds.reluctant) ? thresholds.reluctant : 40;
        const guarded = Number.isFinite(thresholds.guarded) ? thresholds.guarded : 60;
        const willing = Number.isFinite(thresholds.willing) ? thresholds.willing : 80;
        const state = score <= withdrawn ? 'withdrawn'
            : score <= reluctant ? 'reluctant'
            : score <= guarded ? 'guarded'
            : score <= willing ? 'willing' : 'ready';
        const labels = {
            withdrawn: 'Отказывается сотрудничать',
            reluctant: 'Неохотно сотрудничает',
            guarded: 'Осторожно готов говорить',
            willing: 'Готов сотрудничать',
            ready: 'Открыт к сотрудничеству'
        };
        return {
            score: Math.round(score * 10) / 10,
            state,
            label: profile.cooperationLabels?.[state] || labels[state],
            pressureResistance: resistance
        };
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
            liesExposed: memory.liesExposed.length,
            cooperation: (() => {
                const state = this.getCooperationState(npcId, profile);
                return state ? { state: state.state, label: state.label } : null;
            })()
        };
    }

    adjustTrust(npcId, delta) {
        const memory = this._ensureNPC(npcId);
        if (!memory || !Number.isFinite(delta)) return null;
        memory.trust = Math.max(0, Math.min(100, memory.trust + delta));
        this._append(memory, { type: 'trust_changed', delta, trust: memory.trust });
        return memory.trust;
    }

    recordAccusation(npcId, accusation) {
        if (!npcId || !accusation?.id || !accusation?.text) return { recorded: false, reason: 'invalid_accusation' };
        const memory = this._ensureNPC(npcId);
        if (!memory) return { recorded: false, reason: 'invalid_context' };
        if (memory.accusations.some(item => item.id === accusation.id)) return { recorded: false, reason: 'already_recorded' };
        const stored = {
            id: accusation.id,
            text: String(accusation.text).slice(0, 300),
            status: 'pending',
            basisEvidenceIds: Array.isArray(accusation.basisEvidenceIds)
                ? [...new Set(accusation.basisEvidenceIds.filter(id => typeof id === 'string' && id.trim()))]
                : [],
            dialogueId: accusation.dialogueId || null,
            nodeId: accusation.nodeId || null,
            createdAt: Date.now(),
            resolvedAt: null,
            resolutionReason: null
        };
        memory.accusations.push(stored);
        this._append(memory, { type: 'accusation_made', accusationId: stored.id, text: stored.text });
        return { recorded: true, accusation: this._clone(stored) };
    }

    getAccusations(npcId) {
        const memory = this.cases[this.currentCaseId]?.[npcId];
        return Array.isArray(memory?.accusations) ? this._clone(memory.accusations) : [];
    }

    hasAccusation(npcId, accusationId) {
        return this.cases[this.currentCaseId]?.[npcId]?.accusations?.some(item => item.id === accusationId) || false;
    }

    getAccusationStatus(npcId, accusationId) {
        const accusations = this.cases[this.currentCaseId]?.[npcId]?.accusations;
        return Array.isArray(accusations)
            ? (accusations.find(item => item.id === accusationId)?.status || null)
            : null;
    }

    resolveAccusation(npcId, accusationId, outcome, reason = '') {
        if (!['false', 'retracted', 'substantiated'].includes(outcome)) return { resolved: false, reason: 'invalid_outcome' };
        const memory = this._ensureNPC(npcId);
        const accusation = memory?.accusations.find(item => item.id === accusationId);
        if (!accusation) return { resolved: false, reason: 'accusation_not_found' };
        if (accusation.status !== 'pending') return { resolved: false, reason: 'already_resolved' };
        accusation.status = outcome;
        accusation.resolvedAt = Date.now();
        accusation.resolutionReason = String(reason || '').slice(0, 500);
        const effects = {
            false: { trust: -10, pressure: 8, cooperation: -18 },
            retracted: { trust: -3, pressure: 2, cooperation: -8 },
            substantiated: { trust: 1, pressure: -2, cooperation: 3 }
        }[outcome];
        const lastingEffects = { false: -5, retracted: -2, substantiated: 0.5 };
        memory.trust = Math.max(0, Math.min(100, memory.trust + effects.trust));
        memory.pressure = Math.max(0, Math.min(100, memory.pressure + effects.pressure));
        this._adjustCooperationMemory(memory, npcId, effects.cooperation, 'accusation:' + outcome);
        this._append(memory, { type: 'accusation_resolved', accusationId, outcome, reason: accusation.resolutionReason, trustDelta: effects.trust, pressureDelta: effects.pressure });
        this._recordLongTermMemory(npcId, {
            type: 'accusation_resolved',
            summary: outcome === 'false' ? 'Детектив обвинил персонажа без достаточных оснований.'
                : outcome === 'retracted' ? 'Детектив отозвал обвинение.' : 'Обвинение подтвердилось.',
            sentiment: outcome === 'substantiated' ? 'mixed' : 'negative',
            importance: outcome === 'false' ? 5 : outcome === 'retracted' ? 3 : 2,
            tags: [outcome === 'false' ? 'false_accusation' : outcome === 'retracted' ? 'accusation_retracted' : 'accurate_accusation'],
            trustDelta: lastingEffects[outcome]
        });
        return { resolved: true, accusation: this._clone(accusation), trust: memory.trust, pressure: memory.pressure };
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
            fulfilledCooperationDelta: Number.isFinite(promise.fulfilledCooperationDelta) ? promise.fulfilledCooperationDelta : 10,
            brokenCooperationDelta: Number.isFinite(promise.brokenCooperationDelta) ? promise.brokenCooperationDelta : -18,
            status: 'pending',
            createdAt: Date.now(),
            resolvedAt: null,
            resolutionEvent: null
        };
        memory.promises.push(stored);
        this._append(memory, { type: 'promise_made', promiseId: stored.id, text: stored.text });
        this._recordLongTermMemory(npcId, {
            type: 'promise_made', summary: stored.text, sentiment: 'mixed', importance: 3,
            tags: ['promise_made'], trustDelta: 0
        });
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
                const cooperationDelta = Number.isFinite(promise.fulfilledCooperationDelta)
                    ? promise.fulfilledCooperationDelta : 10;
                this._adjustCooperationMemory(memory, npcId, cooperationDelta, 'promise_fulfilled:' + promise.id);
                this._append(memory, { type: 'promise_fulfilled', promiseId: promise.id, trustDelta: delta });
                this._recordLongTermMemory(npcId, {
                    type: 'promise_kept', summary: promise.text, sentiment: 'positive', importance: 4,
                    tags: ['promise_kept'], trustDelta: Math.max(0, delta) * 0.5
                });
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
                const cooperationDelta = fulfilledByOutcome
                    ? (Number.isFinite(promise.fulfilledCooperationDelta) ? promise.fulfilledCooperationDelta : 10)
                    : (Number.isFinite(promise.brokenCooperationDelta) ? promise.brokenCooperationDelta : -18);
                this._adjustCooperationMemory(
                    memory, npcId, cooperationDelta,
                    (fulfilledByOutcome ? 'promise_fulfilled:' : 'promise_broken:') + promise.id
                );
                this._append(memory, {
                    type: fulfilledByOutcome ? 'promise_fulfilled' : 'promise_broken',
                    promiseId: promise.id,
                    trustDelta: delta,
                    outcome
                });
                this._recordLongTermMemory(npcId, {
                    type: fulfilledByOutcome ? 'promise_kept' : 'promise_broken',
                    summary: promise.text,
                    sentiment: fulfilledByOutcome ? 'positive' : 'negative',
                    importance: 5,
                    tags: [fulfilledByOutcome ? 'promise_kept' : 'promise_broken'],
                    trustDelta: fulfilledByOutcome ? Math.max(0, delta) * 0.5 : Math.min(0, delta) * 0.65
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
                liesExposed: Array.isArray(memory.liesExposed) ? memory.liesExposed.length : 0,
                accusations: {
                    pending: (Array.isArray(memory.accusations) ? memory.accusations : []).filter(item => item.status === 'pending').length,
                    false: (Array.isArray(memory.accusations) ? memory.accusations : []).filter(item => item.status === 'false').length,
                    retracted: (Array.isArray(memory.accusations) ? memory.accusations : []).filter(item => item.status === 'retracted').length,
                    substantiated: (Array.isArray(memory.accusations) ? memory.accusations : []).filter(item => item.status === 'substantiated').length
                }
            };
        }
        return { caseId, npcs };
    }

    toJSON() {
        return {
            version: this.version,
            currentCaseId: this.currentCaseId,
            cases: this._clone(this.cases),
            people: this._clone(this.people)
        };
    }

    static fromJSON(json, currentCaseId = null) {
        return new NPCMemoryService(json, currentCaseId);
    }

    _clone(value) {
        return JSON.parse(JSON.stringify(value));
    }
}
