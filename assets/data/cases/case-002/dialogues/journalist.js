const DIALOGUE_JOURNALIST = {
    id: "dialogue-journalist",
    npcId: "journalist",
    type: "face_to_face",
    
    context: {
        title: "Редакция «Вечернего вестника»",
        text: "В редакции шумно — стучат пишущие машинки, кричит редактор. Лора Лейн сидит за угловым столом, заваленным бумагами. Когда вы подходите, она отрывается от заметок и смотрит на вас острым взглядом.",
        mood: "busy"
    },

    tree: {
        start: "greeting",
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Детектив! Какая честь. Сами зашли в нашу скромную редакцию. Дайте угадаю — вам нужна информация о Кейне?",
                mood: "sharp",
                innerThought: "Она догадлива. И явно что-то знает.",
                answers: [
                    { text: "Вы следили за Кейном. Что вы раскопали?", nextNode: "investigation", tone: "direct" },
                    { text: "С чего вы взяли, что мне нужен Кейн?", nextNode: "how_she_knows", tone: "cautious" }
                ]
            },

            how_she_knows: {
                speaker: "npc",
                text: "Пожалуйста. Отравление в баре. Бывшая жена, конкурент, таинственная незнакомка. Я журналист — я знаю всё, что происходит в этом городе. И я знаю, что Кейн — ключ к разгадке.",
                mood: "confident",
                innerThought: "Она в курсе дела. Может быть полезна.",
                answers: [
                    { text: "Тогда расскажите, что вы знаете о Кейне.", nextNode: "investigation" }
                ]
            },

            investigation: {
                speaker: "npc",
                text: "Я копала под Кейна два месяца. Он связан с бандой Салливана — отмывают деньги через сеть аптек. Цианид, который убили Блэквуда? Кейн получил его через подставную компанию. У меня есть доказательства.",
                mood: "serious",
                innerThought: "Два месяца расследования. У неё должно быть много материалов.",
                givesInsight: "kane_criminal_connections",
                answers: [
                    { text: "Почему вы не опубликовали это раньше?", nextNode: "why_not_publish" },
                    { text: "У вас есть доказательства? Покажите.", nextNode: "show_evidence" }
                ]
            },

            why_not_publish: {
                speaker: "npc",
                text: "Потому что мой редактор боится. Кейн владеет половиной рекламных площадей в городе. Если мы опубликуем статью — он уберёт рекламу, и газета закроется. Я не могла рисковать.",
                mood: "frustrated",
                innerThought: "Страх перед деньгами. Знакомая история.",
                givesInsight: "kane_controls_media",
                answers: [
                    { text: "Теперь у вас есть шанс. Дайте мне материалы.", nextNode: "give_materials" }
                ]
            },

            show_evidence: {
                speaker: "npc",
                text: "Вот, смотрите. Банковские выписки, фотографии встреч с Салливаном, записи телефонных разговоров. И главное — счёт из аптеки. Кейн купил цианид за день до отравления.",
                mood: "serious",
                innerThought: "Конкретные доказательства. Это то, что нужно.",
                givesInsight: "hard_evidence_kane",
                answers: [
                    { text: "Это впечатляет. Вы хорошо поработали.", nextNode: "give_materials" }
                ]
            },

            give_materials: {
                speaker: "npc",
                text: "Я отдам вам копии. При одном условии: когда дело закроют — вы дадите мне эксклюзивное интервью. Город должен знать правду.",
                mood: "ambitious",
                innerThought: "Она хочет славы. Но это честная сделка.",
                answers: [
                    { text: "Договорились. Интервью ваше.", nextNode: "deal_made" }
                ]
            },

            deal_made: {
                speaker: "npc",
                text: "Отлично! Вот папка. Здесь всё, что я накопала. И детектив... будьте осторожны. Кейн опасен. Он уже угрожал мне. Не думаю, что вы его остановите одними уликами.",
                mood: "concerned",
                innerThought: "Она предупреждает об опасности. Нужно быть готовым.",
                spawnsItem: "lora_notes",
                answers: [
                    { text: "Я справлюсь. Спасибо за помощь.", nextNode: "end_journalist" }
                ]
            },

            end_journalist: {
                speaker: "npc",
                text: "Я надеюсь. Этот город заслуживает справедливости. И хороших заголовков. Принесите мне и то, и другое.",
                mood: "hopeful",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_JOURNALIST);