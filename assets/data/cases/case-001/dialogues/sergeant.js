const DIALOGUE_SERGEANT = {
    id: "dialogue-sergeant",
    npcId: "sergeant",
    type: "face_to_face",
    
    context: {
        title: "Кабинет сержанта",
        text: "Вы заходите в кабинет. Сержант Миллс сидит за столом, перебирая бумаги. На стене — карта города с отмеченными местами преступлений.",
        mood: "professional"
    },

    tree: {
        start: "greeting",
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Детектив. Докладывайте. Я слышал, вы уже осмотрели номер. Есть зацепки?",
                mood: "professional",
                innerThought: "Сержант деловит. Ему нужны факты, а не домыслы.",
                answers: [
                    { text: "Да, сержант. Дело странное. Номер заперт изнутри, но постоялец исчез.", nextNode: "report_findings" },
                    { text: "Мне нужен ордер на обыск квартиры Блэквуда.", nextNode: "warrant_request", condition: "evidence_count:3" },
                    { text: "Что вы знаете о Блэквуде? Кто он такой?", nextNode: "background_info" }
                ]
            },

            report_findings: {
                speaker: "npc",
                text: "Заперт изнутри? Это невозможно. Разве что... У вас есть подозреваемые?",
                mood: "intrigued",
                innerThought: "Даже сержант удивлён. Дело действительно необычное.",
                answers: [
                    { text: "Горничная Мэри. У неё был мотив и доступ.", nextNode: "mary_suspect" },
                    { text: "Пока нет. Нужно больше улик.", nextNode: "need_more" }
                ]
            },

            mary_suspect: {
                speaker: "npc",
                text: "Мэри? Тихая девочка. Работает полгода. Но... я слышал, она встречалась с Блэквудом. Это может быть мотивом.",
                mood: "thoughtful",
                innerThought: "Сержант подтверждает слухи. Это важно.",
                givesInsight: "sergeant_confirms_rumors",
                answers: [
                    { text: "Откуда вы знаете?", nextNode: "source" }
                ]
            },

            source: {
                speaker: "npc",
                text: "У меня есть информаторы в отеле. Портье Фрэнк — мой старый друг. Он рассказывает мне всё, что происходит. И он говорил о Мэри и Блэквуде.",
                mood: "candid",
                innerThought: "Портье — информатор сержанта. Интересно.",
                givesInsight: "porter_is_informant",
                answers: [
                    { text: "Полезная информация. Спасибо, сержант.", nextNode: "end_briefing" }
                ]
            },

            need_more: {
                speaker: "npc",
                text: "Хорошо. Не торопитесь с выводами. Соберите улики, допросите свидетелей. И держите меня в курсе.",
                mood: "fatherly",
                innerThought: "Сержант даёт дельный совет. Лучше не спешить.",
                answers: [
                    { text: "Принято.", nextNode: "end_briefing" }
                ]
            },

            warrant_request: {
                speaker: "npc",
                text: "Ордер? Уже есть основания? Покажите, что у вас есть.",
                mood: "demanding",
                innerThought: "Он хочет убедиться, что ордер не будет пустой тратой времени.",
                answers: [
                    { text: "У меня есть показания портье, дневник жертвы и фотография.", nextNode: "review_evidence" }
                ]
            },

            review_evidence: {
                speaker: "npc",
                text: "Дневник? Фотография? Хорошо. Это серьёзные улики. Я выпишу ордер. Но будьте осторожны — адвокаты Блэквуда будут следить за каждым вашим шагом.",
                mood: "impressed",
                innerThought: "Ордер получен. Теперь можно обыскать квартиру.",
                givesEvidence: "search_warrant",
                answers: [
                    { text: "Спасибо, сержант. Я не подведу.", nextNode: "end_briefing" }
                ]
            },

            background_info: {
                speaker: "npc",
                text: "Джонатан Блэквуд. Бизнесмен. Владелец сети магазинов. Женат, детей нет. В последнее время у него были финансовые проблемы. Ходили слухи о банкротстве.",
                mood: "informative",
                innerThought: "Финансовые проблемы. Это может быть связано с исчезновением.",
                givesInsight: "financial_troubles",
                answers: [
                    { text: "Банкротство? Кому он был должен?", nextNode: "debts" }
                ]
            },

            debts: {
                speaker: "npc",
                text: "По слухам — букмекерам. Он играл на скачках. Проигрывал крупные суммы. Жена не знала.",
                mood: "serious",
                innerThought: "Игровая зависимость. Ещё один мотив для исчезновения.",
                givesInsight: "gambling_debts",
                answers: [
                    { text: "Это может объяснить побег. Спасибо.", nextNode: "end_briefing" }
                ]
            },

            end_briefing: {
                speaker: "npc",
                text: "Идите, детектив. И помните — правда не всегда то, чем кажется. Иногда она прячется в тенях. Найдите её.",
                mood: "wise",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_SERGEANT);