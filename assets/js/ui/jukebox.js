class Jukebox {
    constructor() {
        this.isPlaying = false;
        this.currentTrack = null;
        this.volume = 0.3;
        this._audioContext = null;
        this._gainNode = null;
        this._tracks = [
            { name: 'Midnight Blues', genre: 'Jazz', duration: 180 },
            { name: 'Rainy Street', genre: 'Noir', duration: 200 },
            { name: 'Smoke & Mirrors', genre: 'Jazz', duration: 160 },
            { name: 'Dark Alley', genre: 'Ambient', duration: 220 },
            { name: 'Detective Theme', genre: 'Noir', duration: 190 }
        ];
        
        this._init();
    }
    
    _init() {
        events.on('location:changed', (data) => {
            // Автоматически включаем джаз в баре
            if (data.locationId === 'bar_joe' && !this.isPlaying) {
                this.play();
            } else if (data.locationId !== 'bar_joe' && this.isPlaying) {
                this.stop();
            }
        });
    }
    
    play(trackIndex = null) {
        if (trackIndex === null) {
            trackIndex = Math.floor(Math.random() * this._tracks.length);
        }
        
        this.currentTrack = this._tracks[trackIndex];
        this.isPlaying = true;
        
        // Генерируем простую мелодию через Web Audio API
        this._playJazzNoise();
        
        events.emit('jukebox:playing', { track: this.currentTrack });
        
        // Автостоп
        if (this.currentTrack.duration) {
            setTimeout(() => {
                if (this.isPlaying) this.play(); // Следующий трек
            }, this.currentTrack.duration * 1000);
        }
    }
    
    stop() {
        this.isPlaying = false;
        if (this._gainNode) {
            this._gainNode.gain.value = 0;
        }
        events.emit('jukebox:stopped');
    }
    
    _playJazzNoise() {
        try {
            if (!this._audioContext) {
                this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Генератор джазового аккорда
            const notes = [261, 329, 392, 523]; // До-Ми-Соль-До
            const note = notes[Math.floor(Math.random() * notes.length)];
            
            const osc = this._audioContext.createOscillator();
            osc.type = 'triangle';
            osc.frequency.value = note;
            
            this._gainNode = this._audioContext.createGain();
            this._gainNode.gain.value = this.volume * 0.1;
            
            osc.connect(this._gainNode);
            this._gainNode.connect(this._audioContext.destination);
            
            osc.start();
            
            // Медленное затухание
            this._gainNode.gain.exponentialRampToValueAtTime(0.001, 
                this._audioContext.currentTime + (this.currentTrack?.duration || 180));
        } catch(e) {
            // Без звука
        }
    }
}