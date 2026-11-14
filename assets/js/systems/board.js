class InvestigationBoard {
    constructor() {
        this.slots = [];          // Слоты для улик
        this.connections = [];    // Связи между слотами
        this.maxSlots = 6;
        this.evidenceOnBoard = []; // ID улик на доске
        this.hypotheses = [];
        this.sourceInquiries = [];
        this.nextInquiryId = 1;
        this.nextHypothesisId = 1;
        this.caseId = null;
        this._initDefaultSlots();
    }

    _initDefaultSlots() {
        this.slots = [
            { id: 'slot-1', label: 'Мотив', evidenceId: null, x: 15, y: 20 },
            { id: 'slot-2', label: 'Возможность', evidenceId: null, x: 50, y: 20 },
            { id: 'slot-3', label: 'Улика А', evidenceId: null, x: 85, y: 20 },
            { id: 'slot-4', label: 'Улика Б', evidenceId: null, x: 15, y: 70 },
            { id: 'slot-5', label: 'Свидетель', evidenceId: null, x: 50, y: 70 },
            { id: 'slot-6', label: 'Вывод', evidenceId: null, x: 85, y: 70 }
        ];

        this.connections = [
            { from: 'slot-1', to: 'slot-2', type: 'solid' },
            { from: 'slot-2', to: 'slot-3', type: 'solid' },
            { from: 'slot-4', to: 'slot-5', type: 'solid' },
            { from: 'slot-5', to: 'slot-6', type: 'solid' },
            { from: 'slot-1', to: 'slot-4', type: 'dashed' },
            { from: 'slot-3', to: 'slot-6', type: 'dashed' }
        ];
    }

    // Разместить улику на доске
    placeEvidence(evidenceId, slotId) {
        const evidence = getObjectById(evidenceId);
        if (!evidence?.isEvidence) {
            events.emit('notification:show', {
                message: 'Этот предмет не является уликой',
                type: 'warning', duration: 2000
            });
            return false;
        }

        const slot = this.slots.find(s => s.id === slotId);
        if (!slot) return false;

        // Если в слоте уже есть улика — возвращаем старую
        if (slot.evidenceId) {
            this.removeEvidence(slotId);
        }

        // Убираем улику с других слотов если она уже на доске
        this.slots.forEach(s => {
            if (s.evidenceId === evidenceId) {
                s.evidenceId = null;
            }
        });

        slot.evidenceId = evidenceId;

        if (!this.evidenceOnBoard.includes(evidenceId)) {
            this.evidenceOnBoard.push(evidenceId);
        }

        // Убираем улику из инвентаря
        events.emit('inventory:remove', evidenceId);

        events.emit('board:updated', { action: 'place', evidenceId, slotId });
        return true;
    }

    // Убрать улику с доски
    removeEvidence(slotId) {
        const slot = this.slots.find(s => s.id === slotId);
        if (!slot || !slot.evidenceId) return null;

        const evidenceId = slot.evidenceId;
        slot.evidenceId = null;

        this.evidenceOnBoard = this.evidenceOnBoard.filter(id => id !== evidenceId);

        events.emit('inventory:restore_evidence', evidenceId);
        events.emit('board:updated', { action: 'remove', evidenceId, slotId });
        return evidenceId;
    }

    // Проверить, все ли ключевые слоты заполнены
    areKeySlotsFilled() {
        const keySlots = ['slot-1', 'slot-2', 'slot-6'];
        return keySlots.every(slotId => {
            const slot = this.slots.find(s => s.id === slotId);
            return slot?.evidenceId !== null;
        });
    }

    // Получить текущую схему доски
    getBoardState() {
        return {
            slots: this.slots.map(s => ({ ...s })),
            connections: [...this.connections],
            evidenceOnBoard: [...this.evidenceOnBoard]
        };
    }

    // Получить улики, которые ещё не на доске
    getAvailableEvidence(inventoryEvidence) {
        return inventoryEvidence.filter(id => !this.evidenceOnBoard.includes(id));
    }

    // Проверить, сделаны ли правильные выводы
    checkConclusions() {
        // Проверяем ключевые пары
        const pairs = [
            { slot1: 'slot-1', slot2: 'slot-2', insight: 'motive_opportunity_linked' },
            { slot1: 'slot-3', slot2: 'slot-6', insight: 'evidence_conclusion_linked' }
        ];

        const insights = [];

        pairs.forEach(pair => {
            const slot1 = this.slots.find(s => s.id === pair.slot1);
            const slot2 = this.slots.find(s => s.id === pair.slot2);

            if (slot1?.evidenceId && slot2?.evidenceId) {
                // Обе улики на месте — даём озарение
                insights.push(pair.insight);
            }
        });

        return insights;
    }

    // An investigation board belongs to one case, not the entire campaign.
    setCase(caseId, adoptLegacy = false) {
        const id = typeof caseId === 'string' && caseId ? caseId : null;
        if (this.caseId === id) return false;
        if (adoptLegacy && this.caseId === null) {
            this.caseId = id;
            return false;
        }
        this._initDefaultSlots();
        this.evidenceOnBoard = [];
        this.hypotheses = [];
        this.sourceInquiries = [];
        this.nextInquiryId = 1;
        this.nextHypothesisId = 1;
        this.caseId = id;
        events.emit('board:updated', { action: 'case_switched', caseId: id });
        return true;
    }

    // Игрок формулирует версии самостоятельно: привязки не доказывают их истинность.
    addHypothesis(text) {
        const title = String(text ?? '').trim().slice(0, 240);
        if (!title) return null;
        const entry = { id: 'hyp-' + this.nextHypothesisId++, title, status: 'open', links: [], history: [{ action: 'created', title }] };
        this.hypotheses.push(entry);
        events.emit('board:updated', { action: 'hypothesis_created', id: entry.id });
        return entry.id;
    }

    reviseHypothesis(id, text) {
        const entry = this.hypotheses.find(h => h.id === id);
        const title = String(text ?? '').trim().slice(0, 240);
        if (!entry || !title || entry.status !== 'open' || entry.title === title) return false;
        entry.history.push({ action: 'revised', previous: entry.title, title });
        entry.title = title;
        events.emit('board:updated', { action: 'hypothesis_revised', id });
        return true;
    }

    linkHypothesis(id, kind, sourceId, stance) {
        const entry = this.hypotheses.find(h => h.id === id);
        if (!entry || entry.status !== 'open' || !['evidence', 'statement', 'assumption'].includes(kind) ||
            !['for', 'against', 'pending'].includes(stance)) return false;
        const source = String(sourceId ?? '').trim().slice(0, 240);
        if (!source || entry.links.some(link => link.kind === kind && link.sourceId === source)) return false;
        entry.links.push({ kind, sourceId: source, stance });
        entry.history.push({ action: 'linked', kind, sourceId: source, stance });
        events.emit('board:updated', { action: 'hypothesis_linked', id });
        return true;
    }

    unlinkHypothesis(id, index) {
        const entry = this.hypotheses.find(h => h.id === id);
        if (!entry || entry.status !== 'open' || !Number.isInteger(index) || index < 0 || index >= entry.links.length) return false;
        const [link] = entry.links.splice(index, 1);
        entry.history.push({ action: 'unlinked', ...link });
        events.emit('board:updated', { action: 'hypothesis_unlinked', id });
        return true;
    }

    abandonHypothesis(id) {
        const entry = this.hypotheses.find(h => h.id === id);
        if (!entry || entry.status !== 'open') return false;
        entry.status = 'abandoned';
        entry.history.push({ action: 'abandoned' });
        events.emit('board:updated', { action: 'hypothesis_abandoned', id });
        return true;
    }

    // Advisory source audit; it never scores the correctness of a hypothesis.
    reviewHypothesisSources(id, statements = []) {
        const entry = this.hypotheses.find(h => h.id === id);
        if (!entry) return null;
        const byId = new Map((Array.isArray(statements) ? statements : [])
            .filter(item => item && typeof item.id === 'string').map(item => [item.id, item]));
        const sources = entry.links.filter(link => link.kind === 'statement').map(link => {
            const claim = byId.get(link.sourceId);
            return {
                id: link.sourceId,
                npcId: claim?.npcId || null,
                topic: claim?.topic || null,
                status: !claim ? 'missing' : claim.status === 'superseded' ? 'superseded' : 'active',
                origin: !claim ? 'unknown' : claim.directObservation === true ? 'firsthand_claim' : 'unverified',
                linkedRumorIds: claim ? [...new Set([...(Array.isArray(claim.referencesRumorIds) ? claim.referencesRumorIds : []), ...(Array.isArray(claim.corroboratesRumorIds) ? claim.corroboratesRumorIds : []), ...(Array.isArray(claim.refutesRumorIds) ? claim.refutesRumorIds : [])])] : []
            };
        });
        const warnings = [];
        for (const source of sources) {
            if (source.status === 'missing') warnings.push({ type: 'missing', ids: [source.id] });
            if (source.status === 'superseded') warnings.push({ type: 'superseded', ids: [source.id] });
        }
        for (let i = 0; i < sources.length; i++) {
            for (let j = i + 1; j < sources.length; j++) {
                const a = sources[i], b = sources[j];
                if (a.npcId && a.npcId === b.npcId) warnings.push({ type: 'same_witness', ids: [a.id, b.id] });
                const sharedRumors = a.linkedRumorIds.filter(rumor => b.linkedRumorIds.includes(rumor));
                if (sharedRumors.length) warnings.push({ type: 'shared_rumor_reference', ids: [a.id, b.id], rumorIds: sharedRumors });
            }
        }
        return { sources, warnings };
    }

    // A player-authored inquiry: provenance is a lead, not a truth verdict.
    startSourceInquiry(hypothesisId, rumorId, statements = []) {
        const hypothesis = this.hypotheses.find(h => h.id === hypothesisId && h.status === 'open');
        const rumor = String(rumorId ?? '').trim().slice(0, 240);
        if (!hypothesis || !rumor || this.sourceInquiries.some(i => i.hypothesisId === hypothesisId && i.rumorId === rumor)) return null;
        const review = this.reviewHypothesisSources(hypothesisId, statements);
        if (!review?.sources.some(s => s.linkedRumorIds.includes(rumor))) return null;
        const inquiry = { id: 'inquiry-' + this.nextInquiryId++, hypothesisId, rumorId: rumor,
            status: 'open', leads: [], history: [{ action: 'opened', rumorId: rumor }] };
        this.sourceInquiries.push(inquiry);
        events.emit('board:updated', { action: 'inquiry_opened', id: inquiry.id });
        return inquiry.id;
    }

    // A lead must reference information actually discovered by the player.
    addSourceInquiryLead(id, kind, sourceId, note, context = {}) {
        const inquiry = this.sourceInquiries.find(i => i.id === id && i.status === 'open');
        const source = String(sourceId ?? '').trim().slice(0, 240);
        const explanation = String(note ?? '').trim().slice(0, 500);
        if (!inquiry || !source || !explanation || !['statement', 'evidence'].includes(kind)) return false;
        if (kind === 'statement' && !context.statements?.some(s => s.id === source && s.status !== 'superseded')) return false;
        if (kind === 'evidence' && !context.evidenceIds?.includes(source)) return false;
        if (inquiry.leads.some(lead => lead.kind === kind && lead.sourceId === source)) return false;
        const lead = { kind, sourceId: source, note: explanation };
        inquiry.leads.push(lead);
        inquiry.history.push({ action: 'lead_added', ...lead });
        events.emit('board:updated', { action: 'inquiry_lead_added', id });
        return true;
    }

    closeSourceInquiry(id, conclusion) {
        const inquiry = this.sourceInquiries.find(i => i.id === id && i.status === 'open');
        const note = String(conclusion ?? '').trim().slice(0, 500);
        if (!inquiry || !inquiry.leads.length || !note) return false;
        inquiry.status = 'closed';
        inquiry.conclusion = note;
        inquiry.history.push({ action: 'closed', note });
        events.emit('board:updated', { action: 'inquiry_closed', id });
        return true;
    }

    // Сбросить доску
    reset() {
        const evidenceToRestore = [...this.evidenceOnBoard];
        this.slots.forEach(s => s.evidenceId = null);
        this.evidenceOnBoard = [];

        evidenceToRestore.forEach(evidenceId => {
            events.emit('inventory:restore_evidence', evidenceId);
        });
        events.emit('board:updated', { action: 'reset' });
    }

    // Сериализация
    toJSON() {
        return {
            slots: this.slots.map(s => ({ id: s.id, evidenceId: s.evidenceId })),
            evidenceOnBoard: [...this.evidenceOnBoard],
            hypotheses: this.hypotheses.map(h => ({ ...h, links: h.links.map(l => ({ ...l })), history: h.history.map(v => ({ ...v })) })),
            sourceInquiries: this.sourceInquiries.map(i => ({ ...i, leads: i.leads.map(l => ({ ...l })), history: i.history.map(h => ({ ...h })) })),
            nextInquiryId: this.nextInquiryId,
            nextHypothesisId: this.nextHypothesisId,
            caseId: this.caseId
        };
    }

    // Восстановление
    static fromJSON(json) {
        const board = new InvestigationBoard();
        if (json) {
            json.slots?.forEach(savedSlot => {
                const slot = board.slots.find(s => s.id === savedSlot.id);
                if (slot && savedSlot.evidenceId) {
                    slot.evidenceId = savedSlot.evidenceId;
                }
            });
            board.evidenceOnBoard = Array.isArray(json.evidenceOnBoard) ? json.evidenceOnBoard : [];
            board.caseId = typeof json.caseId === 'string' ? json.caseId : null;
            board.hypotheses = Array.isArray(json.hypotheses) ? json.hypotheses.filter(h => h && typeof h.id === 'string' && typeof h.title === 'string').map(h => ({
                id: h.id, title: h.title, status: h.status === 'abandoned' ? 'abandoned' : 'open',
                links: Array.isArray(h.links) ? h.links.filter(l => l && ['evidence', 'statement', 'assumption'].includes(l.kind) && ['for', 'against', 'pending'].includes(l.stance) && typeof l.sourceId === 'string') : [],
                history: Array.isArray(h.history) ? h.history.filter(v => v && typeof v.action === 'string') : []
            })) : [];
            board.sourceInquiries = Array.isArray(json.sourceInquiries) ? json.sourceInquiries.filter(i =>
                i && typeof i.id === 'string' && typeof i.hypothesisId === 'string' && typeof i.rumorId === 'string' &&
                board.hypotheses.some(h => h.id === i.hypothesisId)).map(i => ({
                id: i.id, hypothesisId: i.hypothesisId, rumorId: i.rumorId,
                status: i.status === 'closed' ? 'closed' : 'open',
                conclusion: typeof i.conclusion === 'string' ? i.conclusion : undefined,
                leads: Array.isArray(i.leads) ? i.leads.filter(l => l && ['statement', 'evidence'].includes(l.kind) && typeof l.sourceId === 'string' && typeof l.note === 'string').map(l => ({ ...l })) : [],
                history: Array.isArray(i.history) ? i.history.filter(h => h && typeof h.action === 'string').map(h => ({ ...h })) : []
            })) : [];
            board.nextInquiryId = Math.max(1, Number.isSafeInteger(json.nextInquiryId) ? json.nextInquiryId : 1,
                ...board.sourceInquiries.map(i => Number(i.id.match(/^inquiry-(\d+)$/)?.[1] || 0) + 1));
            board.nextHypothesisId = Math.max(1, Number.isSafeInteger(json.nextHypothesisId) ? json.nextHypothesisId : 1,
                ...board.hypotheses.map(h => Number(h.id.match(/^hyp-(\d+)$/)?.[1] || 0) + 1));
        }
        return board;
    }
}
