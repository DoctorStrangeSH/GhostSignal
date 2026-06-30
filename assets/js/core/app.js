class App {
    constructor() {
        this.currentScreen = 'screen-main-menu';
        this.currentCase = null;
        this.gameTime = null;
        this.clockUI = null;
        this.ambiance = null;
        this.progress = null;
        this.locationManager = null;
        this.sceneRenderer = null;
        this.mapRenderer = null;
        this.inventory = null;
        this.inventoryUI = null;
        this.caseManager = null;
        this.caseListUI = null;
        this.npcManager = null;
        this.npcListUI = null;
        this.dialogueEngine = null;
        this.callInterface = null;
        this.ttsEngine = null;
        this.soundEffects = null;
        this.minigameManager = null;
        this.investigationBoard = null;
        this.boardUI = null;
        this.notesManager = null;
        this.notesUI = null;
        this.radioPlayer = null;
        this.answerChecker = null;
        this.progressTracker = null;
        this.statsScreen = null;
        this.reputationSystem = null;
        this.stakeoutSystem = null;
        this.evidenceChainSystem = null;
        this.weatherSystem = null;
        this.jukebox = null;
        this.ambianceDetails = null;
        this.tutorialSystem = null;
        this.achievementSystem = null;
        this.difficultySystem = null;
        this.interrogationSystem = null;
        this.alternateEndings = null;
        this.deductionScreen = null;
        this.authManager = null;
        this.cloudStorage = null;
        this.syncManager = null;
        this.authUI = null;
        this.newspaperUI = null;
        this.detectiveThoughts = null;
        this.locationIntro = null;
        this.ambientSounds = null;

        this._init();
    }

    _init() {
        console.log('👻 GHOST SIGNAL v' + CONFIG.version + ' — запуск...');
        const loading = new LoadingScreen();
        const loadSteps = [
            { progress: 10, message: 'ЗАПУСК ТЕРМИНАЛА...' },
            { progress: 25, message: 'ПРОВЕРКА СОЕДИНЕНИЯ...' },
            { progress: 40, message: 'ЗАГРУЗКА ДЕЛ...' },
            { progress: 60, message: 'СИНХРОНИЗАЦИЯ...' },
            { progress: 80, message: 'ПОИСК СИГНАЛА...' },
            { progress: 100, message: 'ГОТОВО' }
        ];
        let step = 0;
        const iv = setInterval(() => {
            if (step < loadSteps.length) { loading.setProgress(loadSteps[step].progress, loadSteps[step].message); step++; }
            else { clearInterval(iv); setTimeout(() => { loading.hide(); this._afterLoad(); }, 300); }
        }, 400);
    }

    _afterLoad() {
        console.log('📂 Загрузка данных...');
        this.progress = storage.loadProgress() || this._defaultProgress();

        this._initGameTime();
        this._bindNavigation();
        this._updateMainMenu();
        this._bindKeyboard();
        this._bindGlobalShortcuts();

        this.clockUI = new ClockUI(); this.clockUI.update(this.gameTime);
        this.ambiance = new AmbianceManager();

        this.locationManager = new LocationManager(this.gameTime);
        if (this.progress.locationData) {
            const s = this.progress.locationData;
            this.locationManager.unlockedLocations = new Set(s.unlockedLocations || []);
            this.locationManager.currentLocation = s.currentLocation || null;
        }

        this.inventory = Inventory.fromJSON(this.progress.inventoryData);
        this.inventoryUI = new InventoryUI('inventory-list');
        this.inventoryUI.setInventory(this.inventory);

        this.sceneRenderer = new SceneRenderer('scene-container');
        this.sceneRenderer.setLocationManager(this.locationManager);
        this.sceneRenderer.setInventory(this.inventory);

        this.mapRenderer = new MapRenderer('map-container'); this.mapRenderer.setLocationManager(this.locationManager);

        this.caseManager = CaseManager.fromJSON(this.progress.caseData, this.gameTime, this.locationManager, this.inventory);
        this.caseListUI = new CaseListUI('cases-list'); this.caseListUI.setProgress(this.progress);

        this.npcManager = NPCManager.fromJSON(this.progress.npcData, this.gameTime, this.inventory);
        this.npcListUI = new NPCListUI('npcs-list'); this.npcListUI.setNPCManager(this.npcManager);

        this.dialogueEngine = new DialogueEngine(this.inventory, this.gameTime);
        this.callInterface = new CallInterface(); this.callInterface.setDialogueEngine(this.dialogueEngine);

        this.ttsEngine = new TTSEngine();
        this.soundEffects = new SoundEffectsManager(this.ttsEngine);

        this.minigameManager = new MinigameManager(); this.minigameManager.setContainer('modal-body'); this._registerMinigames();

        this.investigationBoard = InvestigationBoard.fromJSON(this.progress.boardData);
        this.boardUI = new BoardUI('board-area'); this.boardUI.setBoard(this.investigationBoard); this.boardUI.setInventory(this.inventory);

        this.notesManager = NotesManager.fromJSON(this.progress.notesData);
        this.notesUI = new NotesUI('notes-content'); this.notesUI.setNotesManager(this.notesManager);

        this.radioPlayer = new RadioPlayer();
        this.answerChecker = new AnswerChecker();
        this.progressTracker = ProgressTracker.fromJSON(this.progress.trackerData);
        this.statsScreen = new StatsScreen('screen-stats');

        this.reputationSystem = ReputationSystem.fromJSON(this.progress.reputationData);
        this.newspaperUI = new NewspaperUI();
        this.stakeoutSystem = StakeoutSystem.fromJSON(this.progress.stakeoutData, this.gameTime);
        this.evidenceChainSystem = EvidenceChainSystem.fromJSON(this.progress.chainData, this.inventory);
        this.weatherSystem = WeatherSystem.fromJSON(this.progress.weatherData, this.gameTime);
        this.jukebox = new Jukebox();
        this.ambianceDetails = new AmbianceDetails(this.gameTime, this.weatherSystem);
        this.tutorialSystem = new TutorialSystem();
        this.achievementSystem = new AchievementSystem(); this.achievementSystem.load();
        this.difficultySystem = new DifficultySystem();
        this.interrogationSystem = InterrogationSystem.fromJSON(this.progress.interrogationData);
        this.alternateEndings = new AlternateEndings();
        this.deductionScreen = new DeductionScreen();

        this.authManager = new AuthManager();
        this.cloudStorage = new CloudStorage(this.authManager);
        this.syncManager = new SyncManager(this.authManager, this.cloudStorage, storage);
        this.authUI = new AuthUI(this.authManager);

        this.detectiveThoughts = new DetectiveThoughts();
        this.locationIntro = new LocationIntro();
        this.ambientSounds = new AmbientSounds();

        if (storage.hasSave() && this.progress.activeCase) {
            document.getElementById('btn-continue').classList.remove('hidden');
        }

        const weather = this.weatherSystem.getCurrentWeather();
        document.getElementById('weather-icon').textContent = weather.icon;
        document.getElementById('weather-name').textContent = weather.name;

        setTimeout(() => {
            events.emit('notification:show', { message: 'Система готова. ' + this.gameTime.getFormatted(), type: 'system', duration: 3000 });
        }, 1500);

        this._bindEvents();

        setTimeout(() => { if (!storage.get('tutorial_completed')) this.tutorialSystem.start(); }, 3000);

        console.log('👻 GHOST SIGNAL готов.');
    }

    _defaultProgress() {
        return {
            solvedCases: [], failedCases: [], totalHintsUsed: 0, totalTimeSpent: 0, activeCase: null,
            gameTime: { hour: 8, minute: 0, day: 1 },
            locationData: null, inventoryData: null, caseData: null, npcData: null,
            boardData: null, notesData: null, trackerData: null, reputationData: null,
            stakeoutData: null, chainData: null, weatherData: null, interrogationData: null
        };
    }

    _initGameTime() {
        this.gameTime = this.progress.gameTime ? GameTime.fromJSON(this.progress.gameTime) : new GameTime(8, 0, 1);
        this.gameTime.onChange((data) => {
            this.progress.gameTime = this.gameTime.toJSON();
            storage.saveProgress(this.progress);
            if (this.clockUI) this.clockUI.update(this.gameTime);
            events.emit('time:changed', data);
        });
    }

    _bindNavigation() {
        document.getElementById('btn-open-cases')?.addEventListener('click', () => { this.navigateTo('screen-cases'); this.caseListUI?.render(); });
        document.getElementById('btn-continue')?.addEventListener('click', () => { if (this.progress.activeCase) this.loadCase(this.progress.activeCase); });
        document.getElementById('btn-stats')?.addEventListener('click', () => { this.statsScreen.setTracker(this.progressTracker); this.statsScreen.render(); this.navigateTo('screen-stats'); });
        document.getElementById('btn-options')?.addEventListener('click', () => this._showOptionsMenu());
        document.querySelectorAll('.btn-back').forEach(b => b.addEventListener('click', () => { const t = b.dataset.screen; if (t) this.navigateTo(t); }));
        document.querySelectorAll('.sidebar-tab').forEach(t => t.addEventListener('click', () => { const id = t.dataset.tab; this._switchTab(id); events.emit('tab:switched', id); }));
        document.getElementById('btn-map')?.addEventListener('click', () => { this.navigateTo('screen-map'); this.mapRenderer?.render(); });
        document.getElementById('btn-wait')?.addEventListener('click', () => this._showWaitDialog());
        document.getElementById('btn-hint')?.addEventListener('click', () => {
            const q = this.caseManager?.currentCase?.finalQuestion;
            if (q) {
                events.emit('modal:show', { title: '💡 ПОДСКАЗКА', body: `<p>${q.hint}</p>`, footer: '<button class="terminal-btn" data-bs-dismiss="modal">ПОНЯТНО</button>' });
                this.reputationSystem?.usedHint();
            }
        });
        document.getElementById('btn-final-answer')?.addEventListener('click', () => {
            if (this.caseManager?.currentCase) this.deductionScreen.show(this.caseManager.currentCase);
        });
    }

    _bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (this.currentScreen === 'screen-main-menu') {
                if (e.key === '1') document.getElementById('btn-open-cases')?.click();
                if (e.key === '2') { const b = document.getElementById('btn-continue'); if (b && !b.classList.contains('hidden')) b.click(); }
                if (e.key === '3') document.getElementById('btn-stats')?.click();
                if (e.key === '4') document.getElementById('btn-options')?.click();
            }
        });
    }

    _bindGlobalShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') { e.preventDefault(); this._quickSave(); return; }
            if (e.key === 'Escape' && !e.ctrlKey) {
                const m = document.querySelector('.modal.show');
                if (m) { bootstrap.Modal.getInstance(m)?.hide(); return; }
                if (this.currentScreen !== 'screen-main-menu') { this.navigateTo('screen-main-menu'); return; }
            }
            if (e.key === 'm' && !e.ctrlKey && this.currentScreen === 'screen-case-active') { e.preventDefault(); this.navigateTo('screen-map'); this.mapRenderer?.render(); }
            if (e.key === 'i' && !e.ctrlKey && this.currentScreen === 'screen-case-active') { e.preventDefault(); this._switchTab('tab-inventory'); }
            if (e.key === 'n' && !e.ctrlKey && this.currentScreen === 'screen-case-active') { e.preventDefault(); this._switchTab('tab-notes'); }
            if (e.key === 't' && !e.ctrlKey && this.currentScreen === 'screen-case-active') { e.preventDefault(); this._showWaitDialog(); }
        });
    }

    _bindEvents() {
        // Модалка
        events.on('modal:show', (data) => {
            const body = document.getElementById('modal-body');
            const title = document.getElementById('modal-title');
            const footer = document.getElementById('modal-footer');
            if (!body || !title || !footer) return;
            title.innerHTML = data.title || '';
            body.innerHTML = data.body || '';
            footer.innerHTML = data.footer || '';
            new bootstrap.Modal(document.getElementById('universal-modal')).show();
        });

        events.on('navigation:go', (id) => { this.navigateTo(id); if (id === 'screen-map') this.mapRenderer?.render(); });
        events.on('case:select', (id) => this.loadCase(id));
        events.on('case:load', (id) => this.loadCase(id));

        events.on('case:started', (data) => {
            this.progress.activeCase = this.caseManager.currentCase?.id;
            this.progress.caseData = this.caseManager.toJSON();
            storage.saveProgress(this.progress);
            this.progressTracker.startCase(data.caseData.id);
            this.npcManager.loadNPCsForCase(data.caseData);
            this.npcListUI.render();
            this.evidenceChainSystem?.loadChainsForCase(data.caseData);
            setTimeout(() => { this.notesManager?.collectNote('initial_report'); this.notesManager?.collectNote('newspaper_article'); }, 1000);
        });

        events.on('location:changed', (data) => {
            this.navigateTo('screen-case-active');
            this.sceneRenderer?.renderLocation(data.locationId);
            this.caseManager?.markLocationVisited(data.locationId);
            this.stakeoutSystem?.checkAll();
        });

        events.on('location:travel', (id) => { this.locationManager?.travelTo(id); this.sceneRenderer?.renderLocation(id); this.navigateTo('screen-case-active'); });

        events.on('inventory:changed', (data) => {
            this.progress.inventoryData = this.inventory?.toJSON();
            storage.saveProgress(this.progress);
            if (data.action === 'add') { this.caseManager?.onItemAcquired(data.itemId); if (getObjectById(data.itemId)?.isEvidence) this.ttsEngine?.playEvidenceSound(); }
            if ((this.inventory?.evidence?.length || 0) >= 3 && !this.notesManager?.hasNote('autopsy_report')) this.notesManager?.collectNote('autopsy_report');
            this.npcManager?.checkAutoTriggers();
            this.evidenceChainSystem?.checkChains();
        });

        // Удаление улики из инвентаря при переносе на доску
        events.on('inventory:remove', (evidenceId) => {
            if (this.inventory) {
                this.inventory.removeFromEvidence(evidenceId);
                this.inventoryUI.render();
            }
        });

        events.on('object:interact', (data) => {
            const obj = getObjectById(data.itemId);
            if (!obj) return;
            if (obj.takeable && this.inventory && !this.inventory.hasItem(data.itemId)) this.inventory.addItem(data.itemId);
            if (obj.interactions?.examine?.spawnsItem) { const sid = obj.interactions.examine.spawnsItem; if (this.inventory && !this.inventory.hasItem(sid)) setTimeout(() => this.inventory.addItem(sid), 500); }
            if (obj.interactions?.examine?.givesInsight) this.inventory?.addInsight(obj.interactions.examine.givesInsight);
            if (data.itemId === 'wall_safe' && this.inventory?.hasItem('small_key') && !this.minigameManager?.isGameCompleted('safe_lock')) setTimeout(() => events.emit('minigame:start', 'safe_lock'), 300);
            if (data.itemId === 'hidden_note' && !this.minigameManager?.isGameCompleted('cipher_note')) setTimeout(() => events.emit('minigame:start', 'cipher_note'), 300);
            this.gameTime?.advance(CONFIG.time.costs.examine);
        });

        events.on('insight:gained', (data) => { this.caseManager?.onInsightGained(data.insightId); this.npcManager?.checkAutoTriggers(); this.evidenceChainSystem?.checkChains(); });

        events.on('case:ready_for_final', (r) => { const a = document.getElementById('final-answer-area'); if (a) r ? a.classList.remove('hidden') : a.classList.add('hidden'); });

        events.on('npc:call', (id) => {
            const npc = getNPCById(id);
            const avail = this.npcManager?.isNPCAvailable(id);
            if (!npc) { events.emit('notification:show', { message: 'Абонент не найден', type: 'error', duration: 2000 }); return; }
            if (!avail?.available) { events.emit('notification:show', { message: avail?.message || 'Недоступен', type: 'warning', duration: 3000 }); return; }
            this.gameTime.advance(CONFIG.time.costs.call);
            this.callInterface.startCall(id);
        });

        events.on('npc:chat', (id) => {
            const npc = getNPCById(id);
            const avail = this.npcManager?.isNPCAvailable(id);
            if (!npc || !avail?.available) { events.emit('npc:call', id); return; }
            this.gameTime.advance(CONFIG.time.costs.dialogue);
            this.callInterface.startCall(id);
        });

        events.on('npc:auto_trigger', (data) => {
            events.emit('notification:show', { message: 'Входящий: ' + (getNPCById(data.npcId)?.name || 'Неизвестный'), type: 'system', duration: 4000 });
            setTimeout(() => events.emit('npc:call', data.npcId), 1500);
        });

        events.on('tts:speak', (d) => this.ttsEngine?.speak(d.text, { mood: d.mood || 'neutral' }));
        events.on('call:started', () => this.ttsEngine?.playDialTone());
        events.on('call:connected', () => this.ttsEngine?.playConnectSound());
        events.on('call:ended', () => { this.ttsEngine?.stop(); this.ttsEngine?.playHangupSound(); });
        events.on('minigame:start', (id) => this.minigameManager?.startGame(id));
        events.on('evidence:from_dialogue', (d) => { if (d.evidenceId && this.inventory) this.inventory.addItem(d.evidenceId); });

        events.on('board:updated', () => {
            if (this.investigationBoard) {
                this.investigationBoard.checkConclusions().forEach(id => { if (!this.inventory?.hasInsight(id)) this.inventory?.addInsight(id); });
                this.progress.boardData = this.investigationBoard.toJSON();
                storage.saveProgress(this.progress);
            }
        });

        events.on('note:collected', () => { this.progress.notesData = this.notesManager?.toJSON(); storage.saveProgress(this.progress); });
        events.on('fragment:saved', () => { this.progress.notesData = this.notesManager?.toJSON(); storage.saveProgress(this.progress); });

        events.on('case:solved', (data) => {
            this.ttsEngine?.playSuccessSound();
            this.reputationSystem?.caseSolved(data);
            this.achievementSystem?.checkAll();
            this.progress.reputationData = this.reputationSystem?.toJSON();
            storage.saveProgress(this.progress);
        });

        events.on('case:failed', (data) => {
            this.ttsEngine?.playErrorSound();
            this.reputationSystem?.caseFailed(data);
            this.progress.reputationData = this.reputationSystem?.toJSON();
            storage.saveProgress(this.progress);
        });

        events.on('weather:changed', (data) => {
            document.getElementById('weather-icon').textContent = data.config.icon;
            document.getElementById('weather-name').textContent = data.config.name;
        });

        events.on('sync:reload_needed', () => { this.progress = storage.loadProgress() || this._defaultProgress(); this._updateMainMenu(); });

        setInterval(() => this._quickSave(), 10000);
        setInterval(() => { if (this.authManager?.isUserLoggedIn() && this.progress) this.syncManager?.saveEverywhere(this.progress); }, 30000);
    }

    _registerMinigames() {
        this.minigameManager.registerGame({ id: 'cipher_note', type: 'cipher', name: 'Шифр записки', description: 'Расшифруйте сообщение.', encryptedText: 'Khoor, L qhhg khos! Phhw ph dw wkh edu.', decryptedText: 'hello, i need help! meet me at the bar.', shift: 3, hint: 'Шифр Цезаря.', reward: { type: 'insight', id: 'decoded_message' } });
        this.minigameManager.registerGame({ id: 'safe_lock', type: 'lock', name: 'Сейф', description: 'Откройте сейф.', code: '304', codeLength: 3, hintText: 'Номер комнаты.', clue: 'Это номер комнаты.', maxAttempts: 5, reward: { type: 'item', id: 'victim_diary' } });
        this.minigameManager.registerGame({ id: 'analyze_poison', type: 'analyze', name: 'Анализ яда', description: 'Смешайте реактивы.', targetRatio: [2, 1, 3], maxDrops: 12, reward: { type: 'insight', id: 'cyanide_identified' } });
        this.minigameManager.registerGame({ id: 'photorobot_suspect', type: 'photorobot', name: 'Фоторобот', description: 'Составьте портрет.', target: { hair: 2, eyes: 1, nose: 4, mouth: 3 }, reward: { type: 'insight', id: 'suspect_identified' } });
    }

    _showWaitDialog() {
        if (!this.gameTime) return;
        const body = document.getElementById('modal-body'), title = document.getElementById('modal-title'), footer = document.getElementById('modal-footer');
        if (!body || !title || !footer) return;
        title.textContent = '⏳ ОЖИДАНИЕ';
        body.innerHTML = `<p>Время: <strong>${this.gameTime.getFormatted()}</strong></p><div class="wait-options">${[30,60,120,0].map(m => `<button class="terminal-btn wait-btn" data-minutes="${m}">${m === 0 ? 'До утра' : '+' + m + ' мин'}</button>`).join('')}</div>`;
        footer.innerHTML = '<button class="terminal-btn" data-bs-dismiss="modal">ОТМЕНА</button>';
        const modal = new bootstrap.Modal(document.getElementById('universal-modal')); modal.show();
        body.querySelectorAll('.wait-btn').forEach(b => b.addEventListener('click', () => { const m = parseInt(b.dataset.minutes); m === 0 ? this.gameTime.advanceToMorning() : this.gameTime.advance(m); modal.hide(); }));
    }

    _showOptionsMenu() {
        const body = document.getElementById('modal-body'), title = document.getElementById('modal-title'), footer = document.getElementById('modal-footer');
        if (!body || !title || !footer) return;
        const diff = this.difficultySystem, cur = diff.getCurrent();
        title.textContent = '⚙️ НАСТРОЙКИ';
        body.innerHTML = `
            <h4>🎮 Сложность</h4>
            <div class="difficulty-options">${Object.entries(diff.levels).map(([k,v]) => `<button class="terminal-btn diff-btn ${k===diff.currentDifficulty?'active':''}" data-diff="${k}">${v.icon} ${v.name}</button>`).join('')}</div>
            <p class="diff-desc">${cur.description}</p>
            <hr><h4>📖 Обучение</h4><button id="btn-restart-tutorial" class="terminal-btn">🔄 ПРОЙТИ ЗАНОВО</button>
            <hr><h4>🔄 Сброс</h4><button id="btn-reset-case" class="terminal-btn" style="border-color:var(--accent-red-bright);">🗑️ ДЕЛО ЗАНОВО</button>
            <button id="btn-reset-all" class="terminal-btn" style="border-color:var(--accent-red-bright);">💀 СБРОСИТЬ ВСЁ</button>
            <hr><h4>🏆 Достижения</h4><div class="achievements-grid">${this.achievementSystem.getAll().map(a => `<div class="achievement-card ${a.unlocked?'unlocked':'locked'}"><span class="achievement-icon">${a.unlocked?a.icon:'🔒'}</span><div class="achievement-info"><div class="achievement-name">${a.name}</div><div class="achievement-desc">${a.description}</div></div><span class="achievement-rarity rarity-${a.rarity}">${a.rarity}</span></div>`).join('')}</div>
        `;
        footer.innerHTML = '<button class="terminal-btn" data-bs-dismiss="modal">ЗАКРЫТЬ</button>';
        const modal = new bootstrap.Modal(document.getElementById('universal-modal')); modal.show();
        body.querySelectorAll('.diff-btn').forEach(b => b.addEventListener('click', () => { diff.setDifficulty(b.dataset.diff); modal.hide(); this._showOptionsMenu(); }));
        body.querySelector('#btn-restart-tutorial')?.addEventListener('click', () => { this.tutorialSystem.reset(); modal.hide(); setTimeout(() => this.tutorialSystem.start(), 500); });
        body.querySelector('#btn-reset-case')?.addEventListener('click', () => {
            if (confirm('Сбросить дело?')) {
                this.inventory = new Inventory(); this.inventory.addItem('magnifying_glass'); this.inventoryUI.setInventory(this.inventory);
                this.investigationBoard = new InvestigationBoard(); this.boardUI.setBoard(this.investigationBoard);
                this.notesManager = new NotesManager(); this.notesUI.setNotesManager(this.notesManager);
                this.npcManager = new NPCManager(this.gameTime, this.inventory); this.npcListUI.setNPCManager(this.npcManager);
                this.caseManager = new CaseManager(this.gameTime, this.locationManager, this.inventory);
                this.progress.activeCase = null; this.progress.caseData = null; this.progress.inventoryData = null; this.progress.boardData = null; this.progress.npcData = null; this.progress.notesData = null;
                storage.saveProgress(this.progress); modal.hide(); this.navigateTo('screen-main-menu');
            }
        });
        body.querySelector('#btn-reset-all')?.addEventListener('click', () => { if (confirm('УДАЛИТЬ ВСЁ?')) { storage.clearAll(); modal.hide(); location.reload(); } });
    }

    _quickSave() {
        if (!this.progress) return;
        this.progress.gameTime = this.gameTime?.toJSON();
        this.progress.locationData = this.locationManager?.toJSON();
        this.progress.inventoryData = this.inventory?.toJSON();
        this.progress.caseData = this.caseManager?.toJSON();
        this.progress.npcData = this.npcManager?.toJSON();
        this.progress.boardData = this.investigationBoard?.toJSON();
        this.progress.notesData = this.notesManager?.toJSON();
        this.progress.trackerData = this.progressTracker?.toJSON();
        this.progress.reputationData = this.reputationSystem?.toJSON();
        this.progress.stakeoutData = this.stakeoutSystem?.toJSON();
        this.progress.chainData = this.evidenceChainSystem?.toJSON();
        this.progress.weatherData = this.weatherSystem?.toJSON();
        this.progress.interrogationData = this.interrogationSystem?.toJSON();
        storage.saveProgress(this.progress);
    }

    navigateTo(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(screenId);
        if (screen) { screen.classList.add('active'); this.currentScreen = screenId; }
    }

    loadCase(caseId) {
        const isNew = !this.progress.activeCase || this.progress.activeCase !== caseId;
        if (isNew && this.caseManager) this.caseManager.loadCase(caseId);
        this.navigateTo('screen-case-active');
        const loc = this.locationManager?.currentLocation || getCaseById(caseId)?.startLocation || 'police_station';
        if (this.sceneRenderer) this.sceneRenderer.renderLocation(loc);
        const cd = getCaseById(caseId);
        if (cd) { document.getElementById('header-case-id').textContent = caseId.replace('case-', ''); document.getElementById('header-case-title').textContent = cd.title; }
        this.progress.activeCase = caseId;
        storage.saveProgress(this.progress);
    }

    _switchTab(tabId) {
        document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const tab = document.querySelector(`[data-tab="${tabId}"]`), panel = document.getElementById(tabId);
        if (tab) tab.classList.add('active');
        if (panel) panel.classList.add('active');
        if (tabId === 'tab-board') this.boardUI?.render();
    }

    _updateMainMenu() {
        const stats = this.progressTracker?.getStats() || { totalCasesSolved: 0, rank: { name: 'СТАЖЁР' } };
        const tEl = document.getElementById('total-cases'), sEl = document.getElementById('solved-cases'), rEl = document.getElementById('detective-rank');
        if (tEl) tEl.textContent = Object.keys(CASES_INDEX).length;
        if (sEl) sEl.textContent = stats.totalCasesSolved;
        if (rEl) rEl.textContent = stats.rank?.name || 'СТАЖЁР';
    }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new App(); });