// ============================================
// NPC — ДЕЛО №2
// ============================================

registerData('npc', {
    ex_wife: {
        id: "ex_wife",
        name: "Анна Ковалёва",
        role: "Бывшая жена",
        description: "Элегантная женщина в красном. Развелась с жертвой полгода назад. Получила крупные отступные, но потеряла всё остальное.",
        icon: "👩‍🦰",
        mood: "angry",
        schedule: {
            awake: { start: 9, end: 23 },
            atWork: null,
            sleeps: { start: 23, end: 9 },
            locations: { work: null, home: "victim_apartment" },
            daysOff: [],
            exceptions: []
        },
        availableForCall: true,
        availableForChat: false,
        dialogueId: "dialogue-ex-wife",
        canGiveEvidence: [],
        canGiveInsights: ["ex_wife_motive", "suicide_plan", "someone_took_vial"],
        specialConditions: []
    },
    woman_in_red: {
        id: "woman_in_red",
        name: "Ева Ковалёва",
        role: "Сестра Анны",
        description: "Рыжеволосая женщина в алом платье. Появляется и исчезает как тень. Сестра Анны, готовая на всё ради неё.",
        icon: "💃",
        mood: "suspicious",
        schedule: {
            awake: { start: 18, end: 4 },
            atWork: null,
            sleeps: { start: 4, end: 18 },
            locations: { work: "bar_joe", home: null },
            daysOff: [],
            exceptions: []
        },
        availableForCall: false,
        availableForChat: true,
        dialogueId: "dialogue-woman-in-red",
        canGiveEvidence: [],
        canGiveInsights: ["sisters_revealed", "rival_took_vial_confirmed", "witness_ready"],
        specialConditions: [
            {
                id: "confront_with_scarf",
                condition: "hasItem:red_scarf",
                dialogueId: "dialogue-woman-in-red"
            }
        ]
    },
    business_rival: {
        id: "business_rival",
        name: "Виктор Кейн",
        role: "Конкурент по бизнесу",
        description: "Седой мужчина в дорогом костюме. Владелец конкурирующей фирмы. Судился с жертвой за крупный контракт.",
        icon: "👨‍💼",
        mood: "cold",
        schedule: {
            awake: { start: 8, end: 22 },
            atWork: { start: 9, end: 18 },
            sleeps: { start: 22, end: 8 },
            locations: { work: "rival_office", home: null },
            daysOff: ["saturday", "sunday"],
            exceptions: []
        },
        availableForCall: true,
        availableForChat: true,
        dialogueId: "dialogue-rival-full",
        canGiveEvidence: [],
        canGiveInsights: ["rival_motive", "rival_alibi", "full_confession_kane", "blackwood_provoked_kane"],
        specialConditions: []
    },
    pharmacist: {
        id: "pharmacist",
        name: "Мистер Грин",
        role: "Фармацевт",
        description: "Пожилой мужчина в очках с толстыми линзами. Работает в аптеке 30 лет. Помнит каждую покупку.",
        icon: "👴",
        mood: "cautious",
        schedule: {
            awake: { start: 8, end: 20 },
            atWork: { start: 8, end: 18 },
            sleeps: { start: 20, end: 8 },
            locations: { work: "pharmacy", home: null },
            daysOff: ["sunday"],
            exceptions: []
        },
        availableForCall: false,
        availableForChat: true,
        dialogueId: "dialogue-pharmacist",
        canGiveEvidence: ["prescription_copy"],
        canGiveInsights: ["kane_bought_cyanide", "anna_bought_sedative", "two_buyers_same_day"],
        specialConditions: []
    },
    waiter: {
        id: "waiter",
        name: "Томас",
        role: "Официант бара",
        description: "Молодой парень, подрабатывает в баре по вечерам. Видел всё, но боится говорить — Кейн угрожал его семье.",
        icon: "🧑‍🍳",
        mood: "scared",
        schedule: {
            awake: { start: 12, end: 2 },
            atWork: { start: 18, end: 1 },
            sleeps: { start: 2, end: 12 },
            locations: { work: "bar_joe", home: null },
            daysOff: ["monday"],
            exceptions: []
        },
        availableForCall: false,
        availableForChat: true,
        dialogueId: "dialogue-waiter",
        canGiveEvidence: [],
        canGiveInsights: ["waiter_saw_poisoning", "kane_threatened_witness", "waiter_confirms_theft"],
        specialConditions: []
    },
    journalist: {
        id: "journalist",
        name: "Лора Лейн",
        role: "Журналистка «Вечернего вестника»",
        description: "Острая на язык журналистка. Расследовала связи Кейна с криминалом. Может помочь — или помешать.",
        icon: "👩‍💼",
        mood: "ambitious",
        schedule: {
            awake: { start: 9, end: 1 },
            atWork: null,
            sleeps: { start: 1, end: 9 },
            locations: { work: "newspaper_office", home: null },
            daysOff: [],
            exceptions: []
        },
        availableForCall: true,
        availableForChat: true,
        dialogueId: "dialogue-journalist",
        canGiveEvidence: ["lora_notes"],
        canGiveInsights: ["kane_criminal_connections", "press_investigation", "hard_evidence_kane"],
        specialConditions: []
    }
});