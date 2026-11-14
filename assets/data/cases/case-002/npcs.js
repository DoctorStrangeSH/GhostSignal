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
        psychology: {
            opennessThreshold: 68, pressureThreshold: 55, calmPressureLimit: 12,
            labels: { cooperative: "Готова говорить", pressured: "Сдерживает гнев", overwhelmed: "На грани срыва", distrustful: "Не доверяет" }
        },
        schedule: {
            awake: { start: 9, end: 23 },
            atWork: null,
            sleeps: { start: 23, end: 9 },
            locations: { work: null, home: "anna_apartment" },
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
        psychology: {
            opennessThreshold: 62, pressureThreshold: 60, calmPressureLimit: 14,
            labels: { cooperative: "Готова сотрудничать", pressured: "Теряет терпение", overwhelmed: "Срывается", distrustful: "Держит дистанцию" }
        },
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
        psychology: {
            opennessThreshold: 78, pressureThreshold: 50, calmPressureLimit: 16,
            labels: { cooperative: "Смягчился", pressured: "Теряет самообладание", overwhelmed: "Сломлен давлением", distrustful: "Закрылся" }
        },
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
        psychology: {
            opennessThreshold: 60, pressureThreshold: 58, calmPressureLimit: 12,
            labels: { cooperative: "Готов помочь", pressured: "Насторожен", overwhelmed: "Сильно встревожен", distrustful: "Не доверяет" }
        },
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
        psychology: {
            opennessThreshold: 56, pressureThreshold: 28, calmPressureLimit: 7,
            cooperationResistance: 0.12,
            cooperationThresholds: { withdrawn: 18, reluctant: 48, guarded: 58, willing: 78 },
            cooperationLabels: {
                withdrawn: "Закрылся от следствия",
                reluctant: "Боится говорить",
                guarded: "Готов говорить осторожно",
                willing: "Готов сотрудничать",
                ready: "Доверяет следствию"
            },
            labels: { cooperative: "Начинает доверять", pressured: "Сильно напуган", overwhelmed: "Паника", distrustful: "Боится вас" }
        },
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
    labour_inspector: {
        id: "labour_inspector",
        name: "Илья Руденко",
        role: "Инспектор городской инспекции труда",
        description: "Сдержанный муниципальный инспектор. Ведёт официальные проверки предприятий и хранит служебные записи о назначениях и отменах визитов.",
        icon: "🧑‍💼",
        mood: "professional",
        psychology: {
            opennessThreshold: 52, pressureThreshold: 72, calmPressureLimit: 18,
            labels: { cooperative: "Готов предоставить документы", pressured: "Требует официальный запрос", overwhelmed: "Прекращает разговор", distrustful: "Ссылается на процедуру" }
        },
        schedule: {
            awake: { start: 7, end: 21 },
            atWork: { start: 8, end: 20 },
            sleeps: { start: 21, end: 7 },
            locations: { work: "labour_inspection_office", home: null },
            daysOff: ["sunday"],
            exceptions: []
        },
        availableForCall: false,
        availableForChat: false,
        dialogueId: "dialogue-labour-inspector",
        canGiveEvidence: ["inspector_service_card"],
        canGiveInsights: ["inspection_cancellation_record", "rudenko_denies_visit", "rudenko_identity_documents_verified", "rudenko_agreed_to_identification"],
        specialConditions: []
    },
    tram_conductor: {
        id: "tram_conductor",
        name: "Павел Соколов",
        role: "Кондуктор ночного трамвая №4",
        description: "Наблюдательный, но осторожный кондуктор. Помнит необычных пассажиров и ведёт аккуратные путевые записи.",
        icon: "🧑‍✈️",
        mood: "wary",
        psychology: {
            opennessThreshold: 48, pressureThreshold: 58, calmPressureLimit: 14,
            labels: { cooperative: "Готов сверить записи", pressured: "Не любит допросы", overwhelmed: "Прекращает разговор", distrustful: "Отвечает уклончиво" }
        },
        schedule: {
            awake: { start: 14, end: 6 },
            atWork: { start: 18, end: 2 },
            sleeps: { start: 6, end: 14 },
            locations: { work: "tram_depot", home: null },
            daysOff: ["monday"],
            exceptions: []
        },
        availableForCall: false,
        availableForChat: false,
        dialogueId: "dialogue-tram-conductor",
        canGiveEvidence: ["tram_route_entry"],
        canGiveInsights: ["tram_passenger_route_corroboration"],
        specialConditions: []
    },
    mill_watchman: {
        id: "mill_watchman",
        name: "Степан Орлов",
        role: "Ночной сторож старой текстильной фабрики",
        description: "Немногословный сторож. Отвечает за ворота, пломбы и журнал ночных смен; не берётся судить о том, чего сам не видел.",
        icon: "🧓",
        mood: "wary",
        psychology: {
            opennessThreshold: 50, pressureThreshold: 60, calmPressureLimit: 15,
            labels: { cooperative: "Готов сверить журнал", pressured: "Отвечает сухо", overwhelmed: "Прекращает разговор", distrustful: "Ссылается на управляющего" }
        },
        schedule: {
            awake: { start: 18, end: 7 },
            atWork: { start: 20, end: 6 },
            sleeps: { start: 7, end: 18 },
            locations: { work: "old_textile_mill", home: null },
            daysOff: [],
            exceptions: []
        },
        availableForCall: false,
        availableForChat: false,
        dialogueId: "dialogue-mill-watchman",
        canGiveEvidence: ["mill_shift_extract"],
        canGiveInsights: ["mill_gate_seal_intact", "mill_no_registered_visitors"],
        specialConditions: []
    },
    diner_owner: {
        id: "diner_owner",
        name: "Элеонора Брукс",
        role: "Хозяйка ночной закусочной",
        description: "Практичная и наблюдательная хозяйка круглосуточной закусочной. Помнит постоянных клиентов, но осторожно относится к полиции и не любит, когда её предположения выдают за факты.",
        icon: "👩‍🍳",
        mood: "guarded",
        psychology: {
            opennessThreshold: 54, pressureThreshold: 62, calmPressureLimit: 14,
            labels: { cooperative: "Готова вспомнить детали", pressured: "Отвечает настороженно", overwhelmed: "Прекращает разговор", distrustful: "Не желает вмешиваться" }
        },
        schedule: {
            awake: { start: 0, end: 23 },
            atWork: { start: 0, end: 23 },
            sleeps: null,
            locations: { work: "night_diner", home: null },
            daysOff: [],
            exceptions: []
        },
        availableForCall: false,
        availableForChat: false,
        dialogueId: "dialogue-diner-owner",
        canGiveEvidence: ["diner_cash_slip"],
        canGiveInsights: ["diner_possible_matching_customer", "diner_time_unverified"],
        specialConditions: []
    },
    telephone_operator: {
        id: "telephone_operator",
        name: "Марта Вейл",
        role: "Оператор городской телефонной станции",
        description: "Опытная операторша ручного коммутатора. Точно различает обычные местные соединения и служебные междугородние запросы; не раскрывает личные сведения без основания.",
        icon: "👩‍💻",
        mood: "professional",
        psychology: {
            opennessThreshold: 56, pressureThreshold: 64, calmPressureLimit: 12,
            labels: { cooperative: "Готова проверить архив", pressured: "Ссылается на регламент", overwhelmed: "Прекращает разговор", distrustful: "Отказывает в доступе" }
        },
        schedule: {
            awake: { start: 7, end: 23 },
            atWork: { start: 7, end: 23 },
            sleeps: { start: 23, end: 7 },
            locations: { work: "telephone_exchange", home: null },
            daysOff: [],
            exceptions: []
        },
        availableForCall: false,
        availableForChat: false,
        dialogueId: "dialogue-telephone-operator",
        canGiveEvidence: ["telephone_exchange_slip"],
        canGiveInsights: ["telephone_exchange_request_record", "telephone_time_calibrated"],
        specialConditions: []
    },
    line_technician: {
        id: "line_technician",
        name: "Генри Кларк",
        role: "Техник городской телефонной сети",
        description: "Практичный мастер, отвечающий за кабельные колодцы и уличные аппараты. Точно знает границы своего участка и не делает выводов о чужих линиях.",
        icon: "👨‍🔧",
        mood: "professional",
        psychology: {
            opennessThreshold: 55, pressureThreshold: 63, calmPressureLimit: 13,
            labels: { cooperative: "Готов показать наряд", pressured: "Отвечает по регламенту", overwhelmed: "Прекращает разговор", distrustful: "Отказывает в архиве" }
        },
        schedule: {
            awake: { start: 6, end: 21 },
            atWork: { start: 7, end: 19 },
            sleeps: { start: 21, end: 6 },
            locations: { work: "telephone_maintenance_depot", home: null },
            daysOff: [],
            exceptions: []
        },
        availableForCall: false,
        availableForChat: false,
        dialogueId: "dialogue-line-technician",
        canGiveEvidence: ["booth_t17_maintenance_ticket"],
        canGiveInsights: ["booth_t17_fault_window", "booth_t17_not_confirmed_source"],
        specialConditions: []
    },
    journalist: {
        id: "journalist",
        name: "Лора Лейн",
        role: "Журналистка «Вечернего вестника»",
        description: "Острая на язык журналистка. Расследовала связи Кейна с криминалом. Может помочь — или помешать.",
        icon: "👩‍💼",
        mood: "ambitious",
        psychology: {
            opennessThreshold: 58, pressureThreshold: 62, calmPressureLimit: 15,
            labels: { cooperative: "Готова поделиться", pressured: "Чувствует давление", overwhelmed: "Раздражена", distrustful: "Не раскрывается" }
        },
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