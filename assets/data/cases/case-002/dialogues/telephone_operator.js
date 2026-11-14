// ============================================
 // ДИАЛОГ — ОПЕРАТОР ГОРОДСКОЙ ТЕЛЕФОННОЙ СТАНЦИИ
 // ============================================

const DIALOGUE_TELEPHONE_OPERATOR = {
    id: "dialogue-telephone-operator",
    npcId: "telephone_operator",
    type: "face_to_face",

    context: {
        title: "Городская телефонная станция",
        text: "В аппаратной пахнет горячей пылью и лаком проводов. За коммутатором дежурит Марта Вейл; на стене тикают большие служебные часы.",
        mood: "professional"
    },

    tree: {
        start: "greeting",
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Станция обслуживает несколько кварталов. Если вы ищете запись разговора из уличной будки, предупреждаю сразу: местные соединения проходят через коммутатор, но содержание разговоров мы не записываем.",
                mood: "measured",
                answers: [
                    {
                        text: "В закусочной вспомнили посетителя около десяти. Мы проверяем возможный звонок с текстильной улицы.",
                        nextNode: "checks_service_register",
                        tone: "procedural",
                        condition: "hasInsight:diner_possible_matching_customer",
                        hiddenWhenUnavailable: true
                    },
                    { text: "Мне нужно уточнить порядок хранения записей.", nextNode: "record_policy", tone: "calm" },
                    { text: "Спасибо. Пока этого достаточно.", nextNode: "end_operator", tone: "calm" }
                ]
            },

            record_policy: {
                speaker: "npc",
                text: "Обычные местные звонки не оставляют у нас карточки с номером вызываемого абонента. Мы можем подтвердить только отдельные служебные операции — например, заявку на междугороднее соединение или неисправность линии. Даже такая запись не говорит, кто держал трубку.",
                mood: "professional",
                answers: [
                    { text: "Проверим только сохранившиеся служебные записи.", nextNode: "greeting", tone: "procedural" }
                ]
            },

            checks_service_register: {
                speaker: "npc",
                text: "Есть одна карточка междугороднего запроса с общественной линии на текстильной улице. Дежурный принял её в 22:18 по нашим служебным часам. Запрос направлялся на Восточный узел; поле с номером абонента на копии не сохранилось. Это отметка о принятом запросе, не подтверждение, что разговор состоялся. И я не могу связать карточку с вашей свидетельницей.",
                mood: "serious",
                innerThought: "Служебные часы сверяются утром с главным хронометром. Карточка надёжнее часов закусочной, но она не называет ни звонившего, ни точный аппарат.",
                givesInsight: "telephone_exchange_request_record",
                spawnsItem: "telephone_exchange_slip",
                answers: [
                    {
                        text: "Зафиксируем: был принят междугородний запрос с линии района, но номер и результат соединения неизвестны.",
                        nextNode: "limits_record",
                        tone: "procedural",
                        trustDelta: 2,
                        memorySummary: "Детектив точно ограничил вывод: служебная карточка подтверждает принятие запроса с линии текстильного района, но не номер абонента, завершение звонка или личность звонившего.",
                        memoryTags: ["player_respected_telephone_record_limits"],
                        memoryImportance: 2
                    },
                    {
                        text: "Значит, это точно звонил мужчина из закусочной.",
                        nextNode: "overstates_record",
                        tone: "defensive",
                        trustDelta: -2,
                        memorySummary: "Детектив приписал служебный запрос конкретному посетителю закусочной без доказательств.",
                        memoryTags: ["player_overstated_telephone_match"],
                        memoryImportance: 2
                    }
                ]
            },

            limits_record: {
                speaker: "npc",
                text: "Именно. Карточка подтверждает запрос с линии, обслуживающей этот район, в 22:18 по нашим сверенным часам. Номер абонента утрачен, завершение разговора не отмечено. Нельзя утверждать, что звонил тот посетитель, которого помнит хозяйка, или что он вообще дозвонился.",
                mood: "measured",
                givesInsight: "telephone_time_calibrated",
                answers: [
                    { text: "Спасибо. Сопоставлю эту отметку с остальными свидетельствами, не называя её опознанием.", nextNode: "end_operator", tone: "calm" }
                ]
            },

            overstates_record: {
                speaker: "npc",
                text: "Нет. У нас нет имени, номера аппарата и даже отметки об успешном соединении. Запрос мог сделать любой человек уличной линии. Не приписывайте карточке то, чего в ней нет.",
                mood: "firm",
                answers: [
                    { text: "Вы правы. Оставим только подтверждённый факт.", nextNode: "limits_record", tone: "calm" }
                ]
            },

            end_operator: {
                speaker: "npc",
                text: "Если появится номер служебной заявки или точный вопрос по линии, приходите. Архив не заменяет свидетельские показания.",
                mood: "neutral",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_TELEPHONE_OPERATOR);
