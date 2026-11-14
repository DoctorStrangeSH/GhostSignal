const DIALOGUE_BARTENDER_CASE2 = {
    id: "dialogue-bartender-case2",
    npcId: "bartender",
    type: "face_to_face",

    evidenceReactions: {
        bar_photo: {
            text: "Да, это тот вечер. На снимке Кейн у стойки. Он оставался в баре и после того, как Анна уронила пузырёк.",
            mood: "serious",
            givesInsight: "bartender_identifies_kane"
        }
    },

    context: {
        title: "Бар «У Джо» — повторный разговор",
        text: "После ночного происшествия бар кажется непривычно тихим. Джо протирает стойку, но теперь избегает смотреть на столик, за которым сидел Блэквуд.",
        mood: "tired"
    },

    tree: {
        start: "greeting",
        entryRules: [
            { condition: "all:hasInsight:thomas_family_protected&hasInsight:thomas_family_address_exposed", nodeId: "joe_after_protection_verified_opening" },
            { condition: "hasInsight:joe_relocated_family_after_leak", nodeId: "joe_after_relocation_opening" },
            { condition: "hasInsight:thomas_family_address_exposed", nodeId: "joe_after_leak_opening" }
        ],
        nodes: {
            joe_after_protection_verified_opening: {
                speaker: "npc",
                text: "Томас подтвердил, что мать добралась до безопасного места. Хорошо, что теперь она под присмотром. Но я помню и прежнюю утечку. Если у вас новые сведения, говорите осторожно — без имён и адресов посторонним.",
                mood: "guarded",
                answers: [
                    { text: "Спасибо за помощь. Вернёмся к другим вопросам дела.", nextNode: "greeting", tone: "calm" },
                    { text: "Не стану подвергать их риску. До встречи.", nextNode: "end_bartender_guarded", tone: "calm" }
                ]
            },
            joe_after_leak_opening: {
                speaker: "npc",
                text: "Детектив, после того как Кейн услышал о первом укрытии, я больше не могу относиться к вопросам безопасности как к пустой формальности. Прежде всего нужно убедиться, что мать Томаса переедет.",
                mood: "angry",
                answers: [
                    {
                        text: "Давайте немедленно организуем другое место, о котором Кейн не знает.",
                        nextNode: "joe_emergency_relocation",
                        tone: "calm",
                        condition: "not:hasInsight:joe_relocated_family_after_leak"
                    },
                    { text: "У меня есть и другие вопросы по делу.", nextNode: "greeting", tone: "calm" },
                    { text: "Понимаю. Я вернусь позже.", nextNode: "end_bartender_guarded", tone: "calm" }
                ]
            },
            joe_after_relocation_opening: {
                speaker: "npc",
                text: "Я организовал другое место, но после утечки первого адреса не стану говорить, что всё завершено. Томас должен сам подтвердить, что мать добралась. И я помню, как нам пришлось менять планы из-за вашей ошибки.",
                mood: "guarded",
                answers: [
                    { text: "Сначала уточню у Томаса, что переезд состоялся.", nextNode: "end_bartender_guarded", tone: "calm" },
                    { text: "Есть ещё вопросы о расследовании.", nextNode: "greeting", tone: "direct" }
                ]
            },
            greeting: {
                speaker: "npc",
                text: "Снова вы, детектив. После того, что случилось... я думал закрыть бар. Но жизнь продолжается. Что я могу для вас сделать?",
                mood: "tired",
                innerThought: "Он устал. Но хочет помочь.",
                answers: [
                    { text: "Расскажите мне о вечере отравления ещё раз. Медленно.", nextNode: "retell", tone: "calm" },
                    {
                        text: "Лора не смогла установить личность посетителя. Проверьте записи о визитах за тот вечер.",
                        nextNode: "joe_finds_visitor_log",
                        tone: "calm",
                        condition: "all:hasInsight:unknown_visitor_unverified&not:hasInsight:joe_found_inspection_entry",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "После переезда матери Томаса никто не интересовался её местонахождением?",
                        nextNode: "joe_reports_unknown_visitor",
                        tone: "calm",
                        condition: "all:hasInsight:thomas_family_protected&not:hasInsight:unknown_visitor_asked_about_thomas",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Я неосторожно сказал Кейну, что мать Томаса укрывают родственники Джо. Что теперь делать?",
                        nextNode: "joe_address_compromised",
                        tone: "direct",
                        trustDelta: -8,
                        cooperationDelta: -10,
                        memoryImportance: 4,
                        memoryTags: ["player_endangered_witness"],
                        report: {
                            id: "detective-exposed-thomas-shelter",
                            kind: "detective_behavior",
                            networkPropagation: true,
                            targetNpcId: "waiter",
                            sourceName: "Джо",
                            text: "Детектив сообщил Кейну сведения об укрытии семьи Томаса. Пришлось искать другое безопасное место."
                        },
                        condition: "all:hasInsight:joe_arranged_safe_lodging&not:hasInsight:thomas_family_protected&not:hasInsight:thomas_family_address_exposed",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Адрес мог стать известен Кейну. Можно перевезти мать Томаса ещё раз?",
                        nextNode: "joe_emergency_relocation",
                        tone: "calm",
                        condition: "all:hasInsight:thomas_family_address_exposed&not:hasInsight:joe_relocated_family_after_leak",
                        hiddenWhenUnavailable: true
                    },

                    {
                        text: "Томасу и его матери всё ещё угрожали. Можно организовать для них временное безопасное место?",
                        nextNode: "joe_safe_lodging_arranged",
                        tone: "calm",
                        condition: "all:hasInsight:full_confession_kane&npc_action_completed:joe-reassures-thomas-after-threat&not:hasInsight:joe_arranged_safe_lodging",
                        hiddenWhenUnavailable: true
                    },

                    {
                        text: "Вы успели поговорить с Томасом после того, что услышали?",
                        nextNode: "joe_helped_thomas",
                        tone: "calm",
                        condition: "npc_action_completed:joe-reassures-thomas-after-threat"
                    },

                    {
                        text: "Похоже, люди вокруг всё ещё помогают вам держаться.",
                        nextNode: "community_support",
                        tone: "reassuring",
                        condition: "npc_goal_completed:maintain_bar_community"
                    },
                    {
                        text: "Помните, как вы давили на меня в прошлый раз? Я не забыл.",
                        nextNode: "remembers_threat",
                        tone: "direct",
                        condition: "long_term_memory:player_threatened"
                    },
                    {
                        text: "Похоже, мы так и не научились доверять друг другу.",
                        nextNode: "guarded_history",
                        tone: "direct",
                        condition: "long_term_disposition:guarded"
                    },
                    {
                        text: "В прошлый раз вы выслушали меня. Я это ценю.",
                        nextNode: "remembers_kindness",
                        tone: "reassuring",
                        condition: "long_term_memory:player_reassured"
                    },
                    { text: "Вы знали, что Кейн купил цианид в аптеке?", nextNode: "about_kane", tone: "direct", condition: "hasInsight:kane_bought_cyanide" },
                    {
                        text: "Томас рассказал, что вы пригрозили обвинить его в соучастии. Это правда?",
                        nextNode: "heard_about_thomas",
                        tone: "direct",
                        condition: "heard_rumor:detective-threatened-thomas",
                        revealSocialEvents: {
                            reportId: "detective-threatened-thomas",
                            eventTypes: ["delivered"],
                            fromNpcId: "waiter",
                            toNpcId: "bartender"
                        }
                    }
                ]
            },

            joe_finds_visitor_log: {
                speaker: "npc",
                text: "Нашёл в журнале учёта посетителей запись за тот вечер: «И. Руденко, проверка условий труда», номер служебной заявки 27-Б. Почерк и время совпадают с моими записями о том незнакомце. Но запись могла быть оставлена кем угодно. Нужно проверить номер заявки не через меня.",
                mood: "thoughtful",
                innerThought: "Это документальная зацепка из бара, но запись не является удостоверением личности посетителя.",
                givesInsight: "joe_found_inspection_entry",
                answers: [
                    { text: "Сверю служебную заявку с независимыми записями.", nextNode: "end_bartender2", tone: "calm" }
                ]
            },
            joe_reports_unknown_visitor: {
                speaker: "npc",
                text: "Вчера заходил незнакомец и спросил, когда Томас вернётся на смену. Он не назвал себя и не спрашивал адрес матери. Я не стал ничего рассказывать. Не знаю, был ли это человек Кейна — возможно, обычный посетитель.",
                mood: "wary",
                innerThought: "Джо лично видел незнакомца, но не имеет данных, связывающих его с Кейном или новой локацией семьи.",
                givesInsight: "unknown_visitor_asked_about_thomas",
                answers: [
                    { text: "Проверю, кто это был, прежде чем делать выводы.", nextNode: "end_bartender2", tone: "calm" }
                ]
            },
            joe_address_compromised: {
                speaker: "npc",
                text: "Вы сказали это Кейну? Тогда прежний адрес нельзя считать безопасным. Я не назову его снова даже вам. Нужно срочно предупредить Томаса и договориться о другом месте. Сейчас нельзя утверждать, что его мать защищена.",
                mood: "angry",
                innerThought: "Это подтверждённое раскрытие схемы укрытия, а не слух. Нельзя использовать первоначальную договорённость как гарантию безопасности.",
                givesInsight: "thomas_family_address_exposed",
                answers: [
                    { text: "Исправлю ошибку. Договоримся о новом укрытии.", nextNode: "end_bartender_guarded", tone: "calm" }
                ]
            },
            joe_emergency_relocation: {
                speaker: "npc",
                text: "Я связался с другим человеком, никак не связанным с первым адресом. Он готов принять мать Томаса без лишних вопросов. Передам контакты только Томасу. Сначала пусть доберутся, затем проверяйте у него.",
                mood: "serious",
                innerThought: "После утечки появился другой план, но сама договорённость не доказывает успешный переезд.",
                givesInsight: "joe_relocated_family_after_leak",
                answers: [
                    { text: "Хорошо. Подтвержу прибытие у Томаса лично.", nextNode: "end_bartender_guarded", tone: "calm" }
                ]
            },
            joe_safe_lodging_arranged: {
                speaker: "npc",
                text: "Томас рассказал мне про угрозы Кейна. После признания я договорился с родственниками за городом: они готовы временно принять его мать, не раскрывая адрес посторонним. Я передам Томасу контакты, но не стану говорить, что всё решено, пока он сам не подтвердит, что мать добралась.",
                mood: "serious",
                innerThought: "Джо организовал временное укрытие, но ещё не подтверждено, что семья им воспользовалась.",
                givesInsight: "joe_arranged_safe_lodging",
                answers: [
                    { text: "Спасибо. Я уточню у Томаса, что мать действительно в безопасности.", nextNode: "end_bartender2", tone: "calm" }
                ]
            },
            joe_helped_thomas: {
                speaker: "npc",
                text: "Да. Я поговорил с Томасом после смены. Он был напуган, но теперь знает, что не останется один. Это не отменяет его показаний и не делает ваши обвинения правдой. Просто я не позволю оставить его без поддержки.",
                mood: "serious",
                answers: [
                    { text: "Я не должен был давить на него. Постараюсь исправить это.", nextNode: "retell", tone: "reassuring", trustDelta: 2 },
                    { text: "Мне нужны только проверяемые показания.", nextNode: "retell", tone: "direct" }
                ]
            },

            community_support: {
                speaker: "npc",
                text: "Не ожидал, что Лора напишет просто узнать, как я. А Элиас ещё в первом деле зашёл поговорить. Наверное, бар держится не только на мне. Иногда нужно позволить людям быть рядом.",
                mood: "grateful",
                innerThought: "Люди не исчезли, когда стало трудно. Я должен помнить об этом.",
                answers: [
                    {
                        text: "Не обязательно справляться со всем в одиночку.",
                        nextNode: "retell",
                        tone: "reassuring",
                        memorySummary: "Детектив поддержал Джо, напомнив, что рядом есть люди.",
                        memoryTags: ["player_reassured"],
                        memoryImportance: 2
                    },
                    { text: "Вернёмся к вечеру отравления.", nextNode: "retell", tone: "direct" }
                ]
            },

            remembers_threat: {
                speaker: "npc",
                text: "Я помню тот разговор. Вы пытались запугать меня, и я не собираюсь снова проходить через это. Говорите прямо, детектив.",
                mood: "suspicious",
                innerThought: "Он помнит, как я обращался с ним раньше. Доверие не исчезло бесследно.",
                answers: [
                    {
                        text: "Вы правы. Я перегнул палку. Давайте начнём заново.",
                        nextNode: "retell",
                        tone: "reassuring",
                        memorySummary: "Детектив извинился перед Джо за прежние угрозы.",
                        memoryTags: ["player_apologized"],
                        memoryImportance: 3
                    },
                    {
                        text: "Я добивался результата. Вам лучше привыкнуть.",
                        nextNode: "retell",
                        tone: "threatening",
                        memorySummary: "Детектив снова пригрозил Джо, не признав прежнюю ошибку.",
                        memoryTags: ["player_threatened"],
                        memoryImportance: 4
                    }
                ]
            },

            guarded_history: {
                speaker: "npc",
                text: "Вы снова здесь, детектив. Я помню, как вы со мной разговаривали. И помню, что потом вы не всегда держали слово. Мне нужно понять, изменилось ли хоть что-нибудь.",
                mood: "guarded",
                innerThought: "Доверие Джо не исчезло за один разговор. Оно копилось — и так же постепенно разрушалось.",
                answers: [
                    {
                        text: "Я понимаю. Мне придётся заслужить ваше доверие.",
                        nextNode: "retell",
                        tone: "reassuring",
                        memorySummary: "Детектив признал, что должен заново заслужить доверие Джо.",
                        memoryTags: ["player_apologized"],
                        memoryImportance: 3
                    },
                    {
                        text: "Я не пришёл за вашим доверием.",
                        nextNode: "retell",
                        tone: "threatening",
                        memorySummary: "Детектив отказался восстанавливать доверие Джо.",
                        memoryTags: ["player_threatened"],
                        memoryImportance: 4
                    }
                ]
            },

            remembers_kindness: {
                speaker: "npc",
                text: "Помню. Вы не стали обращаться со мной как с подозреваемым. После всего, что случилось, приятно видеть, что вы не забыли о нашем разговоре.",
                mood: "grateful",
                innerThought: "Он помнит, что я помог ему. С таким человеком легче говорить.",
                answers: [
                    {
                        text: "Я помню, что вы помогли мне. Спасибо, Джо.",
                        nextNode: "retell",
                        tone: "reassuring",
                        memorySummary: "Детектив подтвердил Джо, что ценит его прежнюю помощь.",
                        memoryTags: ["player_reassured"],
                        memoryImportance: 3
                    },
                    { text: "Не путайте вежливость с доверием.", nextNode: "retell", tone: "direct" }
                ]
            },

            heard_about_thomas: {
                speaker: "npc",
                text: "Да, Томас говорил со мной. Он и без того боялся Кейна за свою семью. Если вы хотите, чтобы мы помогали расследованию, не превращайте наш страх в инструмент. Мы не обязаны выбирать между вами и человеком, который нам угрожает.",
                mood: "disappointed",
                innerThought: "Джо уже слышал о моём разговоре с Томасом. Теперь и он осторожнее со мной.",
                answers: [
                    { text: "Вы правы. Я перегнул палку. Мне следовало выслушать его.", nextNode: "retell", tone: "reassuring", trustDelta: 3, pressureDelta: -2 },
                    { text: "Мне нужны были показания, и я добивался результата.", nextNode: "retell", tone: "defensive", trustDelta: -2, pressureDelta: 3 }
                ]
            },

            retell: {
                speaker: "npc",
                text: "Хорошо. Я расскажу всё, что помню. Был вечер пятницы — самый загруженный вечер недели. Народу было много. Блэквуд пришёл около восьми, сел за свой обычный столик. Заказал двойной виски.",
                mood: "focused",
                innerThought: "Он вспоминает детали. Хорошо.",
                answers: [
                    { text: "Кто подходил к нему?", nextNode: "visitors" }
                ]
            },

            visitors: {
                speaker: "npc",
                text: "Первой — Анна. Его бывшая. Они ругались. Она кричала: «Ты разрушил мою жизнь!» Он отвечал спокойно, даже холодно: «Ты сама её разрушила». После ссоры Анна отошла от его столика к стойке и заказала мартини. Из бара она не уходила.",
                mood: "sad",
                innerThought: "Публичное унижение. Анна была в ярости.",
                answers: [
                    { text: "Кто был следующим?", nextNode: "next_visitor" }
                ]
            },

            next_visitor: {
                speaker: "npc",
                text: "Потом пришёл Кейн. Сел у стойки, заказал скотч. Он не подходил к Блэквуду — просто сидел и смотрел. Знаете, есть такой взгляд... когда человек что-то замышляет.",
                mood: "suspicious",
                innerThought: "Кейн наблюдал. Ждал момента.",
                givesInsight: "kane_watching",
                answers: [
                    { text: "Он говорил с Анной?", nextNode: "kane_anna" }
                ]
            },

            kane_anna: {
                speaker: "npc",
                text: "Нет. Они сидели рядом, но не разговаривали. Анна плакала, Кейн пил. А потом... Анна уронила пузырёк. Он покатился по стойке. Кейн наклонился и поднял его.",
                mood: "serious",
                innerThought: "Вот он — ключевой момент.",
                givesInsight: "kane_picked_vial",
                answers: [
                    { text: "Он вернул его Анне?", nextNode: "returned_vial" }
                ]
            },

            returned_vial: {
                speaker: "npc",
                text: "Нет. Он положил его в карман. Анна не заметила — она как раз отвернулась к телефону. Через несколько минут Кейн вышел в коридор к уборной, а вернулся уже без пузырька. Примерно через пятнадцать минут Блэквуду стало плохо.",
                mood: "grave",
                innerThought: "Кейн украл пузырёк. И использовал его.",
                givesInsight: "kane_stole_vial",
                claim: {
                    id: "bartender-kane-at-bar",
                    topic: "kane-presence-during-poisoning",
                    value: "present-at-bar-during-poisoning",
                    summary: "Бармен подтверждает, что Кейн оставался в баре в критический промежуток",
                    sourceName: "Джо, бармен",
                    location: "Бар «У Джо»",
                    timeLabel: "Вечер отравления",
                    circumstances: "Повторное показание после признания, что Кейн заплатил ему за молчание"
                },
                answers: [
                    { text: "Почему вы не рассказали это сразу?", nextNode: "why_hide" }
                ]
            },

            why_hide: {
                speaker: "npc",
                text: "Потому что Кейн... он заплатил мне. За молчание. Десять тысяч долларов. Я не мог отказаться — у меня долги, семья... Я слабый человек, детектив. Простите.",
                mood: "ashamed",
                innerThought: "Вот почему он молчал. Его подкупили.",
                givesInsight: "bartender_bribed",
                answers: [
                    { text: "Вы понимаете, что это соучастие?", nextNode: "accomplice" }
                ]
            },

            accomplice: {
                speaker: "npc",
                text: "Понимаю. И я готов понести наказание. Но сначала — я хочу дать показания против Кейна. Я расскажу всё. И про деньги, и про угрозы. Пусть он ответит за всё.",
                mood: "determined",
                innerThought: "Он готов искупить вину. Это шанс.",
                givesInsight: "bartender_testimony",
                answers: [
                    { text: "Хорошо. Я приму ваши показания.", nextNode: "end_bartender2" }
                ]
            },

            about_kane: {
                speaker: "npc",
                text: "Цианид? Нет... Я не знал. Но Кейн — он способен на всё. Я видел его глаза в тот вечер. Холодные. Расчётливые. Он пришёл в бар с одной целью — убить.",
                mood: "scared",
                innerThought: "Даже бармен чувствовал угрозу.",
                answers: [
                    { text: "Расскажите всё, что помните о Кейне.", nextNode: "kane_anna" }
                ]
            },

            end_bartender_guarded: {
                speaker: "npc",
                text: "Сначала убедитесь, что Томас и его мать защищены. Я продолжу помогать им, но доверие придётся заслужить заново.",
                mood: "guarded",
                endDialogue: true
            },
            end_bartender2: {
                speaker: "npc",
                text: "Спасибо, детектив. Что не осудили меня сразу. Я знаю — я поступил плохо. Но я всё исправлю. Обещаю.",
                mood: "grateful",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_BARTENDER_CASE2);