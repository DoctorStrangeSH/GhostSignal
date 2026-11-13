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
        "journalist"
    ],
    
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