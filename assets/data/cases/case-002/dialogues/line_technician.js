// ============================================
 // ДИАЛОГ — ТЕХНИК ГОРОДСКОЙ ТЕЛЕФОННОЙ СЕТИ
 // ============================================

const DIALOGUE_LINE_TECHNICIAN = {
    id: "dialogue-line-technician",
    npcId: "line_technician",
    type: "face_to_face",

    context: {
        title: "Ремонтная мастерская телефонной сети",
        text: "В мастерской пахнет изоляцией и машинным маслом. На стене висит схема кабельных колодцев текстильного района. Техник Генри Кларк перебирает катушки провода.",
        mood: "focused"
    },

    tree: {
        start: "greeting",
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Если у вас вопрос о звонке, я не оператор. Я чиню линии и отмечаю неисправности. Могу показать только наряд, который сам выполнял, — и только по номеру участка.",
                mood: "professional",
                answers: [
                    {
                        text: "На станции зарегистрировали междугородний запрос с линии текстильного района в 22:18. Проверим состояние уличной будки.",
                        nextNode: "checks_booth_ticket",
                        tone: "procedural",
                        condition: "hasInsight:telephone_time_calibrated",
                        hiddenWhenUnavailable: true
                    },
                    { text: "Спасибо. Я уточню номер участка и вернусь.", nextNode: "end_technician", tone: "calm" }
                ]
            },

            checks_booth_ticket: {
                speaker: "npc",
                text: "Вот наряд по будке Т-17 на текстильной улице. В 21:55 зафиксировали нестабильный контакт в кабельном колодце. В 22:05 контрольный вызов с этой будки не прошёл. Контакт восстановили и повторную проверку провели в 22:41. Это конкретная будка, а не вся линия района. Запрос на станции в 22:18 мог прийти с другого аппарата на той же городской линии.",
                mood: "serious",
                innerThought: "Я знаю только участок, который ремонтировал. Неисправность могла мешать вызову с Т-17, но она не объясняет, откуда поступила карточка междугороднего запроса.",
                givesInsight: "booth_t17_fault_window",
                spawnsItem: "booth_t17_maintenance_ticket",
                answers: [
                    {
                        text: "Зафиксируем неисправность только будки Т-17. Запрос в 22:18 мог поступить с другого аппарата.",
                        nextNode: "record_scope",
                        tone: "procedural",
                        trustDelta: 2,
                        memorySummary: "Детектив отделил неисправность конкретной будки Т-17 от служебного запроса всей телефонной линии района.",
                        memoryTags: ["player_kept_phone_fault_scope"],
                        memoryImportance: 2
                    },
                    {
                        text: "Значит, карточка станции ошибочна: из этой будки никто не мог позвонить.",
                        nextNode: "overstates_fault",
                        tone: "defensive",
                        trustDelta: -2,
                        memorySummary: "Детектив объявил запись станции ошибочной, хотя наряд касается только будки Т-17 и не устанавливает источник запроса.",
                        memoryTags: ["player_overstated_phone_fault"],
                        memoryImportance: 2
                    }
                ]
            },

            record_scope: {
                speaker: "npc",
                text: "Верно. Наряд подтверждает неисправность и неудачный контрольный вызов с Т-17 в 22:05. Он не доказывает, что будка была полностью отключена всё время до 22:41, и не говорит, какой аппарат использовали для запроса в 22:18.",
                mood: "measured",
                givesInsight: "booth_t17_not_confirmed_source",
                answers: [
                    { text: "Спасибо. Оставим источник запроса неизвестным.", nextNode: "end_technician", tone: "calm" }
                ]
            },

            overstates_fault: {
                speaker: "npc",
                text: "Нет. Я не проверял все аппараты района и не могу объявить карточку станции ошибочной. У меня есть запись о контрольном вызове с Т-17, который не прошёл в 22:05. Это всё, что подтверждает мой наряд.",
                mood: "firm",
                answers: [
                    { text: "Понял. Ограничим вывод конкретной будкой.", nextNode: "record_scope", tone: "calm" }
                ]
            },

            end_technician: {
                speaker: "npc",
                text: "Если получите номер другого аппарата или участка, я проверю отдельный наряд. Без номера могу только гадать.",
                mood: "neutral",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_LINE_TECHNICIAN);
