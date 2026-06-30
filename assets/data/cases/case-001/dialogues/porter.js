const DIALOGUE_PORTER = {
    id: "dialogue-porter",
    npcId: "porter",
    type: "call",
    
    // === КОНТЕКСТ ДЛЯ ИГРОКА (показывается перед диалогом) ===
    context: {
        title: "Звонок портье",
        text: "Вы набираете номер отеля. После трёх гудков трубку снимают.",
        mood: "tense"
    },

    tree: {
        start: "first_contact",
        nodes: {
            first_contact: {
                speaker: "npc",
                text: "Отель «Гранд», портье Фрэнк слушает. А, детектив... Я ждал вашего звонка.",
                mood: "nervous",
                innerThought: "Голос дрожит. Он явно недоговаривает.",
                answers: [
                    { 
                        text: "Расскажите мне о мистере Блэквуде. Каким он был постояльцем?", 
                        nextNode: "about_blackwood",
                        tone: "calm"
                    },
                    { 
                        text: "Что здесь происходит, Фрэнк? Вы явно что-то скрываете.", 
                        nextNode: "something_wrong",
                        tone: "direct"
                    }
                ]
            },

            about_blackwood: {
                speaker: "npc",
                text: "Мистер Блэквуд... Он останавливался у нас каждый месяц. Всегда номер 304. Хороший человек. Платил вовремя, не шумел. Но в последний раз... он был другим.",
                mood: "nervous",
                innerThought: "«Другим»? Нужно копнуть глубже.",
                answers: [
                    { text: "Другим? В каком смысле?", nextNode: "different_how" },
                    { text: "Когда вы видели его в последний раз?", nextNode: "last_sighting" },
                    { text: "Кто-то ещё интересовался им?", nextNode: "visitors" }
                ]
            },

            different_how: {
                speaker: "npc",
                text: "Он всё время оглядывался. Как будто боялся, что кто-то за ним следит. А однажды я слышал, как он кричал в трубку: «Оставь меня в покое!»",
                mood: "nervous",
                innerThought: "Кому он кричал? Жене? Горничной? Кому-то ещё?",
                answers: [
                    { text: "Вы знаете, кому он звонил?", nextNode: "phone_calls" },
                    { text: "Он говорил что-то ещё?", nextNode: "more_details" }
                ]
            },

            phone_calls: {
                speaker: "npc",
                text: "Нет. Но я видел, как он набирал один и тот же номер. И каждый раз после разговора выглядел... разбитым.",
                mood: "sad",
                innerThought: "Повторяющийся номер. Нужно проверить телефон на стойке.",
                givesInsight: "repeated_calls",
                answers: [
                    { text: "Спасибо, Фрэнк. Это важно.", nextNode: "gratitude" },
                    { text: "Продолжайте. Что ещё вы заметили?", nextNode: "more_details" }
                ]
            },

            more_details: {
                speaker: "npc",
                text: "За день до исчезновения он вернулся из бара поздно. Около полуночи. С ним была женщина. Они поднялись в номер. А утром... его уже не было.",
                mood: "nervous",
                innerThought: "Женщина. Горничная? Или кто-то ещё?",
                givesInsight: "woman_visitor",
                answers: [
                    { text: "Вы знаете эту женщину?", nextNode: "know_woman" },
                    { text: "Они ссорились?", nextNode: "argument" }
                ]
            },

            know_woman: {
                speaker: "npc",
                text: "Я не разглядел лица. Но на ней была форма горничной. И... красный шарф. Я запомнил шарф.",
                mood: "nervous",
                innerThought: "Красный шарф. Важная деталь.",
                givesInsight: "red_scarf_detail",
                answers: [
                    { text: "Горничная Мэри? Это была она?", nextNode: "was_it_mary", condition: "hasInsight:mary_suspicion" },
                    { text: "Что было потом?", nextNode: "after_visit" }
                ]
            },

            was_it_mary: {
                speaker: "npc",
                text: "Мэри... Да, наверное. Она работает у нас полгода. Тихая, незаметная. Но мистер Блэквуд всегда просил, чтобы убирала именно она. Говорил, что она «понимает его потребности».",
                mood: "nervous",
                innerThought: "«Понимает потребности»? Это звучит двусмысленно.",
                givesInsight: "blackwood_preferred_mary",
                answers: [
                    { text: "У них были отношения?", nextNode: "relationship" }
                ]
            },

            relationship: {
                speaker: "npc",
                text: "Я не спрашивал. Но однажды я видел, как она выходила из его номера в слезах. А он стоял в дверях и кричал: «Ты не уйдёшь от меня! Ты моя!»",
                mood: "shocked",
                innerThought: "Он угрожал ей. Мотив для неё — самооборона или месть?",
                givesInsight: "abusive_relationship",
                answers: [
                    { text: "Это меняет дело. Спасибо, Фрэнк.", nextNode: "gratitude" }
                ]
            },

            something_wrong: {
                speaker: "npc",
                text: "Детектив, я работаю здесь 20 лет. Я видел всякое. Но этот запах... Сладкий запах из номера 304. Это не духи. Это что-то другое.",
                mood: "nervous",
                innerThought: "Сладкий запах. Химический. Снотворное?",
                givesInsight: "sweet_smell",
                answers: [
                    { text: "Опишите этот запах.", nextNode: "smell_description" },
                    { text: "Кто-то ещё чувствовал его?", nextNode: "others_smelled" }
                ]
            },

            smell_description: {
                speaker: "npc",
                text: "Сладкий, приторный. Как цветы, но с химией. Горничная сказала, что это освежитель. Но освежители так не пахнут. Я знаю, я их покупаю.",
                mood: "suspicious",
                innerThought: "Горничная солгала о запахе. Почему?",
                givesInsight: "maid_lied_about_smell",
                answers: [
                    { text: "Горничная сказала вам это?", nextNode: "maid_said" }
                ]
            },

            maid_said: {
                speaker: "npc",
                text: "Да, Мэри. Она сказала: «Не беспокойтесь, Фрэнк, это просто новый освежитель. Мистер Блэквуд любит цветочные ароматы». Но я ей не поверил.",
                mood: "suspicious",
                innerThought: "Мэри явно что-то скрывает. Нужно допросить её.",
                answers: [
                    { text: "Спасибо за честность, Фрэнк.", nextNode: "gratitude" }
                ]
            },

            others_smelled: {
                speaker: "npc",
                text: "Только я и горничная. Администратор был в отпуске. Больше никто не заходил в то крыло.",
                answers: [
                    { text: "Значит, только вы двое.", nextNode: "maid_said" }
                ]
            },

            last_sighting: {
                speaker: "npc",
                text: "В 21:00. Он вернулся из бара. Поднялся в номер. Больше я его не видел. А утром... номер был пуст. Дверь заперта изнутри.",
                mood: "scared",
                innerThought: "Заперта изнутри. Как он исчез?",
                givesInsight: "locked_from_inside",
                answers: [
                    { text: "Этого не может быть. Вы уверены?", nextNode: "sure_about_lock" }
                ]
            },

            sure_about_lock: {
                speaker: "npc",
                text: "Я сам открывал дверь мастер-ключом. Цепочка была накинута. Пришлось срезать. Я вызывал слесаря.",
                mood: "scared",
                innerThought: "Цепочка изнутри. Это невозможно. Разве что...",
                answers: [
                    { text: "Кто ещё знал о мастер-ключе?", nextNode: "master_key_knowledge" }
                ]
            },

            master_key_knowledge: {
                speaker: "npc",
                text: "Только я и Мэри. У администратора свой, но он в отпуске. Я свой не давал никому.",
                mood: "nervous",
                innerThought: "Мэри знала о ключе. Могла взять.",
                givesInsight: "mary_had_access",
                answers: [
                    { text: "А Мэри? Она могла взять ваш ключ?", nextNode: "mary_key" }
                ]
            },

            mary_key: {
                speaker: "npc",
                text: "Она... она знает, где я храню ключ. В ящике стойки. Но она бы не взяла. Она хорошая девочка.",
                mood: "nervous",
                innerThought: "Он защищает её. Почему?",
                answers: [
                    { text: "Хорошие девочки иногда делают плохие вещи.", nextNode: "porter_defends" }
                ]
            },

            porter_defends: {
                speaker: "npc",
                text: "Вы не понимаете. Мэри... она как дочь мне. Она не могла. Просто не могла.",
                mood: "sad",
                innerThought: "Эмоциональная привязанность. Он может покрывать её.",
                givesInsight: "porter_protects_mary",
                answers: [
                    { text: "Я понимаю. Но я должен узнать правду.", nextNode: "gratitude" }
                ]
            },

            visitors: {
                speaker: "npc",
                text: "За день до исчезновения приходил какой-то человек. Высокий, в чёрной шляпе. Спрашивал Блэквуда. Я сказал, что его нет. Он ушёл, но я заметил — он направился в бар.",
                mood: "nervous",
                innerThought: "Человек в шляпе. Элиас? Или кто-то другой?",
                givesInsight: "mystery_visitor",
                answers: [
                    { text: "Опишите его подробнее.", nextNode: "describe_visitor" }
                ]
            },

            describe_visitor: {
                speaker: "npc",
                text: "Высокий, худой. Чёрное пальто, чёрная шляпа. Глаза... холодные, как у рыбы. Он не представился. Просто спросил: «Блэквуд здесь?» и ушёл.",
                mood: "scared",
                innerThought: "Холодные глаза. Этот человек опасен.",
                answers: [
                    { text: "Спасибо за описание. Я найду его.", nextNode: "gratitude" }
                ]
            },

            after_visit: {
                speaker: "npc",
                text: "После того как она ушла, было тихо. Слишком тихо. Обычно слышно, как мистер Блэквуд ходит по номеру. А тут — ничего.",
                mood: "scared",
                answers: [
                    { text: "Вы не поднялись проверить?", nextNode: "didnt_check" }
                ]
            },

            didnt_check: {
                speaker: "npc",
                text: "Я боялся. Вы должны понять — в этом отеле бывают странные вещи. Я не хотел... не хотел находить то, что нельзя развидеть.",
                mood: "scared",
                innerThought: "Он знал, что что-то случилось. Но боялся вмешиваться.",
                answers: [
                    { text: "Понимаю. Вы уже помогли.", nextNode: "gratitude" }
                ]
            },

            argument: {
                speaker: "npc",
                text: "Я слышал крики. Она кричала: «Ты обещал! Ты клялся!» А он отвечал: «Всё кончено. Я остаюсь с женой.»",
                mood: "sad",
                innerThought: "Он бросил её. Мотив для убийства?",
                givesInsight: "lovers_quarrel",
                answers: [
                    { text: "И что было потом?", nextNode: "after_argument" }
                ]
            },

            after_argument: {
                speaker: "npc",
                text: "Она выбежала в слезах. А через час он исчез.",
                mood: "sad",
                answers: [
                    { text: "Спасибо, Фрэнк. Вы очень помогли.", nextNode: "gratitude" }
                ]
            },

            gratitude: {
                speaker: "npc",
                text: "Детектив... найдите его. И найдите правду. Этот отель хранит слишком много секретов. Может, пора их раскрыть.",
                mood: "hopeful",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_PORTER);