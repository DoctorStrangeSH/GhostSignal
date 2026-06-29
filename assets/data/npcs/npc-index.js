const NPCS_INDEX = {
    porter: {
        id: "porter",
        name: "Фрэнк",
        role: "Ночной портье",
        description: "Пожилой мужчина с усталыми глазами. Работает в отеле «Гранд» уже 20 лет. Знает всех постояльцев.",
        icon: "👨🏻",
        avatar: null,
        mood: "nervous",

        schedule: {
            awake: { start: 18, end: 6 },
            atWork: { start: 20, end: 6 },
            sleeps: { start: 6, end: 18 },
            locations: {
                work: "hotel_grand",
                home: "staff_quarters"
            },
            daysOff: [],
            exceptions: []
        },

        availableForCall: true,
        availableForChat: true,
        dialogueId: "dialogue-porter",

        canGiveEvidence: [],
        canGiveInsights: ["suspicious_visitor"],

        specialConditions: [
            {
                id: "nervous_breakdown",
                condition: "hasInsight:blackwood_affair",
                dialogueId: "dialogue-porter-confession"
            }
        ]
    },

    bartender: {
        id: "bartender",
        name: "Джо",
        role: "Бармен",
        description: "Крупный мужчина с добродушной улыбкой. Владелец бара «У Джо». Всегда готов выслушать.",
        icon: "👨🏾",
        avatar: null,
        mood: "friendly",

        schedule: {
            awake: { start: 14, end: 4 },
            atWork: { start: 16, end: 2 },
            sleeps: { start: 4, end: 14 },
            locations: {
                work: "bar_joe",
                home: "apartment_above_bar"
            },
            daysOff: ["monday"],
            exceptions: []
        },

        availableForCall: true,
        availableForChat: true,
        dialogueId: "dialogue-bartender",

        canGiveEvidence: [],
        canGiveInsights: ["bar_meeting_details", "suspicious_couple"],

        specialConditions: [
            {
                id: "after_finding_note",
                condition: "hasItem:hidden_note",
                dialogueId: "dialogue-bartender-meeting"
            }
        ]
    },

    housekeeper: {
        id: "housekeeper",
        name: "Мэри",
        role: "Горничная",
        description: "Молодая женщина, работает в отеле полгода. Выглядит встревоженной. Избегает зрительного контакта.",
        icon: "👩🏻",
        avatar: null,
        mood: "anxious",

        schedule: {
            awake: { start: 6, end: 22 },
            atWork: { start: 8, end: 17 },
            sleeps: { start: 22, end: 6 },
            locations: {
                work: "hotel_grand",
                home: "staff_quarters"
            },
            daysOff: ["sunday"],
            exceptions: []
        },

        availableForCall: true,
        availableForChat: false,
        dialogueId: "dialogue-housekeeper",

        canGiveEvidence: [],
        canGiveInsights: ["mary_alibi", "mary_suspicion"],

        specialConditions: [
            {
                id: "confronted_with_photo",
                condition: "hasItem:torn_photo",
                dialogueId: "dialogue-housekeeper-confrontation"
            }
        ]
    },

    sergeant: {
        id: "sergeant",
        name: "Сержант Миллс",
        role: "Начальник участка",
        description: "Ваш непосредственный начальник. Суров, но справедлив. Выдаёт дела и ордеры.",
        icon: "👮",
        avatar: null,
        mood: "professional",

        schedule: {
            awake: { start: 7, end: 23 },
            atWork: { start: 8, end: 18 },
            sleeps: { start: 23, end: 7 },
            locations: {
                work: "police_station",
                home: "sergeant_house"
            },
            daysOff: ["saturday", "sunday"],
            exceptions: []
        },

        availableForCall: true,
        availableForChat: true,
        dialogueId: "dialogue-sergeant",

        canGiveEvidence: ["search_warrant"],
        canGiveInsights: ["case_background"],

        specialConditions: [
            {
                id: "issue_warrant",
                condition: "evidence_count:3",
                dialogueId: "dialogue-sergeant-warrant",
                autoTrigger: true
            }
        ]
    },

    ex_wife: {
        id: "ex_wife",
        name: "Анна Ковалёва",
        role: "Бывшая жена",
        description: "Элегантная женщина в красном. Развелась с жертвой полгода назад. Получила крупные отступные.",
        icon: "👩‍🦰",
        avatar: null,
        mood: "angry",

        schedule: {
            awake: { start: 9, end: 23 },
            atWork: null,
            sleeps: { start: 23, end: 9 },
            locations: {
                work: null,
                home: "victim_apartment"
            },
            daysOff: [],
            exceptions: []
        },

        availableForCall: true,
        availableForChat: false,
        dialogueId: "dialogue-ex-wife",

        canGiveEvidence: [],
        canGiveInsights: ["ex_wife_motive"],

        specialConditions: [
            {
                id: "confront_with_note",
                condition: "hasItem:threat_note",
                dialogueId: "dialogue-ex-wife"
            }
        ]
    }
};

// Вспомогательные функции
function getNPCById(id) {
    return NPCS_INDEX[id] || null;
}

function getNPCsByLocation(locationId) {
    return Object.values(NPCS_INDEX).filter(npc => {
        return npc.schedule.locations.work === locationId ||
               npc.schedule.locations.home === locationId;
    });
}

function getNPCsByCase(caseData) {
    if (!caseData?.npcs) return [];
    return caseData.npcs.map(id => getNPCById(id)).filter(Boolean);
}