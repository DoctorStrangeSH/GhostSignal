// ============================================
 // ДИАЛОГ — ХОЗЯЙКА НОЧНОЙ ЗАКУСОЧНОЙ
 // ============================================

const DIALOGUE_DINER_OWNER = {
    id: "dialogue-diner-owner",
    npcId: "diner_owner",
    type: "face_to_face",

    context: {
        title: "Закусочная «У последнего трамвая»",
        text: "За запотевшим стеклом горит вывеска. Элеонора Брукс пересчитывает мелочь у кассы и время от времени поглядывает на часы над кухонной дверью.",
        mood: "guarded"
    },

    tree: {
        start: "greeting",
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Кухня уже закрыта, кофе ещё есть. Если вы пришли из-за того мужчины, о котором спрашивают на улице, я не уверена, что смогу помочь. Ночью здесь проходит слишком много людей.",
                mood: "wary",
                answers: [
                    {
                        text: "Мы ищем человека в тёмном пальто с повреждённой правой рукой. Он мог быть здесь после десяти вечера.",
                        nextNode: "recalls_customer",
                        tone: "calm",
                        condition: "hasInsight:unknown_visitor_description",
                        hiddenWhenUnavailable: true
                    },
                    { text: "Я просто выпью кофе.", nextNode: "end_diner", tone: "calm" }
                ]
            },

            recalls_customer: {
                speaker: "npc",
                text: "Теперь, когда вы сказали про руку… Возможно, это был мужчина, который сидел у окна. Он держал правую кисть под столом и почти не притронулся к кофе. Но пальто здесь носят многие. Я не видела его лица хорошо и не поручусь, что это тот же человек. По моим часам было около десяти. Часы отстают — я всё собираюсь их починить.",
                mood: "thoughtful",
                innerThought: "Я помню посетителя, но не хочу, чтобы мои слова превратили в опознание. Часы давно отстают, а смену я отмечаю по звонку с кухни.",
                givesInsight: "diner_possible_matching_customer",
                spawnsItem: "diner_cash_slip",
                answers: [
                    {
                        text: "Когда он ушёл и в какую сторону?",
                        nextNode: "direction_uncertain",
                        tone: "procedural"
                    },
                    {
                        text: "Значит, это был пассажир трамвая.",
                        nextNode: "rejects_early_identification",
                        tone: "defensive",
                        trustDelta: -2,
                        memorySummary: "Детектив объявил посетителя закусочной пассажиром трамвая, хотя Элеонора не смогла опознать человека и её часы неточны.",
                        memoryTags: ["player_overstated_diner_match"],
                        memoryImportance: 2
                    },
                    {
                        text: "Запишем это как возможное совпадение, не как опознание.",
                        nextNode: "end_diner",
                        tone: "calm",
                        trustDelta: 2,
                        memorySummary: "Детектив сохранил воспоминание Элеоноры о похожем посетителе как неподтверждённую зацепку.",
                        memoryTags: ["player_kept_diner_lead_unconfirmed"],
                        memoryImportance: 2
                    }
                ]
            },

            direction_uncertain: {
                speaker: "npc",
                text: "Я не видела, как он вышел. В тот момент звякнуло на кухне, и я отвернулась. Когда снова посмотрела к окну, чашка уже остыла, а стул был пуст. Чек пробили около десяти, но часы кассы никто не сверял на этой неделе. Не записывайте направление — я его не знаю.",
                mood: "firm",
                givesInsight: "diner_time_unverified",
                answers: [
                    {
                        text: "Проверю часы кассы и сменные записи. Пока время остаётся приблизительным.",
                        nextNode: "end_diner",
                        tone: "procedural",
                        trustDelta: 1,
                        memorySummary: "Детектив отметил, что время на чеке закусочной не сверено, а направление ухода посетителя неизвестно.",
                        memoryTags: ["player_recorded_diner_clock_uncertainty"],
                        memoryImportance: 2
                    }
                ]
            },

            rejects_early_identification: {
                speaker: "npc",
                text: "Нет, я этого не говорила. Я не видела, как он садился в трамвай, и не знаю, был ли это тот же мужчина. Если вы уже решили, что это один человек, вам мои воспоминания не помогут.",
                mood: "cold",
                answers: [
                    { text: "Вы правы. Я поспешил с выводом.", nextNode: "end_diner", tone: "calm" }
                ]
            },

            end_diner: {
                speaker: "npc",
                text: "Если вспомню что-нибудь ещё, скажу. Только не вписывайте в протокол то, чего я не подтверждала.",
                mood: "guarded",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_DINER_OWNER);
