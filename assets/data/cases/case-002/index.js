// ============================================
// ДЕЛО №2: Отравление в баре «У Джо»
// ============================================

const CASE_002 = {
    id: "case-002",
    title: "Отравление в баре «У Джо»",
    difficulty: 2,
    description: "Джонатан Блэквуд найден без сознания после отравления в баре. В стакане обнаружен яд. Бывшая жена и деловой конкурент становятся первыми версиями следствия, а неизвестная женщина в красном может оказаться важным свидетелем.",
    
    // === ВРЕМЯ СТАРТА ===
    startTime: { hour: 0, minute: 30, day: 1 },
    
    // === ЛОКАЦИИ ===
    locations: [
        "police_station",
        "bar_joe",
        "anna_apartment",
        "alley",
        "rival_office",
        "pharmacy",
        "newspaper_office",
        "labour_inspection_office",
        "tram_depot",
        "old_textile_mill",
        "night_diner",
        "textile_phone_booth",
        "telephone_exchange",
        "telephone_maintenance_depot",
        "bank"
    ],
    
    startLocation: "police_station",
    
    // === NPC ===
    npcs: [
        "bartender",
        "sergeant",
        "ex_wife",
        "woman_in_red",
        "business_rival",
        "pharmacist",
        "waiter",
        "journalist",
        "labour_inspector",
        "tram_conductor",
        "mill_watchman",
        "diner_owner",
        "telephone_operator"
    ],

    // === СОЦИАЛЬНАЯ СЕТЬ NPC ===
    // Связи направленные: сведения передаются только по явно заданным отношениям.
    socialNetwork: {
        maxHops: 2, retryMinutes: 15, expiryMinutes: 360,
        edges: [
            { id: "waiter-to-bartender", from: "waiter", to: "bartender", relationship: "coworkers", label: "Коллеги по бару", trust: 80, channel: "in_person", delayMinutes: 15, minTrustToShare: 35, shareTypes: ["detective_behavior"], canForward: true },
            { id: "bartender-to-waiter", from: "bartender", to: "waiter", relationship: "coworkers", label: "Коллеги по бару", trust: 70, channel: "in_person", delayMinutes: 20, minTrustToShare: 35, shareTypes: ["detective_behavior"], canForward: false },
            { id: "bartender-to-journalist", from: "bartender", to: "journalist", relationship: "source", label: "Источник в баре", trust: 65, channel: "message", delayMinutes: 40, minTrustToShare: 50, shareTypes: ["detective_behavior"], protectsNpcIds: [], withholdIfTargetProtected: false, canForward: true },
            { id: "journalist-to-bartender", from: "journalist", to: "bartender", relationship: "source", label: "Источник в баре", trust: 55, channel: "message", delayMinutes: 30, minTrustToShare: 50, shareTypes: ["detective_behavior"], canForward: false },
            { id: "eva-to-anna", from: "woman_in_red", to: "ex_wife", relationship: "siblings", label: "Сёстры", trust: 95, channel: "phone", delayMinutes: 15, minTrustToShare: 20, shareTypes: ["detective_behavior"], canForward: true },
            { id: "anna-to-eva", from: "ex_wife", to: "woman_in_red", relationship: "siblings", label: "Сёстры", trust: 95, channel: "phone", delayMinutes: 10, minTrustToShare: 20, shareTypes: ["detective_behavior"], canForward: false },
            { id: "eva-protects-anna-from-press", from: "woman_in_red", to: "journalist", relationship: "protective", label: "Защищает сестру", trust: 70, channel: "message", delayMinutes: 30, minTrustToShare: 30, shareTypes: ["detective_behavior"], protectsNpcIds: [], withholdIfTargetProtected: false, canForward: false }
        ]
    },

    // === МОТИВЫ И ЛОЯЛЬНОСТЬ NPC ===
    // Скрытая авторская модель: не показывается игроку напрямую.
    // Давление снижает эффективную лояльность с учётом личных приоритетов персонажа.
    npcMotivations: {
        bartender: {
            motives: [
                { id: "protect_staff", weight: 85, pressureResistance: 0.55 },
                { id: "keep_bar_open", weight: 65, pressureResistance: 0.20 }
            ],
            loyalties: [
                { npcId: "waiter", strength: 86, protectThreshold: 62, appliesTo: ["detective_behavior"], motiveId: "protect_staff", reason: "protecting_colleague" }
            ]
        },
        woman_in_red: {
            motives: [
                { id: "protect_sister", weight: 100, pressureResistance: 0.72 },
                { id: "avoid_public_scandal", weight: 35, pressureResistance: 0.12 }
            ],
            loyalties: [
                { npcId: "ex_wife", strength: 96, protectThreshold: 60, appliesTo: ["detective_behavior"], motiveId: "protect_sister", reason: "protecting_sister" }
            ]
        },
        ex_wife: {
            motives: [
                { id: "protect_family", weight: 75, pressureResistance: 0.58 },
                { id: "regain_dignity", weight: 55, pressureResistance: 0.28 }
            ],
            loyalties: [
                { npcId: "woman_in_red", strength: 78, protectThreshold: 56, appliesTo: ["detective_behavior"], motiveId: "protect_family", reason: "protecting_sister" }
            ]
        },
        journalist: {
            motives: [
                { id: "publish_exclusive", weight: 90, pressureResistance: 0.18 },
                { id: "protect_sources", weight: 65, pressureResistance: 0.62 }
            ],
            loyalties: [
                { npcId: "bartender", strength: 72, protectThreshold: 54, appliesTo: ["detective_behavior"], motiveId: "protect_sources", reason: "protecting_source" }
            ]
        },
        waiter: {
            motives: [
                { id: "keep_job", weight: 90, pressureResistance: 0.18 },
                { id: "repay_bartender", weight: 55, pressureResistance: 0.52 }
            ],
            loyalties: [
                { npcId: "bartender", strength: 68, protectThreshold: 52, appliesTo: ["detective_behavior"], motiveId: "repay_bartender", reason: "protecting_employer" }
            ]
        },
        business_rival: {
            motives: [
                { id: "protect_reputation", weight: 90, pressureResistance: 0.24 },
                { id: "win_business_war", weight: 80, pressureResistance: 0.10 }
            ],
            loyalties: []
        },
        pharmacist: {
            motives: [
                { id: "protect_license", weight: 85, pressureResistance: 0.16 },
                { id: "professional_conscience", weight: 70, pressureResistance: 0.68 }
            ],
            loyalties: []
        },
        sergeant: {
            motives: [
                { id: "protect_investigation", weight: 85, pressureResistance: 0.70 },
                { id: "avoid_department_scandal", weight: 55, pressureResistance: 0.22 }
            ],
            loyalties: []
        }
    },

    // === ЖИВЫЕ ОТНОШЕНИЯ NPC ===
    // Базовые связи и автономные действия; скрытые сведения открываются только после подтверждения.
    npcRelationships: {
        goals: [
            {
                id: "maintain_bar_community", npcId: "bartender", title: "Сохранить связи бара",
                description: "Джо старается удержать вокруг бара людей, которым ещё можно доверять.",
                priority: 75, target: 2
            },
            {
                id: "protect_staff", npcId: "bartender", title: "Защитить своих сотрудников",
                description: "Джо не хочет, чтобы Томас расплачивался за чужие решения.",
                priority: 95, target: 2
            },
            {
                id: "protect_sister", npcId: "woman_in_red", title: "Защитить Анну",
                description: "Ева пытается удержать сестру от нового публичного скандала и одиночества.",
                priority: 100, target: 1
            },
            {
                id: "publish_exclusive", npcId: "journalist", title: "Добиться эксклюзива",
                description: "Лора хочет получить комментарий Джо и подготовить материал до утреннего дедлайна.",
                priority: 85, target: 1
            },
            {
                id: "keep_in_touch_with_mills", npcId: "bartender", title: "Оставаться на связи с Миллсом",
                description: "Джо не хочет терять осторожный контакт с сержантом.",
                priority: 55, target: 1
            }
        ],
        bonds: [
            { id: "joe-thomas-colleagues", fromNpcId: "bartender", toNpcId: "waiter", relationship: "coworkers", label: "Коллеги по бару", trust: 80, reciprocal: true },
            { id: "bartender-sergeant", fromNpcId: "bartender", toNpcId: "sergeant", relationship: "cautious_contacts", label: "Осторожные знакомые", trust: 55, reciprocal: true },
            { id: "sisters-anna-eva", fromNpcId: "ex_wife", toNpcId: "woman_in_red", relationship: "siblings", label: "Сёстры", trust: 95, reciprocal: true },
            { id: "joe-lora-source", fromNpcId: "bartender", toNpcId: "journalist", relationship: "source", label: "Источник и журналистка", trust: 65, reciprocal: true },
            { id: "kane-sergeant-procedure", fromNpcId: "business_rival", toNpcId: "sergeant", relationship: "official_record", label: "Протокол допроса", trust: 40, reciprocal: false },
            { id: "lora-eva-inquiry", fromNpcId: "journalist", toNpcId: "woman_in_red", relationship: "investigative_contact", label: "Контакт по расследованию", trust: 40, reciprocal: false }
        ],
        autonomousInteractions: [
            {
                id: "kane-files-objection", relationshipId: "kane-sergeant-procedure",
                fromNpcId: "business_rival", toNpcId: "sergeant", interaction: "conflict",
                channel: "message", initialDelayMinutes: 90, everyMinutes: 90,
                maxOccurrences: 1, retryMinutes: 20,
                fromDialogueId: "dialogue-rival-full", fromDialogueNodeId: "accusation",
                trustDelta: -4, reciprocalTrustDelta: 0,
                fromCooperationDelta: -6,
                summary: "После прямого обвинения Кейн потребовал внести возражение в официальный протокол и указал на отсутствие доказательств."
            },
            {
                id: "joe-reassures-thomas-after-threat", relationshipId: "joe-thomas-colleagues",
                fromNpcId: "bartender", toNpcId: "waiter", interaction: "support",
                goalId: "protect_staff", goalProgress: 1,
                channel: "in_person", requiresSameLocation: true,
                initialDelayMinutes: 30, everyMinutes: 60, maxOccurrences: 1,
                fromRumorId: "detective-threatened-thomas", fromRumorConfidenceAtLeast: 55,
                fromPressureBelow: 80,
                trustDelta: 3, reciprocalTrustDelta: 2, toCooperationDelta: 8,
                summary: "Узнав об угрозах детектива, Джо поддержал Томаса и предложил ему помощь."
            },
            {
                id: "lora-questions-joe-about-threat", relationshipId: "joe-lora-source",
                investigatesRumorId: "detective-threatened-thomas",
                fromNpcId: "journalist", toNpcId: "bartender", interaction: "conflict",
                channel: "message",
                initialDelayMinutes: 90, everyMinutes: 90, maxOccurrences: 1,
                fromRumorId: "detective-threatened-thomas", fromRumorConfidenceAtLeast: 55,
                trustDelta: -2, reciprocalTrustDelta: 0,
                summary: "Услышав историю об угрозах Томасу, Лора потребовала от Джо подтверждений, прежде чем писать статью."
            },
            {
                id: "lora-interviews-eva-about-threat", relationshipId: "lora-eva-inquiry",
                fromNpcId: "journalist", toNpcId: "woman_in_red", interaction: "support",
                channel: "phone", initialDelayMinutes: 180, everyMinutes: 90,
                retryMinutes: 20, maxOccurrences: 1,
                fromRumorId: "detective-threatened-thomas",
                investigatesRumorId: "detective-threatened-thomas",
                requiresActionId: "lora-questions-joe-about-threat",
                requiresInvestigationOutcome: "no_independent_evidence",
                requiresActionAgeMinutes: 60,
                trustDelta: 0, reciprocalTrustDelta: 0,
                summary: "Не найдя независимого подтверждения у Джо, Лора позвонила Еве и уточнила, была ли та свидетелем угроз Томасу."
            },
            {
                id: "joe-checks-thomas", relationshipId: "joe-thomas-colleagues",
                fromNpcId: "bartender", toNpcId: "waiter", interaction: "support",
                goalId: "protect_staff", goalProgress: 1,
                channel: "in_person", requiresSameLocation: true,
                initialDelayMinutes: 120, everyMinutes: 180, maxOccurrences: 1,
                minTrust: 55, fromPressureBelow: 70, toPressureBelow: 50,
                trustDelta: 2, reciprocalTrustDelta: 1,
                toCooperationDelta: 10,
                summary: "Джо поинтересовался, всё ли в порядке у Томаса."
            },
            {
                id: "thomas-snaps-at-joe", relationshipId: "joe-thomas-colleagues",
                fromNpcId: "waiter", toNpcId: "bartender", interaction: "conflict",
                channel: "in_person", requiresSameLocation: true,
                initialDelayMinutes: 180, everyMinutes: 240,
                fromPressureAtLeast: 55,
                trustDelta: -5, reciprocalTrustDelta: -3,
                summary: "Томас сорвался на Джо после очередной тяжёлой смены."
            },
            {
                id: "joe-thomas-reconcile", relationshipId: "joe-thomas-colleagues",
                fromNpcId: "bartender", toNpcId: "waiter", interaction: "reconcile",
                goalId: "protect_staff", goalProgress: 1,
                channel: "in_person", requiresSameLocation: true,
                initialDelayMinutes: 240, everyMinutes: 240, maxOccurrences: 1,
                maxTrust: 55, fromPressureBelow: 35, toPressureBelow: 35,
                trustDelta: 8, reciprocalTrustDelta: 6,
                toCooperationDelta: 6,
                summary: "Джо признал, что был слишком резок, и попытался помириться с Томасом."
            },
            {
                id: "eva-calls-anna", relationshipId: "sisters-anna-eva",
                fromNpcId: "woman_in_red", toNpcId: "ex_wife", interaction: "support",
                goalId: "protect_sister", goalProgress: 1,
                channel: "phone",
                initialDelayMinutes: 90, everyMinutes: 240, maxOccurrences: 1,
                minTrust: 70, fromPressureBelow: 85, toPressureBelow: 85,
                trustDelta: 1, reciprocalTrustDelta: 2,
                toCooperationDelta: 12,
                summary: "Ева позвонила Анне, чтобы убедиться, что та не осталась одна."
            },
            {
                id: "eva-protects-anna-after-pressure", relationshipId: "sisters-anna-eva",
                fromNpcId: "woman_in_red", toNpcId: "ex_wife", interaction: "support",
                goalId: "protect_sister", goalProgress: 1,
                channel: "phone", initialDelayMinutes: 180, everyMinutes: 120,
                maxOccurrences: 1, retryMinutes: 20,
                requiresActionId: "eva-calls-anna", requiresActionAgeMinutes: 60,
                toPressureAtLeast: 30, fromPressureBelow: 85,
                trustDelta: 2, reciprocalTrustDelta: 2,
                toCooperationDelta: 8,
                summary: "Услышав тревогу Анны после допроса, Ева повторно позвонила сестре и попросила её не оставаться одной."
            },
            {
                id: "lora-presses-joe", relationshipId: "joe-lora-source",
                fromNpcId: "journalist", toNpcId: "bartender", interaction: "conflict",
                channel: "message",
                initialDelayMinutes: 480, everyMinutes: 480, maxOccurrences: 1,
                minTrust: 35,
                trustDelta: -2, reciprocalTrustDelta: -1,
                goalId: "publish_exclusive", goalNpcId: "journalist", goalProgress: 1,
                summary: "Лора прислала Джо настойчивое сообщение: ей нужен эксклюзив до утра."
            },
            {
                id: "lora-checks-joe", relationshipId: "joe-lora-source",
                fromNpcId: "journalist", toNpcId: "bartender", interaction: "support",
                goalId: "maintain_bar_community", goalNpcId: "bartender", goalProgress: 1,
                channel: "message",
                initialDelayMinutes: 300, everyMinutes: 360, maxOccurrences: 1,
                minTrust: 50, fromPressureBelow: 65,
                trustDelta: 1, reciprocalTrustDelta: 1,
                toCooperationDelta: 5,
                summary: "Лора написала Джо и уточнила, не нужна ли ему помощь."
            }
        ]
    },

    // === СОБЫТИЯ ===
    events: [
        {
            id: "intro_002",
            trigger: "case_start",
            type: "narrative",
            title: "После полуночи",
            text: "Телефон звонит в половине первого ночи. «Детектив? Это сержант. В баре „У Джо“ произошло отравление. Джонатан Блэквуд без сознания, врачи уже везут его в больницу. В стакане обнаружен яд. Анна, его бывшая жена, была в баре; там же находились конкурент Кейн и неизвестная женщина в красном.»",
            choices: [
                { text: "Выезжаю немедленно.", next: null, action: "accept_case" },
                { text: "Есть подозреваемые?", next: "suspects_info" }
            ]
        },
        {
            id: "suspects_info",
            trigger: "choice",
            text: "«Анна была в баре незадолго до отравления. Кейн сидел у стойки, а женщина в красном следила за сестрой. Пока это только направления для проверки, не доказательства.»",
            action: "accept_case"
        },
        {
            id: "discover_poison",
            trigger: "item_acquired:poison_vial",
            type: "narrative",
            title: "Находка: Пузырёк",
            text: "Этикетка стёрта. Но запах — горький миндаль. Цианид? Отпечатки пальцев принадлежат Анне Ковалёвой. Но яд внутри — не снотворное, которое она купила. Кто-то заменил содержимое."
        },
        {
            id: "all_evidence_002",
            trigger: "evidence_count:4",
            type: "narrative",
            title: "Картина проясняется",
            text: "У вас достаточно улик. Кто-то хотел убрать жертву. Но кто именно — бывшая жена, конкурент или таинственная незнакомка?"
        }
    ],
    
    // === СЦЕНЫ ===
    scenes: [
        {
            id: "bar_crime_scene",
            locationId: "bar_joe",
            trigger: "first_visit:bar_joe",
            text: "В баре полумрак. У столика в углу — опрокинутый стакан. На полу — женский шарф. Бармен нервно протирает стойку.",
            highlightObjects: ["bar_counter", "overturned_glass", "red_scarf"]
        },
        {
            id: "anna_apartment_visit",
            locationId: "anna_apartment",
            trigger: "first_visit:anna_apartment",
            text: "Квартира Анны выглядит так, будто она давно перестала здесь жить: закрытые шторы, нетронутый чай и бумаги, которые она не решилась выбросить.",
            highlightObjects: ["anna_desk"]
        },
        {
            id: "pharmacy_visit",
            locationId: "pharmacy",
            trigger: "first_visit:pharmacy",
            text: "Аптека на углу. Пахнет травами и спиртом. Мистер Грин поправляет очки и смотрит на вас с опаской.",
            highlightObjects: ["pharmacy_counter", "prescription_journal", "medicine_shelf"]
        },
        {
            id: "office_visit",
            locationId: "rival_office",
            trigger: "first_visit:rival_office",
            text: "Офис Кейна. Шикарный вид на город. На столе — фотография семьи. В ящике — папка с судебным иском.",
            highlightObjects: ["rival_desk", "contract_folder", "family_photo"]
        }
    ],
    
    // === УСЛОВИЯ РАЗБЛОКИРОВКИ ===
    unlockConditions: [
        {
            locationId: "anna_apartment",
            requiresItem: "search_warrant",
            message: "Ордер разрешает осмотреть квартиру Анны. Возможно, там остались следы её намерений."
        },
        {
            locationId: "bank",
            requiresItem: "search_warrant",
            message: "Судебный ордер получен. Теперь можно запросить банковские документы по делу."
        }
    ],
    
    // === ДОСКА ===
    boardSlots: 4,
    
    // === ЦЕПОЧКИ УЛИК ===
    // Canonical chain definitions are registered in the matching evidence.js file.
    evidenceChains: [],
    
    // === СЛЕЖКИ ===
    stakeouts: [
        {
            id: "stakeout_pharmacy",
            locationId: "pharmacy",
            targetTime: { hour: 8, minute: 0 },
            duration: 20,
            description: "Наблюдение за аптекой утром",
            reward: { type: 'insight', id: 'pharmacy_regulars' }
        }
    ],
    
    // === ДЕДУКЦИЯ ===
    correctDeduction: {
        suspect: "business_rival",
        motive: "revenge",
        weapon: "poison"
    },
    deductionSuspects: [
        { id: "ex_wife", name: "Анна Ковалёва (бывшая жена)", icon: "👩‍🦰" },
        { id: "business_rival", name: "Виктор Кейн (конкурент)", icon: "👨‍💼" },
        { id: "woman_in_red", name: "Ева Ковалёва (сестра)", icon: "💃" },
        { id: "pharmacist", name: "Мистер Грин (фармацевт)", icon: "👴" }
    ],
    deductionMotives: [
        { id: "revenge", name: "💔 Месть за репутацию" },
        { id: "jealousy", name: "💘 Ревность" },
        { id: "accident", name: "🍀 Случайность" },
        { id: "greed", name: "💰 Алчность" }
    ],
    deductionWeapons: [
        { id: "poison", name: "🧪 Цианид" },
        { id: "sedative", name: "💊 Снотворное" },
        { id: "alcohol", name: "🥃 Отравленный алкоголь" }
    ],
    
    // === ФИНАЛ ===
    finalQuestion: {
        title: "Обвинение",
        text: "Кто отравил Джонатана Блэквуда в баре «У Джо»?",
        hint: "Подумайте, у кого был доступ к пузырьку и кто купил цианид в аптеке.",
        acceptableAnswers: [
            "конкурент",
            "кейн",
            "виктор кейн",
            "rival",
            "business rival",
            "victor kane"
        ],
        correctAnswer: "конкурент",
        feedbackCorrect: {
            title: "✅ ДЕЛО РАСКРЫТО",
            text: "Верно! Виктор Кейн украл пузырёк Анны, заменил снотворное на цианид и подсыпал яд в стакан Блэквуда. Мотив — месть за унижение в суде и разрушенную репутацию. Блэквуд выжил; Анна не причастна к покушению.",
            evidenceSummary: [
                "Показания бармена — Кейн украл пузырёк",
                "Показания официанта — видел момент отравления",
                "Запись в аптеке — Кейн купил цианид",
                "Расследование Лоры Лейн — связи с криминалом",
                "Фотография из бара — Кейн поднимает пузырёк"
            ]
        },
        feedbackIncorrect: {
            title: "❌ НЕВЕРНО",
            text: "Пересмотрите показания свидетелей и записи из аптеки. Кто купил цианид в тот же день?"
        }
    },
    
    // === НАГРАДА ===
    reward: {
        rankPoints: 1,
        message: "Отличная работа! Кейн арестован. Анна оправдана."
    }
};