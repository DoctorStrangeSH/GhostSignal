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
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Снова вы, детектив. После того, что случилось... я думал закрыть бар. Но жизнь продолжается. Что я могу для вас сделать?",
                mood: "tired",
                innerThought: "Он устал. Но хочет помочь.",
                answers: [
                    { text: "Расскажите мне о вечере отравления ещё раз. Медленно.", nextNode: "retell", tone: "calm" },
                    {
                        text: "Помните, как вы давили на меня в прошлый раз? Я не забыл.",
                        nextNode: "remembers_threat",
                        tone: "direct",
                        condition: "long_term_memory:player_threatened"
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