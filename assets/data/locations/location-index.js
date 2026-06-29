const LOCATIONS_INDEX = {
    police_station: {
        id: "police_station",
        name: "Полицейский участок",
        type: "public",
        description: "Ваш опорный пункт. Терминал, архив, доска расследований.",
        hours: { open: 0, close: 24 },
        icon: "🏢",
        mapPosition: { x: 50, y: 60 },
        scenes: {
            day: null,
            night: null
        },
        npcsPresent: [],
        defaultItems: [],
        unlockedByDefault: true
    },
    
    hotel_grand: {
        id: "hotel_grand",
        name: "Отель «Гранд»",
        type: "public",
        description: "Место преступления. Номер 304 опечатан.",
        hours: { open: 6, close: 23 },
        icon: "🏨",
        mapPosition: { x: 35, y: 40 },
        scenes: {
            day: null,
            night: null
        },
        npcsPresent: ["porter"],
        defaultItems: ["guest_book", "lobby_phone"],
        unlockedByDefault: true,
        subLocations: ["hotel_room_304", "hotel_basement"]
    },
    
    hotel_room_304: {
        id: "hotel_room_304",
        name: "Номер 304",
        type: "crime_scene",
        description: "Место исчезновения мистера Блэквуда. Дверь опечатана.",
        hours: { open: 0, close: 24 },
        icon: "🚪",
        mapPosition: null,
        parentLocation: "hotel_grand",
        scenes: {
            day: null,
            night: null
        },
        npcsPresent: [],
        defaultItems: ["bed_304", "window_304", "wardrobe", "mirror", "carpet_stain"],
        unlockedByDefault: true,
        requiresItem: null
    },
    
    bar_joe: {
        id: "bar_joe",
        name: "Бар «У Джо»",
        type: "evening_venue",
        description: "Популярное место. Бармен знает всех в округе.",
        hours: { open: 16, close: 2 },
        icon: "🍸",
        mapPosition: { x: 65, y: 45 },
        scenes: {
            day: null,
            night: null
        },
        npcsPresent: ["bartender"],
        defaultItems: ["bar_counter", "jukebox", "back_door"],
        unlockedByDefault: true
    },
    
    alley: {
        id: "alley",
        name: "Переулок",
        type: "street",
        description: "Тёмный переулок за отелем. Опасное место ночью.",
        hours: { open: 0, close: 24 },
        icon: "🏚️",
        mapPosition: { x: 30, y: 55 },
        scenes: {
            day: null,
            night: null
        },
        npcsPresent: [],
        defaultItems: ["dumpster", "graffiti_wall", "broken_lamp"],
        unlockedByDefault: true,
        nightOnlyItems: ["hidden_suitcase"]
    },
    
    victim_apartment: {
        id: "victim_apartment",
        name: "Квартира жертвы",
        type: "private",
        description: "Личная квартира мистера Блэквуда. Нужен ордер.",
        hours: { open: 8, close: 20 },
        icon: "🏠",
        mapPosition: { x: 75, y: 30 },
        scenes: {
            day: null,
            night: null
        },
        npcsPresent: [],
        defaultItems: ["desk", "bookshelf", "safe", "photo_frame"],
        unlockedByDefault: false,
        requiresItem: "search_warrant"
    }
};

// Вспомогательные функции
function getLocationById(id) {
    return LOCATIONS_INDEX[id] || null;
}

function getMapLocations() {
    return Object.values(LOCATIONS_INDEX).filter(loc => loc.mapPosition !== null);
}

function getSubLocations(parentId) {
    return Object.values(LOCATIONS_INDEX).filter(loc => loc.parentLocation === parentId);
}