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
        this.authManager = null;
        this.cloudStorage = null;
        this.syncManager = null;
        this.authUI = null;
        
        this._init();
    }
    
    _init() {
        console.log('👻 GHOST SIGNAL v' + CONFIG.version + ' — инициализация терминала...');
        
        const loading = new LoadingScreen();
        
        const loadSteps = [
            { progress: 10, message: 'ЗАПУСК ТЕРМИНАЛА...' },
            { progress: 25, message: 'ПРОВЕРКА СОЕДИНЕНИЯ...' },
            { progress: 40, message: 'ЗАГРУЗКА ДЕЛ...' },
            { progress: 60, message: 'СИНХРОНИЗАЦИЯ ДАННЫХ...' },
            { progress: 80, message: 'ПОИСК СИГНАЛА...' },
            { progress: 100, message: 'ГОТОВО' }
        ];
        
        let stepIndex = 0;
        const loadInterval = setInterval(() => {
            if (stepIndex < loadSteps.length) {
                const step = loadSteps[stepIndex];
                loading.setProgress(step.progress, step.message);
                stepIndex++;
            } else {
                clearInterval(loadInterval);
                setTimeout(() => {
                    loading.hide();
                    this._afterLoad();
                }, 300);
            }
        }, 400);
    }
    
    _afterLoad() {
        console.log('📂 Загрузка данных...');
        
        this.progress = storage.loadProgress() || this._defaultProgress();
        console.log('Прогресс загружен:', this.progress);
        
        this._initGameTime();
        this._bindNavigation();
        this._updateMainMenu();
        this._bindKeyboard();
        this._bindGlobalShortcuts();
        
        // Часы
        this.clockUI = new ClockUI();
        this.clockUI.update(this.gameTime);
        console.log('✅ Часы инициализированы');
        
        // Атмосфера
        this.ambiance = new AmbianceManager();
        console.log('✅ Атмосфера инициализирована');
        
        // Локации
        this.locationManager = new LocationManager(this.gameTime);
        if (this.progress.locationData) {
            const saved = this.progress.locationData;
            this.locationManager.unlockedLocations = new Set(saved.unlockedLocations || []);
            this.locationManager.currentLocation = saved.currentLocation || null;
            this.locationManager.visitedLocations = new Set(saved.visitedLocations || []);
        }
        console.log('✅ Менеджер локаций инициализирован');
        
        // Инвентарь
        this.inventory = Inventory.fromJSON(this.progress.inventoryData);
        this.inventoryUI = new InventoryUI('inventory-list');
        this.inventoryUI.setInventory(this.inventory);
        console.log('✅ Инвентарь инициализирован');
        
        // Сцена и карта
        this.sceneRenderer = new SceneRenderer('scene-container');
        this.sceneRenderer.setLocationManager(this.locationManager);
        this.sceneRenderer.setInventory(this.inventory);
        console.log('✅ SceneRenderer инициализирован');
        
        this.mapRenderer = new MapRenderer('map-container');
        this.mapRenderer.setLocationManager(this.locationManager);
        console.log('✅ MapRenderer инициализирован');
        
        // Менеджер дел
        this.caseManager = CaseManager.fromJSON(
            this.progress.caseData,
            this.gameTime,
            this.locationManager,
            this.inventory
        );
        console.log('✅ Менеджер дел инициализирован');
        
        this.caseListUI = new CaseListUI('cases-list');
        this.caseListUI.setProgress(this.progress);
        console.log('✅ CaseListUI инициализирован');
        
        // NPC
        this.npcManager = NPCManager.fromJSON(
            this.progress.npcData,
            this.gameTime,
            this.inventory
        );
        console.log('✅ Менеджер NPC инициализирован');
        
        this.npcListUI = new NPCListUI('npcs-list');
        this.npcListUI.setNPCManager(this.npcManager);
        console.log('✅ NPCListUI инициализирован');
        
        // Диалоги и звонки
        this.dialogueEngine = new DialogueEngine(this.inventory, this.gameTime);
        this.callInterface = new CallInterface();
        this.callInterface.setDialogueEngine(this.dialogueEngine);
        console.log('✅ Система диалогов инициализирована');
        
        // TTS и звуки
        this.ttsEngine = new TTSEngine();
        this.soundEffects = new SoundEffectsManager(this.ttsEngine);
        console.log('✅ TTS и звуки инициализированы');
        
        // Мини-игры
        this.minigameManager = new MinigameManager();
        this.minigameManager.setContainer('modal-body');
        this._registerMinigames();
        console.log('✅ Мини-игры зарегистрированы');
        
        // Доска
        this.investigationBoard = InvestigationBoard.fromJSON(this.progress.boardData);
        this.boardUI = new BoardUI('board-area');
        this.boardUI.setBoard(this.investigationBoard);
        this.boardUI.setInventory(this.inventory);
        console.log('✅ Доска расследования инициализирована');
        
        // Заметки
        this.notesManager = NotesManager.fromJSON(this.progress.notesData);
        this.notesUI = new NotesUI('notes-content');
        this.notesUI.setNotesManager(this.notesManager);
        console.log('✅ Заметки инициализированы');
        
        // Радио
        this.radioPlayer = new RadioPlayer();
        console.log('✅ Радио инициализировано');
        
        // Проверка ответов и статистика
        this.answerChecker = new AnswerChecker();
        this.progressTracker = ProgressTracker.fromJSON(this.progress.trackerData);
        this.statsScreen = new StatsScreen('screen-stats');
        console.log('✅ Статистика инициализирована');
        
        // Firebase
        this.authManager = new AuthManager();
        this.cloudStorage = new CloudStorage(this.authManager);
        this.syncManager = new SyncManager(this.authManager, this.cloudStorage, storage);
        this.authUI = new AuthUI(this.authManager);
        console.log('✅ Firebase инициализирован');
        
        // Кнопка "Продолжить"
        if (storage.hasSave() && this.progress.activeCase) {
            document.getElementById('btn-continue').classList.remove('hidden');
        }
        
        // Приветственное уведомление
        setTimeout(() => {
            events.emit('notification:show', {
                message: 'Система готова. Текущее время: ' + this.gameTime.getFormatted(),
                type: 'system',
                duration: 3000
            });
        }, 1500);
        
        this._bindEvents();
        console.log('✅ Все события связаны');
        console.log('👻 GHOST SIGNAL готов к работе.');
    }
    
    _defaultProgress() {
        return {
            solvedCases: [],
            failedCases: [],
            totalHintsUsed: 0,
            totalTimeSpent: 0,
            activeCase: null,
            gameTime: { hour: CONFIG.time.startHour, minute: CONFIG.time.startMinute, day: CONFIG.time.startDay },
            locationData: null,
            inventoryData: null,
            caseData: null,
            npcData: null,
            boardData: null,
            notesData: null,
            trackerData: null
        };
    }
    
    _initGameTime() {
        if (this.progress.gameTime) {
            this.gameTime = GameTime.fromJSON(this.progress.gameTime);
        } else {
            this.gameTime = new GameTime(
                CONFIG.time.startHour,
                CONFIG.time.startMinute,
                CONFIG.time.startDay
            );
        }
        
        this.gameTime.onChange((data) => {
            this.progress.gameTime = this.gameTime.toJSON();
            storage.saveProgress(this.progress);
            
            if (this.clockUI) {
                this.clockUI.update(this.gameTime);
            }
            
            events.emit('time:changed', data);
            
            if (CONFIG.debug) {
                console.log(`Время: ${this.gameTime.getFormatted()}, День ${this.gameTime.day}, Период: ${this.gameTime.getPeriodName()}`);
            }
        });
    }
    
    _bindNavigation() {
        document.getElementById('btn-open-cases')?.addEventListener('click', () => {
            this.navigateTo('screen-cases');
            this.caseListUI?.render();
        });
        
        document.getElementById('btn-continue')?.addEventListener('click', () => {
            if (this.progress.activeCase) {
                this.loadCase(this.progress.activeCase);
            }
        });
        
        document.getElementById('btn-stats')?.addEventListener('click', () => {
            this.statsScreen.setTracker(this.progressTracker);
            this.statsScreen.render();
            this.navigateTo('screen-stats');
        });
        
        document.querySelectorAll('.btn-back').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.screen;
                if (target) this.navigateTo(target);
            });
        });
        
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                this._switchTab(tabId);
                events.emit('tab:switched', tabId);
            });
        });
        
        document.getElementById('btn-map')?.addEventListener('click', () => {
            this.navigateTo('screen-map');
            if (this.mapRenderer) this.mapRenderer.render();
        });
        
        document.getElementById('btn-wait')?.addEventListener('click', () => {
            this._showWaitDialog();
        });
        
        document.getElementById('btn-final-answer')?.addEventListener('click', () => {
            this._showFinalAnswerDialog();
        });
    }
    
    _bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (this.currentScreen === 'screen-main-menu') {
                switch(e.key) {
                    case '1': document.getElementById('btn-open-cases')?.click(); break;
                    case '2': 
                        const btn = document.getElementById('btn-continue');
                        if (btn && !btn.classList.contains('hidden')) btn.click();
                        break;
                    case '3': document.getElementById('btn-stats')?.click(); break;
                }
            }
        });
    }
    
    _bindGlobalShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this._quickSave();
                return;
            }
            
            if (e.key === 'Escape' && !e.ctrlKey && !e.altKey) {
                const openModal = document.querySelector('.modal.show');
                if (openModal) {
                    const modal = bootstrap.Modal.getInstance(openModal);
                    if (modal) modal.hide();
                    return;
                }
                
                if (this.currentScreen !== 'screen-main-menu') {
                    this.navigateTo('screen-main-menu');
                    return;
                }
            }
            
            if (e.key === 'm' && !e.ctrlKey && !e.altKey) {
                if (this.currentScreen === 'screen-case-active') {
                    e.preventDefault();
                    this.navigateTo('screen-map');
                    this.mapRenderer?.render();
                }
            }
            
            if (e.key === 'i' && !e.ctrlKey && !e.altKey) {
                if (this.currentScreen === 'screen-case-active') {
                    e.preventDefault();
                    this._switchTab('tab-inventory');
                }
            }
            
            if (e.key === 'n' && !e.ctrlKey && !e.altKey) {
                if (this.currentScreen === 'screen-case-active') {
                    e.preventDefault();
                    this._switchTab('tab-notes');
                }
            }
            
            if (e.key === 't' && !e.ctrlKey && !e.altKey) {
                if (this.currentScreen === 'screen-case-active') {
                    e.preventDefault();
                    this._showWaitDialog();
                }
            }
        });
    }
    
    _bindEvents() {
        events.on('navigation:go', (screenId) => {
            this.navigateTo(screenId);
            if (screenId === 'screen-map' && this.mapRenderer) {
                this.mapRenderer.render();
            }
        });
        
        events.on('case:select', (caseId) => {
            this.loadCase(caseId);
        });
        
        events.on('case:load', (caseId) => {
            this.loadCase(caseId);
        });
        
        events.on('case:started', (data) => {
            this.progress.activeCase = this.caseManager.currentCase?.id;
            this.progress.caseData = this.caseManager.toJSON();
            storage.saveProgress(this.progress);
            this.progressTracker.startCase(data.caseData.id);
            this.npcManager.loadNPCsForCase(data.caseData);
            this.npcListUI.render();
            
            setTimeout(() => {
                this.notesManager?.collectNote('initial_report');
                this.notesManager?.collectNote('newspaper_article');
            }, 1000);
        });
        
        events.on('location:changed', (data) => {
            console.log('📍 Локация изменена:', data.locationId);
            
            this.navigateTo('screen-case-active');
            
            if (this.sceneRenderer) {
                this.sceneRenderer.renderLocation(data.locationId);
            }
            
            this.caseManager?.markLocationVisited(data.locationId);
        });
        
        events.on('location:travel', (locationId) => {
            this.locationManager?.travelTo(locationId);
            if (this.sceneRenderer) {
                this.sceneRenderer.renderLocation(locationId);
            }
            this.navigateTo('screen-case-active');
        });
        
        events.on('inventory:changed', (data) => {
            this.progress.inventoryData = this.inventory?.toJSON();
            storage.saveProgress(this.progress);
            
            if (data.action === 'add') {
                this.caseManager?.onItemAcquired(data.itemId);
                const obj = getObjectById(data.itemId);
                if (obj?.isEvidence) {
                    this.ttsEngine?.playEvidenceSound();
                }
            }
            
            const evidenceCount = this.inventory?.evidence?.length || 0;
            if (evidenceCount >= 3 && !this.notesManager?.hasNote('autopsy_report')) {
                this.notesManager?.collectNote('autopsy_report');
            }
            
            this.npcManager?.checkAutoTriggers();
        });
        
        events.on('object:interact', (data) => {
            console.log('🔍 Взаимодействие с объектом:', data.itemId);
            
            const object = getObjectById(data.itemId);
            if (!object) {
                console.warn('Объект не найден:', data.itemId);
                return;
            }
            
            if (object.takeable && this.inventory && !this.inventory.hasItem(data.itemId)) {
                this.inventory.addItem(data.itemId);
            }
            
            if (object.interactions?.examine?.spawnsItem) {
                const spawnedId = object.interactions.examine.spawnsItem;
                if (this.inventory && !this.inventory.hasItem(spawnedId)) {
                    setTimeout(() => this.inventory.addItem(spawnedId), 500);
                }
            }
            
            if (object.interactions?.examine?.givesInsight) {
                this.inventory?.addInsight(object.interactions.examine.givesInsight);
            }
            
            if (data.itemId === 'wall_safe') {
                const hasKey = this.inventory?.hasItem('small_key');
                if (hasKey && !this.minigameManager?.isGameCompleted('safe_lock')) {
                    setTimeout(() => events.emit('minigame:start', 'safe_lock'), 300);
                }
            }
            
            if (data.itemId === 'hidden_note' && !this.minigameManager?.isGameCompleted('cipher_note')) {
                setTimeout(() => events.emit('minigame:start', 'cipher_note'), 300);
            }
            
            this.gameTime?.advance(CONFIG.time.costs.examine);
        });
        
        events.on('insight:gained', (data) => {
            this.caseManager?.onInsightGained(data.insightId);
            this.npcManager?.checkAutoTriggers();
        });
        
        events.on('case:ready_for_final', (ready) => {
            const finalArea = document.getElementById('final-answer-area');
            if (finalArea) {
                if (ready) finalArea.classList.remove('hidden');
                else finalArea.classList.add('hidden');
            }
        });
        
        events.on('npc:call', (npcId) => {
            const npc = getNPCById(npcId);
            const availability = this.npcManager?.isNPCAvailable(npcId);
            
            if (!npc) {
                events.emit('notification:show', { message: 'Абонент не найден', type: 'error', duration: 2000 });
                return;
            }
            
            if (!availability?.available) {
                events.emit('notification:show', { message: availability?.message || `${npc.name} недоступен`, type: 'warning', duration: 3000 });
                return;
            }
            
            this.gameTime.advance(CONFIG.time.costs.call);
            this.callInterface.startCall(npcId);
        });
        
        events.on('npc:auto_trigger', (data) => {
            events.emit('notification:show', {
                message: `Входящий вызов: ${getNPCById(data.npcId)?.name || 'Неизвестный'}`,
                type: 'system',
                duration: 4000
            });
            setTimeout(() => events.emit('npc:call', data.npcId), 1500);
        });
        
        events.on('tts:speak', (data) => {
            this.ttsEngine?.speak(data.text, { mood: data.mood || 'neutral', isPhoneCall: true });
        });
        
        events.on('call:started', () => this.ttsEngine?.playDialTone());
        events.on('call:connected', () => this.ttsEngine?.playConnectSound());
        events.on('call:ended', () => {
            this.ttsEngine?.stop();
            this.ttsEngine?.playHangupSound();
        });
        
        events.on('minigame:start', (gameId) => {
            this.minigameManager?.startGame(gameId);
        });
        
        events.on('evidence:from_dialogue', (data) => {
            if (data.evidenceId && this.inventory) {
                this.inventory.addItem(data.evidenceId);
            }
        });
        
        events.on('board:updated', () => {
            if (this.investigationBoard) {
                const insights = this.investigationBoard.checkConclusions();
                insights.forEach(insightId => {
                    if (!this.inventory?.hasInsight(insightId)) {
                        this.inventory?.addInsight(insightId);
                    }
                });
                this.progress.boardData = this.investigationBoard.toJSON();
                storage.saveProgress(this.progress);
            }
        });
        
        events.on('note:collected', () => {
            this.progress.notesData = this.notesManager?.toJSON();
            storage.saveProgress(this.progress);
        });
        
        events.on('fragment:saved', () => {
            this.progress.notesData = this.notesManager?.toJSON();
            storage.saveProgress(this.progress);
        });
        
        events.on('case:solved', () => {
            this.ttsEngine?.playSuccessSound();
        });
        
        events.on('case:failed', () => {
            this.ttsEngine?.playErrorSound();
        });
        
        events.on('sync:reload_needed', () => {
            this.progress = storage.loadProgress() || this._defaultProgress();
            this._updateMainMenu();
            events.emit('notification:show', {
                message: 'Данные обновлены из облака',
                type: 'system',
                duration: 3000
            });
        });
        
        // Автосохранение локальное
        setInterval(() => {
            this._quickSave();
        }, 10000);
        
        // Автосохранение в облако
        setInterval(() => {
            if (this.authManager?.isUserLoggedIn() && this.progress) {
                this.syncManager?.saveEverywhere(this.progress);
            }
        }, 30000);
    }
    
    _registerMinigames() {
        this.minigameManager.registerGame({
            id: 'cipher_note',
            type: 'cipher',
            name: 'Шифр записки',
            description: 'Записка зашифрована. Расшифруйте сообщение.',
            encryptedText: 'Khoor, L qhhg khos! Phhw ph dw wkh edu.',
            decryptedText: 'hello, i need help! meet me at the bar.',
            shift: 3,
            hint: 'Классический шифр Цезаря. Каждая буква сдвинута на 3 позиции.',
            reward: { type: 'insight', id: 'decoded_message' }
        });
        
        this.minigameManager.registerGame({
            id: 'safe_lock',
            type: 'lock',
            name: 'Сейф в номере',
            description: 'Откройте сейф, чтобы найти дневник.',
            code: '304',
            codeLength: 3,
            hintText: 'Номер комнаты мистера Блэквуда.',
            clue: 'Подсказка: это номер комнаты.',
            maxAttempts: 5,
            reward: { type: 'item', id: 'victim_diary' }
        });
    }
    
    _showWaitDialog() {
        if (!this.gameTime) return;
        
        const currentTime = this.gameTime.getFormatted();
        const period = this.gameTime.getPeriodName();
        
        const modalBody = document.getElementById('modal-body');
        const modalTitle = document.getElementById('modal-title');
        const modalFooter = document.getElementById('modal-footer');
        
        if (!modalBody || !modalTitle || !modalFooter) return;
        
        modalTitle.textContent = '⏳ ОЖИДАНИЕ';
        modalBody.innerHTML = `
            <p>Текущее время: <strong>${currentTime}</strong> (${period})</p>
            <p>Сколько времени желаете ждать?</p>
            <div class="wait-options">
                <button class="terminal-btn wait-btn" data-minutes="30">+30 минут</button>
                <button class="terminal-btn wait-btn" data-minutes="60">+1 час</button>
                <button class="terminal-btn wait-btn" data-minutes="120">+2 часа</button>
                <button class="terminal-btn wait-btn" data-minutes="0">До утра (06:00)</button>
            </div>
        `;
        modalFooter.innerHTML = `<button class="terminal-btn" data-bs-dismiss="modal">ОТМЕНА</button>`;
        
        const modal = new bootstrap.Modal(document.getElementById('universal-modal'));
        modal.show();
        
        modalBody.querySelectorAll('.wait-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const minutes = parseInt(btn.dataset.minutes);
                if (minutes === 0) {
                    this.gameTime.advanceToMorning();
                } else {
                    this.gameTime.advance(minutes);
                }
                modal.hide();
                
                events.emit('notification:show', {
                    message: `Время: ${this.gameTime.getFormatted()}, ${this.gameTime.getPeriodName()}`,
                    type: 'info',
                    duration: 2000
                });
            });
        });
    }
    
    _showFinalAnswerDialog() {
        if (!this.caseManager?.currentCase?.finalQuestion) return;
        if (typeof bootstrap === 'undefined') return;
        
        const question = this.caseManager.currentCase.finalQuestion;
        this.answerChecker.reset();
        
        const modalBody = document.getElementById('modal-body');
        const modalTitle = document.getElementById('modal-title');
        const modalFooter = document.getElementById('modal-footer');
        
        if (!modalBody || !modalTitle || !modalFooter) return;
        
        modalTitle.textContent = '🔍 ОБВИНЕНИЕ';
        modalBody.innerHTML = `
            <p class="final-question-text">${question.text}</p>
            <p class="final-question-hint">${question.hint}</p>
            <div class="answer-input-wrapper">
                <label for="final-answer-input">Введите имя преступника:</label>
                <input type="text" id="final-answer-input" class="terminal-input" 
                       placeholder="Введите ответ..." autocomplete="off">
                <span class="attempts-info" id="attempts-info"></span>
            </div>
            <div id="final-answer-feedback" class="hidden"></div>
        `;
        modalFooter.innerHTML = `
            <button id="btn-submit-answer" class="terminal-btn">ОТПРАВИТЬ</button>
            <button class="terminal-btn" data-bs-dismiss="modal">ОТМЕНА</button>
        `;
        
        const modal = new bootstrap.Modal(document.getElementById('universal-modal'));
        modal.show();
        
        const submitAnswer = () => {
            const input = document.getElementById('final-answer-input');
            const answer = input ? input.value : '';
            
            if (!answer.trim()) {
                events.emit('notification:show', { message: 'Введите ответ', type: 'warning', duration: 2000 });
                return;
            }
            
            const result = this.answerChecker.checkAnswer(answer, question.acceptableAnswers);
            this.progressTracker.addAttempt();
            
            const feedback = document.getElementById('final-answer-feedback');
            const attemptsInfo = document.getElementById('attempts-info');
            
            if (attemptsInfo) {
                attemptsInfo.textContent = `Попытка ${result.attempts} из ${result.maxAttempts}`;
            }
            
            if (feedback) {
                feedback.classList.remove('hidden');
                
                if (result.isCorrect) {
                    const fb = question.feedbackCorrect;
                    feedback.innerHTML = `
                        <div class="feedback feedback-success">
                            <h4>${fb.title}</h4>
                            <p>${fb.text}</p>
                            ${result.hadTypo ? '<p class="feedback-note">⚠️ Ответ принят с учётом опечатки.</p>' : ''}
                            ${fb.evidenceSummary ? `
                                <div class="evidence-summary">
                                    <h5>Ключевые улики:</h5>
                                    <ul>${fb.evidenceSummary.map(e => `<li>${e}</li>`).join('')}</ul>
                                </div>
                            ` : ''}
                        </div>
                    `;
                    
                    document.getElementById('btn-submit-answer').disabled = true;
                    document.getElementById('final-answer-input').disabled = true;
                    
                    this.progressTracker.caseSolved(this.caseManager.currentCase);
                    this.progress.solvedCases.push(this.caseManager.currentCase.id);
                    this.progress.activeCase = null;
                    this.caseManager.caseState = 'solved';
                    storage.saveProgress(this.progress);
                    this._updateMainMenu();
                    
                    this.ttsEngine?.playSuccessSound();
                    
                    setTimeout(() => {
                        modal.hide();
                        document.getElementById('final-answer-area')?.classList.add('hidden');
                        this.navigateTo('screen-main-menu');
                    }, 4000);
                    
                } else {
                    if (result.isFinal) {
                        const fb = question.feedbackIncorrect;
                        feedback.innerHTML = `
                            <div class="feedback feedback-error">
                                <h4>${fb.title}</h4>
                                <p>${fb.text}</p>
                                <p class="feedback-note">Правильный ответ: <strong>${question.correctAnswer}</strong></p>
                            </div>
                        `;
                        
                        document.getElementById('btn-submit-answer').disabled = true;
                        document.getElementById('final-answer-input').disabled = true;
                        
                        this.progressTracker.caseFailed(this.caseManager.currentCase);
                        this.progress.activeCase = null;
                        this.caseManager.caseState = 'failed';
                        storage.saveProgress(this.progress);
                        
                        this.ttsEngine?.playErrorSound();
                        
                        setTimeout(() => {
                            modal.hide();
                            document.getElementById('final-answer-area')?.classList.add('hidden');
                        }, 4000);
                        
                    } else {
                        feedback.innerHTML = `
                            <div class="feedback feedback-error">
                                <h4>❌ НЕВЕРНО</h4>
                                <p>${result.message}</p>
                            </div>
                        `;
                        const inputEl = document.getElementById('final-answer-input');
                        if (inputEl) {
                            inputEl.value = '';
                            inputEl.focus();
                        }
                    }
                }
            }
        };
        
        document.getElementById('btn-submit-answer')?.addEventListener('click', submitAnswer);
        document.getElementById('final-answer-input')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitAnswer();
        });
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
        
        storage.saveProgress(this.progress);
    }
    
    navigateTo(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('active');
            this.currentScreen = screenId;
            console.log('Навигация:', screenId);
        }
    }
    
    loadCase(caseId) {
        console.log('📂 Загрузка дела:', caseId);
        
        if (this.caseManager) {
            this.caseManager.loadCase(caseId);
        }
        
        this.navigateTo('screen-case-active');
        
        const caseData = getCaseById(caseId);
        if (caseData) {
            document.getElementById('header-case-id').textContent = caseId.replace('case-', '');
            document.getElementById('header-case-title').textContent = caseData.title;
        }
    }
    
    _switchTab(tabId) {
        document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        
        const tab = document.querySelector(`[data-tab="${tabId}"]`);
        const panel = document.getElementById(tabId);
        
        if (tab) tab.classList.add('active');
        if (panel) panel.classList.add('active');
        
        if (tabId === 'tab-board') {
            this.boardUI?.render();
        }
    }
    
    _updateMainMenu() {
        const stats = this.progressTracker?.getStats() || { totalCasesSolved: 0, rank: { name: 'СТАЖЁР' } };
        
        const totalCasesEl = document.getElementById('total-cases');
        const solvedCasesEl = document.getElementById('solved-cases');
        const rankEl = document.getElementById('detective-rank');
        
        if (totalCasesEl) totalCasesEl.textContent = Object.keys(CASES_INDEX).length;
        if (solvedCasesEl) solvedCasesEl.textContent = stats.totalCasesSolved;
        if (rankEl) rankEl.textContent = stats.rank?.name || 'СТАЖЁР';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});