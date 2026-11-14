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
        entryRules: [
            { condition: "npc_investigation_outcome:lora-interviews-eva-about-threat:no_independent_evidence", nodeId: "lora_second_check_opening" }
        ],
        nodes: {
            lora_second_check_opening: {
                speaker: "npc",
                text: "Детектив, я уже связалась с Джо и Евой. Ни один разговор пока не дал независимого подтверждения истории об угрозах Томасу. Я продолжу проверять факты, но публиковать неподтверждённое не стану.",
                mood: "focused",
                answers: [
                    { text: "Расскажите подробнее о разговоре с Евой.", nextNode: "lora_eva_followup_unverified", tone: "direct" },
                    {
                        text: "Джо нашёл запись «И. Руденко, заявка 27-Б». Проверьте её независимо.",
                        nextNode: "lora_verifies_inspection_schedule",
                        tone: "calm",
                        condition: "all:hasInsight:joe_found_inspection_entry&not:hasInsight:visitor_likely_inspector",
                        hiddenWhenUnavailable: true
                    },

                    {
                        text: "У Джо появился неизвестный посетитель. Проверьте этот след отдельно.",
                        nextNode: "lora_checks_unknown_visitor",
                        tone: "calm",
                        condition: "all:hasInsight:unknown_visitor_asked_about_thomas&not:hasInsight:unknown_visitor_unverified",
                        hiddenWhenUnavailable: true
                    },
                    { text: "Давайте вернёмся к документам о Кейне.", nextNode: "investigation", tone: "calm" }
                ]
            },

            greeting: {
                speaker: "npc",
                text: "Детектив! Какая честь. Сами зашли в нашу скромную редакцию. Дайте угадаю — вам нужна информация о Кейне?",
                mood: "sharp",
                innerThought: "Она догадлива. И явно что-то знает.",
                answers: [
                    { text: "Вы следили за Кейном. Что вы раскопали?", nextNode: "investigation", tone: "direct" },
                    {
                        text: "Джо нашёл запись «И. Руденко, заявка 27-Б». Проверьте её независимо.",
                        nextNode: "lora_verifies_inspection_schedule",
                        tone: "calm",
                        condition: "all:hasInsight:joe_found_inspection_entry&not:hasInsight:visitor_likely_inspector",
                        hiddenWhenUnavailable: true
                    },

                    {
                        text: "Джо заметил неизвестного посетителя, который спрашивал о Томасе. Можете проверить?",
                        nextNode: "lora_checks_unknown_visitor",
                        tone: "calm",
                        condition: "all:hasInsight:unknown_visitor_asked_about_thomas&not:hasInsight:unknown_visitor_unverified",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "После Джо вы попытались поговорить с Евой?",
                        nextNode: "lora_eva_followup_unverified",
                        tone: "cautious",
                        condition: "npc_investigation_outcome:lora-interviews-eva-about-threat:no_independent_evidence"
                    },
                    {
                        text: "Что показала ваша проверка истории Томаса?",
                        nextNode: "lora_no_confirmation",
                        tone: "direct",
                        condition: "npc_investigation_outcome:lora-questions-joe-about-threat:no_independent_evidence"
                    },
                    {
                        text: "Вы потребовали у Джо подтверждений истории о Томасе?",
                        nextNode: "lora_checked_threat",
                        tone: "cautious",
                        condition: "npc_action_completed:lora-questions-joe-about-threat"
                    },

                    {
                        text: "Вы уже успели поговорить с Джо после нашего разговора?",
                        nextNode: "deadline_followup",
                        tone: "direct",
                        condition: "npc_goal_completed:publish_exclusive"
                    },
                    { text: "С чего вы взяли, что мне нужен Кейн?", nextNode: "how_she_knows", tone: "cautious" },
                    {
                        text: "Вы что-то слышали о моём разговоре с Томасом?",
                        nextNode: "joe_told_journalist",
                        tone: "cautious",
                        condition: "heard_rumor:detective-threatened-thomas",
                        revealSocialEvents: {
                            reportId: "detective-threatened-thomas",
                            eventTypes: ["betrayal", "scheduled", "delivered"],
                            fromNpcId: "bartender",
                            toNpcId: "journalist"
                        }
                    }
                ]
            },

            lora_verifies_inspection_schedule: {
                speaker: "npc",
                text: "Я сверила номер 27-Б с опубликованным графиком городской инспекции труда. В нём есть визит инспектора Ильи Руденко в бар Джо в тот же день и по тому же вопросу. Независимый документ подтверждает назначенный визит. Пока наиболее вероятно, что незнакомец был инспектором, а не человеком Кейна. Но без прямого опознания я не назову это окончательным доказательством личности.",
                mood: "focused",
                innerThought: "Два документа согласуются, но ни один не доказывает напрямую личность человека, которого видел Джо.",
                givesInsight: "visitor_likely_inspector",
                answers: [
                    {
                        text: "Отмечу объяснение как вероятное, а не как доказанную невиновность.",
                        nextNode: "investigation",
                        tone: "calm",
                        trustDelta: 1,
                        memorySummary: "Детектив согласился сохранить служебную версию посетителя как вероятную, но не доказанную.",
                        memoryTags: ["player_respected_visitor_uncertainty"],
                        memoryImportance: 2
                    },
                    {
                        text: "Значит, личность установлена. Это точно был инспектор.",
                        nextNode: "lora_rejects_certain_visitor_identity",
                        tone: "defensive",
                        trustDelta: -3,
                        memorySummary: "Детектив объявил личность посетителя установленной, хотя документы подтверждают только назначенный визит.",
                        memoryTags: ["player_overstated_visitor_identity"],
                        memoryImportance: 3,
                        report: {
                            id: "detective-overstated-visitor-identity",
                            kind: "detective_behavior",
                            networkPropagation: true,
                            targetNpcId: "bartender",
                            sourceName: "Лора",
                            text: "Детектив объявил личность неизвестного посетителя установленной, хотя совпадение записи и графика подтверждает только назначенный визит, а не личность человека у стойки."
                        }
                    }
                ]
            },
            lora_rejects_certain_visitor_identity: {
                speaker: "npc",
                text: "Нет, детектив. Вы сейчас сделали вывод сильнее, чем позволяют документы. График подтверждает назначенный визит Руденко, но не доказывает, что именно он стоял у стойки. Я сообщу Джо, что вы решили считать вопрос закрытым, хотя он ещё открыт. Не заставляйте свидетеля подтверждать то, чего он не видел.",
                mood: "disappointed",
                innerThought: "Я не позволю превратить совпадение документов в ложную уверенность. Джо должен знать, что детектив сделал такой вывод.",
                answers: [
                    { text: "Вы правы. Я поспешил с выводом.", nextNode: "investigation", tone: "reassuring" },
                    { text: "Я сам решаю, когда расследование закончено.", nextNode: "investigation", tone: "defensive" }
                ]
            },
            lora_checks_unknown_visitor: {
                speaker: "npc",
                text: "Я проверила записи звонков редакции и спросила у двух сотрудников, бывавших в баре. Никто не может независимо установить, кто тот посетитель и зачем ему Томас. Джо видел человека, но связь с Кейном пока ничем не подтверждена. Адрес укрытия публиковать нельзя.",
                mood: "focused",
                innerThought: "Отсутствие независимых подтверждений не доказывает ни угрозу, ни её отсутствие.",
                givesInsight: "unknown_visitor_unverified",
                answers: [
                    { text: "Оставим предупреждение открытым и будем собирать факты.", nextNode: "investigation", tone: "calm" }
                ]
            },
            lora_eva_followup_unverified: {
                speaker: "npc",
                text: "Да, связалась с Евой. Но её показаний недостаточно, чтобы независимо подтвердить или опровергнуть рассказ Томаса. Я не стану выдавать догадки за доказательства — даже если редактор требует материал к утру.",
                mood: "thoughtful",
                answers: [
                    { text: "Это честный подход. Спасибо за осторожность.", nextNode: "investigation", tone: "reassuring" },
                    { text: "Если появятся прямые свидетельства, сообщите мне.", nextNode: "investigation", tone: "direct" }
                ]
            },

            lora_no_confirmation: {
                speaker: "npc",
                text: "Я связалась с Джо. Он повторил услышанное, но сам угроз не наблюдал. Это не второе независимое свидетельство. Пока я не нашла подтверждений — и не стану представлять эту историю как доказанный факт.",
                mood: "serious",
                answers: [
                    { text: "Спасибо, что отделяете факты от пересказов.", nextNode: "investigation", tone: "reassuring" },
                    { text: "Продолжайте проверку, но не давите на Томаса.", nextNode: "investigation", tone: "cautious" }
                ]
            },

            lora_checked_threat: {
                speaker: "npc",
                text: "Я написала Джо, потому что услышала тревожную историю о Томасе. Но в редакцию она попадёт только после проверки: рассказ одного человека, даже искренний, ещё не доказательство. Я ищу независимое подтверждение.",
                mood: "focused",
                answers: [
                    { text: "Правильно. Можете проверить мои действия, но берегите свидетеля.", nextNode: "investigation", tone: "reassuring" },
                    { text: "Не превращайте чужой страх в заголовок.", nextNode: "investigation", tone: "cautious" }
                ]
            },

            deadline_followup: {
                speaker: "npc",
                text: "Я написала Джо сама. Попросила комментарий и дала понять, что дедлайн ждать не будет. Он не обязан отвечать, но я не собираюсь сидеть сложа руки, пока другие решают, какую правду можно печатать.",
                mood: "determined",
                innerThought: "Она уже действует без меня. Если не дать ей проверяемые факты, история может уйти в печать раньше времени.",
                answers: [
                    { text: "Не публикуйте то, чего пока не можете доказать.", nextNode: "why_not_publish", tone: "cautious" },
                    { text: "Покажите документы. Я помогу проверить факты.", nextNode: "investigation", tone: "reassuring" }
                ]
            },

            joe_told_journalist: {
                speaker: "npc",
                text: "Джо рассказал мне, что вы пригрозили Томасу обвинением в соучастии. Он не просил скрывать источник. Я не собираюсь превращать чужой страх в сенсацию, но хочу понять, почему вы решили давить на испуганного парня.",
                mood: "serious",
                innerThought: "Джо передал Лоре сведения. Теперь я знаю, что история вышла за пределы бара.",
                answers: [
                    { text: "Я поступил неправильно. Томас был напуган, а я не услышал его.", nextNode: "investigation", tone: "reassuring" },
                    { text: "Это не ваше дело. Я отвечаю за расследование.", nextNode: "investigation", tone: "defensive" }
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
                text: "Я копала под Кейна два месяца. Он связан с бандой Салливана — отмывают деньги через сеть аптек. Цианид он оформил как лабораторный реактив через собственную компанию. Но в её учёте нет ни эксперимента, ни списания вещества. У меня есть копии документов.",
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
                text: "Вот, смотрите. Банковские выписки, фотографии встреч с Салливаном и записи телефонных разговоров. А ещё — контактные отпечатки нашего фотографа, который снимал пятничный вечер в баре. На одном кадре Кейн наклоняется у стойки и поднимает небольшой предмет через салфетку. Сам по себе снимок не доказывает, что это пузырёк, но он совпадает с показаниями Евы и официанта.",
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