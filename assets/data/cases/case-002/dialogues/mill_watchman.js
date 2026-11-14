// ============================================
 // ДИАЛОГ — НОЧНОЙ СТОРОЖ ТЕКСТИЛЬНОЙ ФАБРИКИ
 // ============================================

const DIALOGUE_MILL_WATCHMAN = {
    id: "dialogue-mill-watchman",
    npcId: "mill_watchman",
    type: "face_to_face",

    context: {
        title: "Старая текстильная фабрика",
        text: "За ржавыми воротами тянется тёмный корпус фабрики. В будке горит настольная лампа. Ночной сторож раскладывает на столе журнал смены и связку ключей.",
        mood: "somber"
    },

    tree: {
        start: "greeting",
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Фабрика закрыта уже двенадцать дней. Внутрь никого не пускаю без распоряжения управляющего. Если ищете ночного посетителя, сначала скажите, что именно вам известно.",
                mood: "wary",
                answers: [
                    {
                        text: "Кондуктор трамвая №4 сообщил о пассажире, вышедшем у этой улицы около 22:15. Мужчина был в тёмном пальто, правая рука перевязана.",
                        nextNode: "checks_shift_log",
                        tone: "calm",
                        condition: "hasInsight:tram_passenger_route_corroboration",
                        hiddenWhenUnavailable: true
                    },
                    { text: "Пока больше ничего. Я вернусь.", nextNode: "end_watchman", tone: "calm" }
                ]
            },

            checks_shift_log: {
                speaker: "npc",
                text: "Я дежурил в ту ночь. В журнале всё записано: в 21:50 я опечатал боковые ворота после замены замка. Утром пломба была цела. Главные ворота закрыты с начала ремонта, ни одного посетителя по журналу нет. Но улица длинная, а фабрика занимает только один квартал. Я не могу сказать, куда человек пошёл после остановки.",
                mood: "serious",
                innerThought: "Пломба исключает проход через боковые ворота в этот промежуток. Она не доказывает, что человек вообще не был в районе или не прошёл по другой улице.",
                givesInsight: "mill_gate_seal_intact",
                spawnsItem: "mill_shift_extract",
                answers: [
                    {
                        text: "Сверим запись и отметим только то, что она доказывает: боковые ворота оставались опечатаны.",
                        nextNode: "records_limits",
                        tone: "procedural",
                        trustDelta: 2,
                        memorySummary: "Детектив проверил журнал фабрики и не стал превращать целую пломбу боковых ворот в доказательство отсутствия неизвестного во всём районе.",
                        memoryTags: ["player_respected_record_scope"],
                        memoryImportance: 2
                    },
                    {
                        text: "Значит, пассажир точно не заходил на фабрику и не имеет к ней отношения.",
                        nextNode: "overstates_factory_record",
                        tone: "defensive",
                        trustDelta: -2,
                        memorySummary: "Детектив объявил, что неизвестный не связан с фабрикой, хотя журнал подтверждает только состояние одних ворот.",
                        memoryTags: ["player_overstated_factory_record"],
                        memoryImportance: 2
                    }
                ]
            },

            records_limits: {
                speaker: "npc",
                text: "Именно. В журнале нет зарегистрированных посетителей, а пломба на боковых воротах не нарушена. Это делает проход через них маловероятным. Но я не наблюдал всю улицу и не могу опознать пассажира по вашему описанию.",
                mood: "measured",
                givesInsight: "mill_no_registered_visitors",
                answers: [
                    { text: "Спасибо. Проверю другие улицы и остановки.", nextNode: "end_watchman", tone: "calm" }
                ]
            },

            overstates_factory_record: {
                speaker: "npc",
                text: "Так далеко я бы не заходил. Я отвечаю за ворота и журнал, а не за весь район. Человек мог пройти мимо, зайти в соседний двор или сесть в другой транспорт. Запись не называет его и не доказывает, что он не связан с фабрикой.",
                mood: "firm",
                answers: [
                    { text: "Понял. Оставим вывод в пределах записи.", nextNode: "records_limits", tone: "calm" }
                ]
            },

            end_watchman: {
                speaker: "npc",
                text: "Если найдёте точное время или официальное распоряжение, приходите. Я могу отвечать только за свою смену и ворота.",
                mood: "neutral",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_MILL_WATCHMAN);
