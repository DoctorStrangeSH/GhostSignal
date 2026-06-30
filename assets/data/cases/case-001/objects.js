// ============================================
// ПРЕДМЕТЫ — ДЕЛО №1
// ============================================

registerData('object', {
    magnifying_glass: {
        id: "magnifying_glass", name: "Лупа", type: "tool",
        description: "Карманная лупа следователя. Увеличение x10. Стандартное снаряжение, без которого не обойтись.",
        icon: "🔍", takeable: true, weight: 1, isStartingItem: true,
        interactions: { examine: { text: "Стандартная лупа следователя. С ней вы можете заметить то, что скрыто от обычного глаза.", timeCost: 2 } }
    },
    guest_book: {
        id: "guest_book", name: "Журнал регистрации", type: "document",
        description: "Потрёпанный журнал в кожаной обложке. Последние записи расплылись от влаги — или их специально испортили.",
        icon: "📖", takeable: true, isEvidence: true, weight: 1,
        interactions: { examine: { text: "Вы листаете страницы. Запись за 14-е число вырвана. Остались следы спешки. Кто-то явно хотел скрыть информацию.", timeCost: 5, givesInsight: "missing_page" } }
    },
    lobby_phone: {
        id: "lobby_phone", name: "Телефон на стойке", type: "static_object",
        description: "Старый дисковый телефон. Трубка покрыта пылью. На диске стёрты цифры — 3, 7 и 9.",
        icon: "☎️", takeable: false,
        interactions: { examine: { text: "Кто-то часто набирал эти номера. Последний звонок — горничной. Это может быть важно.", timeCost: 5 } }
    },
    bed_304: {
        id: "bed_304", name: "Кровать", type: "static_object",
        description: "Смятая постель. Подушка сбита набок. Похоже, человек спал беспокойно — или боролся.",
        icon: "🛏️", takeable: false,
        interactions: { examine: { text: "Под подушкой вы находите сложенный листок бумаги. Записка! Кто-то спрятал её в спешке.", timeCost: 5, spawnsItem: "hidden_note" } }
    },
    window_304: {
        id: "window_304", name: "Окно", type: "static_object",
        description: "Окно закрыто изнутри. На подоконнике тонкий слой пыли — нетронутый.",
        icon: "🪟", takeable: false,
        interactions: { examine: { text: "Пыль нетронута. Окно не открывали уже несколько дней. На стекле — едва заметные следы пальцев.", timeCost: 5 } }
    },
    wardrobe: {
        id: "wardrobe", name: "Шкаф", type: "container",
        description: "Пустой шкаф. Вешалки сиротливо покачиваются от сквозняка. На дне что-то блестит.",
        icon: "🗄️", takeable: false,
        interactions: { examine: { text: "Вы достаёте маленький латунный ключ с биркой «304-С». С — сейф? Или что-то другое?", timeCost: 5, spawnsItem: "small_key" } }
    },
    mirror: {
        id: "mirror", name: "Зеркало", type: "static_object",
        description: "Треснутое зеркало в тяжёлой раме. Висит неровно. За ним что-то виднеется.",
        icon: "🪞", takeable: false,
        interactions: { examine: { text: "Вы отодвигаете зеркало. За ним — небольшой сейф с кодовым замком. Вот это находка!", timeCost: 5, revealsObject: "wall_safe" } }
    },
    wall_safe: {
        id: "wall_safe", name: "Сейф в стене", type: "locked_container",
        description: "Небольшой сейф с трёхзначным кодом. Сталь, довольно новый.",
        icon: "🔒", takeable: false, requiresItem: "small_key",
        interactions: { unlock: { text: "Ключ подходит! Сейф открывается. Внутри — кожаный дневник. Бинго!", timeCost: 10, condition: "hasItem:small_key", spawnsItem: "victim_diary" } }
    },
    carpet_stain: {
        id: "carpet_stain", name: "Пятно на ковре", type: "static_object",
        description: "Тёмное влажное пятно у изножья кровати. Пахнет чем-то сладким, с химическим оттенком.",
        icon: "💧", takeable: false,
        interactions: { examine: { text: "Пятно ещё влажное. Рядом — опрокинутый стакан с белым осадком. Снотворное? Кто-то усыпил жертву.", timeCost: 5, givesInsight: "sedative_clue" } }
    },
    hidden_note: {
        id: "hidden_note", name: "Смятая записка", type: "evidence",
        description: "Листок бумаги, сложенный вчетверо. Почерк торопливый, буквы прыгают.",
        icon: "📝", takeable: true, isEvidence: true, weight: 0,
        interactions: { examine: { text: "«Встреча в баре. 22:00. Не говори никому. Это важно.» Без подписи. Кому адресовано?", timeCost: 5, givesInsight: "bar_meeting" } }
    },
    small_key: {
        id: "small_key", name: "Маленький ключ", type: "tool",
        description: "Латунный ключ с биркой «304-С». Похоже, от сейфа в номере.",
        icon: "🔑", takeable: true, weight: 1,
        interactions: { examine: { text: "На бирке выгравировано: «304-С». С — сейф? Нужно проверить.", timeCost: 5 } }
    },
    victim_diary: {
        id: "victim_diary", name: "Дневник жертвы", type: "evidence",
        description: "Кожаный дневник. Страницы исписаны убористым почерком. Пахнет табаком.",
        icon: "📔", takeable: true, isEvidence: true, weight: 1,
        interactions: { examine: { text: "Последняя запись: «Она знает. Я должен бежать. Встреча с Элиасом — последний шанс.» Блэквуд был в отчаянии.", timeCost: 10, givesInsight: "victim_knew_danger" } }
    },
    bar_counter: {
        id: "bar_counter", name: "Барная стойка", type: "static_object",
        description: "Длинная стойка красного дерева. На ней — бокалы и пепельница. Под стойкой — коробка с потерянными вещами.",
        icon: "🍺", takeable: false,
        interactions: { examine: { text: "Среди потерянных вещей — спичечный коробок с адресом. «Переулок, дом 7». Время: «02:00».", timeCost: 5, spawnsItem: "matchbox" } }
    },
    matchbox: {
        id: "matchbox", name: "Спичечный коробок", type: "evidence",
        description: "Коробок спичек из бара «У Джо». На обратной стороне — адрес и время.",
        icon: "📦", takeable: true, isEvidence: true, weight: 0,
        interactions: { examine: { text: "«Переулок, дом 7. 02:00». Тайная встреча? Нужно проверить.", timeCost: 5, givesInsight: "alley_meeting" } }
    },
    jukebox: {
        id: "jukebox", name: "Музыкальный автомат", type: "static_object",
        description: "Старый джукбокс. Играет джаз. На корпусе — свежая царапина.",
        icon: "🎵", takeable: false,
        interactions: { examine: { text: "Царапина свежая. Рядом — клочок красной ткани, застрявший в щели. Кто-то торопился.", timeCost: 5, spawnsItem: "fabric_clue" } }
    },
    back_door: {
        id: "back_door", name: "Чёрный ход", type: "static_object",
        description: "Неприметная дверь в конце коридора. Ведёт в переулок. На ручке — свежие отпечатки.",
        icon: "🚪", takeable: false,
        interactions: { examine: { text: "Дверь приоткрыта. Кто-то часто пользуется этим выходом. Очень удобно для незаметного ухода.", timeCost: 5, givesInsight: "back_door_used" } }
    },
    dumpster: {
        id: "dumpster", name: "Мусорный бак", type: "container",
        description: "Переполненный мусорный бак. Запах соответствующий. Но среди мусора что-то белеет.",
        icon: "🗑️", takeable: false,
        interactions: { examine: { text: "Разорванная фотография. На ней — Блэквуд и горничная. У них был роман!", timeCost: 10, spawnsItem: "torn_photo" } }
    },
    torn_photo: {
        id: "torn_photo", name: "Разорванная фотография", type: "evidence",
        description: "Фотография, разорванная пополам. Мужчина в костюме, женщина в платье. Блэквуд и Мэри.",
        icon: "📷", takeable: true, isEvidence: true, weight: 0,
        interactions: { examine: { text: "Это мистер Блэквуд. Женщина рядом с ним — горничная отеля. У них был роман! Вот это поворот.", timeCost: 5, givesInsight: "blackwood_affair" } }
    },
    graffiti_wall: {
        id: "graffiti_wall", name: "Стена с граффити", type: "static_object",
        description: "Облупленная стена, исписанная баллончиками. Среди рисунков — какой-то текст.",
        icon: "🎨", takeable: false,
        interactions: { examine: { text: "Вы вглядываетесь в граффити. Среди рисунков — надпись: «Она здесь была». И дата — 14-е число. Это послание?", timeCost: 5, givesInsight: "graffiti_clue" } }
    },
    broken_lamp: {
        id: "broken_lamp", name: "Разбитый фонарь", type: "static_object",
        description: "Уличный фонарь. Стекло разбито, лампа не горит. На осколках — следы крови.",
        icon: "💡", takeable: false,
        interactions: { examine: { text: "Кровь на стекле. Кто-то поранился. Возможно, здесь была борьба.", timeCost: 5, givesInsight: "blood_trace" } }
    },
    hidden_suitcase: {
        id: "hidden_suitcase", name: "Спрятанный чемодан", type: "container",
        description: "Потрёпанный чемодан, спрятанный за мусорным баком. Появляется только ночью.",
        icon: "🧳", takeable: false, nightOnly: true,
        interactions: { examine: { text: "В чемодане — смена одежды, паспорт на имя «Джон Смит» и билет на поезд. Блэквуд планировал побег!", timeCost: 10, givesInsight: "planned_escape", spawnsItem: "train_ticket" } }
    },
    train_ticket: {
        id: "train_ticket", name: "Билет на поезд", type: "evidence",
        description: "Билет на поезд до другого города. Отправление — сегодня.",
        icon: "🎫", takeable: true, isEvidence: true, weight: 0,
        interactions: { examine: { text: "Билет куплен два дня назад. Значит, исчезновение не было спонтанным. Блэквуд планировал уехать.", timeCost: 5, givesInsight: "premeditated" } }
    },
    search_warrant: {
        id: "search_warrant", name: "Ордер на обыск", type: "key_item",
        description: "Официальный ордер на обыск квартиры мистера Блэквуда. Подписан судьёй.",
        icon: "📋", takeable: true, isKeyItem: true, weight: 0,
        interactions: { examine: { text: "Ордер подписан судьёй. Теперь вы можете законно проникнуть в квартиру жертвы и осмотреть её.", timeCost: 5 } }
    },
    mansion_phone: {
        id: "mansion_phone", name: "Телефон в гостиной", type: "static_object",
        description: "Старинный телефонный аппарат в особняке Блэквудов. Рядом — блокнот с заметками.",
        icon: "☎️", takeable: false,
        interactions: { examine: { text: "Кнопка повторного набора. Последний звонок — горничной Мэри. Миссис Блэквуд звонила ей. Зачем?", timeCost: 5, givesInsight: "wife_called_mary" } }
    },
    wife_desk: {
        id: "wife_desk", name: "Письменный стол Виктории", type: "container",
        description: "Изящный стол красного дерева. В ящике — конверт с фотографиями.",
        icon: "🗄️", takeable: false,
        interactions: { examine: { text: "Фотографии слежки. Блэквуд и Мэри в баре, в отеле, на улице. Миссис Блэквуд наняла детектива.", timeCost: 10, givesInsight: "wife_hired_detective", spawnsItem: "detective_photos" } }
    },
    wedding_photo: {
        id: "wedding_photo", name: "Свадебная фотография", type: "static_object",
        description: "Фотография в серебряной рамке. Блэквуд и Виктория в день свадьбы. Стекло треснуло.",
        icon: "📷", takeable: false,
        interactions: { examine: { text: "«Мы были счастливы. А потом ты всё разрушил.» Почерк Виктории. Брак был обречён.", timeCost: 5, givesInsight: "broken_marriage" } }
    },
    phone_records: {
        id: "phone_records", name: "Распечатка звонков", type: "evidence",
        description: "Распечатка телефонных звонков Блэквуда за последний месяц.",
        icon: "📄", takeable: true, isEvidence: true, weight: 0,
        interactions: { examine: { text: "Последний звонок — в 21:47, за час до исчезновения. Продолжительность: 12 минут. Кому он звонил?", timeCost: 10, givesInsight: "mystery_call" } }
    },
    detective_photos: {
        id: "detective_photos", name: "Фотографии слежки", type: "evidence",
        description: "Конверт с фотографиями. Блэквуд и Мэри, снятые скрытой камерой.",
        icon: "📸", takeable: true, isEvidence: true, weight: 0,
        interactions: { examine: { text: "На последнем снимке — Мэри держит пузырёк. Тот самый пузырёк со снотворным? Она планировала это заранее.", timeCost: 10, givesInsight: "premeditated_act" } }
    },
    toxicology_report: {
        id: "toxicology_report", name: "Токсикологический отчёт", type: "evidence",
        description: "Официальный отчёт о составе вещества, найденного в стакане.",
        icon: "📋", takeable: true, isEvidence: true, weight: 0,
        interactions: { examine: { text: "Хлоралгидрат. Концентрация: 3 грамма. Не смертельно, но достаточно для глубокого сна. Преступник знал дозировку.", timeCost: 5, givesInsight: "professional_knowledge" } }
    },
    fabric_clue: {
        id: "fabric_clue", name: "Клочок ткани", type: "evidence",
        description: "Маленький кусочек красной ткани, застрявший в джукбоксе.",
        icon: "🧵", takeable: true, isEvidence: true, weight: 0,
        interactions: { examine: { text: "Красный шёлк. Похоже на кусочек от дорогого платья или шарфа. Женщина в красном была здесь.", timeCost: 5, givesInsight: "red_fabric_clue" } }
    },
    desk: {
        id: "desk", name: "Письменный стол", type: "static_object",
        description: "Завален бумагами. Кто-то рылся здесь в спешке.",
        icon: "📋", takeable: false,
        interactions: { examine: { text: "Бумаги в беспорядке. Счета, письма, квитанции. Всё вверх дном.", timeCost: 5 } }
    },
    bookshelf: {
        id: "bookshelf", name: "Книжный шкаф", type: "static_object",
        description: "Книги вырваны с полок. Кто-то что-то искал.",
        icon: "📚", takeable: false,
        interactions: { examine: { text: "Некоторые книги лежат на полу. Спешка? Или попытка что-то скрыть?", timeCost: 5 } }
    },
    safe: {
        id: "safe", name: "Сейф", type: "locked_container",
        description: "Домашний сейф. Закрыт на ключ.",
        icon: "🔒", takeable: false,
        interactions: { examine: { text: "Нужен ключ или код. Возможно, внутри важные документы.", timeCost: 5 } }
    },
    photo_frame: {
        id: "photo_frame", name: "Фоторамка", type: "static_object",
        description: "Семейное фото Блэквудов. Счастливые лица — но как давно это было?",
        icon: "📷", takeable: false,
        interactions: { examine: { text: "На фото они улыбаются. Но в глазах Виктории — тень. Она знала уже тогда?", timeCost: 5 } }
    },
    departure_board: {
        id: "departure_board", name: "Табло отправления", type: "static_object",
        description: "Электронное табло с расписанием поездов.",
        icon: "🖥️", takeable: false,
        interactions: { examine: { text: "Ближайший поезд через 20 минут. Платформа 3. Если горничная сбежала — она будет здесь.", timeCost: 5, givesInsight: "train_soon" } }
    },
    ticket_counter: {
        id: "ticket_counter", name: "Билетная касса", type: "static_object",
        description: "Окошко кассы. Кассир скучает за стеклом.",
        icon: "🎫", takeable: false,
        interactions: { examine: { text: "Кассир говорит, что женщина, похожая на горничную, купила билет час назад.", timeCost: 5, givesInsight: "maid_here" } }
    },
    lost_and_found: {
        id: "lost_and_found", name: "Бюро находок", type: "container",
        description: "Ящик с потерянными вещами. Среди них — сумочка с инициалами «М.Б.»",
        icon: "📦", takeable: false,
        interactions: { examine: { text: "В сумочке — ключ от камеры хранения. Что Мэри спрятала там?", timeCost: 5, spawnsItem: "locker_key" } }
    },
    autopsy_table: {
        id: "autopsy_table", name: "Стол для вскрытия", type: "static_object",
        description: "Холодный металлический стол. Доктор Харрис проводил здесь анализ.",
        icon: "🩻", takeable: false,
        interactions: { examine: { text: "На столе — инструменты и пробирки. Харрис знает своё дело.", timeCost: 5 } }
    },
    evidence_locker: {
        id: "evidence_locker", name: "Шкаф с уликами", type: "container",
        description: "Запертый шкаф с вещественными доказательствами.",
        icon: "🔒", takeable: false,
        interactions: { examine: { text: "Здесь хранятся улики текущих дел. Нужен допуск.", timeCost: 5 } }
    }
});