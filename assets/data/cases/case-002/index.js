// ============================================
// ДЕЛО №2: Отравление в баре «У Джо»
// ============================================

const CASE_002 = {
    id: "case-002",
    title: "Отравление в баре «У Джо»",
    difficulty: 2,
    description: "Посетитель бара найден без сознания за столиком. В его стакане обнаружен яд. Бармен утверждает, что не видел, кто подсыпал отраву. Под подозрением — бывшая жена, конкурент по бизнесу и таинственная незнакомка в красном.",
    
    // === ВРЕМЯ СТАРТА ===
    startTime: { hour: 20, minute: 0, day: 1 },
    
    // === ЛОКАЦИИ ===
    locations: [
        "police_station",
        "bar_joe",
        "victim_apartment",
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
            title: "Три часа ночи",
            text: "Телефон звонит в три часа ночи. «Детектив? Это сержант. В баре „У Джо“ — отравление. Посетитель без сознания. Врачи говорят — яд в стакане. Подозреваемых трое: бывшая жена, конкурент и таинственная незнакомка в красном.»",
            choices: [
                { text: "Выезжаю немедленно.", next: null, action: "accept_case" },
                { text: "Есть подозреваемые?", next: "suspects_info" }
            ]
        },
        {
            id: "suspects_info",
            trigger: "choice",
            text: "«Бывшая жена — она была там за час до происшествия. И какой-то тип в костюме — сидел у стойки. Плюс незнакомка в красном платье — появилась и исчезла.»",
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
            locationId: "bank",
            requiresItem: "bank_subpoena",
            message: "Нужна судебная повестка для доступа к банковским записям."
        }
    ],
    
    // === ДОСКА ===
    boardSlots: 4,
    
    // === ЦЕПОЧКИ УЛИК ===
    evidenceChains: [
        {
            id: "chain_002_poison",
            name: "Путь яда",
            requiredEvidence: ["poison_vial", "prescription_copy", "lora_notes"],
            requiredInsights: ["kane_bought_cyanide", "someone_took_vial"],
            bonusInsight: "full_poison_path",
            description: "Вы проследили путь яда: от аптеки до стакана Блэквуда."
        },
        {
            id: "chain_002_witnesses",
            name: "Свидетели",
            requiredEvidence: ["bar_photo", "lora_notes"],
            requiredInsights: ["waiter_saw_poisoning", "bartender_testimony"],
            bonusInsight: "solid_case",
            description: "У вас есть показания трёх свидетелей. Дело не развалится в суде."
        }
    ],
    
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
            text: "Верно! Виктор Кейн украл пузырёк Анны, заменил снотворное на цианид и подсыпал яд в стакан Блэквуда. Мотив — месть за унижение в суде и разрушенную репутацию. Анна оправдана.",
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