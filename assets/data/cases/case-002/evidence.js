// ============================================
// ЦЕПОЧКИ УЛИК — ДЕЛО №2
// ============================================

registerData('evidence', {
    chain_002_poison_path: {
        id: "chain_002_poison_path",
        name: "Путь яда",
        caseId: "case-002",
        requiredEvidence: ["poison_vial", "prescription_copy", "lora_notes"],
        requiredInsights: ["kane_bought_cyanide", "someone_took_vial", "rival_took_vial_confirmed"],
        bonusInsight: "full_poison_path",
        bonusEvidence: null,
        description: "Вы проследили путь яда от аптеки до стакана Блэквуда. Кейн купил цианид в той же аптеке, где Анна приобрела снотворное. Он украл пузырёк Анны, заменил содержимое и подсыпал яд в стакан. Идеальное преступление, которое разрушила одна свидетельница.",
        narrative: "Аптека на углу. Два покупателя. Один день. Анна купила снотворное — она хотела умереть. Кейн купил цианид — он хотел убить. Когда Анна уронила пузырёк у стойки бара, Кейн поднял его. Но вернул не сразу. Сначала он заменил содержимое. А потом — подсыпал яд в стакан Блэквуда."
    },
    
    chain_002_witnesses: {
        id: "chain_002_witnesses",
        name: "Свидетели преступления",
        caseId: "case-002",
        requiredEvidence: ["bar_photo", "lora_notes", "prescription_copy"],
        requiredInsights: ["waiter_saw_poisoning", "bartender_testimony", "kane_threatened_witness"],
        bonusInsight: "solid_case",
        bonusEvidence: null,
        description: "Три свидетеля. Одно преступление. Официант видел, как Кейн сыпал порошок в стакан. Бармен видел, как Кейн украл пузырёк. Журналистка собрала доказательства его связей с криминалом. С таким набором улик дело не развалится в суде.",
        narrative: "Три человека видели правду. Но все молчали. Официант — из страха. Бармен — из-за денег. Журналистка — потому что боялась за свою газету. Но теперь, когда вы собрали все улики, их показания станут решающими."
    },
    
    chain_002_sisters: {
        id: "chain_002_sisters",
        name: "Сёстры",
        caseId: "case-002",
        requiredEvidence: ["red_scarf", "threat_note", "lora_notes"],
        requiredInsights: ["sisters_revealed", "suicide_plan", "someone_took_vial"],
        bonusInsight: "sisters_full_story",
        bonusEvidence: null,
        description: "Анна и Ева — две сестры, оказавшиеся по разные стороны преступления. Анна хотела умереть. Ева хотела её спасти. Но судьба распорядилась иначе: яд Анны украли, а её саму обвинили в убийстве.",
        narrative: "Две сестры. Одна — сломленная разводом, готовая покончить с собой. Вторая — готовая на всё, чтобы защитить сестру. Когда Анна уронила пузырёк, Ева хотела поднять его. Но Кейн оказался быстрее. И теперь Ева — единственная, кто может оправдать сестру."
    }
});

console.log('🔗 Цепочки улик дела №2 загружены');