// ============================================
// ШАБЛОН ДЛЯ СОЗДАНИЯ НОВОГО ДЕЛА
// ============================================
// 
// ИНСТРУКЦИЯ ДЛЯ МОДУЛЬНОГО ПАКЕТА ДЕЛА:
// 1. Создайте каталог assets/data/cases/case-XXX/.
// 2. Скопируйте этот шаблон в каталог как index.js и переименуйте CASE_000 в CASE_XXX.
// 3. Добавьте файлы пакета в index.html перед case-index.js:
//    locations.js, npcs.js, objects.js, evidence.js, endings.js, story.js,
//    затем dialogues/*.js и index.js.
// 4. Зарегистрируйте CASE_XXX в assets/data/cases/case-index.js.
// 5. Все ID предметов, NPC, локаций, диалогов, цепочек и концовок должны быть
//    уникальными в общих реестрах. Общих персонажей и локации не копируйте.
// 6. Диалог, который отличается только в одном деле, задавайте через
//    npcDialogueOverrides в этом пакете, а не через NPC-файл другого дела.
// 7. Запустите npm run validate:data и npm test.
// Файлы story/evidence/endings и диалоги остаются отдельными частями пакета.
//
// ============================================

const CASE_000 = {
    // === ОСНОВНАЯ ИНФОРМАЦИЯ ===
    id: "case-000",                    // TODO: уникальный ID
    title: "Название дела",            // TODO: название
    difficulty: 1,                     // 1-лёгкое, 2-среднее, 3-сложное
    description: "Краткое описание дела.", // TODO: 1-2 предложения
    
    // === ВРЕМЯ СТАРТА ===
    startTime: { hour: 8, minute: 0, day: 1 },
    
    // === ЛОКАЦИИ ===
    // Доступные локации: police_station, hotel_grand, hotel_room_304,
    //                     bar_joe, alley, victim_apartment
    locations: [
        "police_station"
        // TODO: добавьте нужные локации
    ],
    
    startLocation: "police_station",
    
    // === NPC ===
    // Доступные NPC: porter, bartender, housekeeper, sergeant
    npcs: [
        // TODO: укажите NPC, участвующих в деле
    ],

    // Переопределения диалогов только для этого дела.
    // Ключ — ID NPC из npcs, значение — ID диалога этого NPC.
    npcDialogueOverrides: {
        // bartender: "dialogue-bartender-case-XXX"
    },

    // === ОТНОШЕНИЯ И АВТОНОМНЫЕ ДЕЙСТВИЯ NPC ===
    // Все связи скрыты до подтверждения через диалог, наблюдение, документ или улику.
    npcRelationships: {
        bonds: [
            // { id: "unique-bond-id", fromNpcId: "npc_a", toNpcId: "npc_b", relationship: "colleagues", label: "Коллеги", trust: 65, reciprocal: true }
        ],
        autonomousInteractions: [
            // {
            //     id: "unique-interaction-id", relationshipId: "unique-bond-id",
            //     fromNpcId: "npc_a", toNpcId: "npc_b", interaction: "support",
            //     channel: "in_person", initialDelayMinutes: 120, everyMinutes: 240,
            //     minTrust: 55, fromPressureBelow: 70,
            //     trustDelta: 2, reciprocalTrustDelta: 1,
            //     summary: "Короткое описание автономного действия."
            // }
        ]
    },

    // === СОБЫТИЯ ===
    // Типы триггеров:
    //   "case_start"         — при старте дела
    //   "first_visit:locId"  — при первом посещении локации
    //   "item_acquired:id"   — при получении предмета
    //   "insight:id"         — при получении озарения
    //   "evidence_count:N"   — при сборе N улик
    events: [
        {
            id: "intro",
            trigger: "case_start",
            type: "narrative",         // narrative | notification
            title: "Брифинг",
            text: "Текст вступления.",
            choices: [                 // только для type: narrative
                { text: "Принять дело", next: null, action: "accept_case" }
            ]
        }
        // TODO: добавьте события
    ],
    
    // === СЦЕНЫ ===
    scenes: [
        {
            id: "scene_id",
            locationId: "police_station",
            trigger: "first_visit:police_station",
            text: "Описание сцены при первом посещении.",
            highlightObjects: ["object_id"]
        }
        // TODO: добавьте сцены
    ],
    
    // === РАЗБЛОКИРОВКА ===
    unlockConditions: [
        // {
        //     locationId: "victim_apartment",
        //     requiresItem: "search_warrant",
        //     message: "Нужен ордер на обыск."
        // }
        // TODO: условия разблокировки локаций
    ],
    
    // === ДОСКА ===
    boardSlots: 4,  // Количество слотов на доске (3-6)
    
    // === ФИНАЛ ===
    finalQuestion: {
        title: "Обвинение",
        text: "Кто виновен?",
        hint: "Подсказка для игрока.",
        acceptableAnswers: [
            "правильный ответ",
            "синоним",
            "english version"
        ],
        correctAnswer: "правильный ответ",
        feedbackCorrect: {
            title: "✅ ДЕЛО РАСКРЫТО",
            text: "Поздравление и объяснение.",
            evidenceSummary: [
                "Улика 1",
                "Улика 2",
                "Улика 3"
            ]
        },
        feedbackIncorrect: {
            title: "❌ НЕВЕРНО",
            text: "Подсказка куда смотреть."
        }
    },
    
    // === НАГРАДА ===
    reward: {
        rankPoints: 1,
        message: "Поздравление с раскрытием."
    }
};