class Jukebox {
    constructor() {
        this.isPlaying = false;
        this.currentTrack = null;
        this.volume = 0.02;
        this._audioContext = null;
        this._gainNode = null;
        this._currentOsc = null;
        this._tracks = [
            { name: 'Midnight Blues', genre: 'Jazz', duration: 4 },
            { name: 'Rainy Street', genre: 'Noir', duration: 5 },
            { name: 'Smoke & Mirrors', genre: 'Jazz', duration: 4 },
            { name: 'Dark Alley', genre: 'Ambient', duration: 6 },
            { name: 'Detective Theme', genre: 'Noir', duration: 5 }
        ];
        this._init();
    }
    
    _init() {
        events.on('location:changed', (data) => {
            if (data.locationId === 'bar_joe' && !this.isPlaying) this.play();
            else if (data.locationId !== 'bar_joe' && this.isPlaying) this.stop();
        });
        
        events.on('navigation:go', (screenId) => {
            if (screenId !== 'screen-case-active' && this.isPlaying) this.stop();
        });
    }
    
    play(trackIndex = null) {
        if (trackIndex === null) trackIndex = Math.floor(Math.random() * this._tracks.length);
        this.currentTrack = this._tracks[trackIndex];
        this.isPlaying = true;
        this._playSoftTone();
        
        const duration = (this.currentTrack.duration || 4) * 1000;
        setTimeout(() => { if (this.isPlaying) this.play(); }, duration + 1000);
    }
    
    stop() {
        this.isPlaying = false;
        if (this._currentOsc) { try { this._currentOsc.stop(); } catch(e) {} this._currentOsc = null; }
        if (this._gainNode) this._gainNode.gain.value = 0;
    }
    
    _playSoftTone() {
        try {
            if (!this._audioContext) this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            const notes = [261, 329, 392];
            const note = notes[Math.floor(Math.random() * notes.length)];
            
            const osc = this._audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = note;
            
            this._gainNode = this._audioContext.createGain();
            this._gainNode.gain.value = this.volume;
            
            osc.connect(this._gainNode);
            this._gainNode.connect(this._audioContext.destination);
            
            osc.start();
            this._currentOsc = osc;
            
            const dur = (this.currentTrack?.duration || 4);
            this._gainNode.gain.exponentialRampToValueAtTime(0.001, this._audioContext.currentTime + dur);
            
            setTimeout(() => { try { osc.stop(); } catch(e) {} }, dur * 1000 + 500);
        } catch(e) {}
    }
}