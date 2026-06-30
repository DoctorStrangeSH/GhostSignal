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
        requiredInsights: ["blackwood_affair", "wife_knew_everything", "mary_confirms_affair"],
        bonusInsight: "love_triangle_motive",
        bonusEvidence: null,
        description: "Блэквуд, Мэри и Виктория — любовный треугольник, который привёл к преступлению. Жена знала о романе. Горничная была влюблена. А Блэквуд... он просто хотел сбежать от обеих.",
        narrative: "Три женщины. Один мужчина. Жена, которая знала всё и молчала. Горничная, которая любила и надеялась. И таинственная незнакомка, чьё имя ещё предстоит узнать. Любовный треугольник, который превратился в удавку."
    },
    
    chain_001_locked_room: {
        id: "chain_001_locked_room",
        name: "Загадка запертой комнаты",
        caseId: "case-001",
        requiredEvidence: ["small_key", "wall_safe", "hidden_note"],
        requiredInsights: ["locked_from_inside", "mary_had_access", "sedative_clue"],
        bonusInsight: "locked_room_solved",
        bonusEvidence: null,
        description: "Как можно исчезнуть из запертой изнутри комнаты? Ответ прост: нужно иметь ключ. Горничная знала, где лежит мастер-ключ. Она вошла, когда Блэквуд уснул, и вывезла его в тележке для белья.",
        narrative: "Запертая комната — классическая загадка детективов. Но разгадка проста: у горничной был доступ. Она знала, где хранится мастер-ключ. Она знала расписание портье. Она знала, что Блэквуд пьёт снотворное. Идеальное преступление — если бы не одна ошибка."
    }
});

console.log('🔗 Цепочки улик дела №1 загружены');