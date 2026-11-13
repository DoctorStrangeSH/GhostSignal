// ============================================
// ЦЕПОЧКИ УЛИК — ДЕЛО №1
// ============================================

registerData('evidence', {
    chain_001_escape_plan: {
        id: "chain_001_escape_plan",
        name: "План побега",
        caseId: "case-001",
        requiredEvidence: ["hidden_note", "train_ticket", "torn_photo"],
        requiredInsights: ["bar_meeting", "planned_escape", "blackwood_affair"],
        bonusInsight: "full_escape_plan",
        bonusEvidence: null,
        description: "Вы восстановили план побега Блэквуда. Билеты на поезд, тайная встреча в баре, роман с горничной — всё ведёт к одной развязке. Блэквуд собирался бежать с Мэри, но что-то пошло не так.",
        narrative: "Вы раскладываете улики на столе: записка о встрече в баре, билет на поезд, фотография с горничной. Картина складывается. Блэквуд планировал побег. Он купил билеты, договорился о встрече, собрал вещи. Но в последний момент передумал — или кто-то заставил его передумать."
    },
    
    chain_001_love_triangle: {
        id: "chain_001_love_triangle",
        name: "Любовный треугольник",
        caseId: "case-001",
        requiredEvidence: ["torn_photo", "victim_diary", "detective_photos"],
        requiredInsights: ["blackwood_affair", "wife_knew_everything", "blackwood_betrayal"],
        bonusInsight: "love_triangle_motive",
        bonusEvidence: null,
        description: "Блэквуд, Мэри и Виктория — любовный треугольник, который привёл к преступлению. Жена знала о романе. Горничная была влюблена. А Блэквуд... он просто хотел сбежать от обеих.",
        narrative: "Три человека и разрушенный брак. Виктория знала об измене и молчала, Мэри любила и надеялась, а Блэквуд пытался сохранить удобную для себя жизнь. Эта связь объясняет мотивы, но сама по себе ещё не доказывает похищение."
    },
    
    chain_001_locked_room: {
        id: "chain_001_locked_room",
        name: "Загадка запертой комнаты",
        caseId: "case-001",
        requiredEvidence: ["victim_diary", "toxicology_report", "detective_photos"],
        requiredInsights: ["locked_from_inside", "mary_had_access", "sedative_clue", "back_door_used"],
        bonusInsight: "locked_room_solved",
        bonusEvidence: null,
        description: "Как можно исчезнуть из запертой изнутри комнаты? Окно не открывали, следов взлома нет, но портье подтверждает: у Мэри был доступ к служебным ключам. Токсикология доказывает, что Блэквуд спал под действием снотворного, а следы у чёрного хода указывают на путь вывоза.",
        narrative: "Запертая комната — не чудо и не невозможное преступление. У Мэри был служебный ключ, Блэквуд находился без сознания, а чёрный ход позволял вывезти его незаметно. Запертая дверь создавала ложное впечатление, будто он всё ещё внутри."
    }
});

console.log('🔗 Цепочки улик дела №1 загружены');