class AmbientSounds {
    constructor() {
        this.currentSound = null;
        this._audioContext = null;
        this._gainNode = null;
        this._oscillator = null;
        this._bindEvents();
    }

    _bindEvents() {
        events.on('location:changed', (data) => {
            this.playForLocation(data.locationId);
        });

        events.on('navigation:go', () => {
            this.stop();
        });
    }

    playForLocation(locationId) {
        this.stop();

        const sounds = {
            'police_station': { freq: 440, type: 'sine', vol: 0.005, desc: 'фон участка' },
            'hotel_grand': { freq: 330, type: 'sine', vol: 0.004, desc: 'гул отеля' },
            'hotel_room_304': { freq: 220, type: 'triangle', vol: 0.006, desc: 'тиканье' },
            'bar_joe': { freq: 392, type: 'sine', vol: 0.003, desc: 'джаз' },
            'alley': { freq: 110, type: 'sawtooth', vol: 0.003, desc: 'ветер' },
            'victim_apartment': { freq: 180, type: 'sine', vol: 0.004, desc: 'тишина' },
            'rival_office': { freq: 520, type: 'triangle', vol: 0.003, desc: 'офис' },
            'train_station': { freq: 660, type: 'sawtooth', vol: 0.005, desc: 'вокзал' }
        };

        const sound = sounds[locationId];
        if (!sound) return;

        try {
            this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this._oscillator = this._audioContext.createOscillator();
            this._gainNode = this._audioContext.createGain();

            this._oscillator.type = sound.type;
            this._oscillator.frequency.value = sound.freq;

            this._gainNode.gain.value = sound.vol;

            this._oscillator.connect(this._gainNode);
            this._gainNode.connect(this._audioContext.destination);

            this._oscillator.start();
            this.currentSound = sound;
        } catch(e) {}
    }

    stop() {
        if (this._oscillator) {
            try { this._oscillator.stop(); } catch(e) {}
            this._oscillator = null;
        }
        if (this._audioContext) {
            this._audioContext.close().catch(()=>{});
            this._audioContext = null;
        }
        this.currentSound = null;
    }
}