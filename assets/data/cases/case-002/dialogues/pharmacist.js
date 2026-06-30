const DIALOGUE_PHARMACIST = {
    id: "dialogue-pharmacist",
    npcId: "pharmacist",
    type: "face_to_face",
    
    context: {
        title: "Аптека на углу",
        text: "Звенит колокольчик над дверью. Пахнет травами и спиртом. Мистер Грин поднимает глаза от журнала и поправляет очки.",
        mood: "neutral"
    },

    tree: {
        start: "greeting",
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Добрый день. Что желаете? Если рецепт — показывайте. Если вопросы — задавайте быстрее, у меня инвентаризация.",
                mood: "cautious",
                innerThought: "Деловой старик. Не любит тратить время.",
                answers: [
                    { text: "Я расследую отравление в баре. Вы продавали яд?", nextNode: "poison_question", tone: "direct" },
                    { text: "Расскажите о покупателях за 13-е число.", nextNode: "records_question", tone: "calm" }
                ]
            },

            poison_question: {
                speaker: "npc",
                text: "Яд? Молодой человек, я фармацевт. Я продаю лекарства. А яд и лекарство — это вопрос дозировки. Но да, я продавал некоторые препараты, которые могут быть опасны в больших количествах.",
                mood: "defensive",
                innerThought: "Он увиливает. Нужно конкретнее.",
                answers: [
                    { text: "Хлоралгидрат и цианистый калий. 13-е число.", nextNode: "specific_drugs" }
                ]
            },

            specific_drugs: {
                speaker: "npc",
                text: "Ах, это... Да, я помню. Странный день. Сначала пришла женщина — бледная, заплаканная. Купила снотворное по рецепту. А через час — мужчина в дорогом костюме. Спросил цианид. Сказал — для лаборатории.",
                mood: "nervous",
                innerThought: "Оба купили яды. В один день. Это не совпадение.",
                givesInsight: "two_buyers_same_day",
                answers: [
                    { text: "Вы проверили его лицензию?", nextNode: "license_check" }
                ]
            },

            license_check: {
                speaker: "npc",
                text: "Да, всё было в порядке. Лицензия на имя Виктора Кейна. Химическая лаборатория «Кейн Индастриз». Я не имел права отказать.",
                mood: "defensive",
                innerThought: "Кейн использовал свою компанию для прикрытия.",
                givesInsight: "kane_used_company",
                answers: [
                    { text: "Вы знали, что он планирует?", nextNode: "knew_plan" }
                ]
            },

            knew_plan: {
                speaker: "npc",
                text: "Конечно нет! Я просто продал препарат. Я не спрашиваю, зачем он нужен. Это не моё дело.",
                mood: "defensive",
                innerThought: "Он не виноват. Но его показания — ключ к делу.",
                answers: [
                    { text: "Спасибо, мистер Грин. Вы очень помогли.", nextNode: "end_pharmacist" }
                ]
            },

            records_question: {
                speaker: "npc",
                text: "Журнал продаж? Это конфиденциальная информация. Но для полиции я сделаю исключение. Смотрите.",
                mood: "cautious",
                answers: [
                    { text: "Покажите записи за 13-е число.", nextNode: "specific_drugs" }
                ]
            },

            end_pharmacist: {
                speaker: "npc",
                text: "Детектив... будьте осторожны. Кейн — опасный человек. Я слышал, у него связи. Даже в полиции.",
                mood: "worried",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_PHARMACIST);