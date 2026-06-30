class RadioPlayer {
    constructor() {
        this.isPlaying = false;
        this.currentBroadcast = null;
        this._audioContext = null;
        this._gainNode = null;
        this._noiseSource = null;
        this._createUI();
    }
    
    _createUI() {
        const footer = document.querySelector('.terminal-footer');
        if (!footer) return;
        
        // Проверяем, нет ли уже радио
        if (document.getElementById('radio-control')) return;
        
        const radioHTML = `
            <span class="footer-divider">│</span>
            <span class="radio-control" id="radio-control">
                📻 <span id="radio-status">ВЫКЛ</span>
                <button id="btn-radio-toggle" class="radio-btn">▶</button>
            </span>
        `;
        
        footer.insertAdjacentHTML('beforeend', radioHTML);
        
        document.getElementById('btn-radio-toggle')?.addEventListener('click', () => {
            this.toggleRadio();
        });
    }
    
    toggleRadio() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.playRandom();
        }
    }
    
    playRandom() {
        const broadcasts = getRadioBroadcasts();
        if (broadcasts.length === 0) return;
        
        const currentHour = window.app?.gameTime?.hour || 12;
        const suitable = broadcasts.filter(b => {
            if (!b.availableAt) return true;
            return Math.abs(b.availableAt.hour - currentHour) <= 2;
        });
        
        const broadcast = suitable.length > 0 ? 
            suitable[Math.floor(Math.random() * suitable.length)] : 
            broadcasts[Math.floor(Math.random() * broadcasts.length)];
        
        this._playBroadcast(broadcast);
    }
    
    _playBroadcast(broadcast) {
        this.currentBroadcast = broadcast;
        this.isPlaying = true;
        
        const status = document.getElementById('radio-status');
        const btn = document.getElementById('btn-radio-toggle');
        if (status) status.textContent = '▶ ' + broadcast.title;
        if (btn) btn.textContent = '⏹';
        
        events.emit('modal:show', {
            title: `📻 ${broadcast.title}`,
            body: `
                <div class="radio-broadcast">
                    <p class="radio-speaker">${broadcast.speaker}:</p>
                    <div class="radio-text">${broadcast.transcript}</div>
                </div>
            `,
            footer: `<button class="terminal-btn" id="btn-radio-stop">⏹ ВЫКЛЮЧИТЬ</button>`
        });
        
        setTimeout(() => {
            document.getElementById('btn-radio-stop')?.addEventListener('click', () => this.stop());
        }, 100);
        
        if (broadcast.duration) {
            setTimeout(() => this.stop(), broadcast.duration * 1000);
        }
        
        this._startRadioNoise();
        
        events.emit('radio:playing', { broadcast });
    }
    
    stop() {
        this.isPlaying = false;
        this.currentBroadcast = null;
        
        const status = document.getElementById('radio-status');
        const btn = document.getElementById('btn-radio-toggle');
        if (status) status.textContent = 'ВЫКЛ';
        if (btn) btn.textContent = '▶';
        
        this._stopRadioNoise();
        
        events.emit('radio:stopped');
    }
    
    _startRadioNoise() {
        try {
            this._audioContext = new (window.AudioContext || window.webkitAudioContext());
            
            // Создаём буфер с белым шумом (вместо ScriptProcessorNode)
            const sampleRate = this._audioContext.sampleRate;
            const bufferSize = sampleRate * 2;
            const buffer = this._audioContext.createBuffer(1, bufferSize, sampleRate);
            const data = buffer.getChannelData(0);
            
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * 0.3;
            }
            
            const noiseSource = this._audioContext.createBufferSource();
            noiseSource.buffer = buffer;
            noiseSource.loop = true;
            
            // Фильтр (эффект радио)
            const filterNode = this._audioContext.createBiquadFilter();
            filterNode.type = 'bandpass';
            filterNode.frequency.value = 1500;
            filterNode.Q.value = 1.5;
            
            this._gainNode = this._audioContext.createGain();
            this._gainNode.gain.value = 0.03;
            
            noiseSource.connect(filterNode);
            filterNode.connect(this._gainNode);
            this._gainNode.connect(this._audioContext.destination);
            
            noiseSource.start();
            
            this._noiseSource = noiseSource;
        } catch (e) {
            console.warn('Radio noise not available:', e);
        }
    }
    
    _stopRadioNoise() {
        if (this._noiseSource) {
            try { this._noiseSource.stop(); } catch(e) {}
            this._noiseSource.disconnect();
            this._noiseSource = null;
        }
        if (this._audioContext) {
            this._audioContext.close().catch(() => {});
            this._audioContext = null;
        }
    }
}