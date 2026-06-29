const OBJECTS_INDEX = {
    // === ПРЕДМЕТЫ ОТЕЛЯ ===
    guest_book: {
        id: "guest_book",
        name: "Журнал регистрации",
        type: "document",
        description: "Потрёпанный журнал в кожаной обложке. Последние записи расплылись от влаги.",
        icon: "📖",
        takeable: true,
        weight: 1,
        interactions: {
            examine: {
                text: "Вы листаете страницы. Запись за 14-е число вырвана. Остались следы спешки.",
                timeCost: 5,
                givesInsight: "missing_page"
            },
            read: {
                text: "Почерк неразборчив. Но одно имя повторяется несколько раз: «Элиас».",
                timeCost: 5,
                condition: "hasLight",
                givesInsight: "elias_mention"
            }
        }
    },

    lobby_phone: {
        id: "lobby_phone",
        name: "Телефон на стойке",
        type: "static_object",
        description: "Старый дисковый телефон. Трубка покрыта пылью.",
        icon: "☎️",
        takeable: false,
        interactions: {
            examine: {
                text: "На диске стёрты цифры «3», «7» и «9». Кто-то часто набирал эти номера.",
                timeCost: 5
            },
            redial: {
                text: "Вы нажимаете кнопку повторного набора. Длинные гудки... Никто не отвечает.",
                timeCost: 10,
                givesInsight: "mystery_caller"
            }
        }
    },

    // === ПРЕДМЕТЫ НОМЕРА 304 ===
    bed_304: {
        id: "bed_304",
        name: "Кровать",
        type: "static_object",
        description: "Смятая постель. Подушка сбита набок.",
        icon: "🛏️",
        takeable: false,
        interactions: {
            examine: {
                text: "Под подушкой вы находите сложенный листок бумаги.",
                timeCost: 5,
                spawnsItem: "hidden_note"
            }
        }
    },

    window_304: {
        id: "window_304",
        name: "Окно",
        type: "static_object",
        description: "Окно закрыто изнутри. На подоконнике тонкий слой пыли.",
        icon: "🪟",
        takeable: false,
        interactions: {
            examine: {
                text: "Пыль нетронута. Окно не открывали уже несколько дней. На стекле — следы пальцев.",
                timeCost: 5
            },
            dust: {
                text: "Вы проводите пальцем по пыли. Под ней — едва заметная царапина: «ПОМ...»",
                timeCost: 10,
                condition: "hasMagnifier",
                givesInsight: "help_scratch"
            }
        }
    },

    wardrobe: {
        id: "wardrobe",
        name: "Шкаф",
        type: "container",
        description: "Пустой шкаф. Вешалки сиротливо покачиваются.",
        icon: "🗄️",
        takeable: false,
        interactions: {
            examine: {
                text: "На дне шкафа что-то блестит. Вы достаёте маленький ключ.",
                timeCost: 5,
                spawnsItem: "small_key"
            }
        }
    },

    mirror: {
        id: "mirror",
        name: "Зеркало",
        type: "static_object",
        description: "Треснутое зеркало в тяжёлой раме. За ним что-то виднеется.",
        icon: "🪞",
        takeable: false,
        interactions: {
            examine: {
                text: "Зеркало висит неровно. Кажется, за ним что-то спрятано.",
                timeCost: 5
            },
            move: {
                text: "Вы отодвигаете зеркало. За ним — небольшой сейф с кодовым замком.",
                timeCost: 10,
                revealsObject: "wall_safe"
            }
        }
    },

    wall_safe: {
        id: "wall_safe",
        name: "Сейф в стене",
        type: "locked_container",
        description: "Небольшой сейф с трёхзначным кодом.",
        icon: "🔒",
        takeable: false,
        requiresItem: "small_key",
        interactions: {
            unlock: {
                text: "Ключ подходит! Сейф открывается. Внутри — дневник.",
                timeCost: 10,
                condition: "hasItem:small_key",
                spawnsItem: "victim_diary"
            }
        }
    },

    carpet_stain: {
        id: "carpet_stain",
        name: "Пятно на ковре",
        type: "static_object",
        description: "Тёмное влажное пятно у изножья кровати.",
        icon: "💧",
        takeable: false,
        interactions: {
            examine: {
                text: "Пятно ещё влажное. Пахнет чем-то сладким. Рядом — опрокинутый стакан.",
                timeCost: 5
            },
            analyze: {
                text: "Присмотревшись, вы замечаете белый порошок на краю стакана. Снотворное?",
                timeCost: 10,
                condition: "hasMagnifier",
                givesInsight: "sedative_clue"
            }
        }
    },

    // === НАХОДИМЫЕ ПРЕДМЕТЫ ===
    hidden_note: {
        id: "hidden_note",
        name: "Смятая записка",
        type: "evidence",
        description: "Листок бумаги, сложенный вчетверо. Почерк торопливый.",
        icon: "📝",
        takeable: true,
        isEvidence: true,
        weight: 0,
        interactions: {
            read: {
                text: "«Встреча в баре. 22:00. Не говори никому. Это важно.» Без подписи.",
                timeCost: 5,
                givesInsight: "bar_meeting"
            }
        }
    },

    small_key: {
        id: "small_key",
        name: "Маленький ключ",
        type: "tool",
        description: "Латунный ключ с биркой «304-С». Похоже, от сейфа.",
        icon: "🔑",
        takeable: true,
        isEvidence: false,
        weight: 1,
        interactions: {
            examine: {
                text: "На бирке выгравировано: «304-С». С — сейф?",
                timeCost: 5
            }
        }
    },

    victim_diary: {
        id: "victim_diary",
        name: "Дневник жертвы",
        type: "evidence",
        description: "Кожаный дневник. Страницы исписаны убористым почерком.",
        icon: "📔",
        takeable: true,
        isEvidence: true,
        weight: 1,
        interactions: {
            read: {
                text: "Последняя запись: «Она знает. Я должен бежать. Встреча с Элиасом — последний шанс.»",
                timeCost: 10,
                givesInsight: "victim_knew_danger"
            },
            examine: {
                text: "Между страниц — квитанция из бара «У Джо» за 14-е число. Счёт на двоих.",
                timeCost: 5
            }
        }
    },

    // === ПРЕДМЕТЫ БАРА ===
    bar_counter: {
        id: "bar_counter",
        name: "Барная стойка",
        type: "static_object",
        description: "Длинная стойка красного дерева. На ней — бокалы и пепельница.",
        icon: "🍺",
        takeable: false,
        interactions: {
            examine: {
                text: "Под стойкой — коробка с потерянными вещами. Среди них — спичечный коробок.",
                timeCost: 5,
                spawnsItem: "matchbox"
            }
        }
    },

    matchbox: {
        id: "matchbox",
        name: "Спичечный коробок",
        type: "evidence",
        description: "Коробок спичек из бара «У Джо». На обратной стороне — адрес.",
        icon: "📦",
        takeable: true,
        isEvidence: true,
        weight: 0,
        interactions: {
            examine: {
                text: "На коробке написан адрес: «Переулок, дом 7». И время: «02:00».",
                timeCost: 5,
                givesInsight: "alley_meeting"
            }
        }
    },

    // === ПРЕДМЕТЫ ПЕРЕУЛКА ===
    dumpster: {
        id: "dumpster",
        name: "Мусорный бак",
        type: "container",
        description: "Переполненный мусорный бак. Запах соответствующий.",
        icon: "🗑️",
        takeable: false,
        interactions: {
            examine: {
                text: "Среди мусора — разорванная фотография. На ней — мужчина и женщина.",
                timeCost: 10,
                spawnsItem: "torn_photo"
            }
        }
    },

    torn_photo: {
        id: "torn_photo",
        name: "Разорванная фотография",
        type: "evidence",
        description: "Фотография, разорванная пополам. Мужчина в костюме, женщина в платье.",
        icon: "📷",
        takeable: true,
        isEvidence: true,
        weight: 0,
        interactions: {
            examine: {
                text: "Это мистер Блэквуд. Женщина рядом с ним — предположительно, горничная отеля.",
                timeCost: 5,
                givesInsight: "blackwood_affair"
            }
        }
    },

    hidden_suitcase: {
        id: "hidden_suitcase",
        name: "Спрятанный чемодан",
        type: "container",
        description: "Потрёпанный чемодан, спрятанный за мусорным баком. Появляется только ночью.",
        icon: "🧳",
        takeable: false,
        nightOnly: true,
        interactions: {
            examine: {
                text: "В чемодане — смена одежды, паспорт на имя «Джон Смит» и билет на поезд. Мистер Блэквуд планировал побег.",
                timeCost: 10,
                givesInsight: "planned_escape",
                spawnsItem: "train_ticket"
            }
        }
    },

    train_ticket: {
        id: "train_ticket",
        name: "Билет на поезд",
        type: "evidence",
        description: "Билет на поезд до другого города. Отправление — сегодня.",
        icon: "🎫",
        takeable: true,
        isEvidence: true,
        weight: 0,
        interactions: {
            examine: {
                text: "Билет куплен два дня назад. Значит, исчезновение не было спонтанным.",
                timeCost: 5,
                givesInsight: "premeditated"
            }
        }
    },

    // === ИНСТРУМЕНТЫ ===
    magnifying_glass: {
        id: "magnifying_glass",
        name: "Лупа",
        type: "tool",
        description: "Карманная лупа. Позволяет разглядеть мелкие детали.",
        icon: "🔍",
        takeable: true,
        weight: 1,
        isStartingItem: true,
        interactions: {
            examine: {
                text: "Стандартная лупа следователя. Увеличение x10.",
                timeCost: 2
            }
        }
    },

    search_warrant: {
        id: "search_warrant",
        name: "Ордер на обыск",
        type: "key_item",
        description: "Официальный ордер на обыск квартиры мистера Блэквуда.",
        icon: "📋",
        takeable: true,
        isKeyItem: true,
        weight: 0,
        interactions: {
            examine: {
                text: "Ордер подписан судьёй. Теперь вы можете законно проникнуть в квартиру жертвы.",
                timeCost: 5
            }
        }
    },

    // === ПРЕДМЕТЫ ДЕЛА №2 ===
    overturned_glass: {
        id: "overturned_glass",
        name: "Опрокинутый стакан",
        type: "evidence",
        description: "Стакан с остатками жидкости. Пахнет горьким миндалём.",
        icon: "🥃",
        takeable: true,
        isEvidence: true,
        weight: 1,
        interactions: {
            examine: {
                text: "На дне стакана — белый осадок. Судя по запаху — цианид. Яд был подсыпан в напиток.",
                timeCost: 5,
                givesInsight: "cyanide_poison"
            }
        }
    },

    red_scarf: {
        id: "red_scarf",
        name: "Красный шарф",
        type: "evidence",
        description: "Женский шёлковый шарф. На этикетке — инициалы «А.К.»",
        icon: "🧣",
        takeable: true,
        isEvidence: true,
        weight: 0,
        interactions: {
            examine: {
                text: "Шарф дорогой, ручная работа. Такие продаются в бутике на центральной улице. Инициалы совпадают с бывшей женой — Анна Ковалёва.",
                timeCost: 5,
                givesInsight: "scarf_owner"
            }
        }
    },

    poison_vial: {
        id: "poison_vial",
        name: "Пузырёк из-под яда",
        type: "evidence",
        description: "Маленький стеклянный пузырёк. Этикетка стёрта.",
        icon: "🧪",
        takeable: true,
        isEvidence: true,
        weight: 1,
        interactions: {
            examine: {
                text: "На стекле остались отпечатки пальцев. Если найдёте эксперта, можно сравнить с подозреваемыми.",
                timeCost: 10,
                givesInsight: "fingerprints_found"
            }
        }
    },

    threat_note: {
        id: "threat_note",
        name: "Записка с угрозами",
        type: "evidence",
        description: "Смятая записка: «Ты за всё заплатишь. Очень скоро.»",
        icon: "📝",
        takeable: true,
        isEvidence: true,
        weight: 0,
        interactions: {
            examine: {
                text: "Почерк женский. Буквы острые, с сильным нажимом. Писала в ярости.",
                timeCost: 5,
                givesInsight: "angry_writer"
            }
        }
    }
};

// Вспомогательные функции
function getObjectById(id) {
    return OBJECTS_INDEX[id] || null;
}

function getObjectsByIds(ids) {
    return ids.map(id => getObjectById(id)).filter(Boolean);
}

function getEvidenceItems() {
    return Object.values(OBJECTS_INDEX).filter(obj => obj.isEvidence);
}

function getTakeableItems() {
    return Object.values(OBJECTS_INDEX).filter(obj => obj.takeable);
}