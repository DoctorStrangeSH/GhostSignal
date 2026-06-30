// ============================================
// ЛОКАЦИИ — ДЕЛО №2
// ============================================

registerData('location', {
    pharmacy: {
        id: "pharmacy",
        name: "Аптека на углу",
        type: "public",
        description: "Старая аптека с деревянными шкафами и стеклянными витринами. Пахнет травами и спиртом.",
        hours: { open: 8, close: 18 },
        icon: "💊",
        mapPosition: { x: 55, y: 70 },
        scenes: { day: null, night: null },
        npcsPresent: ["pharmacist"],
        defaultItems: ["pharmacy_counter", "prescription_journal", "medicine_shelf"],
        unlockedByDefault: true
    },
    newspaper_office: {
        id: "newspaper_office",
        name: "Редакция «Вечернего вестника»",
        type: "public",
        description: "Шумная редакция. Стук пишущих машинок, крики редактора, запах типографской краски.",
        hours: { open: 8, close: 22 },
        icon: "📰",
        mapPosition: { x: 45, y: 30 },
        scenes: { day: null, night: null },
        npcsPresent: ["journalist"],
        defaultItems: ["lora_desk", "archive_shelf", "press_photos"],
        unlockedByDefault: true
    },
    rival_office: {
        id: "rival_office",
        name: "Офис Кейна",
        type: "private",
        description: "Шикарный офис в деловом центре. На столе — фотография семьи. В ящике — папка с судебным иском.",
        hours: { open: 9, close: 18 },
        icon: "🏢",
        mapPosition: { x: 80, y: 25 },
        scenes: { day: null, night: null },
        npcsPresent: ["business_rival"],
        defaultItems: ["rival_desk", "contract_folder", "family_photo"],
        unlockedByDefault: true
    },
    bank: {
        id: "bank",
        name: "Первый городской банк",
        type: "public",
        description: "Мраморные колонны, золотые таблички. Здесь Блэквуд держал свои счета.",
        hours: { open: 9, close: 17 },
        icon: "🏦",
        mapPosition: { x: 70, y: 50 },
        scenes: { day: null, night: null },
        npcsPresent: [],
        defaultItems: ["bank_records", "safety_deposit_box"],
        unlockedByDefault: false,
        requiresItem: "bank_subpoena"
    }
});