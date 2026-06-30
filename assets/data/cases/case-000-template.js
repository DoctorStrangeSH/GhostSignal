// ============================================
// ШАБЛОН ДЛЯ СОЗДАНИЯ НОВОГО ДЕЛА
// ============================================
// 
// ИНСТРУКЦИЯ:
// 1. Скопируйте этот файл → переименуйте в case-XXX.js
// 2. Заполните все секции (отмечены TODO)
// 3. Добавьте в case-index.js: "case-XXX": CASE_XXX,
// 4. Готово! Дело появится в игре.
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