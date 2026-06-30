class SoundEffectsManager {
    constructor(ttsEngine) {
        this.tts = ttsEngine;
        this._bindEvents();
    }
    
    _bindEvents() {
        // Звук при получении улики
        events.on('inventory:changed', (data) => {
            if (data.action === 'add') {
                const obj = getObjectById(data.itemId);
                if (obj?.isEvidence) {
                    this.tts?.playEvidenceSound();
                } else {
                    this.tts?.playEffect('message');
                }
            }
        });
        
        // Звук при озарении
        events.on('insight:gained', () => {
            this.tts?.playEffect('evidence');
        });
        
        // Звук при раскрытии дела
        events.on('case:solved', () => {
            this.tts?.playSuccessSound();
        });
        
        // Звук при ошибке
        events.on('case:failed', () => {
            this.tts?.playErrorSound();
        });
        
        // Звук набора номера при звонке
        events.on('call:started', () => {
            this.tts?.playDialTone();
        });
        
        // Звук соединения
        events.on('call:connected', () => {
            this.tts?.playConnectSound();
        });
        
        // Звук сброса
        events.on('call:ended', () => {
            this.tts?.playHangupSound();
        });
        
        // Звук печатной машинки при вводе в финальном ответе
        document.addEventListener('input', (e) => {
            if (e.target.id === 'final-answer-input') {
                this.tts?.playEffect('typewriter');
            }
        });
    }
}