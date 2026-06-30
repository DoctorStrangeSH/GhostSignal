// ============================================
// NPC — ДЕЛО №1
// ============================================

registerData('npc', {
    porter: {
        id: "porter",
        name: "Фрэнк",
        role: "Ночной портье",
        description: "Пожилой мужчина с усталыми глазами. Работает в отеле «Гранд» уже 20 лет. Знает всех постояльцев. Слышал шаги в коридоре в ночь исчезновения.",
        icon: "👨🏻",
        mood: "nervous",
        schedule: {
            awake: { start: 18, end: 6 },
            atWork: { start: 20, end: 6 },
            sleeps: { start: 6, end: 18 },
            locations: { work: "hotel_grand", home: null },
            daysOff: [],
            exceptions: []
        },
        availableForCall: true,
        availableForChat: true,
        dialogueId: "dialogue-porter",
        canGiveEvidence: [],
        canGiveInsights: ["suspicious_visitor", "maid_evening_visit", "locked_from_inside"],
        specialConditions: [
            {
                id: "porter_confession",
                condition: "hasInsight:blackwood_affair",
                dialogueId: "dialogue-porter"
            }
        ]
    },
    bartender: {
        id: "bartender",
        name: "Джо",
        role: "Бармен",
        description: "Крупный мужчина с добродушной улыбкой. Владелец бара «У Джо». Всегда готов выслушать — и налить.",
        icon: "👨🏾",
        mood: "friendly",
        schedule: {
            awake: { start: 14, end: 4 },
            atWork: { start: 16, end: 2 },
            sleeps: { start: 4, end: 14 },
            locations: { work: "bar_joe", home: null },
            daysOff: ["monday"],
            exceptions: []
        },
        availableForCall: true,
        availableForChat: true,
        dialogueId: "dialogue-bartender",
        canGiveEvidence: ["matchbox"],
        canGiveInsights: ["bar_meeting_details", "suspicious_couple", "blackwood_wanted_to_disappear"],
        specialConditions: [
            {
                id: "after_finding_note",
                condition: "hasItem:hidden_note",
                dialogueId: "dialogue-bartender"
            }
        ]
    },
    housekeeper: {
        id: "housekeeper",
        name: "Мэри",
        role: "Горничная",
        description: "Молодая женщина, работает в отеле полгода. Выглядит встревоженной. Избегает зрительного контакта. Была в номере 304 в ночь исчезновения.",
        icon: "👩🏻",
        mood: "anxious",
        schedule: {
            awake: { start: 6, end: 22 },
            atWork: { start: 8, end: 17 },
            sleeps: { start: 22, end: 6 },
            locations: { work: "hotel_grand", home: null },
            daysOff: ["sunday"],
            exceptions: []
        },
        availableForCall: true,
        availableForChat: false,
        dialogueId: "dialogue-housekeeper",
        canGiveEvidence: [],
        canGiveInsights: ["mary_alibi", "mary_suspicion", "mary_confession"],
        specialConditions: [
            {
                id: "confronted_with_photo",
                condition: "hasItem:torn_photo",
                dialogueId: "dialogue-housekeeper"
            }
        ]
    },
    sergeant: {
        id: "sergeant",
        name: "Сержант Миллс",
        role: "Начальник участка",
        description: "Ваш непосредственный начальник. Суров, но справедлив. Выдаёт дела и ордеры. Знает больше, чем говорит.",
        icon: "👮",
        mood: "professional",
        schedule: {
            awake: { start: 7, end: 23 },
            atWork: { start: 8, end: 18 },
            sleeps: { start: 23, end: 7 },
            locations: { work: "police_station", home: null },
            daysOff: ["saturday", "sunday"],
            exceptions: []
        },
        availableForCall: true,
        availableForChat: true,
        dialogueId: "dialogue-sergeant",
        canGiveEvidence: ["search_warrant"],
        canGiveInsights: ["case_background", "financial_troubles"],
        specialConditions: [
            {
                id: "issue_warrant",
                condition: "evidence_count:3",
                dialogueId: "dialogue-sergeant",
                autoTrigger: true
            }
        ]
    },
    elias: {
        id: "elias",
        name: "Элиас Вон",
        role: "Друг Блэквуда",
        description: "Высокий мужчина в чёрной шляпе. Старый друг Блэквуда. Помогал ему с билетами на поезд.",
        icon: "🎩",
        mood: "nervous",
        schedule: {
            awake: { start: 10, end: 2 },
            atWork: null,
            sleeps: { start: 2, end: 10 },
            locations: { work: "bar_joe", home: null },
            daysOff: [],
            exceptions: []
        },
        availableForCall: true,
        availableForChat: true,
        dialogueId: "dialogue-elias",
        canGiveEvidence: [],
        canGiveInsights: ["elias_testimony", "elias_betrayal", "wife_suicide_threat"],
        specialConditions: []
    },
    wife_blackwood: {
        id: "wife_blackwood",
        name: "Виктория Блэквуд",
        role: "Жена жертвы",
        description: "Высокая элегантная женщина в чёрном. Знает о романе мужа. Наняла детектива, чтобы следить за ним.",
        icon: "👩‍⚖️",
        mood: "cold",
        schedule: {
            awake: { start: 9, end: 22 },
            atWork: null,
            sleeps: { start: 22, end: 9 },
            locations: { work: null, home: "blackwood_mansion" },
            daysOff: [],
            exceptions: []
        },
        availableForCall: true,
        availableForChat: true,
        dialogueId: "dialogue-wife",
        canGiveEvidence: ["phone_records", "detective_photos"],
        canGiveInsights: ["wife_knew_everything", "wife_blackmail"],
        specialConditions: []
    },
    coroner: {
        id: "coroner",
        name: "Доктор Харрис",
        role: "Патологоанатом",
        description: "Уставший человек в белом халате. Видел слишком много смертей. Говорит цинично, но дело знает.",
        icon: "🧑‍⚕️",
        mood: "cynical",
        schedule: {
            awake: { start: 8, end: 20 },
            atWork: { start: 9, end: 18 },
            sleeps: { start: 20, end: 8 },
            locations: { work: "morgue", home: null },
            daysOff: ["sunday"],
            exceptions: []
        },
        availableForCall: true,
        availableForChat: true,
        dialogueId: "dialogue-coroner",
        canGiveEvidence: ["toxicology_report"],
        canGiveInsights: ["sedative_analysis", "professional_knowledge", "fingerprints_on_glass"],
        specialConditions: []
    }
});