const DIALOGUE_ELIAS = {
    id: "dialogue-elias",
    npcId: "elias",
    type: "face_to_face",
    
    context: {
        title: "Встреча в баре",
        text: "Вы находите Элиаса в баре «У Джо». Он сидит в углу, в чёрной шляпе, и нервно крутит стакан с виски. Когда вы подходите, он вздрагивает.",
        mood: "tense"
    },

    tree: {
        start: "greeting",
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Детектив. Я знал, что вы меня найдёте. Садитесь. Нам нужно поговорить.",
                mood: "nervous",
                innerThought: "Он ждал меня. Это упрощает дело.",
                answers: [
                    { text: "Вы Элиас Вон. Друг Блэквуда. Расскажите всё.", nextNode: "confession" },
                    { text: "Вы помогали ему с побегом. Это преступление.", nextNode: "accusation" }
                ]
            },

            confession: {
                speaker: "npc",
                text: "Да, я помогал ему. Но я не знал, что всё так обернётся. Джонатан был моим другом. Лучшим другом. Мы вместе росли. Я не мог отказать.",
                mood: "sad",
                innerThought: "Дружба с детства. Он действовал из лояльности, а не из корысти.",
                answers: [
                    { text: "Что именно вы для него сделали?", nextNode: "what_he_did" }
                ]
            },

            what_he_did: {
                speaker: "npc",
                text: "Я купил билеты на поезд. На два имени. Джонатан Смит и Мэри Смит. Фальшивые паспорта. Они должны были уехать вместе.",
                mood: "serious",
                innerThought: "Два билета. Он подтверждает план побега.",
                givesInsight: "elias_confirms_plan",
                answers: [
                    { text: "Но Блэквуд передумал?", nextNode: "changed_mind" }
                ]
            },

            changed_mind: {
                speaker: "npc",
                text: "Да. За день до отъезда. Он позвонил мне и сказал: «Элиас, я не могу. Я не могу бросить жену. Она угрожает покончить с собой.»",
                mood: "conflicted",
                innerThought: "Жена угрожала суицидом. Это объясняет, почему он остался.",
                givesInsight: "wife_suicide_threat",
                answers: [
                    { text: "Жена знала о Мэри?", nextNode: "wife_knew" }
                ]
            },

            wife_knew: {
                speaker: "npc",
                text: "Да. Она наняла частного детектива. Узнала всё. И пришла к Джонатану с ультиматумом: или он остаётся, или она расскажет всем о его долгах и романе.",
                mood: "serious",
                innerThought: "Шантаж. Жена держала его на крючке.",
                givesInsight: "wife_blackmail",
                answers: [
                    { text: "И что решил Блэквуд?", nextNode: "decision" }
                ]
            },

            decision: {
                speaker: "npc",
                text: "Он решил остаться. Позвонил Мэри и сказал, что всё кончено. Она... она была в ярости. Я слышал её крик по телефону.",
                mood: "sad",
                innerThought: "Мэри была в ярости. Это подтверждает её мотив.",
                answers: [
                    { text: "Вы думаете, это она похитила его?", nextNode: "elias_opinion" }
                ]
            },

            elias_opinion: {
                speaker: "npc",
                text: "Я не знаю. Мэри способна на многое. Но она любила его. По-настоящему любила. А любовь иногда толкает на безумные поступки.",
                mood: "philosophical",
                innerThought: "«Любовь толкает на безумные поступки». Это и есть ключ к делу.",
                givesInsight: "love_as_motive",
                answers: [
                    { text: "Спасибо, Элиас. Вы очень помогли.", nextNode: "end_elias" }
                ]
            },

            accusation: {
                speaker: "npc",
                text: "Преступление? Я не делал ничего противозаконного. Я просто купил билеты. Остальное — его выбор.",
                mood: "defensive",
                innerThought: "Он защищается. Но говорит правду — покупка билетов не преступление.",
                answers: [
                    { text: "Расскажите всё с самого начала.", nextNode: "confession" }
                ]
            },

            end_elias: {
                speaker: "npc",
                text: "Детектив... если найдёте Джонатана, скажите ему... что я сожалею. Я должен был отговорить его. А не помогать.",
                mood: "regretful",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_ELIAS);