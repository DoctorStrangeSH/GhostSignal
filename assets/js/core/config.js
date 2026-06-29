const CONFIG = {
    version: '1.0.0',
    appName: 'Ghost Signal',
    tagline: 'Every case leaves a trace in the static.',
    
    time: {
        startHour: 8,
        startMinute: 0,
        startDay: 1,
        costs: {
            travel: 20,
            examine: 5,
            call: 10,
            dialogue: 5,
            minigame: 15,
            readNote: 5,
            waitHour: 60,
            waitMorning: null
        },
        dawn: 6,
        day: 9,
        dusk: 18,
        night: 22
    },
    
    ranks: [
        { name: 'СТАЖЁР', minSolved: 0 },
        { name: 'МЛАДШИЙ ДЕТЕКТИВ', minSolved: 1 },
        { name: 'ДЕТЕКТИВ', minSolved: 3 },
        { name: 'СТАРШИЙ ДЕТЕКТИВ', minSolved: 6 },
        { name: 'МАЙОР', minSolved: 10 },
        { name: 'ЛЕГЕНДА', minSolved: 15 }
    ],
    
    hints: {
        maxPerCase: 3,
        penaltyPerHint: 0.5
    },
    
    audio: {
        enabled: true,
        volume: 0.5,
        voiceEnabled: true
    },
    
    debug: true  // Включаем для отладки
};

Object.freeze(CONFIG);