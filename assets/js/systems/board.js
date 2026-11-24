class InvestigationBoard {
    constructor() {
        this.slots = [];          // Слоты для улик
        this.connections = [];    // Связи между слотами
        this.maxSlots = 6;
        this.evidenceOnBoard = []; // ID улик на доске
        this.hypotheses = [];
        this.sourceInquiries = [];
        this.alibiClaims = [];
        this.routeQuestions = [];
        this.nextAlibiId = 1;
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

        events.emit('board:updated', { action: 'place', evidenceId, slotId, caseId: this.caseId, filledSlots: this.slots.filter(item => item.evidenceId).length, totalSlots: this.slots.length });
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

    // Only discovered evidence contributes to the chronology. Documents may
    // describe different devices or events, even when their times overlap.
    getEvidenceChronology(discoveredIds = []) {
        return [...new Set(Array.isArray(discoveredIds) ? discoveredIds : [])].flatMap(evidenceId => {
            const object = getObjectById(evidenceId);
            if (!object?.isEvidence || !Array.isArray(object.timelineFacts)) return [];
            return object.timelineFacts.filter(fact => (fact.minute === null ||
                (Number.isInteger(fact.minute) && fact.minute >= 0 && fact.minute < 1440)) &&
                typeof fact.id === 'string' && typeof fact.label === 'string' && typeof fact.scope === 'string')
                .map(fact => ({ evidenceId, id: fact.id, minute: fact.minute, label: fact.label,
                    scope: fact.scope, certainty: fact.certainty || 'recorded', caveat: fact.caveat || '',
                    uncertaintyMinutes: Number.isInteger(fact.uncertaintyMinutes) &&
                        fact.uncertaintyMinutes >= 0 && fact.uncertaintyMinutes <= 720
                        ? fact.uncertaintyMinutes : null }));
        }).sort((a, b) => (a.minute === null ? Infinity : a.minute) - (b.minute === null ? Infinity : b.minute) || a.id.localeCompare(b.id));
    }

    compareChronologyFacts(firstId, secondId, discoveredIds = []) {
        const facts = this.getEvidenceChronology(discoveredIds);
        const firstMatches = facts.filter(f => f.id === firstId);
        const secondMatches = facts.filter(f => f.id === secondId);
        // Fact IDs are only meaningful when unique among discovered evidence.
        // Ambiguous references must not silently select whichever document sorts first.
        if (firstMatches.length !== 1 || secondMatches.length !== 1) return null;
        const [first] = firstMatches;
        const [second] = secondMatches;
        if (first.id === second.id || first.minute === null || second.minute === null) return null;
        const windowFor = fact => {
            if (fact.certainty === 'recorded') {
                const margin = fact.uncertaintyMinutes ?? 0;
                return { start: fact.minute - margin, end: fact.minute + margin };
            }
            if (fact.certainty !== 'approximate' || fact.uncertaintyMinutes === null) return null;
            return { start: fact.minute - fact.uncertaintyMinutes, end: fact.minute + fact.uncertaintyMinutes };
        };
        const firstWindow = windowFor(first);
        const secondWindow = windowFor(second);
        const validWindow = window => window && window.start >= 0 && window.end < 1440;
        const windowsKnown = validWindow(firstWindow) && validWindow(secondWindow);
        const temporalRelation = !windowsKnown ? 'unknown'
            : firstWindow.end < secondWindow.start ? 'first_before_second'
            : firstWindow.start > secondWindow.end ? 'first_after_second' : 'overlap_possible';
        const exact = first.certainty === 'recorded' && second.certainty === 'recorded' &&
            (first.uncertaintyMinutes ?? 0) === 0 && (second.uncertaintyMinutes ?? 0) === 0;
        const warning = !windowsKnown
            ? 'Для одной из записей нельзя безопасно построить временное окно. Уточните точность источника.'
            : temporalRelation === 'overlap_possible'
                ? 'Временные окна пересекаются или соприкасаются: порядок событий по этим данным не установлен.'
                : temporalRelation === 'first_before_second'
                    ? 'С учётом указанной погрешности первое событие определённо раньше второго. Это само по себе не доказывает причинную связь.'
                    : 'С учётом указанной погрешности первое событие определённо позже второго. Это само по себе не доказывает причинную связь.';
        return { first, second, firstWindow, secondWindow, temporalRelation,
            minutesApart: exact ? Math.abs(first.minute - second.minute) : null,
            sameScope: first.scope === second.scope, warning };
    }

    // A player-authored order is a hypothesis, not a factual verdict. In
    // particular an approximate timestamp cannot establish strict order.
    proposeChronologyOrder(firstId, secondId, relation, discoveredIds = []) {
        if (!['before', 'after'].includes(relation) || firstId === secondId) return null;
        const facts = this.getEvidenceChronology(discoveredIds);
        const firstMatches = facts.filter(f => f.id === firstId);
        const secondMatches = facts.filter(f => f.id === secondId);
        if (firstMatches.length !== 1 || secondMatches.length !== 1) return null;
        const [first] = firstMatches;
        const [second] = secondMatches;
        const timed = first.minute !== null && second.minute !== null;
        const exact = timed && first.certainty === 'recorded' && second.certainty === 'recorded';
        const agrees = exact && (relation === 'before' ? first.minute < second.minute : first.minute > second.minute);
        const disagrees = exact && !agrees;
        const status = agrees ? 'consistent' : disagrees ? 'conflicts' : 'unverified';
        const relationText = relation === 'before' ? 'раньше' : 'позже';
        const id = this.addHypothesis(`Хронология: «${first.label}» ${relationText}, чем «${second.label}»`);
        if (!id) return null;
        this.linkHypothesis(id, 'evidence', first.evidenceId, 'pending');
        if (first.evidenceId !== second.evidenceId) this.linkHypothesis(id, 'evidence', second.evidenceId, 'pending');
        const hypothesis = this.hypotheses.find(h => h.id === id);
        hypothesis.history.push({ action: 'chronology_reviewed', status, firstId, secondId, relation });
        return { id, status };
    }

    // A proposed cause is never established by chronology alone. Even an
    // independent document is a lead to examine, not proof of causation.
    proposeChronologyCause(causeId, effectId, explanation, supportEvidenceId = '', discoveredIds = []) {
        const reason = typeof explanation === 'string' ? explanation.trim().slice(0, 500) : '';
        if (!reason || causeId === effectId) return null;
        const facts = this.getEvidenceChronology(discoveredIds);
        const causeMatches = facts.filter(f => f.id === causeId);
        const effectMatches = facts.filter(f => f.id === effectId);
        if (causeMatches.length !== 1 || effectMatches.length !== 1) return null;
        const [cause] = causeMatches;
        const [effect] = effectMatches;
        const support = supportEvidenceId ? String(supportEvidenceId) : '';
        if (support && (!discoveredIds.includes(support) || !getObjectById(support)?.isEvidence ||
            support === cause.evidenceId || support === effect.evidenceId)) return null;
        const id = this.addHypothesis(`Возможная связь: «${cause.label}» → «${effect.label}»`);
        if (!id) return null;
        for (const evidenceId of new Set([cause.evidenceId, effect.evidenceId, support].filter(Boolean))) {
            this.linkHypothesis(id, 'evidence', evidenceId, 'pending');
        }
        const hypothesis = this.hypotheses.find(h => h.id === id);
        hypothesis.history.push({ action: 'causal_link_proposed', status: 'unverified',
            causeId, effectId, supportEvidenceId: support || null, explanation: reason });
        return { id, status: 'unverified', hasIndependentLead: Boolean(support) };
    }

    // Records a player's assessment of an independent source. Supporting
    // material never upgrades a causal theory to an established fact.
    assessChronologyCause(hypothesisId, evidenceId, stance, note, discoveredIds = []) {
        const hypothesis = this.hypotheses.find(h => h.id === hypothesisId && h.status === 'open');
        const proposal = hypothesis?.history.find(event => event.action === 'causal_link_proposed');
        const source = typeof evidenceId === 'string' ? evidenceId : '';
        const explanation = typeof note === 'string' ? note.trim().slice(0, 500) : '';
        if (!proposal || !['for', 'against'].includes(stance) || !explanation ||
            !Array.isArray(discoveredIds) || !discoveredIds.includes(source) || !getObjectById(source)?.isEvidence) return null;
        const facts = this.getEvidenceChronology(discoveredIds);
        const cause = facts.find(f => f.id === proposal.causeId);
        const effect = facts.find(f => f.id === proposal.effectId);
        if (!cause || !effect || source === cause.evidenceId || source === effect.evidenceId) return null;
        const existing = hypothesis.history.find(event => event.action === 'causal_evidence_assessed' && event.evidenceId === source);
        if (existing) return null;
        const linked = hypothesis.links.find(link => link.kind === 'evidence' && link.sourceId === source);
        if (linked) linked.stance = stance;
        else hypothesis.links.push({ kind: 'evidence', sourceId: source, stance });
        hypothesis.history.push({ action: 'causal_evidence_assessed', evidenceId: source, stance, note: explanation });
        events.emit('board:updated', { action: 'causal_evidence_assessed', id: hypothesisId });
        return this.getChronologyCauseAssessment(hypothesisId);
    }

    getChronologyCauseAssessment(hypothesisId) {
        const hypothesis = this.hypotheses.find(h => h.id === hypothesisId);
        if (!hypothesis?.history.some(event => event.action === 'causal_link_proposed')) return null;
        const assessments = hypothesis.history.filter(event => event.action === 'causal_evidence_assessed');
        return { status: 'unverified', supporting: assessments.filter(event => event.stance === 'for').length,
            challenging: assessments.filter(event => event.stance === 'against').length,
            assessments: assessments.map(event => ({ ...event })) };
    }

    prepareCausalQuestion(hypothesisId, npcId, statements = []) {
        const hypothesis = this.hypotheses.find(h => h.id === hypothesisId && h.status === 'open');
        const assessment = this.getChronologyCauseAssessment(hypothesisId);
        if (!hypothesis || !assessment?.challenging || typeof npcId !== 'string' ||
            !statements.some(s => s.npcId === npcId && s.status !== 'superseded') ||
            hypothesis.history.some(e => e.action === 'causal_question_prepared' && e.npcId === npcId)) return false;
        hypothesis.history.push({ action: 'causal_question_prepared', npcId });
        events.emit('board:updated', { action: 'causal_question_prepared', hypothesisId, npcId });
        return true;
    }

    getPreparedCausalQuestion(npcId) {
        for (const h of this.hypotheses) {
            if (h.status !== 'open') continue;
            const prepared = h.history.findLast(e => e.action === 'causal_question_prepared' && e.npcId === npcId);
            if (prepared && !h.history.some(e => e.action === 'causal_question_discussed' && e.npcId === npcId)) {
                return { hypothesisId: h.id, title: h.title, assessment: this.getChronologyCauseAssessment(h.id) };
            }
        }
        return null;
    }

    discussCausalQuestion(npcId) {
        const prepared = this.getPreparedCausalQuestion(npcId);
        if (!prepared) return false;
        const hypothesis = this.hypotheses.find(h => h.id === prepared.hypothesisId);
        hypothesis.history.push({ action: 'causal_question_discussed', npcId });
        events.emit('board:updated', { action: 'causal_question_discussed', hypothesisId: hypothesis.id, npcId });
        return true;
    }

    // Проверить, сделаны ли правильные выводы
    addAlibiClaim({ subject, location, locationId, startMinute, endMinute, kind, sourceId, precision, uncertaintyMinutes = null }, context = {}) {
        const who = String(subject ?? '').trim().slice(0, 100);
        const where = String(location ?? '').trim().slice(0, 120);
        const source = String(sourceId ?? '').trim().slice(0, 240);
        const linkedLocation = locationId ? context.locations?.find(loc => loc.id === locationId) : null;
        if (locationId && !linkedLocation) return null;
        if (!who || !where || !source || !Number.isInteger(startMinute) || !Number.isInteger(endMinute) ||
            startMinute < 0 || endMinute >= 1440 || startMinute > endMinute ||
            !['exact', 'approximate'].includes(precision) ||
            (uncertaintyMinutes !== null && (!Number.isInteger(uncertaintyMinutes) || uncertaintyMinutes < 0 || uncertaintyMinutes > 720))) return null;
        if (kind === 'statement' && !context.statements?.some(s => s.id === source && s.status !== 'superseded')) return null;
        if (kind === 'evidence' && !context.evidenceIds?.includes(source)) return null;
        if (!['statement', 'evidence'].includes(kind) || this.alibiClaims.some(c =>
            c.subject === who && c.location === where && c.startMinute === startMinute &&
            c.endMinute === endMinute && c.kind === kind && c.sourceId === source &&
            (c.locationId || null) === (linkedLocation?.id || null))) return null;
        const entry = { id: 'alibi-' + this.nextAlibiId++, subject: who, location: where,
            locationId: linkedLocation?.id || null, startMinute, endMinute, precision, kind, sourceId: source, uncertaintyMinutes };
        this.alibiClaims.push(entry);
        events.emit('board:updated', { action: 'alibi_claim_added', id: entry.id });
        return entry.id;
    }

    removeAlibiClaim(id) {
        const index = this.alibiClaims.findIndex(c => c.id === id);
        if (index < 0) return false;
        this.alibiClaims.splice(index, 1);
        events.emit('board:updated', { action: 'alibi_claim_removed', id });
        return true;
    }

    // Travel duration is supplied by the active game's travel rule. This is
    // a minimum time-budget check, not a geographic route calculation.
    reviewAlibiClaims(minimumTravelMinutes = null) {
        const findings = [];
        const travelMinutes = Number.isInteger(minimumTravelMinutes) && minimumTravelMinutes >= 0
            ? minimumTravelMinutes : null;
        for (let i = 0; i < this.alibiClaims.length; i++) {
            for (let j = i + 1; j < this.alibiClaims.length; j++) {
                const a = this.alibiClaims[i], b = this.alibiClaims[j];
                if (a.subject.toLocaleLowerCase() !== b.subject.toLocaleLowerCase() ||
                    a.location.toLocaleLowerCase() === b.location.toLocaleLowerCase()) continue;
                const overlap = Math.max(a.startMinute, b.startMinute) <= Math.min(a.endMinute, b.endMinute);
                if (overlap) {
                    findings.push({ ids: [a.id, b.id], subject: a.subject, status: 'needs_verification',
                        reason: a.precision === 'approximate' || b.precision === 'approximate'
                            ? 'Пересекаются приблизительные интервалы; уточните время и возможность перемещения.'
                            : 'В одно время указаны разные места; проверьте точность источников и возможность перемещения.' });
                    continue;
                }
                if (travelMinutes === null) continue;
                const [earlier, later] = a.startMinute <= b.startMinute ? [a, b] : [b, a];
                const gapMinutes = later.startMinute - earlier.endMinute;
                if (gapMinutes >= travelMinutes) continue;
                findings.push({ ids: [earlier.id, later.id], subject: a.subject, status: 'travel_time_tight',
                    gapMinutes, minimumTravelMinutes: travelMinutes,
                    reason: earlier.precision === 'approximate' || later.precision === 'approximate'
                        ? `Между приблизительными интервалами ${gapMinutes} мин., а обычный переход в игре занимает ${travelMinutes} мин. Уточните часы и источники.`
                        : `Между точными интервалами ${gapMinutes} мин., а обычный переход в игре занимает ${travelMinutes} мин. Проверьте время и возможность особого маршрута.` });
            }
        }
        return findings;
    }

    // Opening hours describe normal public access, not whether somebody could
    // physically enter a place after closing. Only caller-supplied, visited
    // locations are reviewed; undiscovered locations cannot leak into findings.
    reviewAlibiLocationHours(knownLocations = []) {
        const locations = new Map(knownLocations.filter(loc => loc && typeof loc.id === 'string').map(loc => [loc.id, loc]));
        const findings = [];
        for (const claim of this.alibiClaims) {
            const loc = locations.get(claim.locationId);
            const open = loc?.hours?.open, close = loc?.hours?.close;
            if (!Number.isInteger(open) || !Number.isInteger(close) || open < 0 || open > 24 ||
                close < 0 || close > 24 || open === close || (open === 0 && close === 24)) continue;
            const within = minute => {
                const hour = minute / 60;
                return open < close ? hour >= open && hour < close : hour >= open || hour < close;
            };
            // Check the entire interval, including a closed period between
            // two otherwise open endpoints of an overnight schedule.
            let outside = false;
            for (let minute = claim.startMinute; minute < Math.max(claim.startMinute + 1, claim.endMinute); minute += 1) {
                if (!within(minute)) { outside = true; break; }
            }
            if (!outside) continue;
            findings.push({ ids: [claim.id], subject: claim.subject, locationId: loc.id,
                status: 'outside_public_hours',
                reason: `Для «${loc.name || claim.location}» обычные часы работы ${String(open).padStart(2, '0')}:00–${String(close).padStart(2, '0')}:00. Указанный интервал выходит за них; проверьте доступ после закрытия и достоверность источника. Это не доказательство отсутствия.` });
        }
        return findings;
    }

    // A requiresItem gate describes the detective's investigation access.
    // It must never be interpreted as proof that an NPC could not enter.
    reviewAlibiAccessRestrictions(knownLocations = []) {
        const locations = new Map((Array.isArray(knownLocations) ? knownLocations : [])
            .filter(loc => loc && typeof loc.id === 'string').map(loc => [loc.id, loc]));
        return this.alibiClaims.flatMap(claim => {
            const loc = locations.get(claim.locationId);
            if (!loc?.requiresItem) return [];
            return [{
                ids: [claim.id], subject: claim.subject, locationId: loc.id,
                status: 'investigator_access_gate',
                requirement: loc.requiresItem,
                reason: `Для осмотра «${loc.name || claim.location}» детективу требуется специальное разрешение. Это правило доступа игрока; оно не доказывает, что ${claim.subject} не мог находиться там или попасть внутрь другим способом.`
            }];
        });
    }

    // Scenario-authored route estimates are hypotheses about ordinary travel,
    // not proof that a character took a particular route. Unknown segments
    // are intentionally omitted, never interpreted as impossible travel.
    reviewAlibiRoutes(routeEdges = [], knownLocations = []) {
        const names = new Map((Array.isArray(knownLocations) ? knownLocations : [])
            .filter(loc => loc && typeof loc.id === 'string').map(loc => [loc.id, loc.name || loc.id]));
        const graph = new Map();
        for (const edge of Array.isArray(routeEdges) ? routeEdges : []) {
            if (!edge || !names.has(edge.from) || !names.has(edge.to) || edge.from === edge.to ||
                !Number.isInteger(edge.minutes) || edge.minutes <= 0 || edge.minutes > 180) continue;
            const add = (from, to) => {
                if (!graph.has(from)) graph.set(from, []);
                graph.get(from).push({ to, minutes: edge.minutes });
            };
            add(edge.from, edge.to);
            if (edge.bidirectional === true) add(edge.to, edge.from);
        }
        const route = (from, to) => {
            const best = new Map([[from, 0]]), paths = new Map([[from, [from]]]);
            const pending = new Set([from]);
            while (pending.size) {
                const current = [...pending].reduce((a, b) => best.get(a) <= best.get(b) ? a : b);
                pending.delete(current);
                if (current === to) return { minutes: best.get(current), locations: paths.get(current) };
                for (const edge of graph.get(current) || []) {
                    const estimate = best.get(current) + edge.minutes;
                    if (estimate >= (best.get(edge.to) ?? Infinity)) continue;
                    best.set(edge.to, estimate);
                    paths.set(edge.to, [...paths.get(current), edge.to]);
                    pending.add(edge.to);
                }
            }
            return null;
        };
        const findings = [];
        for (let i = 0; i < this.alibiClaims.length; i++) {
            for (let j = i + 1; j < this.alibiClaims.length; j++) {
                const a = this.alibiClaims[i], b = this.alibiClaims[j];
                if (a.subject.toLocaleLowerCase() !== b.subject.toLocaleLowerCase() ||
                    !names.has(a.locationId) || !names.has(b.locationId) || a.locationId === b.locationId ||
                    Math.max(a.startMinute, b.startMinute) <= Math.min(a.endMinute, b.endMinute)) continue;
                const [earlier, later] = a.startMinute < b.startMinute ? [a, b] : [b, a];
                const estimate = route(earlier.locationId, later.locationId);
                const availableMinutes = later.startMinute - earlier.endMinute;
                if (!estimate || availableMinutes >= estimate.minutes) continue;
                findings.push({ ids: [earlier.id, later.id], subject: a.subject, status: 'route_time_tight',
                    routeLocationIds: estimate.locations, estimatedMinutes: estimate.minutes, availableMinutes,
                    reason: `Между ${names.get(earlier.locationId)} и ${names.get(later.locationId)} по известному маршруту оценка ${estimate.minutes} мин. (через ${estimate.locations.map(id => names.get(id)).join(' → ')}), а между версиями ${availableMinutes} мин. Проверьте точность времени и альтернативные пути: это не доказательство невозможности перемещения.` });
            }
        }
        return findings;
    }


    // Compare alibi windows against the shortest documented route. An unmodeled
    // route may exist, so a tight estimate is never treated as proof of impossibility.
    reviewAlibiRouteWindows(routeEdges = [], knownLocations = [], discoveredEvidenceIds = []) {
        const locations = new Map((Array.isArray(knownLocations) ? knownLocations : [])
            .filter(loc => loc && typeof loc.id === 'string').map(loc => [loc.id, loc]));
        const graph = new Map();
        const discoveredEvidence = new Set(Array.isArray(discoveredEvidenceIds) ? discoveredEvidenceIds.filter(id => typeof id === 'string') : []);
        for (const edge of Array.isArray(routeEdges) ? routeEdges : []) {
            if (!edge || (typeof edge.requiresEvidence === 'string' && !discoveredEvidence.has(edge.requiresEvidence)) ||
                !locations.has(edge.from) || !locations.has(edge.to) || edge.from === edge.to ||
                !Number.isInteger(edge.minutes) || edge.minutes <= 0 || edge.minutes > 180) continue;
            const add = (from, to) => { if (!graph.has(from)) graph.set(from, []); graph.get(from).push({ to, minutes: edge.minutes }); };
            add(edge.from, edge.to);
            if (edge.bidirectional === true) add(edge.to, edge.from);
        }
        const shortestRoute = (from, to) => {
            const distances = new Map([[from, 0]]), paths = new Map([[from, [from]]]), pending = new Set([from]);
            while (pending.size) {
                const current = [...pending].reduce((a, b) => distances.get(a) <= distances.get(b) ? a : b);
                pending.delete(current);
                if (current === to) return { minutes: distances.get(current), locations: paths.get(current) };
                for (const edge of graph.get(current) || []) {
                    const next = distances.get(current) + edge.minutes;
                    if (next >= (distances.get(edge.to) ?? Infinity)) continue;
                    distances.set(edge.to, next); paths.set(edge.to, [...paths.get(current), edge.to]); pending.add(edge.to);
                }
            }
            return null;
        };
        const findings = [];
        for (let i = 0; i < this.alibiClaims.length; i++) for (let j = i + 1; j < this.alibiClaims.length; j++) {
            const a = this.alibiClaims[i], b = this.alibiClaims[j];
            if (a.subject.toLocaleLowerCase() !== b.subject.toLocaleLowerCase() ||
                !locations.has(a.locationId) || !locations.has(b.locationId) || a.locationId === b.locationId) continue;
            const [earlier, later] = a.startMinute <= b.startMinute ? [a, b] : [b, a];
            if (earlier.endMinute > later.startMinute) continue;
            const route = shortestRoute(earlier.locationId, later.locationId);
            if (!route) {
                findings.push({ ids: [earlier.id, later.id], subject: a.subject, status: 'insufficient_data',
                    reason: 'Для этой пары мест нет известного маршрута. Это недостаток карты, а не доказательство невозможности перемещения.' });
                continue;
            }
            const earlyUncertainty = earlier.uncertaintyMinutes ?? (earlier.precision === 'exact' ? 0 : null);
            const lateUncertainty = later.uncertaintyMinutes ?? (later.precision === 'exact' ? 0 : null);
            if (earlyUncertainty === null || lateUncertainty === null) {
                findings.push({ ids: [earlier.id, later.id], subject: a.subject, status: 'insufficient_data',
                    routeLocationIds: route.locations, estimatedMinutes: route.minutes,
                    reason: 'Маршрут известен, но для приблизительного времени не задана погрешность.' });
                continue;
            }
            const availableMinutesMin = later.startMinute - lateUncertainty - (earlier.endMinute + earlyUncertainty);
            const availableMinutesMax = later.startMinute + lateUncertainty - (earlier.endMinute - earlyUncertainty);
            const common = { ids: [earlier.id, later.id], subject: a.subject, routeLocationIds: route.locations,
                estimatedMinutes: route.minutes, availableMinutesMin, availableMinutesMax };
            if (availableMinutesMax < route.minutes) findings.push({ ...common, status: 'route_time_tight',
                reason: `Даже при наиболее благоприятной погрешности доступно до ${availableMinutesMax} мин., а кратчайший известный маршрут занимает ${route.minutes} мин. Неизвестный альтернативный путь ещё не исключён.` });
            else if (availableMinutesMin >= route.minutes) findings.push({ ...common, status: 'plausible',
                reason: `Даже при консервативной оценке доступно не менее ${availableMinutesMin} мин.; известный маршрут занимает ${route.minutes} мин. Это не доказывает, что персонаж им воспользовался.` });
            else findings.push({ ...common, status: 'uncertain',
                reason: `Диапазон доступного времени ${availableMinutesMin}–${availableMinutesMax} мин. пересекает оценку маршрута ${route.minutes} мин.` });
        }
        return findings;
    }

    prepareRouteQuestion(finding, npcId) {
        if (finding?.status !== 'route_time_tight' || !Array.isArray(finding.ids) || finding.ids.length !== 2 ||
            typeof npcId !== 'string' || !/^[a-z0-9_:-]{1,64}$/i.test(npcId) ||
            !finding.ids.every(id => this.alibiClaims.some(c => c.id === id)) ||
            this.routeQuestions.some(q => q.npcId === npcId && q.ids.join('|') === finding.ids.join('|'))) return false;
        this.routeQuestions.push({ npcId, ids: [...finding.ids], caseId: this.caseId, discussed: false });
        events.emit('board:updated', { action: 'route_question_prepared', npcId });
        return true;
    }

    hasPreparedRouteQuestion(npcId) {
        return this.routeQuestions.some(q => q.npcId === npcId && q.caseId === this.caseId &&
            !q.discussed && q.ids.every(id => this.alibiClaims.some(c => c.id === id)));
    }

    hasDiscussedRouteQuestion(npcId) {
        return this.routeQuestions.some(q => q.npcId === npcId && q.caseId === this.caseId &&
            q.discussed === true && q.ids.every(id => this.alibiClaims.some(c => c.id === id)));
    }

    markRouteQuestionDiscussed(npcId) {
        const question = this.routeQuestions.find(q => q.npcId === npcId && q.caseId === this.caseId &&
            !q.discussed && q.ids.every(id => this.alibiClaims.some(c => c.id === id)));
        if (!question) return false;
        question.discussed = true;
        events.emit('board:updated', { action: 'route_question_discussed', npcId });
        return true;
    }

    // A spoiler-free checklist derived exclusively from player-visible state.
    // It is guidance, not authored case completion logic or evidence discovery.
    getInvestigationChecklist({ visitedLocationIds = [], evidenceIds = [], statements = [],
        thomasTelephoneQuestionAsked = false, loraReportKnown = false,
        loraVerificationOutcome = null, loraVerificationDiscussed = false } = {}) {
        const visited = new Set(Array.isArray(visitedLocationIds) ? visitedLocationIds : []);
        const evidence = new Set(Array.isArray(evidenceIds) ? evidenceIds : []);
        const witnesses = new Set((Array.isArray(statements) ? statements : [])
            .filter(s => s && s.status !== 'superseded' && typeof s.npcId === 'string').map(s => s.npcId));
        const tasks = [
            { id: 'locations', text: 'Осмотреть хотя бы два доступных места', done: visited.size >= 2 },
            { id: 'evidence', text: 'Собрать первую улику или документ', done: evidence.size > 0 },
            { id: 'witnesses', text: 'Записать показания двух разных свидетелей', done: witnesses.size >= 2 },
            { id: 'hypothesis', text: 'Сформулировать рабочую гипотезу', done: this.hypotheses.length > 0 }
        ];
        if (this.alibiClaims.length > 0) {
            tasks.push({ id: 'alibi', text: 'Сопоставить две версии местонахождения', done: this.alibiClaims.length >= 2 });
        }
        const nextActions = [];
        if (this.hasPreparedRouteQuestion('business_rival')) nextActions.push({ id: 'kane-route', status: 'available',
            text: 'Подготовлен вопрос Кейну: вернитесь к нему и начните новый разговор. Это ещё не доказательство вины.' });
        else if (this.hasDiscussedRouteQuestion('business_rival')) nextActions.push({ id: 'kane-route', status: 'checked',
            text: 'Вопрос Кейну о маршруте уже задан. Его ответ не подтверждает маршрут: ищите независимые свидетельства о времени и местах.' });
        const thomasSpoke = witnesses.has('waiter');
        if (this.caseId === 'case-002' && evidence.has('telephone_exchange_slip') && thomasSpoke) {
            nextActions.push(thomasTelephoneQuestionAsked
                ? { id: 'thomas-telephone', status: 'checked', text: 'Томаса уже спросили о телефонном запросе. Он не видел звонившего; нужен независимый источник.' }
                : { id: 'thomas-telephone', status: 'available', text: 'Найдена карточка телефонной станции: вернитесь к Томасу и уточните, видел ли он звонившего.' });
        }
        if (this.caseId === 'case-002' && loraReportKnown) {
            const checked = loraVerificationDiscussed;
            const available = loraVerificationOutcome === 'no_independent_evidence';
            nextActions.push({ id: 'lora-thomas-verification',
                status: checked ? 'checked' : available ? 'available' : 'pending',
                text: checked
                    ? 'Лора обсудила отдельный разговор с Томасом: это ещё не независимое подтверждение первоначального обвинения.'
                    : available
                        ? 'Лора провела отдельный разговор с Томасом. Вернитесь к ней, чтобы узнать, что удалось проверить.'
                        : 'Лора узнала о спорном обвинении Томаса и планирует проверить рассказ. Не считайте пересказ доказанным фактом.' });
        }
        for (const inquiry of this.sourceInquiries) {
            const hypothesis = this.hypotheses.find(item => item.id === inquiry.hypothesisId);
            if (!hypothesis || !['open', 'closed'].includes(inquiry.status)) continue;
            const title = hypothesis.title;
            nextActions.push(inquiry.status === 'closed'
                ? { id: inquiry.id, status: 'checked',
                    text: `Проверка источника для версии «${title}» завершена. Вывод записан как оценка детектива, не как установленный факт.` }
                : inquiry.leads.length
                    ? { id: inquiry.id, status: 'available',
                        text: `В версии «${title}» появились материалы для проверки источника. Сверьте их и запишите осторожный вывод на доске.` }
                    : { id: inquiry.id, status: 'pending',
                        text: `Для версии «${title}» начата проверка происхождения слуха. Найдите доступное показание или улику и добавьте в проверку.` });
        }
        return { tasks, nextActions, nextAction: nextActions[0]?.text || null,
            completed: tasks.filter(t => t.done).length };
    }

    cancelRouteQuestion(npcId) {
        const before = this.routeQuestions.length;
        this.routeQuestions = this.routeQuestions.filter(q => !(q.npcId === npcId && q.caseId === this.caseId));
        if (this.routeQuestions.length === before) return false;
        events.emit('board:updated', { action: 'route_question_cancelled', npcId });
        return true;
    }

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
        this.alibiClaims = [];
        this.routeQuestions = [];
        this.nextAlibiId = 1;
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

    // Alternatives share a comparison group, but remain independent player-authored hypotheses.
    // The group is organizational only: it never ranks or selects a "true" version.
    createAlternativeHypothesis(id, text) {
        const base = this.hypotheses.find(h => h.id === id);
        const title = String(text ?? '').trim().slice(0, 240);
        if (!base || base.status !== 'open' || !title) return null;
        const groupId = base.alternativeGroupId || base.id;
        if (!base.alternativeGroupId) {
            base.alternativeGroupId = groupId;
            base.history.push({ action: 'alternative_group_created', groupId });
        }
        const entryId = this.addHypothesis(title);
        if (!entryId) return null;
        const alternative = this.hypotheses.find(h => h.id === entryId);
        alternative.alternativeGroupId = groupId;
        alternative.history.push({ action: 'alternative_created', groupId, basedOn: base.id });
        events.emit('board:updated', { action: 'hypothesis_alternative_created', id: entryId, groupId });
        return entryId;
    }

    getHypothesisAlternatives(id) {
        const entry = this.hypotheses.find(h => h.id === id);
        if (!entry) return [];
        const groupId = entry.alternativeGroupId || entry.id;
        return this.hypotheses.filter(h => h.id === groupId || h.alternativeGroupId === groupId)
            .map(h => ({ id: h.id, title: h.title, status: h.status, links: h.links.map(link => ({ ...link })) }));
    }

    // Compare active alternatives by source overlap and the detective's own assessments.
    // Shared material is surfaced, never counted as independent corroboration or ranked.
    compareHypothesisAlternatives(id) {
        const current = this.hypotheses.find(h => h.id === id && h.status === 'open');
        if (!current) return null;
        const groupId = current.alternativeGroupId || current.id;
        const peers = this.hypotheses.filter(h => h.id !== current.id && h.status === 'open' &&
            (h.alternativeGroupId || h.id) === groupId);
        const sourceKey = link => link.kind + ':' + link.sourceId;
        return peers.map(peer => {
            const currentMap = new Map(current.links.filter(link => ['evidence', 'statement'].includes(link.kind))
                .map(link => [sourceKey(link), link]));
            const peerMap = new Map(peer.links.filter(link => ['evidence', 'statement'].includes(link.kind))
                .map(link => [sourceKey(link), link]));
            const sharedSources = [];
            for (const [key, link] of currentMap) {
                const other = peerMap.get(key);
                if (other) sharedSources.push({ kind: link.kind, sourceId: link.sourceId,
                    currentStance: link.stance, otherStance: other.stance,
                    differingAssessment: link.stance !== other.stance });
            }
            const currentOnly = current.links.filter(link => ['evidence', 'statement'].includes(link.kind) && !peerMap.has(sourceKey(link)))
                .map(link => ({ ...link }));
            const otherOnly = peer.links.filter(link => ['evidence', 'statement'].includes(link.kind) && !currentMap.has(sourceKey(link)))
                .map(link => ({ ...link }));
            const pendingAssumptions = [
                ...current.links.filter(link => link.kind === 'assumption' && link.stance === 'pending').map(link => ({ side: 'current', sourceId: link.sourceId })),
                ...peer.links.filter(link => link.kind === 'assumption' && link.stance === 'pending').map(link => ({ side: 'other', sourceId: link.sourceId }))
            ];
            return { hypothesisId: peer.id, title: peer.title, sharedSources, currentOnly, otherOnly, pendingAssumptions };
        });
    }
    // Rebuild a readable, point-in-time history from the persisted action log.
    // No wall-clock timestamps are invented: order is the only guaranteed chronology.
    getHypothesisHistory(id) {
        const entry = this.hypotheses.find(h => h.id === id);
        if (!entry) return null;
        let title = '';
        let links = [];
        return (Array.isArray(entry.history) ? entry.history : []).map((item, index) => {
            const action = item?.action || 'unknown';
            if (action === 'created' && typeof item.title === 'string') title = item.title;
            else if (action === 'revised' && typeof item.title === 'string') title = item.title;
            else if (action === 'linked' && ['evidence', 'statement', 'assumption'].includes(item.kind) &&
                typeof item.sourceId === 'string' && ['for', 'against', 'pending'].includes(item.stance)) {
                if (!links.some(link => link.kind === item.kind && link.sourceId === item.sourceId))
                    links.push({ kind: item.kind, sourceId: item.sourceId, stance: item.stance });
            } else if (action === 'unlinked') {
                const position = links.findIndex(link => link.kind === item.kind && link.sourceId === item.sourceId);
                if (position >= 0) links.splice(position, 1);
            }
            const labels = { created: 'Версия сформулирована', revised: 'Формулировка изменена',
                linked: 'Добавлен источник', unlinked: 'Источник откреплён', abandoned: 'Версия отложена',
                alternative_group_created: 'Создана группа альтернатив', alternative_created: 'Добавлена альтернативная версия' };
            return { index: index + 1, action, label: labels[action] || 'Изменение записи',
                title: title || entry.title, previousTitle: typeof item.previous === 'string' ? item.previous : null,
                source: typeof item.sourceId === 'string' ? item.sourceId : null,
                kind: typeof item.kind === 'string' ? item.kind : null,
                stance: ['for', 'against', 'pending'].includes(item.stance) ? item.stance : null,
                links: links.map(link => ({ ...link })), status: action === 'abandoned' ? 'abandoned' : 'open' };
        });
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

    // Shared material across player theories is not independent corroboration.
    reviewHypothesisOverlaps(id) {
        const entry = this.hypotheses.find(h => h.id === id && h.status === 'open');
        if (!entry) return [];
        const active = this.hypotheses.filter(h => h.id !== id && h.status === 'open');
        return entry.links.filter(link => ['evidence', 'statement'].includes(link.kind)).flatMap(link =>
            active.flatMap(other => {
                const matching = other.links.find(candidate => candidate.kind === link.kind && candidate.sourceId === link.sourceId);
                return matching ? [{ kind: link.kind, sourceId: link.sourceId, stance: link.stance,
                    otherHypothesisId: other.id, otherTitle: other.title, otherStance: matching.stance,
                    differingAssessment: link.stance !== matching.stance }] : [];
            }));
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
        // Archived or missing records remain visible in the audit, but they
        // must not create fresh dependency warnings between current sources.
        const activeSources = sources.filter(source => source.status === 'active');
        for (let i = 0; i < activeSources.length; i++) {
            for (let j = i + 1; j < activeSources.length; j++) {
                const a = activeSources[i], b = activeSources[j];
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
        const originSources = review.sources
            .filter(source => source.status === 'active' && source.linkedRumorIds.includes(rumor))
            .map(source => ({
                statementId: source.id,
                npcId: source.npcId,
                sourceName: statements.find(statement => statement.id === source.id)?.sourceName || source.npcId,
                directObservation: statements.find(statement => statement.id === source.id)?.directObservation === true
            }))
            .filter(source => typeof source.npcId === 'string' && source.npcId);
        if (!originSources.length) return null;
        const inquiry = { id: 'inquiry-' + this.nextInquiryId++, hypothesisId, rumorId: rumor,
            status: 'open', originSources, leads: [], history: [{ action: 'opened', rumorId: rumor }] };
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
        const statement = kind === 'statement'
            ? context.statements?.find(item => item.id === source && item.status !== 'superseded')
            : null;
        if (kind === 'statement' && (
            !statement || typeof statement.npcId !== 'string' || !statement.npcId ||
            statement.directObservation !== true ||
            statement.referencesRumorIds?.includes(inquiry.rumorId)
        )) return false;
        if (kind === 'evidence' && !context.evidenceIds?.includes(source)) return false;
        if (inquiry.leads.some(lead => lead.kind === kind && lead.sourceId === source)) return false;
        // A second statement from the original rumor witness is not independent
        // corroboration. Nor are two claims from the same witness independent
        // of each other. Keep this check in the domain layer, not only in UI.
        const originSources = Array.isArray(inquiry.originSources) && inquiry.originSources.length
            ? inquiry.originSources
            : this.reviewHypothesisSources(inquiry.hypothesisId, context.statements || []).sources
                .filter(origin => origin.status === 'active' && origin.linkedRumorIds.includes(inquiry.rumorId));
        if (statement && (
            originSources.some(origin => origin.npcId === statement.npcId) ||
            inquiry.leads.some(lead => lead.kind === 'statement' && lead.npcId === statement.npcId)
        )) return false;
        const lead = {
            kind, sourceId: source, note: explanation,
            ...(statement ? {
                npcId: statement.npcId,
                sourceName: statement.sourceName || statement.npcId,
                directObservation: statement.directObservation === true
            } : {})
        };
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
            alibiClaims: this.alibiClaims.map(c => ({ ...c })),
            routeQuestions: this.routeQuestions.map(q => ({ ...q, ids: [...q.ids] })),
            nextAlibiId: this.nextAlibiId,
            nextInquiryId: this.nextInquiryId,
            nextHypothesisId: this.nextHypothesisId,
            caseId: this.caseId
        };
    }

    // Восстановление
    static fromJSON(json) {
        const board = new InvestigationBoard();
        if (json) {
            // Rebuild the board inventory from the actual slots. Older or
            // partially written saves could contain duplicate/stale IDs in
            // evidenceOnBoard, which made clues disappear from both the board
            // and the detective's inventory after a reload.
            const placedEvidence = new Set();
            const savedSlots = Array.isArray(json.slots) ? json.slots : [];
            savedSlots.forEach(savedSlot => {
                if (!savedSlot || typeof savedSlot.id !== 'string' ||
                    typeof savedSlot.evidenceId !== 'string' || !savedSlot.evidenceId) return;
                const slot = board.slots.find(item => item.id === savedSlot.id);
                if (!slot || placedEvidence.has(savedSlot.evidenceId)) return;
                const evidence = typeof getObjectById === 'function'
                    ? getObjectById(savedSlot.evidenceId) : null;
                if (!evidence?.isEvidence) return;
                slot.evidenceId = savedSlot.evidenceId;
                placedEvidence.add(savedSlot.evidenceId);
            });
            board.evidenceOnBoard = [...placedEvidence];
            board.caseId = typeof json.caseId === 'string' ? json.caseId : null;
            board.hypotheses = Array.isArray(json.hypotheses) ? json.hypotheses.filter(h => h && typeof h.id === 'string' && typeof h.title === 'string').map(h => ({
                id: h.id, title: h.title, status: h.status === 'abandoned' ? 'abandoned' : 'open',
                ...(typeof h.alternativeGroupId === 'string' && h.alternativeGroupId ? { alternativeGroupId: h.alternativeGroupId } : {}),
                links: Array.isArray(h.links) ? h.links.filter(l => l && ['evidence', 'statement', 'assumption'].includes(l.kind) && ['for', 'against', 'pending'].includes(l.stance) && typeof l.sourceId === 'string') : [],
                history: Array.isArray(h.history) ? h.history.filter(v => v && typeof v.action === 'string') : []
            })) : [];
            board.sourceInquiries = Array.isArray(json.sourceInquiries) ? json.sourceInquiries.filter(i =>
                i && typeof i.id === 'string' && typeof i.hypothesisId === 'string' && typeof i.rumorId === 'string' &&
                board.hypotheses.some(h => h.id === i.hypothesisId)).map(i => ({
                id: i.id, hypothesisId: i.hypothesisId, rumorId: i.rumorId,
                status: i.status === 'closed' ? 'closed' : 'open',
                conclusion: typeof i.conclusion === 'string' ? i.conclusion : undefined,
                originSources: Array.isArray(i.originSources) ? i.originSources
                    .filter(source => source && typeof source.statementId === 'string' &&
                        typeof source.npcId === 'string' && source.npcId)
                    .map(source => ({
                        statementId: source.statementId.slice(0, 240),
                        npcId: source.npcId.slice(0, 64),
                        sourceName: typeof source.sourceName === 'string' ? source.sourceName.slice(0, 120) : source.npcId,
                        directObservation: source.directObservation === true
                    })) : [],
                leads: Array.isArray(i.leads) ? i.leads
                    .filter(l => l && ['statement', 'evidence'].includes(l.kind) && typeof l.sourceId === 'string' && typeof l.note === 'string')
                    .map(l => ({
                        kind: l.kind, sourceId: l.sourceId.slice(0, 240), note: l.note.slice(0, 500),
                        ...(typeof l.npcId === 'string' && l.npcId ? { npcId: l.npcId.slice(0, 64) } : {}),
                        ...(typeof l.sourceName === 'string' ? { sourceName: l.sourceName.slice(0, 120) } : {}),
                        ...(typeof l.directObservation === 'boolean' ? { directObservation: l.directObservation } : {})
                    })) : [],
                history: Array.isArray(i.history) ? i.history.filter(h => h && typeof h.action === 'string').map(h => ({ ...h })) : []
            })) : [];
            board.nextInquiryId = Math.max(1, Number.isSafeInteger(json.nextInquiryId) ? json.nextInquiryId : 1,
                ...board.sourceInquiries.map(i => Number(i.id.match(/^inquiry-(\d+)$/)?.[1] || 0) + 1));
            board.alibiClaims = Array.isArray(json.alibiClaims) ? json.alibiClaims.filter(c =>
                c && typeof c.id === 'string' && typeof c.subject === 'string' && typeof c.location === 'string' &&
                typeof c.sourceId === 'string' && ['evidence', 'statement'].includes(c.kind) &&
                ['exact', 'approximate'].includes(c.precision) && Number.isInteger(c.startMinute) &&
                Number.isInteger(c.endMinute) && c.startMinute >= 0 && c.endMinute < 1440 &&
                c.startMinute <= c.endMinute).map(c => ({ id: c.id, subject: c.subject.slice(0, 100),
                location: c.location.slice(0, 120), locationId: typeof c.locationId === 'string' ? c.locationId.slice(0, 120) : null,
                sourceId: c.sourceId.slice(0, 240), kind: c.kind,
                precision: c.precision, startMinute: c.startMinute, endMinute: c.endMinute,
                uncertaintyMinutes: Number.isInteger(c.uncertaintyMinutes) && c.uncertaintyMinutes >= 0 && c.uncertaintyMinutes <= 720 ? c.uncertaintyMinutes : null })) : [];
            board.routeQuestions = Array.isArray(json.routeQuestions) ? json.routeQuestions.filter(q =>
                q && typeof q.npcId === 'string' && Array.isArray(q.ids) && q.ids.length === 2 &&
                q.ids.every(id => typeof id === 'string' && board.alibiClaims.some(c => c.id === id)) &&
                typeof q.caseId === 'string' && q.caseId === board.caseId).map(q =>
                ({ npcId: q.npcId.slice(0, 64), ids: [...q.ids], caseId: q.caseId, discussed: q.discussed === true })) : [];
            board.nextAlibiId = Math.max(1, Number.isSafeInteger(json.nextAlibiId) ? json.nextAlibiId : 1,
                ...board.alibiClaims.map(c => Number(c.id.match(/^alibi-(\d+)$/)?.[1] || 0) + 1));
            board.nextHypothesisId = Math.max(1, Number.isSafeInteger(json.nextHypothesisId) ? json.nextHypothesisId : 1,
                ...board.hypotheses.map(h => Number(h.id.match(/^hyp-(\d+)$/)?.[1] || 0) + 1));
        }
        return board;
    }
}
