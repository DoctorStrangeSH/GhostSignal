const DIALOGUES_INDEX = {
    // ============ ПОРТЬЕ ============
    "dialogue-porter": {
        id: "dialogue-porter",
        npcId: "porter",
        type: "call",  // call | chat | face_to_face
        tree: {
            start: "greeting",
            nodes: {
                greeting: {
                    speaker: "npc",
                    text: "Детектив? Я уж думал, вы не придёте. Этот отель... с ним что-то не так.",
                    mood: "nervous",
                    answers: [
                        { text: "Расскажите о мистере Блэквуде.", nextNode: "about_blackwood" },
                        { text: "Что значит «что-то не так»?", nextNode: "something_wrong" },
                        { text: "Мне нужен журнал регистрации.", nextNode: "guest_book_request", condition: "hasItem:search_warrant" }
                    ]
                },
                about_blackwood: {
                    speaker: "npc",
                    text: "Мистер Блэквуд... Хороший постоялец. Платил вовремя. Но в последнюю неделю был сам не свой. Оглядывался, нервничал.",
                    answers: [
                        { text: "Кто-то его преследовал?", nextNode: "stalker" },
                        { text: "Когда вы видели его в последний раз?", nextNode: "last_seen" },
                        { text: "[Закончить разговор]", nextNode: "end_call" }
                    ]
                },
                something_wrong: {
                    speaker: "npc",
                    text: "Звуки по ночам. Шаги. А на утро — тишина. И этот запах... сладкий запах из номера 304.",
                    mood: "nervous",
                    givesInsight: "sweet_smell",
                    answers: [
                        { text: "Сладкий запах? Опишите.", nextNode: "smell_description" },
                        { text: "Вы проверяли номер?", nextNode: "checked_room" }
                    ]
                },
                smell_description: {
                    speaker: "npc",
                    text: "Как цветы... но с химическим оттенком. Горничная сказала, что это освежитель воздуха. Но я не уверен.",
                    answers: [
                        { text: "Горничная? Расскажите о ней.", nextNode: "about_maid" },
                        { text: "Спасибо, это важно.", nextNode: "end_call" }
                    ]
                },
                checked_room: {
                    speaker: "npc",
                    text: "Да, утром. Дверь была заперта изнутри. Пришлось использовать мастер-ключ. Внутри — никого. Только беспорядок.",
                    givesInsight: "locked_from_inside",
                    answers: [
                        { text: "Мастер-ключ? У кого он есть?", nextNode: "master_key" }
                    ]
                },
                master_key: {
                    speaker: "npc",
                    text: "У меня, у горничной, у администратора. Но я свой не давал никому. Клянусь.",
                    mood: "nervous",
                    answers: [
                        { text: "А горничная? Она могла взять ваш ключ?", nextNode: "maid_key" },
                        { text: "Я проверю. Спасибо.", nextNode: "end_call" }
                    ]
                },
                maid_key: {
                    speaker: "npc",
                    text: "Мэри? Она... она хорошая девочка. Но в последнее время сама не своя. Может, неприятности?",
                    answers: [
                        { text: "Какие неприятности?", nextNode: "maid_troubles" }
                    ]
                },
                maid_troubles: {
                    speaker: "npc",
                    text: "Я слышал, она говорила по телефону. Плакала. Упоминала какие-то деньги. А потом Блэквуд исчез.",
                    givesInsight: "mary_money_problems",
                    answers: [
                        { text: "Это важно. Спасибо, Фрэнк.", nextNode: "end_call" }
                    ]
                },
                about_maid: {
                    speaker: "npc",
                    text: "Мэри работает у нас полгода. Тихоня. Но мистер Блэквуд... он всегда просил, чтобы убирала именно она.",
                    givesInsight: "blackwood_preferred_mary",
                    answers: [
                        { text: "Почему именно она?", nextNode: "why_mary" },
                        { text: "Понятно. Продолжим о Блэквуде.", nextNode: "about_blackwood" }
                    ]
                },
                why_mary: {
                    speaker: "npc",
                    text: "Не знаю. Может, она просто хорошо убирает. А может... Впрочем, это не моё дело.",
                    mood: "nervous",
                    answers: [
                        { text: "Договаривайте.", nextNode: "porter_hint", condition: "hasInsight:blackwood_affair" }
                    ]
                },
                porter_hint: {
                    speaker: "npc",
                    text: "Я видел их вместе. В баре. Они сидели за одним столиком и о чём-то спорили. Это было за день до исчезновения.",
                    givesInsight: "porter_testimony",  // Было givesEvidence
                    answers: [
                        { text: "Это ключевая информация. Благодарю.", nextNode: "end_call" }
                    ]
                },
                stalker: {
                    speaker: "npc",
                    text: "Я не видел никого подозрительного. Но в журнале есть запись о посетителе. Высокий, в шляпе. Спрашивал Блэквуда.",
                    answers: [
                        { text: "Когда это было?", nextNode: "visitor_time" },
                        { text: "Опишите посетителя подробнее.", nextNode: "visitor_detail" }
                    ]
                },
                visitor_time: {
                    speaker: "npc",
                    text: "За день до исчезновения. Около 20:00. Я как раз заступил на смену.",
                    answers: [
                        { text: "Он поднимался в номер?", nextNode: "visitor_room" }
                    ]
                },
                visitor_room: {
                    speaker: "npc",
                    text: "Нет. Я сказал, что Блэквуд не принимает гостей. Он ушёл. Но я заметил, что он направился в бар.",
                    answers: [
                        { text: "В бар? Это важно.", nextNode: "end_call" }
                    ]
                },
                visitor_detail: {
                    speaker: "npc",
                    text: "Высокий, худой. Чёрная шляпа. Глаза... холодные. Я бы запомнил такого.",
                    answers: [
                        { text: "Спасибо за описание.", nextNode: "end_call" }
                    ]
                },
                last_seen: {
                    speaker: "npc",
                    text: "В 21:00 он вернулся из бара. Поднялся в номер. Больше я его не видел.",
                    answers: [
                        { text: "Кто-то ещё поднимался в номер после?", nextNode: "other_visitors" }
                    ]
                },
                other_visitors: {
                    speaker: "npc",
                    text: "Горничная заходила. Сказала, что забыла поменять полотенца. Это было около 22:00.",
                    givesInsight: "maid_evening_visit",
                    answers: [
                        { text: "И после этого — тишина?", nextNode: "after_maid" }
                    ]
                },
                after_maid: {
                    speaker: "npc",
                    text: "Да. До самого утра. А утром — никого. И дверь заперта.",
                    answers: [
                        { text: "Спасибо, Фрэнк. Вы очень помогли.", nextNode: "end_call" }
                    ]
                },
                guest_book_request: {
                    speaker: "npc",
                    text: "Конечно. Вот журнал. Но записи за 14-е число... они испорчены. Словно кто-то специально залил страницу.",
                    givesInsight: "guest_book_tampered",  // Было givesEvidence
                    answers: [
                        { text: "Кто-то пытался скрыть записи?", nextNode: "tampered_book" },
                        { text: "Спасибо, я изучу.", nextNode: "end_call" }
                    ]
                },
                tampered_book: {
                    speaker: "npc",
                    text: "Не знаю. Я храню журнал на стойке. Кто угодно мог подойти.",
                    answers: [
                        { text: "Проверьте камеры, если они есть.", nextNode: "no_cameras" }
                    ]
                },
                no_cameras: {
                    speaker: "npc",
                    text: "Камеры только на входе. И они не работают уже месяц. Бюджет, знаете ли.",
                    answers: [
                        { text: "Понятно. Я разберусь.", nextNode: "end_call" }
                    ]
                },
                end_call: {
                    speaker: "npc",
                    text: "Удачи, детектив. Если что — я на смене до утра.",
                    endDialogue: true
                }
            }
        }
    },

    // ============ БАРМЕН ============
    "dialogue-bartender": {
        id: "dialogue-bartender",
        npcId: "bartender",
        type: "face_to_face",
        tree: {
            start: "greeting",
            nodes: {
                greeting: {
                    speaker: "npc",
                    text: "Детектив! Рад видеть. Что будете? Расследование — штука сухая, могу налить.",
                    mood: "friendly",
                    answers: [
                        { text: "Я по делу. Мистер Блэквуд.", nextNode: "about_blackwood" },
                        { text: "Что за встреча была здесь позавчера?", nextNode: "meeting_question", condition: "hasInsight:bar_meeting" },
                        { text: "Спасибо, просто поговорим.", nextNode: "small_talk" }
                    ]
                },
                about_blackwood: {
                    speaker: "npc",
                    text: "Блэквуд? Хороший клиент. Всегда заказывал двойной виски. В последний раз был здесь позавчера.",
                    answers: [
                        { text: "Он был один?", nextNode: "alone_question" },
                        { text: "Как он себя вёл?", nextNode: "behavior_question" }
                    ]
                },
                alone_question: {
                    speaker: "npc",
                    text: "Нет. С ним была женщина. Молодая, симпатичная. Я её раньше не видел.",
                    givesInsight: "mystery_woman",
                    answers: [
                        { text: "Опишите её.", nextNode: "describe_woman" }
                    ]
                },
                describe_woman: {
                    speaker: "npc",
                    text: "Блондинка, лет 25. В синем платье. Она нервничала, всё время оглядывалась. Они о чём-то спорили.",
                    answers: [
                        { text: "О чём спорили?", nextNode: "argument_topic" },
                        { text: "Вы знаете, кто она?", nextNode: "woman_identity" }
                    ]
                },
                argument_topic: {
                    speaker: "npc",
                    text: "Я не подслушивал, но пару слов уловил. «Деньги», «побег», «она не должна узнать». Драматично.",
                    givesInsight: "money_and_escape",
                    answers: [
                        { text: "Это важно. Продолжайте.", nextNode: "more_details" }
                    ]
                },
                woman_identity: {
                    speaker: "npc",
                    text: "Нет. Но она работает в отеле. Я видел её форму под плащом. Горничная, наверное.",
                    answers: [
                        { text: "Горничная? Вы уверены?", nextNode: "confirm_maid" }
                    ]
                },
                confirm_maid: {
                    speaker: "npc",
                    text: "Да. На плаще был логотип отеля. И ключи на поясе. Точно горничная.",
                    givesInsight: "woman_is_maid",
                    answers: [
                        { text: "Это меняет дело. Спасибо.", nextNode: "end_talk" }
                    ]
                },
                behavior_question: {
                    speaker: "npc",
                    text: "На взводе. Много пил, мало говорил. Потом пришла она, и он оживился. Но ненадолго.",
                    answers: [
                        { text: "Она? Горничная?", nextNode: "confirm_maid" }
                    ]
                },
                meeting_question: {
                    speaker: "npc",
                    text: "Вы про ту пару? Да, были здесь. Он и горничная. Обсуждали что-то важное. Я даже отошёл, чтобы не мешать.",
                    answers: [
                        { text: "Вы знаете, о чём они говорили?", nextNode: "argument_topic" }
                    ]
                },
                small_talk: {
                    speaker: "npc",
                    text: "Знаете, в этом баре многое можно услышать. Люди пьют и забывают, что у стен есть уши.",
                    answers: [
                        { text: "И что вы слышали о Блэквуде?", nextNode: "overheard" }
                    ]
                },
                overheard: {
                    speaker: "npc",
                    text: "Что он вляпался. В долги или в роман. Может, и в то, и в другое. Говорили, он хотел исчезнуть.",
                    givesInsight: "blackwood_wanted_to_disappear",
                    answers: [
                        { text: "Исчезнуть? Расскажите подробнее.", nextNode: "disappear_plan" }
                    ]
                },
                disappear_plan: {
                    speaker: "npc",
                    text: "Я слышал обрывок разговора. «Билеты куплены», «никто не найдёт». Романтика или преступление — решать вам.",
                    answers: [
                        { text: "Спасибо, Джо. Ты очень помог.", nextNode: "end_talk" }
                    ]
                },
                more_details: {
                    speaker: "npc",
                    text: "Она дала ему что-то. Маленький свёрток. Он положил в карман. И они ушли вместе.",
                    answers: [
                        { text: "Когда это было?", nextNode: "time_details" }
                    ]
                },
                time_details: {
                    speaker: "npc",
                    text: "Около полуночи. Я как раз закрывал смену. Они вышли через чёрный ход.",
                    givesInsight: "left_through_back",
                    answers: [
                        { text: "Чёрный ход ведёт в переулок?", nextNode: "alley_connection" }
                    ]
                },
                alley_connection: {
                    speaker: "npc",
                    text: "Да. Прямо к мусорным бакам. Не самое романтичное место для свидания.",
                    answers: [
                        { text: "Я проверю переулок. Спасибо.", nextNode: "end_talk" }
                    ]
                },
                end_talk: {
                    speaker: "npc",
                    text: "Обращайтесь, детектив. Бар открыт до двух.",
                    endDialogue: true
                }
            }
        }
    },

    // ============ ГОРНИЧНАЯ ============
    "dialogue-housekeeper": {
        id: "dialogue-housekeeper",
        npcId: "housekeeper",
        type: "call",
        tree: {
            start: "greeting",
            nodes: {
                greeting: {
                    speaker: "npc",
                    text: "Алло? Кто это? Я занята, у меня смена.",
                    mood: "anxious",
                    answers: [
                        { text: "Детектив. У меня вопросы о мистере Блэквуде.", nextNode: "nervous_response" },
                        { text: "Не вешайте трубку. Это важно.", nextNode: "why_important" }
                    ]
                },
                nervous_response: {
                    speaker: "npc",
                    text: "Я... я не знаю, о чём вы. Я просто убираю номера.",
                    mood: "nervous",
                    answers: [
                        { text: "Вы были в номере 304 в ночь исчезновения.", nextNode: "caught_lie", condition: "hasInsight:maid_evening_visit" },
                        { text: "Расскажите о ваших отношениях с Блэквудом.", nextNode: "deny_relationship" }
                    ]
                },
                why_important: {
                    speaker: "npc",
                    text: "Почему важно? Я ничего не сделала. Оставьте меня в покое.",
                    mood: "anxious",
                    answers: [
                        { text: "Успокойтесь. Я просто задам пару вопросов.", nextNode: "calm_down" }
                    ]
                },
                calm_down: {
                    speaker: "npc",
                    text: "Хорошо. Спрашивайте. Только быстро.",
                    answers: [
                        { text: "Где вы были после 22:00?", nextNode: "alibi_question" }
                    ]
                },
                alibi_question: {
                    speaker: "npc",
                    text: "Дома. Я ушла с работы в 18:00. Спросите портье, он видел, как я уходила.",
                    answers: [
                        { text: "Портье говорит, вы заходили в номер в 22:00.", nextNode: "caught_lie", condition: "hasInsight:maid_evening_visit" },
                        { text: "У вас есть свидетель?", nextNode: "no_witness" }
                    ]
                },
                caught_lie: {
                    speaker: "npc",
                    text: "...Хорошо. Да, я заходила. Но я просто забыла полотенца! Это моя работа!",
                    mood: "angry",
                    answers: [
                        { text: "У вас был роман с Блэквудом.", nextNode: "confront_affair", condition: "hasItem:torn_photo" },
                        { text: "Что вы сделали с ним?", nextNode: "accusation" }
                    ]
                },
                confront_affair: {
                    speaker: "npc",
                    text: "...Откуда у вас это фото? Да, мы были близки. Он обещал мне... обещал, что мы уедем вместе.",
                    mood: "sad",
                    givesInsight: "mary_confirms_affair",
                    answers: [
                        { text: "Но он передумал?", nextNode: "he_changed_mind" }
                    ]
                },
                he_changed_mind: {
                    speaker: "npc",
                    text: "Он сказал, что не может бросить жену. Что всё было ошибкой. Я... я была в ярости.",
                    mood: "angry",
                    answers: [
                        { text: "И вы решили его убрать?", nextNode: "accusation_direct" }
                    ]
                },
                accusation: {
                    speaker: "npc",
                    text: "Я ничего не делала! Он исчез сам! Вы не докажете!",
                    mood: "angry",
                    answers: [
                        { text: "Улики говорят об обратном.", nextNode: "evidence_confrontation", condition: "evidence_count:5" }
                    ]
                },
                accusation_direct: {
                    speaker: "npc",
                    text: "Нет! Я... я просто хотела напугать его. Подсыпала снотворное в стакан. Он уснул. А потом... я вывезла его в тележке. Он был жив! Просто спал!",
                    mood: "breaking",
                    givesInsight: "mary_confession",
                    answers: [
                        { text: "Куда вы его отвезли?", nextNode: "where_is_he" }
                    ]
                },
                evidence_confrontation: {
                    speaker: "npc",
                    text: "Хорошо... хорошо. Вы правы. Я устала врать. Он заслужил это. Обещал мне всё, а потом выбросил как мусор.",
                    mood: "breaking",
                    givesInsight: "mary_full_confession",
                    answers: [
                        { text: "Где он сейчас?", nextNode: "where_is_he" }
                    ]
                },
                where_is_he: {
                    speaker: "npc",
                    text: "В подвале отеля. Я не убивала его, клянусь! Он просто спал. Я хотела, чтобы он исчез из моей жизни. Как он хотел исчезнуть из моей.",
                    answers: [
                        { text: "Дело раскрыто. Оставайтесь на месте.", nextNode: "end_call_arrest" }
                    ]
                },
                deny_relationship: {
                    speaker: "npc",
                    text: "Отношений? Нет, я просто убирала его номер. Он был вежлив, не более.",
                    answers: [
                        { text: "У меня есть свидетельства обратного.", nextNode: "confront_affair", condition: "hasItem:torn_photo" },
                        { text: "Хорошо. Я проверю.", nextNode: "end_call_doubt" }
                    ]
                },
                no_witness: {
                    speaker: "npc",
                    text: "Нет. Я живу одна. Но это правда — я была дома.",
                    answers: [
                        { text: "Я проверю ваш телефон. Звонки записываются.", nextNode: "phone_records" }
                    ]
                },
                phone_records: {
                    speaker: "npc",
                    text: "...Это незаконно. Я не обязана отвечать.",
                    mood: "angry",
                    answers: [
                        { text: "Тогда до встречи в участке.", nextNode: "end_call_threat" }
                    ]
                },
                end_call: {
                    speaker: "npc",
                    text: "Мне пора работать.",
                    endDialogue: true
                },
                end_call_doubt: {
                    speaker: "npc",
                    text: "Проверяйте. Мне скрывать нечего.",
                    endDialogue: true
                },
                end_call_threat: {
                    speaker: "npc",
                    text: "Подождите!... *гудки*",
                    endDialogue: true
                },
                end_call_arrest: {
                    speaker: "npc",
                    text: "*тихий плач* Я не хотела... Я просто любила его...",
                    endDialogue: true
                }
            }
        }
    },

    // ============ СЕРЖАНТ ============
    "dialogue-sergeant": {
        id: "dialogue-sergeant",
        npcId: "sergeant",
        type: "face_to_face",
        tree: {
            start: "greeting",
            nodes: {
                greeting: {
                    speaker: "npc",
                    text: "Детектив. Докладывайте. Как продвигается дело Блэквуда?",
                    mood: "professional",
                    answers: [
                        { text: "Собираю улики. Есть зацепки.", nextNode: "clues_update" },
                        { text: "Нужен ордер на обыск квартиры.", nextNode: "warrant_request", condition: "evidence_count:3" }
                    ]
                },
                clues_update: {
                    speaker: "npc",
                    text: "Хорошо. Помните: время не ждёт. Если понадобится ордер или подкрепление — дайте знать.",
                    answers: [
                        { text: "Что вы знаете о Блэквуде?", nextNode: "background_info" },
                        { text: "Принято.", nextNode: "end_briefing" }
                    ]
                },
                background_info: {
                    speaker: "npc",
                    text: "Блэквуд — бизнесмен. Успешный. Женат. Но ходили слухи о долгах и интрижке на стороне. Ничего конкретного.",
                    givesInsight: "case_background",
                    answers: [
                        { text: "Долги? Кому он был должен?", nextNode: "debts" }
                    ]
                },
                debts: {
                    speaker: "npc",
                    text: "Ходят слухи о букмекерах. Но доказательств нет. Проверьте его дневник, если найдёте.",
                    answers: [
                        { text: "Понял. Продолжу расследование.", nextNode: "end_briefing" }
                    ]
                },
                warrant_request: {
                    speaker: "npc",
                    text: "Ордер? Уже есть основания? Покажите, что накопали.",
                    answers: [
                        { text: "Улики указывают на квартиру.", nextNode: "issue_warrant" }
                    ]
                },
                issue_warrant: {
                    speaker: "npc",
                    text: "Хорошо. Вот ордер. Но действуйте аккуратно — не хочу проблем с адвокатами.",
                    givesEvidence: "search_warrant",
                    answers: [
                        { text: "Спасибо, сержант.", nextNode: "end_briefing" }
                    ]
                },
                end_briefing: {
                    speaker: "npc",
                    text: "Удачи. Держите меня в курсе.",
                    endDialogue: true
                }
            }
        }
    }
};

// Вспомогательные функции
function getDialogueById(id) {
    return DIALOGUES_INDEX[id] || null;
}

function getDialogueForNPC(npcId, condition) {
    // Проверяем специальные диалоги
    const npc = getNPCById(npcId);
    if (npc?.specialConditions) {
        for (const cond of npc.specialConditions) {
            if (cond.condition === condition && cond.dialogueId) {
                return getDialogueById(cond.dialogueId);
            }
        }
    }
    // Возвращаем основной диалог
    const dialogueId = npc?.dialogueId;
    return dialogueId ? getDialogueById(dialogueId) : null;
}