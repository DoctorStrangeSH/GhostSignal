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
        this.npcMemoryService = null;
        this.npcMotivationService = null;
        this.npcSocialNetwork = null;
        this.npcRelationshipService = null;
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
        this.navigationController = new NavigationController(this);
        this.saveController = new SaveController(this, storage);
        this.eventController = new EventController(this);
        this.caseController = new CaseController(this);

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

        this.caseManager = CaseManager.fromJSON(this.progress.caseData, this.gameTime, this.locationManager, this.inventory, this.progress.activeCase);
        this.caseListUI = new CaseListUI('cases-list'); this.caseListUI.setProgress(this.progress);

        this.npcManager = NPCManager.fromJSON(this.progress.npcData, this.gameTime, this.inventory, this.progress.activeCase);
        this.npcMemoryService = NPCMemoryService.fromJSON(this.progress.npcMemoryData, this.progress.activeCase);
        this.npcManager.setMemoryService(this.npcMemoryService);
        this.npcMotivationService = new NPCMotivationService(this.npcMemoryService);
        this.npcSocialNetwork = NPCSocialNetwork.fromJSON(this.progress.npcSocialData, this.npcMemoryService, this.npcManager, this.gameTime);
        const activeSocialCase = this.progress.activeCase ? getCaseById(this.progress.activeCase) : null;
        if (activeSocialCase) this.npcMotivationService.setCase(activeSocialCase);
        this.npcSocialNetwork.setMotivationService(this.npcMotivationService);
        if (activeSocialCase) this.npcSocialNetwork.setCase(activeSocialCase);
        this.npcRelationshipService = NPCRelationshipService.fromJSON(
            this.progress.npcRelationshipData, this.npcMemoryService, this.npcManager, this.gameTime, this.npcSocialNetwork
        );
        if (activeSocialCase) this.npcRelationshipService.setCase(activeSocialCase);
        this.npcSocialNetwork.setRelationshipService(this.npcRelationshipService);
        this.npcManager.setSocialNetwork(this.npcSocialNetwork);
        this.npcManager.setRelationshipService(this.npcRelationshipService);
        this.npcListUI = new NPCListUI('npcs-list'); this.npcListUI.setNPCManager(this.npcManager);

        this.dialogueEngine = new DialogueEngine(this.inventory, this.gameTime);
        this.dialogueEngine.setMemoryService(this.npcMemoryService);
        this.dialogueEngine.setMotivationService(this.npcMotivationService);
        this.dialogueEngine.setSocialNetwork(this.npcSocialNetwork);
        this.dialogueEngine.setRelationshipService(this.npcRelationshipService);
        this.callInterface = new CallInterface(); this.callInterface.setDialogueEngine(this.dialogueEngine);

        this.ttsEngine = new TTSEngine();
        this.soundEffects = new SoundEffectsManager(this.ttsEngine);

        this.minigameManager = new MinigameManager(); this.minigameManager.setContainer('modal-body'); this._registerMinigames();

        this.investigationBoard = InvestigationBoard.fromJSON(this.progress.boardData);
        // Legacy snapshots had no case ID; associate them with the active saved case.
        this.investigationBoard.setCase(this.progress.activeCase, true);
        this.dialogueEngine.setInvestigationBoard(this.investigationBoard);
        this.boardUI = new BoardUI('board-area'); this.boardUI.setBoard(this.investigationBoard); this.boardUI.setInventory(this.inventory); this.boardUI.setMemoryService(this.npcMemoryService); this.boardUI.setLocationManager(this.locationManager);

        this.notesManager = NotesManager.fromJSON(this.progress.notesData);
        this.notesUI = new NotesUI('notes-content'); this.notesUI.setNotesManager(this.notesManager);

        this.radioPlayer = new RadioPlayer();
        this.answerChecker = new AnswerChecker();
        this.progressTracker = ProgressTracker.fromJSON(this.progress.trackerData);
        this.statsScreen = new StatsScreen('screen-stats');

        this.reputationSystem = ReputationSystem.fromJSON(this.progress.reputationData);
        this.newspaperUI = new NewspaperUI();
        this.stakeoutSystem = StakeoutSystem.fromJSON(this.progress.stakeoutData, this.gameTime);
        this.evidenceChainSystem = EvidenceChainSystem.fromJSON(this.progress.chainData, this.inventory, this.progress.activeCase);
        if (this.caseManager?.currentCase) this.evidenceChainSystem.loadChainsForCase(this.caseManager.currentCase, true);
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

        // Reconcile already-collected clues after listeners are attached.
        if (this.caseManager?.currentCase) this.evidenceChainSystem?.checkChains();

        setTimeout(() => { if (!storage.get('tutorial_completed')) this.tutorialSystem.start(); }, 3000);

        console.log('👻 GHOST SIGNAL готов.');
    }

    _defaultProgress() {
        return {
            solvedCases: [], failedCases: [], totalHintsUsed: 0, totalTimeSpent: 0, activeCase: null,
            gameTime: { hour: 8, minute: 0, day: 1 },
            locationData: null, inventoryData: null, caseData: null, npcData: null,
            boardData: null, notesData: null, trackerData: null, reputationData: null,
            stakeoutData: null, chainData: null, weatherData: null, interrogationData: null, npcMemoryData: null, npcSocialData: null, npcRelationshipData: null
        };
    }

    _initGameTime() {
        this.gameTime = this.progress.gameTime ? GameTime.fromJSON(this.progress.gameTime) : new GameTime(8, 0, 1);
        this.gameTime.onChange((data) => {
            this.progress.gameTime = this.gameTime.toJSON();
            this._saveProgress();
            if (this.clockUI) this.clockUI.update(this.gameTime);
            events.emit('time:changed', data);
        });
    }

    _bindNavigation() {
        this.navigationController.bindNavigation();
    }

    _bindKeyboard() {
        this.navigationController.bindKeyboard();
    }

    _bindGlobalShortcuts() {
        this.navigationController.bindGlobalShortcuts();
    }

    _bindEvents() {
        this.eventController.bind();
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
                this.investigationBoard = new InvestigationBoard(); this.boardUI.setBoard(this.investigationBoard); this.dialogueEngine?.setInvestigationBoard(this.investigationBoard);
                this.notesManager = new NotesManager(); this.notesUI.setNotesManager(this.notesManager);
                this.npcManager = new NPCManager(this.gameTime, this.inventory);
                this.npcManager.setMemoryService(this.npcMemoryService);
                this.npcManager.setSocialNetwork(this.npcSocialNetwork);
                this.npcManager.setRelationshipService(this.npcRelationshipService);
                this.npcListUI.setNPCManager(this.npcManager);
                this.caseManager = new CaseManager(this.gameTime, this.locationManager, this.inventory);
                this.npcSocialNetwork?.resetCase(this.progress.activeCase);
                this.npcRelationshipService?.resetCase(this.progress.activeCase);
                this.progress.npcSocialData = this.npcSocialNetwork?.toJSON();
                this.progress.npcRelationshipData = this.npcRelationshipService?.toJSON();
                this.progress.activeCase = null; this.progress.caseData = null; this.progress.inventoryData = null; this.progress.boardData = null; this.progress.npcData = null; this.progress.notesData = null;
                this._saveProgress(); modal.hide(); this.navigateTo('screen-main-menu');
            }
        });
        body.querySelector('#btn-reset-all')?.addEventListener('click', () => { if (confirm('УДАЛИТЬ ВСЁ?')) { storage.clearAll(); modal.hide(); location.reload(); } });
    }

    _saveProgress() {
        return this.saveController.saveProgress();
    }

    _quickSave() {
        return this.saveController.quickSave();
    }

    navigateTo(screenId) {
        this.navigationController.navigateTo(screenId);
    }

    loadCase(caseId) {
        return this.caseController.loadCase(caseId);
    }

    _switchTab(tabId) {
        this.navigationController.switchTab(tabId);
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
