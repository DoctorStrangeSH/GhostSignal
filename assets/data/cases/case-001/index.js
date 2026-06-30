// ============================================
// ДЕЛО №1: Исчезновение в отеле «Гранд»
// ============================================

const CASE_001 = {
    id: "case-001",
    title: "Исчезновение в отеле «Гранд»",
    difficulty: 1,
    description: "Мистер Блэквуд, постоялец отеля «Гранд», исчез из запертого номера 304. Дверь закрыта изнутри, окно не открывали. Признаков взлома нет. Администрация отеля просит провести расследование.",
    
    // === ВРЕМЯ СТАРТА ===
    startTime: { hour: 8, minute: 0, day: 1 },
    
    // === ЛОКАЦИИ ===
    locations: [
        "police_station",
        "hotel_grand",
        "hotel_room_304",
        "bar_joe",
        "alley",
        "victim_apartment",
        "blackwood_mansion",
        "morgue",
        "train_station"
    ],
    
    startLocation: "police_station",
    
    // === NPC ===
    npcs: [
        "porter",
        "bartender",
        "housekeeper",
        "sergeant",
        "elias",
        "wife_blackwood",
        "coroner"
    ],
    
    // === СОБЫТИЯ ===
    events: [
        {
            id: "intro_briefing",
            trigger: "case_start",
            type: "narrative",
            title: "Дождливый вечер",
            text: "Дождь барабанит по крыше полицейского участка. Телефонный звонок разрывает тишину. «Детектив? Это сержант Миллс. У нас происшествие в отеле „Гранд“. Постоялец исчез из запертого номера. Вы нужны там.»",
            choices: [
                { text: "Принять дело", next: null, action: "accept_case" },
                { text: "Задать вопросы", next: "briefing_questions" }
            ]
        },
        {
            id: "briefing_questions",
            trigger: "choice",
            text: "Сержант хмурится: «Подробности в отчёте портье. Идите, детектив, время не ждёт.»",
            action: "accept_case"
        },
        {
            id: "discover_diary",
            trigger: "item_acquired:victim_diary",
            type: "narrative",
            title: "Находка: Дневник",
            text: "Вы открываете дневник. Последние записи полны тревоги. Блэквуд кого-то боялся. Он пишет о «ней» — таинственной женщине, которая следила за ним последнюю неделю."
        },
        {
            id: "discover_photo",
            trigger: "item_acquired:torn_photo",
            type: "narrative",
            title: "Находка: Фотография",
            text: "На фотографии Блэквуд с горничной отеля. Выглядит как тайный роман. Это может быть мотивом... или ключом к разгадке."
        },
        {
            id: "bar_meeting_clue",
            trigger: "insight:bar_meeting",
            type: "notification",
            message: "Записка упоминает встречу в баре в 22:00. Нужно расспросить бармена."
        },
        {
            id: "alley_clue",
            trigger: "insight:alley_meeting",
            type: "notification",
            message: "На спичечном коробке адрес в переулке. Встреча в 02:00 — стоит проверить."
        },
        {
            id: "all_evidence_found",
            trigger: "evidence_count:5",
            type: "narrative",
            title: "Картина проясняется",
            text: "У вас достаточно улик. Блэквуд планировал побег с горничной, но что-то пошло не так. Пора составить обвинение."
        }
    ],
    
    // === СЦЕНЫ ===
    scenes: [
        {
            id: "hotel_lobby_intro",
            locationId: "hotel_grand",
            trigger: "first_visit:hotel_grand",
            text: "Лобби отеля встречает вас тишиной. Портье нервно теребит журнал регистрации. На стойке — старый телефон. Свет люстр дрожит.",
            highlightObjects: ["guest_book", "lobby_phone"]
        },
        {
            id: "room_304_intro",
            locationId: "hotel_room_304",
            trigger: "first_visit:hotel_room_304",
            text: "Номер 304. Беспорядок. Кровать смята. На ковре — тёмное пятно. Окно закрыто. Зеркало висит криво — за ним что-то виднеется.",
            highlightObjects: ["bed_304", "carpet_stain", "window_304", "mirror"]
        },
        {
            id: "bar_intro",
            locationId: "bar_joe",
            trigger: "first_visit:bar_joe",
            text: "В баре полумрак. Музыкальный автомат играет старый джаз. Бармен протирает стаканы. На стойке — коробка с потерянными вещами.",
            highlightObjects: ["bar_counter"]
        },
        {
            id: "alley_intro",
            locationId: "alley",
            trigger: "first_visit:alley",
            text: "Переулок встречает вас запахом сырости. У стены — переполненный мусорный бак. Фонарь разбит. В темноте что-то блестит.",
            highlightObjects: ["dumpster", "broken_lamp"],
            nightOnlyObjects: ["hidden_suitcase"]
        }
    ],
    
    // === УСЛОВИЯ РАЗБЛОКИРОВКИ ===
    unlockConditions: [
        {
            locationId: "victim_apartment",
            requiresItem: "search_warrant",
            message: "Нужен ордер на обыск. Поговорите с сержантом после сбора улик."
        },
        {
            locationId: "train_station",
            requiresItem: "train_ticket",
            message: "Нужен билет на поезд чтобы попасть на вокзал."
        }
    ],
    
    // === ДОСКА ===
    boardSlots: 4,
    
    // === ЦЕПОЧКИ УЛИК ===
    evidenceChains: [
        {
            id: "chain_001",
            name: "План побега",
            requiredEvidence: ["hidden_note", "train_ticket", "torn_photo"],
            requiredInsights: ["bar_meeting", "planned_escape"],
            bonusInsight: "full_escape_plan",
            description: "Вы восстановили план побега Блэквуда. Он собирался уехать с горничной."
        }
    ],
    
    // === СЛЕЖКИ ===
    stakeouts: [
        {
            id: "stakeout_alley",
            locationId: "alley",
            targetTime: { hour: 2, minute: 0 },
            duration: 30,
            description: "Наблюдение за переулком в 02:00",
            reward: { type: 'insight', id: 'alley_night_meeting' }
        }
    ],
    
    // === ДЕДУКЦИЯ ===
    correctDeduction: {
        suspect: "housekeeper",
        motive: "love",
        weapon: "sedative"
    },
    deductionSuspects: [
        { id: "housekeeper", name: "Мэри (горничная)", icon: "👩🏻" },
        { id: "porter", name: "Фрэнк (портье)", icon: "👨🏻" },
        { id: "elias", name: "Элиас (друг)", icon: "🎩" },
        { id: "wife_blackwood", name: "Виктория (жена)", icon: "👩‍⚖️" }
    ],
    deductionMotives: [
        { id: "love", name: "💘 Любовь/Ревность" },
        { id: "revenge", name: "💔 Месть" },
        { id: "money", name: "💰 Деньги" },
        { id: "fear", name: "😱 Страх" }
    ],
    deductionWeapons: [
        { id: "sedative", name: "💊 Снотворное" },
        { id: "poison", name: "🧪 Яд" },
        { id: "strangle", name: "🧣 Удушение" }
    ],
    
    // === ФИНАЛ ===
    finalQuestion: {
        title: "Обвинение",
        text: "Собрав все улики, вы готовы назвать преступника. Кто виновен в исчезновении мистера Блэквуда?",
        hint: "Подумайте, у кого был доступ в номер и мотив.",
        acceptableAnswers: [
            "горничная",
            "housekeeper",
            "мэри",
            "mary",
            "горничная мэри",
            "mary the housekeeper"
        ],
        correctAnswer: "горничная",
        feedbackCorrect: {
            title: "✅ ДЕЛО РАСКРЫТО",
            text: "Совершенно верно! Горничная Мэри и мистер Блэквуд планировали побег. Но в последний момент она узнала, что Блэквуд передумал и решил остаться с женой. В порыве ярости она подсыпала ему снотворное, спрятала в тележку для белья и вывезла через чёрный ход.",
            evidenceSummary: [
                "Записка о встрече в баре — план побега",
                "Дневник Блэквуда — он боялся «её»",
                "Фотография — тайный роман с горничной",
                "Спичечный коробок — адрес в переулке",
                "Чемодан — инсценировка побега"
            ]
        },
        feedbackIncorrect: {
            title: "❌ НЕВЕРНО",
            text: "Улики указывают на другого человека. Пересмотрите дневник жертвы и фотографию. Кто был ближе всех к Блэквуду?"
        }
    },
    
    
    // === НАГРАДА ===
    reward: {
        rankPoints: 1,
        message: "Поздравляем! Вы раскрыли своё первое дело. Звание повышено до «МЛАДШИЙ ДЕТЕКТИВ»."
    }
};