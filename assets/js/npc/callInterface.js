class CallInterface {
    constructor() {
        this.dialogueEngine = null;
        this.currentNPC = null;
        this.isCallActive = false;
        this.callAudioContext = null;
        this._callStartTime = null;
        this._timerInterval = null;
        this._ringtoneOscillator = null;
        this._createCallModal();
    }
    
    setDialogueEngine(engine) {
        this.dialogueEngine = engine;
    }
    
    // Начать звонок
    startCall(npcId) {
        const npc = getNPCById(npcId);
        if (!npc) return;
        
        this.currentNPC = npc;
        this.isCallActive = true;
        
        // Показываем интерфейс звонка
        this._showCallingScreen(npc);
        
        // Имитация гудков
        this._playRingtone();
        
        // Оповещаем
        events.emit('call:started', { npcId });
        
        // Через 2.5 секунды "соединяем"
        setTimeout(() => {
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
                        <div class="dialogue-messages" id="dialogue-messages"></div>
                        <div class="dialogue-answers" id="dialogue-answers"></div>
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
        document.getElementById('call-avatar').querySelector('.call-avatar-icon').textContent = npc.icon || '📞';
        document.getElementById('call-name').textContent = npc.name;
        document.getElementById('call-role').textContent = npc.role;
        document.getElementById('dialogue-messages').innerHTML = '';
        document.getElementById('dialogue-answers').innerHTML = '';
        document.getElementById('call-duration').textContent = '00:00';
        
        // Анимация волн
        const waveAnim = this.callModal.querySelector('.call-wave-animation');
        if (waveAnim) waveAnim.style.display = 'flex';
    }
    
    _connectCall(npc) {
        // Определяем диалог
        const dialogueId = npc.dialogueId;
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
            this.dialogueEngine.onNodeChange = (node) => {
                this._updateDialogueUI(node);
                
                // Озвучиваем реплику NPC
                if (node.speaker === 'npc' && node.text) {
                    events.emit('tts:speak', {
                        text: node.text,
                        mood: node.mood || 'neutral'
                    });
                }
            };
            
            this.dialogueEngine.startDialogue(dialogueId);
        }
        
        // Запускаем таймер звонка
        this._startCallTimer();
    }
    
    _updateDialogueUI(node) {
        if (!node) return;
        
        const messagesContainer = document.getElementById('dialogue-messages');
        const answersContainer = document.getElementById('dialogue-answers');
        
        if (!messagesContainer || !answersContainer) return;
        
        // Добавляем сообщение NPC
        const messageEl = document.createElement('div');
        messageEl.className = 'dialogue-message npc-message';
        messageEl.innerHTML = `
            <span class="message-speaker">${this.currentNPC?.name || 'NPC'}:</span>
            <span class="message-text typewriter">${node.text}</span>
        `;
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
                btn.textContent = answer.text;
                btn.disabled = !answer.isAvailable;
                
                if (answer.isAvailable) {
                    btn.addEventListener('click', () => {
                        // Добавляем ответ игрока в сообщения
                        const playerMsg = document.createElement('div');
                        playerMsg.className = 'dialogue-message player-message';
                        playerMsg.innerHTML = `
                            <span class="message-speaker">ВЫ:</span>
                            <span class="message-text">${answer.text}</span>
                        `;
                        messagesContainer.appendChild(playerMsg);
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
        
        // Останавливаем таймер
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
        
        // Останавливаем звуки
        if (this._ringtoneOscillator) {
            try { this._ringtoneOscillator.stop(); } catch(e) {}
            this._ringtoneOscillator = null;
        }
        
        // Скрываем модалку
        if (this.callModal) {
            this.callModal.classList.add('hidden');
        }
        
        // Сбрасываем диалог
        if (this.dialogueEngine) {
            this.dialogueEngine.reset();
        }
        
        this.currentNPC = null;
        this._callStartTime = null;
        
        events.emit('call:ended');
    }
}