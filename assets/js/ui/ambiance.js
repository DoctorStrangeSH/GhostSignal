class AmbianceManager {
    constructor() {
        this.body = document.body;
        this.overlay = document.getElementById('static-overlay');
        this.scanLine = document.querySelector('.scan-line');
        this._currentPeriod = null;
        this._audioContext = null;
        this._noiseGain = null;
        this._noiseSource = null;
        this._initialized = false;
        this._init();
    }
    
    _init() {
        events.on('time:changed', (data) => {
            if (data.periodChanged) {
                this.onPeriodChange(data.oldPeriod, data.period);
            }
        });
        
        this._currentPeriod = 'day';
        
        // Пытаемся инициализировать звук после первого взаимодействия
        this._waitForUserGesture();
    }
    
    _waitForUserGesture() {
        const resumeAudio = () => {
            if (!this._initialized) {
                this._initAmbientSound();
                this._initialized = true;
            }
            
            // Резюмим AudioContext если он приостановлен
            if (this._audioContext && this._audioContext.state === 'suspended') {
                this._audioContext.resume().then(() => {
                    console.log('🔊 Ambient audio resumed');
                }).catch(e => {
                    console.warn('Cannot resume audio context:', e);
                });
            }
        };
        
        // Слушаем первое взаимодействие
        const events = ['click', 'touchstart', 'keydown'];
        const handler = () => {
            resumeAudio();
            events.forEach(e => document.removeEventListener(e, handler));
        };
        
        events.forEach(e => document.addEventListener(e, handler, { once: false }));
        
        // Также пробуем при фокусе
        document.addEventListener('focus', () => resumeAudio(), { once: true });
    }
    
    _initAmbientSound() {
        try {
            this._audioContext = new (window.AudioContext || window.webkitAudioContext());
            
            // Создаём буфер с белым шумом
            const sampleRate = this._audioContext.sampleRate;
            const bufferSize = sampleRate * 2;
            const buffer = this._audioContext.createBuffer(1, bufferSize, sampleRate);
            const data = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * 0.1;
            }
            
            const noiseSource = this._audioContext.createBufferSource();
            noiseSource.buffer = buffer;
            noiseSource.loop = true;
            
            const gainNode = this._audioContext.createGain();
            gainNode.gain.value = 0.001;
            
            noiseSource.connect(gainNode);
            gainNode.connect(this._audioContext.destination);
            
            noiseSource.start();
            
            this._noiseSource = noiseSource;
            this._noiseGain = gainNode;
            
            console.log('🔊 Ambient noise initialized');
        } catch (e) {
            console.warn('Ambient sound not available:', e);
        }
    }
    
    onPeriodChange(oldPeriod, newPeriod) {
        console.log(`Атмосфера: ${oldPeriod} → ${newPeriod}`);
        
        this.body.classList.remove('dawn-time', 'day-time', 'evening-time', 'night-time');
        this.body.classList.add(`${newPeriod}-time`);
        this._currentPeriod = newPeriod;
        this._applyPeriodEffects(newPeriod);
        
        events.emit('ambiance:changed', { period: newPeriod, oldPeriod: oldPeriod });
    }
    
    _applyPeriodEffects(period) {
        const staticLevel = document.getElementById('static-level');
        
        const settings = {
            dawn: {
                staticOpacity: '0.01',
                scanOpacity: '0.3',
                staticLevel: '1%',
                noiseVolume: 0.001,
                screenTint: 'rgba(200, 180, 150, 0.03)'
            },
            day: {
                staticOpacity: '0.008',
                scanOpacity: '0.2',
                staticLevel: '1%',
                noiseVolume: 0.0005,
                screenTint: 'rgba(0, 0, 0, 0)'
            },
            evening: {
                staticOpacity: '0.02',
                scanOpacity: '0.5',
                staticLevel: '3%',
                noiseVolume: 0.002,
                screenTint: 'rgba(255, 140, 0, 0.04)'
            },
            night: {
                staticOpacity: '0.03',
                scanOpacity: '0.7',
                staticLevel: '5%',
                noiseVolume: 0.003,
                screenTint: 'rgba(0, 0, 30, 0.08)'
            }
        };
        
        const s = settings[period] || settings.day;
        
        if (this.overlay) this.overlay.style.opacity = s.staticOpacity;
        if (this.scanLine) this.scanLine.style.opacity = s.scanOpacity;
        if (staticLevel) staticLevel.textContent = s.staticLevel;
        
        if (this._noiseGain && this._audioContext) {
            this._noiseGain.gain.setValueAtTime(s.noiseVolume, this._audioContext.currentTime);
        }
        
        this.body.style.setProperty('--ambient-tint', s.screenTint);
    }
    
    getCurrentPeriod() {
        return this._currentPeriod;
    }
    
    startRain() {
        this.body.classList.add('raining');
    }
    
    stopRain() {
        this.body.classList.remove('raining');
    }
}