// A correct theory is not the same as a supported accusation. Cases without
// proofRequirements retain their existing rules.
function assessAccusationEvidence(caseData, inventory) {
    const requirements = caseData?.proofRequirements;
    if (!requirements) return { sufficient: true, missingItems: [], missingCorroboration: false };

    const missingItems = (requirements.requiredItems || [])
        .filter(itemId => !inventory?.hasItem?.(itemId));
    const alternatives = requirements.anyInsights || [];
    const missingCorroboration = alternatives.length > 0 &&
        !alternatives.some(insightId => inventory?.hasInsight?.(insightId));

    return {
        sufficient: missingItems.length === 0 && !missingCorroboration,
        missingItems,
        missingCorroboration
    };
}

class CaseManager {
    constructor(gameTime, locationManager, inventory) {
        this.gameTime = gameTime;
        this.locationManager = locationManager;
        this.inventory = inventory;
        
        this.currentCase = null;
        this.caseState = null;          // Состояние активного дела
        this.completedEvents = [];      // Завершённые события
        this.visitedLocations = [];     // Посещённые локации в деле
        this.evidenceFound = 0;
    }
    
    // Загрузить дело
    loadCase(caseId) {
        const caseData = getCaseById(caseId);
        if (!caseData) {
            console.error('Дело не найдено:', caseId);
            return false;
        }
        
        this.currentCase = caseData;
        this.locationManager?.setActiveCase?.(caseData);
        this.caseState = 'active';
        this.completedEvents = [];
        this.visitedLocations = [];
        this.evidenceFound = 0;

        // Exploration belongs to the active investigation. A new case must
        // not inherit visited locations from a previous case's map.
        this.locationManager?.visitedLocations?.clear?.();
        
        // Устанавливаем время начала дела
        if (caseData.startTime) {
            if (typeof this.gameTime.setTime === 'function') {
                this.gameTime.setTime(
                    caseData.startTime.hour,
                    caseData.startTime.minute,
                    caseData.startTime.day
                );
            } else {
                this.gameTime.hour = caseData.startTime.hour;
                this.gameTime.minute = caseData.startTime.minute;
                this.gameTime.day = caseData.startTime.day;
            }
        }
        
        // Разблокируем локации дела
        if (caseData.locations) {
            caseData.locations.forEach(locId => {
                const location = getLocationById(locId);
                if (location?.unlockedByDefault !== false) {
                    this.locationManager.unlockLocation(locId);
                }
            });
        }
        
        // Применяем уже имеющиеся ключевые предметы к условиям доступа.
        this._checkUnlockConditions();

        // Новый забег начинается в стартовой точке без оплаты перехода из прошлого дела.
        const startLoc = caseData.startLocation || 'police_station';
        if (this.locationManager) this.locationManager.currentLocation = null;
        this.locationManager.travelTo(startLoc);
        
        // Запускаем вступительное событие
        const introEvent = caseData.events?.find(e => e.trigger === 'case_start');
        if (introEvent) {
            this._triggerEvent(introEvent);
        }
        
        // Уведомляем
        events.emit('case:started', { caseId, caseData });
        events.emit('notification:show', {
            message: `Дело открыто: ${caseData.title}`,
            type: 'system',
            duration: 4000
        });
        
        return true;
    }
    
    // Отметить первое посещение локации
    markLocationVisited(locationId) {
        if (!this.visitedLocations.includes(locationId)) {
            this.visitedLocations.push(locationId);
            
            // Проверяем сцены для первого посещения
            const scene = this.currentCase?.scenes?.find(s => 
                s.locationId === locationId && s.trigger === `first_visit:${locationId}`
            );
            
            if (scene) {
                this._showSceneIntro(scene);
            }
        }
    }
    
    // Обработать получение предмета
    onItemAcquired(itemId) {
        // Проверяем события, связанные с предметами
        const events_triggered = this.currentCase?.events?.filter(e => 
            e.trigger === `item_acquired:${itemId}`
        );
        
        if (events_triggered) {
            events_triggered.forEach(e => this._triggerEvent(e));
        }
        
        // Считаем улики
        const obj = getObjectById(itemId);
        if (obj?.isEvidence) {
            this.evidenceFound++;
            this._checkEvidenceCount();
        }
        
        // Проверяем условия разблокировки
        this._checkUnlockConditions();
    }
    
    // Обработать получение озарения
    onInsightGained(insightId) {
        const events_triggered = this.currentCase?.events?.filter(e => 
            e.trigger === `insight:${insightId}`
        );
        
        if (events_triggered) {
            events_triggered.forEach(e => this._triggerEvent(e));
        }
    }
    
    // Проверить финальный ответ
    checkFinalAnswer(answer) {
        if (!this.currentCase?.finalQuestion) return null;
        
        const normalizedAnswer = answer.toLowerCase().trim();
        const acceptableAnswers = this.currentCase.finalQuestion.acceptableAnswers;
        
        const isCorrect = acceptableAnswers.some(a => {
            // Простое сравнение
            if (normalizedAnswer === a.toLowerCase()) return true;
            // Проверка расстояния Левенштейна для опечаток
            if (normalizedAnswer.length > 3) {
                const distance = this._levenshteinDistance(normalizedAnswer, a.toLowerCase());
                return distance <= 2; // Допускаем 2 опечатки
            }
            return false;
        });
        
        const proof = assessAccusationEvidence(this.currentCase, this.inventory);
        if (isCorrect && !proof.sufficient) {
            return {
                isCorrect: false,
                theoryCorrect: true,
                insufficientEvidence: true,
                proof,
                title: '⚖️ ВЕРСИЯ НЕ ДОКАЗАНА',
                text: this.currentCase.proofRequirements.hint ||
                    'Вы выбрали правдоподобную версию, но для обвинения нужны независимые подтверждения.'
            };
        }

        const feedback = isCorrect ?
            this.currentCase.finalQuestion.feedbackCorrect :
            this.currentCase.finalQuestion.feedbackIncorrect;

        if (isCorrect) {
            this.caseState = 'solved';
            events.emit('case:solved', { 
                caseId: this.currentCase.id,
                reward: this.currentCase.reward 
            });
        }
        
        return {
            isCorrect,
            ...feedback
        };
    }
    
    // Внутренние методы
    
    _showSceneIntro(scene) {
        events.emit('modal:show', {
            title: `📍 ${getLocationById(scene.locationId)?.name || scene.locationId}`,
            body: `
                <p class="scene-intro-text">${scene.text}</p>
                ${scene.highlightObjects ? `
                    <div class="scene-highlights">
                        ${scene.highlightObjects.map(objId => {
                            const obj = getObjectById(objId);
                            return obj ? `<span class="highlight-tag">${obj.icon} ${obj.name}</span>` : '';
                        }).join('')}
                    </div>
                ` : ''}
            `,
            footer: `<button class="terminal-btn" data-bs-dismiss="modal">ОСМОТРЕТЬ</button>`
        });
    }
    
    _triggerEvent(event) {
        if (this.completedEvents.includes(event.id)) return;
        this.completedEvents.push(event.id);
        
        switch (event.type) {
            case 'narrative':
                events.emit('modal:show', {
                    title: event.title || 'Событие',
                    body: `<p>${event.text}</p>`,
                    footer: `<button class="terminal-btn" data-bs-dismiss="modal">ПРОДОЛЖИТЬ</button>`
                });
                break;
                
            case 'notification':
                events.emit('notification:show', {
                    message: event.message,
                    type: 'info',
                    duration: 5000
                });
                break;
        }
    }
    
    _checkEvidenceCount() {
        const thresholdEvent = this.currentCase?.events?.find(event => {
            const [kind, count] = (event.trigger || '').split(':');
            return kind === 'evidence_count' && Number.isInteger(Number(count));
        });
        const required = thresholdEvent ? Number(thresholdEvent.trigger.split(':')[1]) : 5;
        if (this.evidenceFound >= required) {
            const event = this.currentCase?.events?.find(e => e.trigger === `evidence_count:${required}`);
            if (event) this._triggerEvent(event);
            
            // Показываем кнопку обвинения
            events.emit('case:ready_for_final', true);
        }
    }
    
    _checkUnlockConditions() {
        if (!this.currentCase?.unlockConditions) return;
        
        this.currentCase.unlockConditions.forEach(condition => {
            if (this.inventory.hasItem(condition.requiresItem)) {
                const unlocked = this.locationManager.unlockLocation(condition.locationId);
                if (unlocked && condition.message) {
                    events.emit('notification:show', {
                        message: condition.message,
                        type: 'success',
                        duration: 4000
                    });
                }
            }
        });
    }
    
    // Расстояние Левенштейна (для проверки опечаток)
    _levenshteinDistance(a, b) {
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[b.length][a.length];
    }
    
    // Сериализация
    toJSON() {
        return {
            currentCaseId: this.currentCase?.id || null,
            caseState: this.caseState,
            completedEvents: [...this.completedEvents],
            visitedLocations: [...this.visitedLocations],
            evidenceFound: this.evidenceFound
        };
    }
    
    // Восстановление
    static fromJSON(json, gameTime, locationManager, inventory, fallbackCaseId = null) {
        const manager = new CaseManager(gameTime, locationManager, inventory);
        const caseId = fallbackCaseId || json?.currentCaseId;
        if (caseId) {
            manager.currentCase = getCaseById(caseId);
            if (manager.currentCase) {
                const snapshotMatchesCase = !fallbackCaseId || json?.currentCaseId === fallbackCaseId;
                manager.locationManager?.setActiveCase?.(manager.currentCase);
                manager.caseState = snapshotMatchesCase ? (json?.caseState || 'active') : 'active';
                manager.completedEvents = snapshotMatchesCase ? (json?.completedEvents || []) : [];
                manager.visitedLocations = snapshotMatchesCase ? (json?.visitedLocations || []) : [];
                manager.evidenceFound = snapshotMatchesCase ? (json?.evidenceFound || 0) : 0;
                manager._checkUnlockConditions();
            }
        }
        return manager;
    }
}
