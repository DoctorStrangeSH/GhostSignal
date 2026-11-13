/**
 * NPCSocialNetwork
 * Case-authored social graph with time-gated, attributed rumor delivery.
 */
class NPCSocialNetwork {
    constructor(snapshot = null, memoryService = null, npcManager = null, gameTime = null) {
        this.version = 2;
        this.currentCaseId = snapshot?.currentCaseId || null;
        this.cases = this._clone(snapshot?.cases || {});
        this.memoryService = memoryService;
        this.npcManager = npcManager;
        this.gameTime = gameTime;
        this.caseConfig = null;
    }

    setDependencies(memoryService, npcManager, gameTime) {
        this.memoryService = memoryService || null;
        this.npcManager = npcManager || null;
        this.gameTime = gameTime || null;
    }

    setCase(caseData) {
        if (!caseData?.id || typeof caseData.id !== 'string') return false;
        this.currentCaseId = caseData.id;
        this.caseConfig = this._normalizeConfig(caseData.socialNetwork);
        const state = this._ensureState();
        const activeIds = new Set(Array.isArray(caseData.npcs) ? caseData.npcs : []);
        for (const edge of this.caseConfig.edges) {
            if (!activeIds.has(edge.from) || !activeIds.has(edge.to)) continue;
            const existing = this.memoryService?.getMemory(edge.from)?.relationshipTrusts?.[edge.to];
            if (!Number.isFinite(existing)) this.memoryService?.setRelationshipTrust(edge.from, edge.to, edge.trust);
        }
        return Boolean(state);
    }

    _normalizeConfig(config) {
        const edges = Array.isArray(config?.edges) ? config.edges : [];
        return {
            maxHops: Number.isInteger(config?.maxHops) ? Math.max(1, Math.min(5, config.maxHops)) : 2,
            retryMinutes: Number.isInteger(config?.retryMinutes) ? Math.max(5, config.retryMinutes) : 15,
            expiryMinutes: Number.isInteger(config?.expiryMinutes) ? Math.max(30, config.expiryMinutes) : 360,
            edges: edges.filter(edge =>
                edge && typeof edge.from === 'string' && typeof edge.to === 'string' &&
                edge.from !== edge.to && typeof edge.relationship === 'string' &&
                ['in_person', 'phone', 'message'].includes(edge.channel)
            ).map(edge => ({
                ...edge,
                trust: Number.isFinite(edge.trust) ? Math.max(0, Math.min(100, edge.trust)) : 50,
                delayMinutes: Number.isFinite(edge.delayMinutes) ? Math.max(1, edge.delayMinutes) : 15,
                minTrustToShare: Number.isFinite(edge.minTrustToShare) ? Math.max(0, Math.min(100, edge.minTrustToShare)) : 0,
                shareTypes: Array.isArray(edge.shareTypes) ? edge.shareTypes : ['detective_behavior'],
                protectsNpcIds: Array.isArray(edge.protectsNpcIds) ? edge.protectsNpcIds : [],
                canForward: edge.canForward === true,
                withholdIfTargetProtected: edge.withholdIfTargetProtected === true
            }))
        };
    }

    _ensureState(caseId = this.currentCaseId) {
        if (!caseId) return null;
        if (!this.cases[caseId] || typeof this.cases[caseId] !== 'object') {
            this.cases[caseId] = { pending: [], delivered: [], withheld: [], publishedIds: [], eventLog: [], nextEventId: 1 };
        }
        const state = this.cases[caseId];
        state.pending = Array.isArray(state.pending) ? state.pending : [];
        state.delivered = Array.isArray(state.delivered) ? state.delivered : [];
        state.withheld = Array.isArray(state.withheld) ? state.withheld : [];
        state.publishedIds = Array.isArray(state.publishedIds) ? state.publishedIds : [];
        state.eventLog = Array.isArray(state.eventLog) ? state.eventLog : [];
        state.nextEventId = Number.isInteger(state.nextEventId) && state.nextEventId > 0
            ? state.nextEventId
            : state.eventLog.length + 1;
        return state;
    }

    _now() {
        const day = Math.max(1, Number(this.gameTime?.day) || 1);
        const hour = Math.max(0, Math.min(23, Number(this.gameTime?.hour) || 0));
        const minute = Math.max(0, Math.min(59, Number(this.gameTime?.minute) || 0));
        return (day - 1) * 1440 + hour * 60 + minute;
    }

    _name(npcId) {
        if (typeof getNPCById === 'function') {
            const npc = getNPCById(npcId);
            if (npc?.name) return npc.name;
        }
        return npcId;
    }

    _recordEvent(type, details = {}) {
        const state = this._ensureState();
        if (!state) return null;
        const now = this._now();
        const minuteOfDay = now % 1440;
        const hour = Math.floor(minuteOfDay / 60);
        const minute = minuteOfDay % 60;
        const event = {
            id: `${this.currentCaseId}:social:${state.nextEventId++}`,
            type,
            atGameMinute: now,
            day: Math.floor(now / 1440) + 1,
            time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
            fromNpcId: details.fromNpcId || null,
            fromName: details.fromNpcId ? this._name(details.fromNpcId) : null,
            toNpcId: details.toNpcId || null,
            toName: details.toNpcId ? this._name(details.toNpcId) : null,
            reportId: details.reportId || null,
            reportKind: details.reportKind || null,
            summary: String(details.summary || '').slice(0, 240),
            channel: details.channel || null,
            relationship: details.relationship || null,
            protectedNpcId: details.protectedNpcId || null,
            protectedNpcName: details.protectedNpcId ? this._name(details.protectedNpcId) : null,
            reason: details.reason || null,
            path: Array.isArray(details.path) ? [...details.path] : [],
            dueAt: Number.isFinite(details.dueAt) ? details.dueAt : null
        };
        state.eventLog.push(event);
        if (state.eventLog.length > 300) state.eventLog.splice(0, state.eventLog.length - 300);
        return event;
    }

    _queueOutgoing(fromNpcId, report, sourceEvent, context) {
        const state = this._ensureState();
        if (!state || !this.caseConfig || context.hops >= this.caseConfig.maxHops) return 0;
        let queued = 0;
        const now = this._now();
        const path = Array.isArray(context.path) ? context.path : [context.originalSourceNpcId];

        for (const edge of this.caseConfig.edges.filter(item => item.from === fromNpcId)) {
            if (path.includes(edge.to)) continue;
            if (!edge.shareTypes.includes('*') && !edge.shareTypes.includes(report.kind)) continue;
            const senderTrust = this.memoryService?.getRelationshipTrust(fromNpcId, edge.to) ?? edge.trust;
            if (senderTrust < edge.minTrustToShare) continue;

            const protectedTarget = report.targetNpcId && edge.protectsNpcIds.includes(report.targetNpcId);
            if (protectedTarget && edge.withholdIfTargetProtected) {
                const withheldId = report.id + '::' + path.join('>') + '::' + edge.to;
                if (!state.withheld.some(item => item.id === withheldId)) {
                    state.withheld.push({
                        id: withheldId, rumorId: report.id, fromNpcId, toNpcId: edge.to,
                        protectedNpcId: report.targetNpcId, relationship: edge.relationship,
                        atGameMinute: now, reason: 'protecting_relationship'
                    });
                    this._recordEvent('withheld', {
                        fromNpcId, toNpcId: edge.to, reportId: report.id,
                        reportKind: report.kind, protectedNpcId: report.targetNpcId,
                        relationship: edge.relationship, channel: edge.channel,
                        path: [...path, edge.to], reason: 'protecting_relationship',
                        summary: `Сведения затрагивали ${this._name(report.targetNpcId)}; передача остановлена из-за защитной связи.`
                    });
                }
                continue;
            }

            const deliveryId = report.id + '::' + path.join('>') + '::' + edge.to;
            if (state.pending.some(item => item.id === deliveryId) ||
                state.delivered.some(item => item.id === deliveryId)) continue;

            state.pending.push({
                id: deliveryId, rumorId: report.id, fromNpcId, toNpcId: edge.to,
                relationship: edge.relationship, channel: edge.channel, edgeId: edge.id || null,
                dueAt: now + edge.delayMinutes, expiresAt: now + this.caseConfig.expiryMinutes,
                report: this._clone(report), sourceEvent: this._clone(sourceEvent),
                originalSourceNpcId: context.originalSourceNpcId,
                originalSourceName: context.originalSourceName,
                path: [...path, edge.to], hops: context.hops + 1,
                canForward: edge.canForward,
                recipientTrust: this.memoryService?.getRelationshipTrust(edge.to, fromNpcId) ?? 50
            });
            this._recordEvent('scheduled', {
                fromNpcId, toNpcId: edge.to, reportId: report.id, reportKind: report.kind,
                summary: report.text, channel: edge.channel, relationship: edge.relationship,
                path: [...path, edge.to], dueAt: now + edge.delayMinutes
            });
            queued++;
        }
        return queued;
    }

    publish(fromNpcId, report, sourceEvent) {
        if (!this.currentCaseId || !fromNpcId || !report?.id || !report?.text || !report?.kind ||
            !sourceEvent?.dialogueId || !sourceEvent?.nodeId || !sourceEvent?.answerText) {
            return { published: false, reason: 'invalid_report' };
        }
        const sourceMemory = this.memoryService?.getMemory(fromNpcId);
        const witnessed = sourceMemory?.dialogueHistory?.some(entry =>
            entry.type === 'answer' && entry.dialogueId === sourceEvent.dialogueId &&
            entry.nodeId === sourceEvent.nodeId && entry.answerText === sourceEvent.answerText
        );
        if (!witnessed) return { published: false, reason: 'source_event_not_found' };

        const state = this._ensureState();
        if (state.publishedIds.includes(report.id)) return { published: false, reason: 'already_published' };
        state.publishedIds.push(report.id);
        this._recordEvent('reported', {
            fromNpcId, reportId: report.id, reportKind: report.kind,
            summary: report.text, reason: 'source_dialogue'
        });
        const queued = this._queueOutgoing(fromNpcId, report, sourceEvent, {
            originalSourceNpcId: fromNpcId,
            originalSourceName: report.sourceName || this._name(fromNpcId),
            path: [fromNpcId],
            hops: 0
        });
        return { published: true, queued };
    }

    _canDeliver(delivery) {
        if (!this.npcManager?.isNPCAvailable) return false;
        const sender = this.npcManager.isNPCAvailable(delivery.fromNpcId);
        const recipient = this.npcManager.isNPCAvailable(delivery.toNpcId);
        if (!recipient?.available) return false;
        if (delivery.channel === 'message') return true;
        if (!sender?.available) return false;
        if (delivery.channel === 'in_person') {
            return Boolean(sender.location && recipient.location && sender.location === recipient.location);
        }
        if (delivery.channel === 'phone') {
            // NPC-to-NPC calls are independent of whether the player may call them.
            return Boolean(sender?.available && recipient?.available);
        }
        return false;
    }

    processDueDeliveries() {
        const state = this._ensureState();
        if (!state || !this.memoryService) return { delivered: 0, deferred: 0, expired: 0, processed: 0 };
        const now = this._now();
        const due = state.pending.filter(item => Number.isFinite(item.dueAt) && item.dueAt <= now)
            .sort((a, b) => a.dueAt - b.dueAt);
        let delivered = 0, deferred = 0, expired = 0, processed = 0;

        for (const item of due) {
            processed++;
            if (item.expiresAt < now) {
                state.pending = state.pending.filter(entry => entry.id !== item.id);
                state.delivered.push({ id: item.id, status: 'expired', atGameMinute: now });
                this._recordEvent('expired', {
                    fromNpcId: item.fromNpcId, toNpcId: item.toNpcId, reportId: item.rumorId,
                    reportKind: item.report?.kind, summary: item.report?.text,
                    channel: item.channel, relationship: item.relationship,
                    path: item.path, reason: 'delivery_window_expired'
                });
                expired++;
                continue;
            }
            if (!this._canDeliver(item)) {
                if (!item.deferLogged) {
                    this._recordEvent('delayed', {
                        fromNpcId: item.fromNpcId, toNpcId: item.toNpcId, reportId: item.rumorId,
                        reportKind: item.report?.kind, channel: item.channel,
                        relationship: item.relationship, path: item.path,
                        reason: 'participants_unavailable',
                        summary: 'Передача отложена: участники пока не могут связаться.'
                    });
                    item.deferLogged = true;
                }
                item.dueAt = Math.min(now + this.caseConfig.retryMinutes, item.expiresAt);
                deferred++;
                continue;
            }

            const received = this.memoryService.receiveSocialRumor(item.toNpcId, item.report, {
                fromNpcId: item.fromNpcId, fromNpcName: this._name(item.fromNpcId),
                originalSourceNpcId: item.originalSourceNpcId,
                originalSourceName: item.originalSourceName,
                sourceEvent: item.sourceEvent, path: item.path, hops: item.hops,
                channel: item.channel, recipientTrust: item.recipientTrust,
                receivedAtGameMinute: now
            });
            state.pending = state.pending.filter(entry => entry.id !== item.id);
            state.delivered.push({
                id: item.id, rumorId: item.rumorId, fromNpcId: item.fromNpcId,
                toNpcId: item.toNpcId, status: received.received ? 'delivered' : 'duplicate',
                atGameMinute: now
            });
            this._recordEvent(received.received ? 'delivered' : 'duplicate', {
                fromNpcId: item.fromNpcId, toNpcId: item.toNpcId, reportId: item.rumorId,
                reportKind: item.report?.kind, summary: item.report?.text,
                channel: item.channel, relationship: item.relationship, path: item.path,
                reason: received.received ? null : 'already_received'
            });
            if (!received.received) continue;
            delivered++;
            if (item.canForward && item.hops < this.caseConfig.maxHops) {
                this._queueOutgoing(item.toNpcId, item.report, item.sourceEvent, {
                    originalSourceNpcId: item.originalSourceNpcId,
                    originalSourceName: item.originalSourceName,
                    path: item.path, hops: item.hops
                });
            }
        }
        if (state.delivered.length > 200) state.delivered.splice(0, state.delivered.length - 200);
        if (state.withheld.length > 100) state.withheld.splice(0, state.withheld.length - 100);
        return { delivered, deferred, expired, processed };
    }

    getRelationshipsForNPC(npcId) {
        if (!npcId || !this.caseConfig) return [];
        const links = new Map();
        for (const edge of this.caseConfig.edges.filter(item => item.from === npcId || item.to === npcId)) {
            const otherNpcId = edge.from === npcId ? edge.to : edge.from;
            const direction = edge.from === npcId ? 'outgoing' : 'incoming';
            const existing = links.get(otherNpcId);
            if (existing) {
                existing.direction = existing.direction === direction ? direction : 'mutual';
                if (!existing.labels.includes(edge.label || edge.relationship)) existing.labels.push(edge.label || edge.relationship);
                if (!existing.channels.includes(edge.channel)) existing.channels.push(edge.channel);
                continue;
            }
            links.set(otherNpcId, {
                npcId: otherNpcId,
                name: this._name(otherNpcId),
                relationship: edge.relationship,
                label: edge.label || edge.relationship,
                labels: [edge.label || edge.relationship],
                direction,
                channels: [edge.channel],
                trust: this.memoryService?.getRelationshipTrust(npcId, otherNpcId) ?? edge.trust
            });
        }
        return [...links.values()].map(link => ({ ...link, label: link.labels.join(' · ') }));
    }

    getEventLog(limit = 30, npcId = null) {
        const log = this._ensureState()?.eventLog || [];
        const relevant = npcId
            ? log.filter(item => item.fromNpcId === npcId || item.toNpcId === npcId || item.protectedNpcId === npcId)
            : log;
        const safeLimit = Number.isInteger(limit) ? Math.max(1, Math.min(100, limit)) : 30;
        return this._clone(relevant.slice(-safeLimit).reverse());
    }

    getPendingDeliveries() { return this._clone(this._ensureState()?.pending || []); }
    getWithheldReports() { return this._clone(this._ensureState()?.withheld || []); }

    resetCase(caseId = this.currentCaseId) {
        if (!caseId) return false;
        delete this.cases[caseId];
        if (caseId === this.currentCaseId) this._ensureState();
        return true;
    }

    toJSON() {
        return { version: this.version, currentCaseId: this.currentCaseId, cases: this._clone(this.cases) };
    }

    static fromJSON(json, memoryService = null, npcManager = null, gameTime = null) {
        return new NPCSocialNetwork(json, memoryService, npcManager, gameTime);
    }

    _clone(value) { return JSON.parse(JSON.stringify(value)); }
}