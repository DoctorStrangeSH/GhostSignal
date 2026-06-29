class TTSEngine {
    constructor() {
        this.enabled = CONFIG.audio.voiceEnabled;
        this.volume = CONFIG.audio.volume;
        this.speaking = false;
        this.pendingQueue = [];
        this.audioContext = null;
        this.filterNode = null;
        this.gainNode = null;
        this._initialized = false;
        
        this.supported = 'speechSynthesis' in window;
        
        if (!this.supported) {
            console.warn('Web Speech API не поддерживается');
        }
        
        // Ждём жеста пользователя для AudioContext
        this._waitForUserGesture();
    }
    
    _waitForUserGesture() {
        const init = () => {
            if (!this._initialized) {
                this._initAudioContext();
                this._initialized = true;
            }
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
        };
        
        ['click', 'touchstart', 'keydown'].forEach(event => {
            document.addEventListener(event, init, { once: false });
        });
    }
    
    _initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            this.filterNode = this.audioContext.createBiquadFilter();
            this.filterNode.type = 'bandpass';
            this.filterNode.frequency.value = 1000;
            this.filterNode.Q.value = 0.8;
            
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = this.volume;
            
            this.filterNode.connect(this.gainNode);
        } catch (e) {
            console.warn('AudioContext не доступен:', e);
        }
    }
    
    speak(text, options = {}) {
        if (!this.supported || !this.enabled) return;
        
        const {
            mood = 'neutral',
            isPhoneCall = true,
            onEnd = null
        } = options;
        
        const cleanText = text.replace(/\*[^*]+\*/g, '').trim();
        if (!cleanText) return;
        
        // Резюмим AudioContext если нужно
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'ru-RU';
        utterance.rate = this._getRate(mood);
        utterance.pitch = this._getPitch(mood);
        utterance.volume = this.volume;
        
        const voices = speechSynthesis.getVoices();
        const russianVoice = voices.find(v => v.lang.startsWith('ru'));
        if (russianVoice) utterance.voice = russianVoice;
        
        utterance.onstart = () => {
            this.speaking = true;
            events.emit('tts:started', { text: cleanText });
        };
        
        utterance.onend = () => {
            this.speaking = false;
            events.emit('tts:ended');
            if (onEnd) onEnd();
            this._processQueue();
        };
        
        utterance.onerror = (e) => {
            console.warn('TTS error:', e);
            this.speaking = false;
            if (onEnd) onEnd();
            this._processQueue();
        };
        
        if (this.speaking) {
            this.pendingQueue.push(utterance);
        } else {
            speechSynthesis.speak(utterance);
        }
    }
    
    stop() {
        speechSynthesis.cancel();
        this.speaking = false;
        this.pendingQueue = [];
    }
    
    playEffect(effectName) {
        if (!this.audioContext) return;
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        const effects = this._getEffectConfig(effectName);
        if (!effects) return;
        
        effects.forEach(config => {
            this._playTone(config);
        });
    }
    
    playDialTone() { this.playEffect('dial_tone'); }
    playConnectSound() { this.playEffect('connect'); }
    playHangupSound() { this.playEffect('hangup'); }
    playMessageSound() { this.playEffect('message'); }
    playEvidenceSound() { this.playEffect('evidence'); }
    playSuccessSound() { this.playEffect('success'); }
    playErrorSound() { this.playEffect('error'); }
    
    _processQueue() {
        if (this.pendingQueue.length > 0 && !this.speaking) {
            const next = this.pendingQueue.shift();
            speechSynthesis.speak(next);
        }
    }
    
    _getRate(mood) {
        switch (mood) {
            case 'nervous': return 1.1;
            case 'angry': return 1.2;
            case 'sad': return 0.8;
            case 'breaking': return 0.7;
            case 'friendly': return 1.0;
            default: return 0.95;
        }
    }
    
    _getPitch(mood) {
        switch (mood) {
            case 'nervous': return 1.3;
            case 'angry': return 0.9;
            case 'sad': return 0.8;
            case 'friendly': return 1.1;
            default: return 1.0;
        }
    }
    
    _playTone(config) {
        if (!this.audioContext) return;
        
        const { frequency, duration, type, delay, volume } = config;
        
        setTimeout(() => {
            try {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.type = type || 'sine';
                oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
                
                const vol = (volume || 0.1) * this.volume;
                gainNode.gain.setValueAtTime(vol, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.start();
                oscillator.stop(this.audioContext.currentTime + duration);
            } catch(e) {
                // Игнорируем ошибки аудио
            }
        }, (delay || 0) * 1000);
    }
    
    _getEffectConfig(effectName) {
        const effects = {
            dial_tone: [
                { frequency: 350, duration: 0.3, type: 'sine', delay: 0, volume: 0.08 },
                { frequency: 440, duration: 0.3, type: 'sine', delay: 0, volume: 0.08 },
                { frequency: 350, duration: 0.3, type: 'sine', delay: 1, volume: 0.08 },
                { frequency: 440, duration: 0.3, type: 'sine', delay: 1, volume: 0.08 }
            ],
            connect: [
                { frequency: 800, duration: 0.1, type: 'square', volume: 0.05 }
            ],
            hangup: [
                { frequency: 400, duration: 0.3, type: 'sawtooth', volume: 0.05 },
                { frequency: 200, duration: 0.3, type: 'sawtooth', delay: 0.3, volume: 0.03 }
            ],
            message: [
                { frequency: 880, duration: 0.1, type: 'sine', volume: 0.06 },
                { frequency: 1100, duration: 0.1, type: 'sine', delay: 0.1, volume: 0.06 }
            ],
            evidence: [
                { frequency: 660, duration: 0.15, type: 'triangle', volume: 0.08 },
                { frequency: 880, duration: 0.15, type: 'triangle', delay: 0.15, volume: 0.08 },
                { frequency: 1100, duration: 0.2, type: 'triangle', delay: 0.3, volume: 0.08 }
            ],
            success: [
                { frequency: 523, duration: 0.2, type: 'sine', volume: 0.1 },
                { frequency: 659, duration: 0.2, type: 'sine', delay: 0.2, volume: 0.1 },
                { frequency: 784, duration: 0.3, type: 'sine', delay: 0.4, volume: 0.1 }
            ],
            error: [
                { frequency: 200, duration: 0.3, type: 'sawtooth', volume: 0.05 },
                { frequency: 150, duration: 0.3, type: 'sawtooth', delay: 0.3, volume: 0.03 }
            ],
            typewriter: [
                { frequency: 1200, duration: 0.02, type: 'square', volume: 0.03 }
            ]
        };
        
        return effects[effectName] || null;
    }
}