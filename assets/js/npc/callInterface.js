class CallInterface {
    constructor() {
        this.dialogueEngine = null;
        this.currentNPC = null;
        this.isCallActive = false;
        this.callAudioContext = null;
        this._callStartTime = null;
        this._timerInterval = null;
        this._connectionTimeout = null;
        this._ringtoneOscillator = null;
        this._createCallModal();
    }

    setDialogueEngine(engine) {
        this.dialogueEngine = engine;
    }

    // Начать звонок
    startCall(npcId, dialogueId = null) {
        const npc = getNPCById(npcId);
        if (!npc) return;

        if (this.isCallActive) this.endCall();

        this.currentNPC = npc;
        // Resolve case-specific dialogue for this call before the delayed connection.
        this.currentDialogueId = dialogueId || npc.dialogueId || null;
        this.isCallActive = true;

        // Показываем интерфейс звонка
        this._showCallingScreen(npc);

        // Имитация гудков
        this._playRingtone();

        // Оповещаем
        events.emit('call:started', { npcId });

        // Через 2.5 секунды "соединяем"
        this._connectionTimeout = setTimeout(() => {
            this._connectionTimeout = null;
            if (!this.isCallActive || this.currentNPC?.id !== npc.id) return;
            this._connectCall(npc);
        }, 2500);
    }

    _createCallModal() {
        // Проверяем, нет ли уже модалки
        if (document.getElementById('call-modal')) return;

        const modalHTML = `
            <div id="call-modal" class="call-modal hidden">
                <div class="call-screen">
                    <div class="call-header">
                        <span class="call-status" id="call-status">ВЫЗОВ...</span>
                        <span class="call-time" id="call-duration">00:00</span>
                    </div>
                    <div class="call-avatar" id="call-avatar">
                        <span class="call-avatar-icon">📞</span>
                    </div>
                    <div class="call-name" id="call-name"></div>
                    <div class="call-role" id="call-role"></div>
                    <div class="call-dialogue" id="call-dialogue">
                        <div class="dialogue-messages" id="dialogue-messages" role="log" aria-label="Протокол разговора" aria-live="polite" aria-relevant="additions"></div>
                        <div class="dialogue-answers" id="dialogue-answers" role="group" aria-label="Варианты ответа"></div>
                        <div class="dialogue-evidence-tools" id="dialogue-evidence-tools" aria-label="Проверка показаний"></div>
                    </div>
                    <div class="call-controls">
                        <button id="btn-hangup" class="call-btn hangup-btn">🔴 СБРОСИТЬ</button>
                    </div>
                </div>
                <div class="call-wave-animation">
                    <div class="wave"></div>
                    <div class="wave"></div>
                    <div class="wave"></div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.callModal = document.getElementById('call-modal');

        // Обработчик сброса
        document.getElementById('btn-hangup').addEventListener('click', () => {
            this.endCall();
        });
    }

    _showCallingScreen(npc) {
        if (!this.callModal) return;

        this.callModal.classList.remove('hidden');
        document.getElementById('call-status').textContent = 'ВЫЗОВ...';
        document.getElementById('call-status').classList.remove('connected');
        const avatar = document.getElementById('call-avatar').querySelector('.call-avatar-icon');
        avatar.replaceChildren();
        if (npc.portrait) {
            const image = document.createElement('img');
            image.src = npc.portrait;
            image.alt = '';
            image.decoding = 'async';
            image.addEventListener('error', () => {
                avatar.textContent = npc.icon || '📞';
            }, { once: true });
            avatar.appendChild(image);
        } else {
            avatar.textContent = npc.icon || '📞';
        }
        document.getElementById('call-name').textContent = npc.name;
        document.getElementById('call-role').textContent = npc.role;
        document.getElementById('dialogue-messages').innerHTML = '';
        document.getElementById('dialogue-answers').innerHTML = '';
        const evidenceTools = document.getElementById('dialogue-evidence-tools');
        if (evidenceTools) evidenceTools.innerHTML = '';
        document.getElementById('call-duration').textContent = '00:00';

        // Анимация волн
        const waveAnim = this.callModal.querySelector('.call-wave-animation');
        if (waveAnim) waveAnim.style.display = 'flex';
    }

    _connectCall(npc) {
        // Определяем диалог
        const dialogueId = this.currentDialogueId || npc.dialogueId;
        if (!dialogueId) {
            this.endCall();
            return;
        }

        // Скрываем волны
        const waveAnim = this.callModal.querySelector('.call-wave-animation');
        if (waveAnim) waveAnim.style.display = 'none';

        document.getElementById('call-status').textContent = 'СОЕДИНЁН';
        document.getElementById('call-status').classList.add('connected');

        // Оповещаем
        events.emit('call:connected', { npcId: npc.id });

        // Запускаем диалог
        if (this.dialogueEngine) {
            this._bindDialogueUpdates();
            this.dialogueEngine.startDialogue(dialogueId);
        }

        // Запускаем таймер звонка
        this._startCallTimer();
    }

    _bindDialogueUpdates() {
        if (!this.dialogueEngine) return;
        this.dialogueEngine.onNodeChange = (node) => {
            this._updateDialogueUI(node);
            if (node.speaker === 'npc' && node.text) {
                events.emit('tts:speak', { text: node.text, mood: node.mood || 'neutral' });
            }
            events.emit('dialogue:state_changed', this.dialogueEngine.toJSON());
        };
    }

    // Resume without ringing, charging time, or replaying dialogue effects.
    restoreActiveDialogue(snapshot) {
        if (!snapshot || !this.dialogueEngine || !this.dialogueEngine.restoreFromJSON(snapshot)) return false;
        const npc = typeof getNPCById === 'function' ? getNPCById(snapshot.npcId) : null;
        if (!npc) {
            this.dialogueEngine.reset();
            return false;
        }

        this.currentNPC = npc;
        // The snapshot is the authoritative source: case-specific NPC dialogue
        // overrides may differ from the shared profile's default dialogueId.
        this.currentDialogueId = snapshot.dialogueId;
        this.isCallActive = true;
        this._showCallingScreen(npc);
        const status = document.getElementById('call-status');
        status.textContent = 'СОЕДИНЁН';
        status.classList.add('connected');
        const waveAnim = this.callModal?.querySelector('.call-wave-animation');
        if (waveAnim) waveAnim.style.display = 'none';

        this._bindDialogueUpdates();
        const history = this.dialogueEngine.getHistory();
        for (const entry of history.slice(0, -1)) {
            if (entry.speaker === 'player') {
                this._appendPlayerStatement(entry.text);
            } else {
                const message = document.createElement('div');
                message.className = 'dialogue-message npc-message';
                const speaker = document.createElement('span');
                speaker.className = 'message-speaker';
                speaker.textContent = `${npc.name || 'Свидетель'}:`;
                const body = document.createElement('span');
                body.className = 'message-text';
                body.textContent = entry.text;
                message.append(speaker, body);
                document.getElementById('dialogue-messages')?.appendChild(message);
            }
        }
        this._updateDialogueUI(this.dialogueEngine.currentNode);
        this._startCallTimer();
        events.emit('call:connected', { npcId: npc.id, resumed: true });
        return true;
    }

    _updateDialogueUI(node) {
        if (!node) return;

        const messagesContainer = document.getElementById('dialogue-messages');
        const answersContainer = document.getElementById('dialogue-answers');

        if (!messagesContainer || !answersContainer) return;

        // Добавляем сообщение NPC
        const messageEl = document.createElement('div');
        messageEl.className = 'dialogue-message npc-message';
        const speaker = document.createElement('span');
        speaker.className = 'message-speaker';
        speaker.textContent = `${this.currentNPC?.name || 'Свидетель'}:`;
        const transcript = document.createElement('span');
        transcript.className = 'message-text typewriter';
        transcript.textContent = node.text || '';
        messageEl.append(speaker, transcript);
        messagesContainer.appendChild(messageEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Эффект печати
        this._typewriterEffect(messageEl.querySelector('.message-text'));

        // Очищаем и добавляем ответы
        answersContainer.innerHTML = '';

        if (node.endDialogue) {
            // Диалог завершён
            setTimeout(() => this.endCall(), 2000);
            return;
        }

        if (node.answers) {
            const availableAnswers = this.dialogueEngine.getAvailableAnswers();

            availableAnswers.forEach(answer => {
                const btn = document.createElement('button');
                btn.className = `terminal-btn answer-btn ${answer.isAvailable ? '' : 'answer-locked'}`;
                btn.textContent = answer.isAvailable ? answer.text : '🔒 ' + answer.text;
                btn.disabled = !answer.isAvailable;

                if (!answer.isAvailable && answer.lockReason) {
                    const hint = document.createElement('span');
                    hint.className = 'answer-lock-reason';
                    hint.textContent = answer.lockReason;
                    btn.appendChild(hint);
                }

                if (answer.isAvailable) {
                    btn.addEventListener('click', () => {
                        // Добавляем ответ игрока в сообщения
                        this._appendPlayerStatement(answer.text);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;

                        // Отправляем выбор
                        const result = this.dialogueEngine.selectAnswer(answer.index);
                        if (result?.endDialogue) {
                            setTimeout(() => this.endCall(), 2000);
                        }
                    });
                }

                answersContainer.appendChild(btn);
            });
        }

        this._renderEvidenceTools();
    }

    _appendPlayerStatement(text, after = null) {
        const messages = document.getElementById('dialogue-messages');
        if (!messages) return;
        const message = document.createElement('div');
        message.className = 'dialogue-message player-message';
        const speaker = document.createElement('span');
        speaker.className = 'message-speaker';
        speaker.textContent = 'ДЕТЕКТИВ:';
        const body = document.createElement('span');
        body.className = 'message-text';
        body.textContent = text;
        message.append(speaker, body);
        if (after?.parentElement === messages) after.after(message);
        else messages.appendChild(message);
        messages.scrollTop = messages.scrollHeight;
    }

    _renderEvidenceTools() {
        const container = document.getElementById('dialogue-evidence-tools');
        if (!container || !this.dialogueEngine?.currentDialogue) return;

        const allItems = this.dialogueEngine.inventory?.getAllItems?.() || [];
        const evidence = allItems.length
            ? allItems.filter(item => item.isEvidence)
            : (this.dialogueEngine.inventory?.getEvidence?.() || []);
        const prepared = this.dialogueEngine.memoryService?.getPreparedConfrontation?.(this.currentNPC?.id);
        const causalQuestion = this.dialogueEngine.investigationBoard?.getPreparedCausalQuestion?.(this.currentNPC?.id);
        const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[char]);
        const sections = [];

        if (evidence.length) {
            sections.push(`
                <div class="evidence-present-row">
                    <select id="dialogue-evidence-select" class="terminal-input" aria-label="Выберите улику для предъявления">
                        <option value="">-- Предъявить улику --</option>
                        ${evidence.map(item => `<option value="${item.id}">${item.icon || '📄'} ${item.name}</option>`).join('')}
                    </select>
                    <button id="btn-present-evidence" class="terminal-btn" type="button">ПРЕДЪЯВИТЬ УЛИКУ</button>
                </div>
            `);
        }

        if (prepared) {
            const first = prepared.contradiction.first;
            const second = prepared.contradiction.second;
            sections.push(`
                <div class="prepared-contradiction">
                    <div class="prepared-contradiction-kicker">ПОДГОТОВЛЕНО ПО ДОСЬЕ</div>
                    <p><strong>${escapeHTML(first.sourceName || first.npcId)}:</strong> ${escapeHTML(first.summary)}</p>
                    <p><strong>${escapeHTML(second.sourceName || second.npcId)}:</strong> ${escapeHTML(second.summary)}</p>
                    <button id="btn-present-contradiction" class="terminal-btn" type="button">ПРЕДЪЯВИТЬ ПРОТИВОРЕЧИЕ</button>
                </div>
            `);
        }

        if (causalQuestion) {
            sections.push(`<div class="prepared-contradiction">
                <div class="prepared-contradiction-kicker">ВОПРОС ПО ГИПОТЕЗЕ</div>
                <p>${escapeHTML(causalQuestion.title)}</p>
                <p>Найдены возражения против этой версии. Попросите свидетеля прояснить обстоятельства.</p>
                <button id="btn-present-causal-question" class="terminal-btn" type="button">УТОЧНИТЬ ПРОТИВОРЕЧИЕ</button>
            </div>`);
        }

        container.innerHTML = sections.join('');

        document.getElementById('btn-present-evidence')?.addEventListener('click', () => {
            const evidenceId = document.getElementById('dialogue-evidence-select')?.value;
            if (!evidenceId) {
                events.emit('notification:show', {
                    message: 'Сначала выберите улику',
                    type: 'warning',
                    duration: 2000
                });
                return;
            }

            const messages = document.getElementById('dialogue-messages');
            const previousMessage = messages?.lastElementChild;
            const result = this.dialogueEngine.presentEvidence(evidenceId);
            if (result.success) {
                const selected = evidence.find(item => item.id === evidenceId);
                this._appendPlayerStatement(`Прошу взглянуть на улику: ${selected?.name || 'документ'}.`, previousMessage);
            }
            if (!result.success) {
                const message = result.reason === 'already_presented'
                    ? 'Вы уже предъявляли эту улику этому персонажу'
                    : 'Эта улика сейчас недоступна';
                events.emit('notification:show', { message, type: 'info', duration: 2500 });
            }
        });

        document.getElementById('btn-present-contradiction')?.addEventListener('click', () => {
            const previousMessage = document.getElementById('dialogue-messages')?.lastElementChild;
            const result = this.dialogueEngine.presentPreparedContradiction();
            if (result.success) {
                this._appendPlayerStatement('Я сопоставил ваши слова с другим свидетельским показанием. Объясните это противоречие.', previousMessage);
            }
            if (!result.success) {
                const message = result.reason === 'already_confronted'
                    ? 'Это противоречие уже предъявлялось'
                    : 'Сначала подготовьте противоречие на доске расследования';
                events.emit('notification:show', { message, type: 'warning', duration: 2800 });
            }
        });
        document.getElementById('btn-present-causal-question')?.addEventListener('click', () => {
            const previousMessage = document.getElementById('dialogue-messages')?.lastElementChild;
            const result = this.dialogueEngine.presentPreparedCausalQuestion();
            if (result.success) this._appendPlayerStatement('Есть независимая улика, противоречащая моей версии. Помогите уточнить, что вы действительно знаете.', previousMessage);
            else events.emit('notification:show', { message: 'Этот вопрос уже задан или не подготовлен.', type: 'warning', duration: 2600 });
        });
    }

    _typewriterEffect(element) {
        if (!element) return;

        const text = element.textContent;
        element.textContent = '';
        element.style.borderRight = '2px solid var(--accent-green)';

        let i = 0;
        const speed = 30; // мс на символ

        function type() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(type, speed);
            } else {
                element.style.borderRight = 'none';
            }
        }

        type();
    }

    _playRingtone() {
        // Простой звук гудков через Web Audio API
        try {
            this.callAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = this.callAudioContext.createOscillator();
            const gainNode = this.callAudioContext.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(440, this.callAudioContext.currentTime);
            gainNode.gain.setValueAtTime(0.1, this.callAudioContext.currentTime);

            oscillator.connect(gainNode);
            gainNode.connect(this.callAudioContext.destination);

            // Прерывистый сигнал
            gainNode.gain.setValueAtTime(0.1, this.callAudioContext.currentTime);
            gainNode.gain.setValueAtTime(0, this.callAudioContext.currentTime + 0.5);
            gainNode.gain.setValueAtTime(0.1, this.callAudioContext.currentTime + 1);
            gainNode.gain.setValueAtTime(0, this.callAudioContext.currentTime + 1.5);
            gainNode.gain.setValueAtTime(0.1, this.callAudioContext.currentTime + 2);
            gainNode.gain.setValueAtTime(0, this.callAudioContext.currentTime + 2.5);

            oscillator.start();
            oscillator.stop(this.callAudioContext.currentTime + 3);

            this._ringtoneOscillator = oscillator;
        } catch (e) {
            // Без звука, если не поддерживается
        }
    }

    _startCallTimer() {
        this._callStartTime = Date.now();
        this._timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this._callStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            const display = document.getElementById('call-duration');
            if (display) {
                display.textContent =
                    `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
        }, 1000);
    }

    endCall() {
        this.isCallActive = false;

        if (this._connectionTimeout !== null) {
            clearTimeout(this._connectionTimeout);
            this._connectionTimeout = null;
        }

        // Останавливаем таймер
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }

        // Останавливаем звуки
        if (this._ringtoneOscillator) {
            try { this._ringtoneOscillator.stop(); } catch (e) { }
            this._ringtoneOscillator = null;
        }

        // Скрываем модалку
        if (this.callModal) {
            this.callModal.classList.add('hidden');
        }

        // Сбрасываем диалог и удаляем его активный autosave snapshot.
        const endedNpcId = this.currentNPC?.id || this.dialogueEngine?.currentDialogue?.npcId || null;
        if (this.dialogueEngine) this.dialogueEngine.reset();
        if (endedNpcId) events.emit('dialogue:ended', { npcId: endedNpcId });

        this.currentNPC = null;
        this._callStartTime = null;

        events.emit('call:ended');
    }
}
