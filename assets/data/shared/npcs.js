// ============================================
// ОБЩИЕ NPC — ПЕРСОНАЖИ НЕСКОЛЬКИХ РАССЛЕДОВАНИЙ
// ============================================
// Базовые профили общих персонажей. Контекстные диалоги и
// реакции конкретного дела задаются в соответствующем case pack.

registerData('npc', {
bartender: {
        id: "bartender",
        name: "Джо",
        role: "Бармен",
        description: "Крупный мужчина с добродушной улыбкой. Владелец бара «У Джо». Всегда готов выслушать — и налить.",
        icon: "👨🏾",
        portrait: "assets/art/portraits/bartender-joe.webp",
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
sergeant: {
        id: "sergeant",
        name: "Сержант Миллс",
        role: "Начальник участка",
        description: "Ваш непосредственный начальник. Суров, но справедлив. Выдаёт дела и ордеры. Знает больше, чем говорит.",
        icon: "👮",
        portrait: "assets/art/portraits/sergeant-mills.webp",
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
    }
});
