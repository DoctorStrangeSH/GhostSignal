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
    }

    _subscribe(name, handler) {
        const unsubscribe = this.events.on(name, handler);
        if (typeof unsubscribe === 'function') this.unsubscribers.push(unsubscribe);
    }

    _notifyPromiseChanges(changes) {
        if (!Array.isArray(changes) || changes.length === 0) return;
        this.events.emit('npc:memory_changed', { reason: 'promise_resolution', changes });
    }

    bind() {
        if (this.bound) return;
        this.bound = true;
        const app = this.app;
        const events = this.events;
        const on = (name, handler) => this._subscribe(name, handler);

        // Модалка
        on('modal:show', (data) => {
            const body = document.getElementById('modal-body');
            const title = document.getElementById('modal-title');
            const footer = document.getElementById('modal-footer');
            if (!body || !title || !footer) return;
            title.innerHTML = data.title || '';
            body.innerHTML = data.body || '';
            footer.innerHTML = data.footer || '';
            new bootstrap.Modal(document.getElementById('universal-modal')).show();
        });

        on('navigation:go', (id) => { app.navigateTo(id); if (id === 'screen-map') app.mapRenderer?.render(); });
        on('case:select', (id) => app.loadCase(id));
        on('case:load', (id) => app.loadCase(id));

        on('case:started', (data) => {
            app.progress.activeCase = app.caseManager.currentCase?.id;
            app.npcMemoryService?.setCase(data.caseData.id);
            app.progress.npcMemoryData = app.npcMemoryService?.toJSON();
            app.progress.caseData = app.caseManager.toJSON();
            app._saveProgress();
            app.progressTracker.startCase(data.caseData.id);
            app.npcManager.loadNPCsForCase(data.caseData);
            app.npcListUI.render();
            app.evidenceChainSystem?.loadChainsForCase(data.caseData);
            app.evidenceChainSystem?.checkChains();
            setTimeout(() => { app.notesManager?.collectNote('initial_report'); app.notesManager?.collectNote('newspaper_article'); }, 1000);
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

        on('npc:call', (id) => {
            const npc = getNPCById(id);
            const avail = app.npcManager?.isNPCAvailable(id);
            if (!npc) { events.emit('notification:show', { message: 'Абонент не найден', type: 'error', duration: 2000 }); return; }
            if (!avail?.available) { events.emit('notification:show', { message: avail?.message || 'Недоступен', type: 'warning', duration: 3000 }); return; }
            app.gameTime.advance(CONFIG.time.costs.call);
            app.callInterface.startCall(id);
        });

        on('npc:chat', (id) => {
            const npc = getNPCById(id);
            const avail = app.npcManager?.isNPCAvailable(id);
            if (!npc || !avail?.available) { events.emit('npc:call', id); return; }
            app.gameTime.advance(CONFIG.time.costs.dialogue);
            app.callInterface.startCall(id);
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

        on('case:solved', (data = {}) => {
            const caseData = app.caseManager?.currentCase || getCaseById(data.caseId) || data;
            const caseId = caseData?.id || data.caseId;
            if (!caseId) return;

            this._notifyPromiseChanges(app.npcMemoryService?.settlePromisesForCase(caseId, 'solved'));

            const solvedCases = Array.isArray(app.progress.solvedCases) ? app.progress.solvedCases : [];
            const isFirstSolve = !solvedCases.includes(caseId);

            if (app.caseManager) app.caseManager.caseState = 'solved';
            app.progress.activeCase = null;
            app.progress.caseData = app.caseManager?.toJSON() || app.progress.caseData;

            // Повторная отправка события не должна повторно начислять статистику и репутацию.
            if (isFirstSolve) {
                const ending = app.alternateEndings?.determineEnding(
                    caseData,
                    app.inventory,
                    app.caseManager?.evidenceFound || 0,
                    { npcMemoryService: app.npcMemoryService }
                );
                if (ending) {
                    events.emit('ending:determined', { caseId, ending });
                    setTimeout(() => events.emit('modal:show', {
                        title: ending.title || 'Дело завершено',
                        body: '<div class="ending-report"><p style="white-space:pre-line;">' + (ending.text || 'Расследование завершено.') + '</p></div>',
                        footer: '<button class="terminal-btn" data-bs-dismiss="modal">ЗАКРЫТЬ ДЕЛО</button>'
                    }), 350);
                }

                app.progress.solvedCases = [...solvedCases, caseId];
                app.progressTracker?.caseSolved(caseData);
                app.reputationSystem?.caseSolved(caseData);
                if (ending?.bonusReputation) {
                    app.reputationSystem?.addReputation(ending.bonusReputation, 'Бонус концовки: ' + (ending.title || caseId));
                }
                for (const locationId of ending?.unlocks || []) {
                    app.locationManager?.unlockLocation(locationId);
                }
                app.ttsEngine?.playSuccessSound();
            }

            app.progress.trackerData = app.progressTracker?.toJSON() || app.progress.trackerData;
            app.progress.reputationData = app.reputationSystem?.toJSON() || app.progress.reputationData;
            app.achievementSystem?.checkAll();
            app.caseListUI?.setProgress(app.progress);
            app._updateMainMenu();
            document.getElementById('btn-continue')?.classList.add('hidden');
            app._quickSave();
        });

        on('case:failed', (data) => {
            const caseId = data?.caseId || app.caseManager?.currentCase?.id || app.progress?.activeCase;
            if (caseId) {
                this._notifyPromiseChanges(app.npcMemoryService?.settlePromisesForCase(caseId, 'failed'));
            }
            app.ttsEngine?.playErrorSound();
            app.reputationSystem?.caseFailed(data);
            app.progress.reputationData = app.reputationSystem?.toJSON();
            app._saveProgress();
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
        this.intervals.push(setInterval(() => { if (app.authManager?.isUserLoggedIn() && app.progress) app.syncManager?.saveEverywhere(app.progress); }, 30000));
    }

    dispose() {
        this.unsubscribers.splice(0).reverse().forEach(unsubscribe => unsubscribe());
        this.intervals.splice(0).forEach(intervalId => clearInterval(intervalId));
        this.bound = false;
    }
}
