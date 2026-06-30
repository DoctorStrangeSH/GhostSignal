// ============================================
// ЛОКАЦИИ — ДЕЛО №1
// ============================================

registerData('location', {
    hotel_grand: {
        id: "hotel_grand",
        name: "Отель «Гранд»",
        type: "public",
        description: "Место преступления. Номер 304 опечатан. В лобби пахнет полиролью и увядшими цветами.",
        hours: { open: 6, close: 23 },
        icon: "🏨",
        mapPosition: { x: 35, y: 40 },
        scenes: { day: null, night: null },
        npcsPresent: ["porter"],
        defaultItems: ["guest_book", "lobby_phone"],
        unlockedByDefault: true,
        subLocations: ["hotel_room_304"]
    },
    hotel_room_304: {
        id: "hotel_room_304",
        name: "Номер 304",
        type: "crime_scene",
        description: "Место исчезновения мистера Блэквуда. Кровать смята, на ковре тёмное пятно.",
        hours: { open: 0, close: 24 },
        icon: "🚪",
        mapPosition: null,
        parentLocation: "hotel_grand",
        scenes: { day: null, night: null },
        npcsPresent: [],
        defaultItems: ["bed_304", "window_304", "wardrobe", "mirror", "carpet_stain"],
        unlockedByDefault: true
    },
    bar_joe: {
        id: "bar_joe",
        name: "Бар «У Джо»",
        type: "evening_venue",
        description: "Популярное место. Джаз льётся из музыкального автомата, бармен знает всех в округе.",
        hours: { open: 16, close: 2 },
        icon: "🍸",
        mapPosition: { x: 65, y: 45 },
        scenes: { day: null, night: null },
        npcsPresent: ["bartender"],
        defaultItems: ["bar_counter", "jukebox", "back_door"],
        unlockedByDefault: true
    },
    alley: {
        id: "alley",
        name: "Переулок",
        type: "street",
        description: "Тёмный переулок за отелем. Единственный фонарь разбит. В темноте что-то блестит.",
        hours: { open: 0, close: 24 },
        icon: "🏚️",
        mapPosition: { x: 30, y: 55 },
        scenes: { day: null, night: null },
        npcsPresent: [],
        defaultItems: ["dumpster", "graffiti_wall", "broken_lamp"],
        unlockedByDefault: true,
        nightOnlyItems: ["hidden_suitcase"]
    },
    victim_apartment: {
        id: "victim_apartment",
        name: "Квартира жертвы",
        type: "private",
        description: "Личная квартира мистера Блэквуда. Нужен ордер на обыск.",
        hours: { open: 8, close: 20 },
        icon: "🏠",
        mapPosition: { x: 75, y: 30 },
        scenes: { day: null, night: null },
        npcsPresent: [],
        defaultItems: ["desk", "bookshelf", "safe", "photo_frame"],
        unlockedByDefault: false,
        requiresItem: "search_warrant"
    },
    blackwood_mansion: {
        id: "blackwood_mansion",
        name: "Особняк Блэквудов",
        type: "private",
        description: "Величественный особняк на холме. Мраморные полы, хрустальные люстры — и абсолютная тишина.",
        hours: { open: 9, close: 20 },
        icon: "🏛️",
        mapPosition: { x: 90, y: 15 },
        scenes: { day: null, night: null },
        npcsPresent: ["wife_blackwood"],
        defaultItems: ["mansion_phone", "wife_desk", "wedding_photo", "phone_records"],
        unlockedByDefault: true
    },
    morgue: {
        id: "morgue",
        name: "Городской морг",
        type: "public",
        description: "Холодное помещение с кафельными стенами. Пахнет формалином. Доктор Харрис проводит здесь большую часть времени.",
        hours: { open: 9, close: 18 },
        icon: "🏥",
        mapPosition: { x: 15, y: 85 },
        scenes: { day: null, night: null },
        npcsPresent: ["coroner"],
        defaultItems: ["autopsy_table", "toxicology_report", "evidence_locker"],
        unlockedByDefault: true
    },
    train_station: {
        id: "train_station",
        name: "Железнодорожный вокзал",
        type: "public",
        description: "Шумный вокзал. Поезда прибывают и отправляются. На табло — расписание.",
        hours: { open: 0, close: 24 },
        icon: "🚂",
        mapPosition: { x: 10, y: 80 },
        scenes: { day: null, night: null },
        npcsPresent: [],
        defaultItems: ["departure_board", "ticket_counter", "lost_and_found"],
        unlockedByDefault: false,
        requiresItem: "train_ticket"
    }
});