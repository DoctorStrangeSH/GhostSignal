const CASE_002 = {
    id: "case-002",
    title: "Отравление в баре «У Джо»",
    difficulty: 2,
    description: "Посетитель бара найден без сознания за столиком. В его стакане обнаружен яд. Бармен утверждает, что не видел, кто подсыпал отраву. Под подозрением — бывшая жена, конкурент по бизнесу и таинственная незнакомка в красном.",
    
    startTime: { hour: 20, minute: 0, day: 1 },
    
    locations: [
        "police_station",
        "bar_joe",
        "victim_apartment",
        "alley"
    ],
    
    startLocation: "police_station",
    
    npcs: ["bartender", "sergeant", "housekeeper"],
    
    events: [
        {
            id: "intro_briefing_002",
            trigger: "case_start",
            type: "narrative",
            title: "Вызов в бар",
            text: "Сержант хмуро протягивает вам телефонограмму. «Бар „У Джо“. Посетитель отравлен. Врачи говорят — яд в стакане. Бармен клянётся, что ничего не видел. Езжайте, пока там всё не затоптали.»",
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
            text: "Этикетка стёрта. Но запах — горький миндаль. Цианид? Или мышьяк? Нужен анализ."
        },
        {
            id: "all_evidence_002",
            trigger: "evidence_count:4",
            type: "narrative",
            title: "Картина проясняется",
            text: "У вас достаточно улик. Кто-то хотел убрать жертву. Но кто именно — бывшая жена, конкурент или таинственная незнакомка?"
        }
    ],
    
    scenes: [
        {
            id: "bar_crime_scene",
            locationId: "bar_joe",
            trigger: "first_visit:bar_joe",
            text: "В баре полумрак. У столика в углу — опрокинутый стакан. На полу — женский шарф. Бармен нервно протирает стойку.",
            highlightObjects: ["bar_counter", "overturned_glass", "red_scarf"]
        }
    ],
    
    unlockConditions: [],
    
    boardSlots: 4,
    
    finalQuestion: {
        title: "Обвинение",
        text: "Кто отравил посетителя в баре?",
        hint: "Подумайте, у кого был мотив и доступ к стакану.",
        acceptableAnswers: [
            "бывшая жена",
            "ex wife",
            "жена",
            "анна",
            "anna"
        ],
        correctAnswer: "бывшая жена",
        feedbackCorrect: {
            title: "✅ ДЕЛО РАСКРЫТО",
            text: "Верно! Бывшая жена Анна не смогла смириться с разводом. Она пришла в бар, дождалась момента и подсыпала яд в стакан бывшего мужа. Красный шарф — её визитная карточка.",
            evidenceSummary: [
                "Шарф с инициалами «А.К.»",
                "Пузырёк из-под яда в её сумочке",
                "Свидетельство бармена о ссоре",
                "Записка с угрозами"
            ]
        },
        feedbackIncorrect: {
            title: "❌ НЕВЕРНО",
            text: "Улики указывают на другого. Обратите внимание на красный шарф и пузырёк."
        }
    },
    
    reward: {
        rankPoints: 1,
        message: "Отличная работа! Вы раскрыли ещё одно дело."
    }
};