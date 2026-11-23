/**
 * EventController
 * Owns App-level event subscriptions and periodic autosave/sync tasks.
 * Subscriptions and timers can be disposed if the app lifecycle is restarted.
 */
class EventController {
    constructor(app, eventBus = events) {
        this.app = app;
        this.events = eventBus;
        this.unsubscribers = [];
        this.intervals = [];
        this.bound = false;
        this.pageHideHandler = null;
        this.pendingModalData = [];
        this.modalElement = null;
        this.modalHiddenHandler = null;
        this.modalHideHandler = null;
        this.modalIsHiding = false;
    }

    _subscribe(name, handler) {
        const unsubscribe = this.events.on(name, handler);
        if (typeof unsubscribe === 'function') this.unsubscribers.push(unsubscribe);
    }

    _notifyPromiseChanges(changes) {
        if (!Array.isArray(changes) || changes.length === 0) return;
        this._applyPromiseReputation(changes);
        this.events.emit('npc:memory_changed', { reason: 'promise_resolution', changes });
    }

    _applyPromiseReputation(changes) {
        const app = this.app;
        const memory = app.npcMemoryService;
        const reputation = app.reputationSystem;
        if (!memory?.getPromises || !reputation?.changeFactionReputation) return;

        for (const change of changes) {
            if (change?.npcId !== 'waiter' || change.promiseId !== 'thomas-family-protection' ||
                !['fulfilled', 'broken'].includes(change.status)) continue;

            const promise = memory.getPromises(change.npcId)
                .find(item => item.id === change.promiseId);
            if (promise?.fulfillment?.type !== 'insight_gained' ||
                promise.fulfillment.insightId !== 'thomas_family_protected') continue;

            const fulfilled = change.status === 'fulfilled';
            const eventId = 'thomas-family-protection:' + change.status;
            const effects = fulfilled
                ? [
                    ['witnesses', 5, 'Защита семьи свидетеля выполнена'],
                    ['residents', 3, 'Детектив выполнил обещание о защите семьи']
                ]
                : [
                    ['witnesses', -8, 'Обещанная защита семьи свидетеля не обеспечена'],
                    ['residents', -5, 'Детектив не выполнил обещание о защите семьи']
                ];

            for (const [factionId, amount, reason] of effects) {
                reputation.changeFactionReputation(
                    factionId, amount, reason, eventId + ':' + factionId
                );
            }
        }

        if (app.progress) app.progress.reputationData = reputation.toJSON?.() || app.progress.reputationData;
    }

    bind() {
        if (this.bound) return;
        this.bound = true;
        const app = this.app;
        const events = this.events;
        const on = (name, handler) => this._subscribe(name, handler);

        on('dialogue:state_changed', () => {
            if (app.progress && !app.saveBlocked) app._quickSave();
        });
        on('dialogue:ended', () => {
            if (!app.progress?.dialogueData) return;
            app.progress.dialogueData = null;
            if (!app.saveBlocked) app._quickSave();
        });


        // Модальные окна показываем последовательно: Bootstrap игнорирует show()
        // во время перехода предыдущего окна, оставляя backdrop без владельца.
        this.modalElement = typeof document !== 'undefined' ? document.getElementById('universal-modal') : null;
        if (this.modalElement && !this.modalHiddenHandler) {
            this.modalHideHandler = () => { this.modalIsHiding = true; };
            this.modalHiddenHandler = () => {
                this.modalIsHiding = false;
                const next = this.pendingModalData.shift();
                if (next) this._showModal(next);
            };
            this.modalElement.addEventListener('hide.bs.modal', this.modalHideHandler);
            this.modalElement.addEventListener('hidden.bs.modal', this.modalHiddenHandler);
        }
        on('modal:show', (data) => {
            if (!this.modalElement && typeof document !== 'undefined') this.modalElement = document.getElementById('universal-modal');
            if (!this.modalElement) return;
            if (this.modalElement.classList.contains('show') || this.modalIsHiding) {
                // Preserve every narrative event in arrival order. Replacing a
                // single pending payload silently discarded earlier dialogue.
                this.pendingModalData.push(data);
                return;
            }
            this._showModal(data);
        });

        on('navigation:go', (id) => { app.navigateTo(id); if (id === 'screen-map') app.mapRenderer?.render(); });
        on('case:select', (id) => app.loadCase(id));
        on('case:replay', (id) => {
            if (!id || !getCaseById(id)) return;
            app.loadCase(id);
        });
        on('case:load', (id) => app.loadCase(id));

        on('case:started', (data) => {
            app.progress.dialogueData = null;
            app.dialogueEngine?.reset();

            const caseId = data.caseData.id;
            // This event marks a NEW playthrough, never a resume. Keep people's
            // long-term profiles but discard run-specific claims and rumors.
            app.npcMemoryService?.resetCase(caseId);
            app.npcSocialNetwork?.resetCase(caseId);
            app.npcRelationshipService?.resetCase(caseId);
            // setCase is intentionally a no-op for an unchanged ID; reset the
            // board first so replaying the same investigation starts blank.
            if (app.investigationBoard?.caseId === caseId) app.investigationBoard.setCase(null);
            app.progress.activeCase = app.caseManager.currentCase?.id;
            app.progress.playthroughSequence = (Number.isInteger(app.progress.playthroughSequence) ? app.progress.playthroughSequence : 0) + 1;
            const runId = caseId + ':' + Date.now() + ':' + app.progress.playthroughSequence;
            app.progress.activeRunId = runId;
            app.progressTracker?.startCase?.(caseId, runId);
            app.progress.trackerData = app.progressTracker?.toJSON?.() || app.progress.trackerData;
            app.progress.completedRunIds = Array.isArray(app.progress.completedRunIds) ? app.progress.completedRunIds : [];
            app.investigationBoard?.setCase(caseId);
            app.progress.boardData = app.investigationBoard?.toJSON();
            app.boardUI?.render();
            app.npcMemoryService?.setCase(data.caseData.id);
            app.npcMotivationService?.setMemoryService(app.npcMemoryService);
            app.npcMotivationService?.setCase(data.caseData);
            app.npcSocialNetwork?.setMotivationService(app.npcMotivationService);
            app.npcSocialNetwork?.setCase(data.caseData);
            app.npcRelationshipService?.setDependencies(app.npcMemoryService, app.npcManager, app.gameTime, app.npcSocialNetwork);
            app.npcRelationshipService?.setCase(data.caseData);
            app.npcSocialNetwork?.setRelationshipService(app.npcRelationshipService);
            app.npcManager?.setMemoryService(app.npcMemoryService);
            app.npcManager?.setSocialNetwork(app.npcSocialNetwork);
            app.npcManager?.setRelationshipService(app.npcRelationshipService);
            app.progress.npcSocialData = app.npcSocialNetwork?.toJSON();
            app.progress.npcRelationshipData = app.npcRelationshipService?.toJSON();
            app.progress.npcMemoryData = app.npcMemoryService?.toJSON();
            app.progress.caseData = app.caseManager.toJSON();
            app._saveProgress();
            app.npcManager.loadNPCsForCase(data.caseData);
            app.npcListUI.render();
            app.evidenceChainSystem?.loadChainsForCase(data.caseData);
            app.evidenceChainSystem?.checkChains();
            setTimeout(() => { app.notesManager?.collectNote('initial_report'); app.notesManager?.collectNote('newspaper_article'); }, 1000);
        });

        on('time:changed', () => {
            const result = app.npcSocialNetwork?.processDueDeliveries();
            if (result && (result.processed || result.delivered || result.deferred || result.expired)) {
                events.emit('npc:memory_changed', { reason: 'social_delivery', delivered: result.delivered });
                events.emit('npc:social_network_changed', { reason: 'social_delivery' });
                if (result.delivered) events.emit('npc:relationship_changed', { reason: 'social_relationship_update' });
            }
            const relationships = app.npcRelationshipService?.processDueInteractions();
            if (relationships?.processed) {
                events.emit('npc:relationship_changed', { reason: 'autonomous_interaction', ...relationships });
                if (relationships.changed) events.emit('npc:social_network_changed', { reason: 'relationship_event' });
            }
        });

        on('location:changed', (data) => {
            app.navigateTo('screen-case-active');
            app.sceneRenderer?.renderLocation(data.locationId);
            app.caseManager?.markLocationVisited(data.locationId);
            app.stakeoutSystem?.checkAll();
        });

        on('location:travel', (id) => { app.locationManager?.travelTo(id); app.sceneRenderer?.renderLocation(id); app.navigateTo('screen-case-active'); });

        on('inventory:changed', (data) => {
            app.progress.inventoryData = app.inventory?.toJSON();
            app._saveProgress();
            if (data.action === 'add') {
                this._notifyPromiseChanges(app.npcMemoryService?.resolvePromisesForEvent({
                    type: 'item_acquired',
                    itemId: data.itemId
                }));
                app.caseManager?.onItemAcquired(data.itemId);
                if (getObjectById(data.itemId)?.isEvidence) app.ttsEngine?.playEvidenceSound();
            }
            if ((app.inventory?.evidence?.length || 0) >= 3 && !app.notesManager?.hasNote('autopsy_report')) app.notesManager?.collectNote('autopsy_report');
            app.npcManager?.checkAutoTriggers();
            app.evidenceChainSystem?.checkChains();
        });

        // Удаление улики из инвентаря при переносе на доску
        on('inventory:remove', (evidenceId) => {
            if (app.inventory) {
                app.inventory.removeFromEvidence(evidenceId);
                app.inventoryUI?.render();
            }
        });

        // Возвращаем улику в пул инвентаря, если её сняли с доски расследования.
        on('inventory:restore_evidence', (evidenceId) => {
            if (app.inventory?.addToEvidence(evidenceId)) {
                app.inventoryUI?.render();
            }
        });

        on('object:interact', (data) => {
            const obj = getObjectById(data.itemId);
            if (!obj) return;
            const revealedObjectId = obj.interactions?.examine?.revealsObject;
            if (revealedObjectId && app.locationManager?.revealObject(data.locationId, revealedObjectId)) {
                if (app.sceneRenderer?.currentScene?.id === data.locationId) {
                    app.sceneRenderer.renderLocation(data.locationId);
                }
            }
            if (obj.takeable && app.inventory && !app.inventory.hasItem(data.itemId)) app.inventory.addItem(data.itemId);
            if (obj.interactions?.examine?.spawnsItem) { const sid = obj.interactions.examine.spawnsItem; if (app.inventory && !app.inventory.hasItem(sid)) setTimeout(() => app.inventory.addItem(sid), 500); }
            if (obj.interactions?.examine?.givesInsight) app.inventory?.addInsight(obj.interactions.examine.givesInsight);
            if (data.itemId === 'wall_safe' && app.inventory?.hasItem('small_key') && !app.minigameManager?.isGameCompleted('safe_lock')) setTimeout(() => events.emit('minigame:start', 'safe_lock'), 300);
            if (data.itemId === 'hidden_note' && !app.minigameManager?.isGameCompleted('cipher_note')) setTimeout(() => events.emit('minigame:start', 'cipher_note'), 300);
            app.gameTime?.advance(CONFIG.time.costs.examine);
        });

        on('insight:gained', (data) => {
            this._notifyPromiseChanges(app.npcMemoryService?.resolvePromisesForEvent({
                type: 'insight_gained',
                insightId: data.insightId
            }));
            app.caseManager?.onInsightGained(data.insightId);
            app.npcManager?.checkAutoTriggers();
            app.evidenceChainSystem?.checkChains();
        });

        on('case:ready_for_final', (r) => { const a = document.getElementById('final-answer-area'); if (a) r ? a.classList.remove('hidden') : a.classList.add('hidden'); });

        on('deduction:attempted', () => {
            app.progressTracker?.addAttempt();
            app.progress.trackerData = app.progressTracker?.toJSON();
            app._saveProgress();
        });

        // A private deduction is not an accusation. Only the explicit public
        // declaration can affect NPC memory, and one declaration is counted once.
        on('deduction:public_accusation', ({ caseId, suspectId } = {}) => {
            const currentCase = app.caseManager?.currentCase;
            if (!currentCase || currentCase.id !== caseId || !app.npcMemoryService ||
                !currentCase.deductionSuspects?.some(person => person.id === suspectId) ||
                typeof assessAccusationEvidence !== 'function' ||
                !assessAccusationEvidence(currentCase, app.inventory).sufficient) return;

            const correctSuspect = currentCase.correctDeduction?.suspect || currentCase.finalQuestion?.correctAnswer;
            // The judgement of a *false* accusation belongs to the story state,
            // never to the deduction UI (which must not reveal the right suspect).
            if (suspectId === correctSuspect ||
                currentCase.finalQuestion?.acceptableAnswers?.includes(suspectId)) return;

            const accusationId = 'public-final-accusation:' + caseId + ':' + suspectId;
            const recorded = app.npcMemoryService.recordAccusation(suspectId, {
                id: accusationId,
                text: 'Детектив публично назвал этого человека виновным, не подтвердив обвинение.'
            });
            if (!recorded?.recorded) return;
            // A proven false public accusation damages confidence in the detective
            // among residents and witnesses. The event ID makes this consequence idempotent.
            app.reputationSystem?.changeFactionReputation?.('residents', -8,
                'Публичное ложное обвинение: ' + suspectId, 'false-public-accusation:' + caseId + ':' + suspectId + ':residents');
            app.reputationSystem?.changeFactionReputation?.('witnesses', -10,
                'Публичное ложное обвинение: ' + suspectId, 'false-public-accusation:' + caseId + ':' + suspectId + ':witnesses');
            app.progress.reputationData = app.reputationSystem?.toJSON?.() || app.progress.reputationData;
            app.npcMemoryService.resolveAccusation(
                suspectId, accusationId, 'false', 'Публичное обвинение противоречит установленным обстоятельствам дела.'
            );
            const published = app.npcSocialNetwork?.publishPublicAccusation(suspectId, accusationId);
            if (published?.published) {
                events.emit('npc:social_network_changed', { reason: 'public_accusation', npcId: suspectId });
            }
            events.emit('npc:memory_changed', { reason: 'public_false_accusation', npcId: suspectId });
        });

        on('npc:call', (id) => {
            const npc = getNPCById(id);
            const avail = app.npcManager?.isNPCAvailable(id);
            if (!npc) { events.emit('notification:show', { message: 'Абонент не найден', type: 'error', duration: 2000 }); return; }
            if (!avail?.available) { events.emit('notification:show', { message: avail?.message || 'Недоступен', type: 'warning', duration: 3000 }); return; }
            app.gameTime.advance(CONFIG.time.costs.call);
            app.callInterface.startCall(id, app.npcManager?.getDialogueForNPC?.(id));
        });

        on('npc:chat', (id) => {
            const npc = getNPCById(id);
            const avail = app.npcManager?.isNPCAvailable(id);
            if (!npc || !avail?.available) { events.emit('npc:call', id); return; }
            app.gameTime.advance(CONFIG.time.costs.dialogue);
            app.callInterface.startCall(id, app.npcManager?.getDialogueForNPC?.(id));
        });

        on('npc:social_network_changed', () => {
            app.progress.npcSocialData = app.npcSocialNetwork?.toJSON();
            app._saveProgress();
        });

        on('npc:relationship_changed', () => {
            app.progress.npcRelationshipData = app.npcRelationshipService?.toJSON();
            app._saveProgress();
            app.npcListUI?.render();
        });

        on('npc:memory_changed', () => {
            app.progress.npcMemoryData = app.npcMemoryService?.toJSON();
            app._saveProgress();
            app.npcListUI?.render();
        });

        // Возможные противоречия не раскрываются автоматически:
        // игрок должен найти их в журнале и подготовить предъявление.
        
        on('npc:auto_trigger', (data) => {
            events.emit('notification:show', { message: 'Входящий: ' + (getNPCById(data.npcId)?.name || 'Неизвестный'), type: 'system', duration: 4000 });
            setTimeout(() => events.emit('npc:call', data.npcId), 1500);
        });

        on('tts:speak', (d) => app.ttsEngine?.speak(d.text, { mood: d.mood || 'neutral' }));
        on('call:started', () => app.ttsEngine?.playDialTone());
        on('call:connected', () => app.ttsEngine?.playConnectSound());
        on('call:ended', () => { app.ttsEngine?.stop(); app.ttsEngine?.playHangupSound(); });
        on('minigame:start', (id) => app.minigameManager?.startGame(id));
        // MinigameBase emits reward events; bridge them into the same inventory
        // APIs used by scene interactions and dialogue rewards.
        on('inventory:add', (itemId) => {
            if (itemId && app.inventory && !app.inventory.hasItem(itemId)) app.inventory.addItem(itemId);
        });
        on('insight:add', (insightId) => {
            if (insightId && app.inventory && !app.inventory.hasInsight(insightId)) app.inventory.addInsight(insightId);
        });
        on('evidence:from_dialogue', (d) => { if (d.evidenceId && app.inventory) app.inventory.addItem(d.evidenceId); });

        on('board:updated', () => {
            if (app.investigationBoard) {
                app.investigationBoard.checkConclusions().forEach(id => { if (!app.inventory?.hasInsight(id)) app.inventory?.addInsight(id); });
                app.progress.boardData = app.investigationBoard.toJSON();
                app._saveProgress();
            }
        });

        on('note:collected', () => { app.progress.notesData = app.notesManager?.toJSON(); app._saveProgress(); });
        on('fragment:saved', () => { app.progress.notesData = app.notesManager?.toJSON(); app._saveProgress(); });

        on('achievement:progress_changed', () => {
            app.progress.achievementData = app.achievementSystem?.toJSON?.() || app.progress.achievementData;
            app._saveProgress?.();
        });

        on('achievement:unlocked', () => {
            app.progress.achievementData = app.achievementSystem?.toJSON?.() || app.progress.achievementData;
            app._saveProgress?.();
        });

        on('case:solved', (data = {}) => {
            const caseData = app.caseManager?.currentCase || getCaseById(data.caseId) || data;
            const caseId = caseData?.id || data.caseId;
            if (!caseId || !app.progress) return;

            const runId = app.progress.activeRunId || app.progressTracker?.activeRunId || app.progress.lastCompletedRunId || (caseId + ':legacy');
            const completedRuns = Array.isArray(app.progress.completedRunIds) ? app.progress.completedRunIds : [];
            if (completedRuns.includes(runId)) return;

            this._notifyPromiseChanges(app.npcMemoryService?.settlePromisesForCase(caseId, 'solved'));

            const solvedCases = Array.isArray(app.progress.solvedCases) ? app.progress.solvedCases : [];
            const isFirstSolve = !solvedCases.includes(caseId);
            completedRuns.push(runId);
            app.progress.completedRunIds = completedRuns;
            app.progress.lastCompletedRunId = runId;

            if (app.caseManager) app.caseManager.caseState = 'solved';
            app.progress.activeCase = null;
            app.progress.activeRunId = null;
            app.progress.caseData = app.caseManager?.toJSON() || app.progress.caseData;

            // Every distinct playthrough gets its own ending and history record.
            // Permanent progression rewards remain first-clear only.
            const ending = app.alternateEndings?.determineEnding(
                caseData, app.inventory, app.caseManager?.evidenceFound || 0,
                { npcMemoryService: app.npcMemoryService, solved: true }
            );
            if (ending) {
                events.emit('ending:determined', { caseId, runId, ending });
                const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
                    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
                })[char]);
                const quality = ending.outcomeQuality === 'compromised' ? 'consequences' :
                    !ending.condition || ending.condition === 'default' ? 'limited' :
                    ending.condition?.startsWith('evidence_count_') ? 'partial' : 'complete';
                setTimeout(() => events.emit('modal:show', {
                    title: ending.title || 'Дело завершено',
                    body: `<div class="ending-report ending-report--${quality}"><span class="ending-report-kicker">ИТОГОВЫЙ ПРОТОКОЛ · ${escapeHTML(caseId)}</span><p>${escapeHTML(ending.text || 'Расследование завершено.')}</p></div>`,
                    footer: '<button class="terminal-btn" data-bs-dismiss="modal">ЗАКРЫТЬ ДЕЛО</button>'
                }), 350);
            }

            if (isFirstSolve) {
                app.progress.solvedCases = [...solvedCases, caseId];
                const endingReputation = Number.isFinite(ending?.bonusReputation) ? ending.bonusReputation : 15;
                app.reputationSystem?.caseSolved(caseData, endingReputation);
                for (const locationId of ending?.unlocks || []) app.locationManager?.unlockLocation(locationId);
                app.ttsEngine?.playSuccessSound();
            }

            if (app.progressTracker?.stats && Array.isArray(app.progress.solvedCases)) {
                const knownSolved = Array.isArray(app.progressTracker.stats.solvedCaseIds)
                    ? app.progressTracker.stats.solvedCaseIds : [];
                app.progressTracker.stats.solvedCaseIds = [...new Set([...knownSolved, ...app.progress.solvedCases])];
                app.progressTracker.stats.totalCasesSolved = Math.max(
                    Number(app.progressTracker.stats.totalCasesSolved) || 0,
                    app.progressTracker.stats.solvedCaseIds.length
                );
            }
            app.progressTracker?.caseSolved?.(caseData, runId, ending);
            app.progress.trackerData = app.progressTracker?.toJSON?.() || app.progress.trackerData;
            app.progress.reputationData = app.reputationSystem?.toJSON() || app.progress.reputationData;
            const runRecord = app.progressTracker?.stats?.casesHistory?.find(record => record.runId === runId) || null;
            app.achievementSystem?.checkAll({ caseData, runRecord, ending, firstClear: isFirstSolve });
            app.progress.achievementData = app.achievementSystem?.toJSON?.() || app.progress.achievementData;
            app.caseListUI?.setProgress(app.progress);
            app.caseArchiveUI?.setProgress(app.progress);
            app._updateMainMenu();
            document.getElementById('btn-continue')?.classList.add('hidden');
            app._quickSave();
        });

        on('case:failed', (data = {}) => {
            const caseId = data.caseId || app.caseManager?.currentCase?.id || app.progress?.activeCase;
            if (!caseId || app.progress?.activeCase !== caseId ||
                app.caseManager?.caseState === 'failed') return;

            // Finalize the run once. Otherwise reload exposes a dead Continue
            // action and repeated events can double-count failure penalties.
            if (app.caseManager) app.caseManager.caseState = 'failed';
            this._notifyPromiseChanges(app.npcMemoryService?.settlePromisesForCase(caseId, 'failed'));
            app.progress.activeCase = null;
            app.progress.caseData = app.caseManager?.toJSON?.() || app.progress.caseData;
            const failedCases = Array.isArray(app.progress.failedCases) ? app.progress.failedCases : [];
            if (!failedCases.includes(caseId)) app.progress.failedCases = [...failedCases, caseId];

            const caseData = app.caseManager?.currentCase || getCaseById(caseId) || { id: caseId, title: caseId };
            const runId = app.progress.activeRunId || app.progressTracker?.activeRunId || (caseId + ':legacy');
            const completedRuns = Array.isArray(app.progress.completedRunIds) ? app.progress.completedRunIds : [];
            if (completedRuns.includes(runId)) return;
            completedRuns.push(runId);
            app.progress.completedRunIds = completedRuns;
            app.progress.lastCompletedRunId = runId;
            app.progress.activeRunId = null;
            app.progressTracker?.caseFailed(caseData, runId);
            app.reputationSystem?.caseFailed(caseData);
            app.progress.trackerData = app.progressTracker?.toJSON?.() || app.progress.trackerData;
            app.caseArchiveUI?.setProgress(app.progress);
            app.progress.reputationData = app.reputationSystem?.toJSON?.() || app.progress.reputationData;
            app.caseListUI?.setProgress(app.progress);
            app._updateMainMenu?.();
            if (typeof document !== 'undefined') document.getElementById('btn-continue')?.classList.add('hidden');
            if (app._quickSave) app._quickSave();
            else app._saveProgress?.();

            const ending = app.alternateEndings?.determineEnding(
                caseData, app.inventory, app.caseManager?.evidenceFound || 0,
                { npcMemoryService: app.npcMemoryService, failed: true }
            );
            if (ending) {
                events.emit('ending:determined', { caseId, runId, ending });
                const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
                    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
                })[char]);
                // Reuse the already-visible confirmation dialog for the final
                // report. Chaining Bootstrap hide/show transitions on the same
                // modal can leave a queued report behind a stale backdrop.
                const showFailureReport = () => {
                    const modal = this.modalElement || document.getElementById('universal-modal');
                    const title = document.getElementById('modal-title');
                    const body = document.getElementById('modal-body');
                    const footer = document.getElementById('modal-footer');
                    if (!modal || !title || !body || !footer) return;
                    title.textContent = ending.title || 'Дело не раскрыто';
                    body.innerHTML = `<div class="ending-report ending-report--failed"><span class="ending-report-kicker">ИТОГОВЫЙ ПРОТОКОЛ · ${escapeHTML(caseId)}</span><p>${escapeHTML(ending.text || 'Расследование завершено без результата.')}</p></div>`;
                    footer.innerHTML = '<button class="terminal-btn" data-bs-dismiss="modal">ЗАКРЫТЬ ДЕЛО</button>';
                };
                if (this.modalElement?.classList.contains('show')) showFailureReport();
                else events.emit('modal:show', {
                    title: ending.title || 'Дело не раскрыто',
                    body: `<div class="ending-report ending-report--failed"><span class="ending-report-kicker">ИТОГОВЫЙ ПРОТОКОЛ · ${escapeHTML(caseId)}</span><p>${escapeHTML(ending.text || 'Расследование завершено без результата.')}</p></div>`,
                    footer: '<button class="terminal-btn" data-bs-dismiss="modal">ЗАКРЫТЬ ДЕЛО</button>'
                });
            }
        });

        on('weather:changed', (data) => {
            document.getElementById('weather-icon').textContent = data.config.icon;
            document.getElementById('weather-name').textContent = data.config.name;
        });

        on('sync:reload_needed', () => {
            // Cloud data was persisted; reload to rebuild every system from the same snapshot.
            window.location.reload();
        });

        on('sync:conflict', () => {
            events.emit('notification:show', {
                message: 'Облачное сохранение новее. Текущее расследование сохранено; выберите версию в меню аккаунта.',
                type: 'warning',
                duration: 6000
            });
        });

        this.intervals.push(setInterval(() => app._quickSave(), 10000));
        // Timed autosave may not fire if the player closes the tab immediately.
        // pagehide also covers navigation and bfcache without blocking unload.
        if (typeof window !== 'undefined' && window.addEventListener) {
            this.pageHideHandler = () => { if (app.progress) app._quickSave(); };
            window.addEventListener('pagehide', this.pageHideHandler);
        }
        this.intervals.push(setInterval(() => {
            if (!app.authManager?.isUserLoggedIn() || !app.progress || !app.syncManager) return;
            // A cloud sync must capture the latest NPC, board and dialogue state,
            // not the snapshot from the previous ten-second local autosave.
            if (app._quickSave()) app.syncManager.saveEverywhere(app.progress);
        }, 30000));
    }

    _showModal(data) {
        const body = document.getElementById('modal-body');
        const title = document.getElementById('modal-title');
        const footer = document.getElementById('modal-footer');
        if (!body || !title || !footer || !this.modalElement) return;
        title.innerHTML = data.title || '';
        body.innerHTML = data.body || '';
        footer.innerHTML = data.footer || '';
        // Bind callbacks only after this modal is actually dequeued and rendered.
        // This avoids racing the shared modal queue when another narrative window
        // is closing and keeps controller logic out of HTML string handlers.
        if (typeof data.onConfirm === 'function') {
            const confirmButton = footer.querySelector('#btn-confirm-abandon-case');
            if (confirmButton) {
                // Bootstrap ignores hide() while the opening fade transition is
                // still running. Keep the destructive action unavailable until
                // the modal is fully shown, so the follow-up ending can always
                // close this dialog and enter the modal queue.
                confirmButton.disabled = true;
                this.modalElement.addEventListener('shown.bs.modal', () => {
                    if (confirmButton.isConnected) confirmButton.disabled = false;
                }, { once: true });
                confirmButton.addEventListener('click', () => {
                    if (confirmButton.disabled) return;
                    confirmButton.disabled = true;
                    data.onConfirm();
                });
            }
        }
        bootstrap.Modal.getOrCreateInstance(this.modalElement).show();
    }

    dispose() {
        if (this.modalElement && this.modalHideHandler) {
            this.modalElement.removeEventListener('hide.bs.modal', this.modalHideHandler);
        }
        if (this.modalElement && this.modalHiddenHandler) {
            this.modalElement.removeEventListener('hidden.bs.modal', this.modalHiddenHandler);
        }
        this.modalHideHandler = null;
        this.modalHiddenHandler = null;
        this.modalIsHiding = false;
        this.pendingModalData = null;
        this.modalElement = null;
        if (this.pageHideHandler && typeof window !== 'undefined') {
            window.removeEventListener('pagehide', this.pageHideHandler);
            this.pageHideHandler = null;
        }
        this.unsubscribers.splice(0).reverse().forEach(unsubscribe => unsubscribe());
        this.intervals.splice(0).forEach(intervalId => clearInterval(intervalId));
        this.bound = false;
    }
}
