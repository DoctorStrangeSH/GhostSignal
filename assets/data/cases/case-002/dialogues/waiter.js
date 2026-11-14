const DIALOGUE_WAITER = {
    id: "dialogue-waiter",
    npcId: "waiter",
    type: "face_to_face",

    evidenceReactions: {
        bar_photo: {
            text: "Да, это Кейн. Я помню этот костюм и то, как он сидел у стойки. На фотографии он ещё не подошёл к столику Блэквуда.",
            mood: "nervous",
            givesInsight: "kane_identified_in_photo"
        },
        poison_vial: {
            text: "Похоже на тот самый пузырёк. Я видел, как Кейн поднял его через салфетку, а потом спрятал в карман.",
            mood: "scared",
            givesInsight: "waiter_identifies_vial"
        }
    },

    context: {
        title: "Подсобка бара",
        text: "Вы находите Томаса в подсобке. Он нервно крутит полотенце и избегает зрительного контакта. Ему не больше двадцати.",
        mood: "tense"
    },

    tree: {
        start: "greeting",
        entryRules: [
            { condition: "accusation_status:thomas-lied-about-poisoning:pending", nodeId: "accused_after_revision_opening" },
            { condition: "accusation_status:thomas-lied-about-poisoning:false", nodeId: "apology_acknowledged_opening" },
            { condition: "has_claim:waiter-kane-at-poisoning-reconsidered", nodeId: "reconsidered_testimony_opening" },
            { condition: "has_claim:waiter-kane-at-poisoning-v2", nodeId: "revised_testimony_opening" },
            { condition: "has_claim:waiter-kane-at-poisoning", nodeId: "testimony_given_opening" },
            { condition: "npc_action_received:joe-reassures-thomas-after-threat", nodeId: "supported_opening" }
        ],
        nodes: {
            accused_after_revision_opening: {
                speaker: "npc",
                text: "Вы назвали меня лжецом, когда я исправил показания. Прежде чем спрашивать о Кейне снова, скажите: вы действительно считаете, что я специально обманул вас?",
                mood: "hurt",
                answers: [
                    {
                        text: "Нет. Я обвинил тебя без доказательств. Мне жаль. Я официально снимаю обвинение.",
                        nextNode: "apology_not_forgiven",
                        tone: "reassuring",
                        resolveAccusation: {
                            id: "thomas-lied-about-poisoning",
                            outcome: "false",
                            reason: "Детектив признал, что добровольное уточнение показаний не доказывает намеренную ложь."
                        },
                        report: {
                            id: "detective-retracted-thomas-lie-accusation",
                            kind: "detective_behavior",
                            networkPropagation: true,
                            targetNpcId: "waiter",
                            sourceName: "Томас",
                            text: "Детектив признал, что зря обвинил меня во лжи, и снял обвинение. Доверять ему снова пока трудно."
                        }
                    },
                    { text: "Я не готов снять обвинение.", nextNode: "end_waiter_guarded", tone: "cold" }
                ]
            },
            apology_not_forgiven: {
                speaker: "npc",
                text: "Хорошо, что вы это признали. Но мои слова уже обсуждали за моей спиной. Я не могу сразу снова вам доверять. Проверьте факты и не заставляйте меня выбирать удобную для вас версию.",
                mood: "guarded",
                innerThought: "Извинение исправило запись об обвинении, но доверие и готовность говорить не восстанавливаются мгновенно.",
                answers: [
                    { text: "Я проверю всё независимо. Не буду давить на тебя.", nextNode: "end_waiter_guarded", tone: "calm" }
                ]
            },
            apology_acknowledged_opening: {
                speaker: "npc",
                text: "Я помню, что вы сняли обвинение. Спасибо за это. Но мне всё ещё трудно говорить с вами после того, что произошло. Давайте пока придерживаться проверенных фактов.",
                mood: "guarded",
                answers: [
                    {
                        text: "Джо организовал для твоей матери временное безопасное место. Ты убедился, что она там?",
                        nextNode: "family_safety_confirmed",
                        tone: "calm",
                        condition: "all:hasInsight:joe_arranged_safe_lodging&hasInsight:full_confession_kane&not:hasInsight:thomas_family_protected&not:hasInsight:thomas_family_address_exposed",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "После раскрытия первого укрытия Джо нашёл новое. Ты подтвердил переезд матери?",
                        nextNode: "family_safety_reconfirmed",
                        tone: "calm",
                        condition: "all:hasInsight:thomas_family_address_exposed&hasInsight:joe_relocated_family_after_leak&not:hasInsight:thomas_family_protected",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Вернёмся к твоим действующим показаниям, без предположений.",
                        nextNode: "revised_testimony_opening",
                        tone: "calm",
                        condition: "has_claim:waiter-kane-at-poisoning-v2"
                    },
                    {
                        text: "Расскажи только о том, что видел после нашего прошлого разговора.",
                        nextNode: "reconsidered_testimony_opening",
                        tone: "calm",
                        condition: "has_claim:waiter-kane-at-poisoning-reconsidered"
                    },
                    { text: "Согласен. Не буду требовать большего, чем ты видел.", nextNode: "end_waiter_guarded", tone: "calm" }
                ]
            },
            reconsidered_testimony_opening: {
                speaker: "npc",
                text: "Я уже объяснил, что после угрозы сказал больше, чем могу подтвердить. Я помню Кейна у столика, но не стану утверждать, будто видел сам момент отравления.",
                mood: "guarded",
                answers: [
                    {
                        text: "Джо организовал для твоей матери временное безопасное место. Ты убедился, что она там?",
                        nextNode: "family_safety_confirmed",
                        tone: "calm",
                        condition: "all:hasInsight:joe_arranged_safe_lodging&hasInsight:full_confession_kane&not:hasInsight:thomas_family_protected&not:hasInsight:thomas_family_address_exposed",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "После раскрытия первого укрытия Джо нашёл новое. Ты подтвердил переезд матери?",
                        nextNode: "family_safety_reconfirmed",
                        tone: "calm",
                        condition: "all:hasInsight:thomas_family_address_exposed&hasInsight:joe_relocated_family_after_leak&not:hasInsight:thomas_family_protected",
                        hiddenWhenUnavailable: true
                    },
                    { text: "Почему ты изменил показания после нашего разговора?", nextNode: "revision_under_pressure_reason", tone: "calm" },
                    { text: "Я учту уточнение. Спасибо, Томас.", nextNode: "end_waiter_guarded", tone: "reassuring" },
                    { text: "В журнале телефонной станции отмечен запрос. Ты видел Кейна у телефона?", nextNode: "telephone_record_scope", tone: "calm", condition: "all:hasItem:telephone_exchange_slip&not:has_visited_node:telephone_record_scope", hiddenWhenUnavailable: true }
                ]
            },
            revised_testimony_opening: {
                speaker: "npc",
                text: "Детектив, я уже уточнил показания после фотографии. Я видел Кейна рядом со столиком, но не видел, как порошок попал в стакан. Я не стану снова говорить, будто видел больше.",
                mood: "guarded",
                answers: [
                    {
                        text: "Джо организовал для твоей матери временное безопасное место. Ты убедился, что она там?",
                        nextNode: "family_safety_confirmed",
                        tone: "calm",
                        condition: "all:hasInsight:joe_arranged_safe_lodging&hasInsight:full_confession_kane&not:hasInsight:thomas_family_protected&not:hasInsight:thomas_family_address_exposed",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "После раскрытия первого укрытия Джо нашёл новое. Ты подтвердил переезд матери?",
                        nextNode: "family_safety_reconfirmed",
                        tone: "calm",
                        condition: "all:hasInsight:thomas_family_address_exposed&hasInsight:joe_relocated_family_after_leak&not:hasInsight:thomas_family_protected",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Если тебе трудно говорить после нашего прошлого разговора, давай уточним показания.",
                        nextNode: "testimony_reconsiders",
                        tone: "calm",
                        condition: "all:cooperation_state:reluctant&has_claim:waiter-kane-at-poisoning-v2",
                        hiddenWhenUnavailable: true
                    },
                    { text: "Что именно заставило тебя уточнить показания?", nextNode: "revision_photo_reason", tone: "calm" },
                    {
                        text: "Значит, раньше ты солгал мне и намеренно покрывал Кейна?",
                        nextNode: "unfounded_lie_accusation",
                        tone: "aggressive",
                        condition: "not:has_accusation:thomas-lied-about-poisoning",
                        hiddenWhenUnavailable: true,
                        cooperationDelta: -15,
                        accusation: { id: "thomas-lied-about-poisoning", text: "Детектив без доказательств обвинил Томаса в сознательной лжи после добровольного уточнения свидетельства." },
                        report: {
                            id: "detective-accused-thomas-after-correction",
                            kind: "detective_behavior",
                            networkPropagation: true,
                            targetNpcId: "waiter",
                            sourceName: "Томас",
                            text: "Когда я честно уточнил, что видел, детектив обвинил меня в умышленной лжи."
                        }
                    },
                    { text: "Спасибо за точность. Других вопросов пока нет.", nextNode: "end_waiter", tone: "reassuring" },
                    { text: "В журнале станции есть запись о запросе. Ты видел Кейна у телефона?", nextNode: "telephone_record_scope", tone: "calm", condition: "all:hasItem:telephone_exchange_slip&not:has_visited_node:telephone_record_scope", hiddenWhenUnavailable: true }
                ]
            },
            revision_under_pressure_reason: {
                speaker: "npc",
                text: "Вы сами пригрозили мне соучастием. Я боялся, что меня не отпустят к семье, если я не скажу то, что вы хотели услышать. Но Кейна рядом со столиком я действительно видел.",
                mood: "hurt",
                innerThought: "Давление могло исказить формулировку. Сам факт присутствия Кейна Томас не отрицает.",
                answers: [
                    { text: "Прости за давление. В деле останется только то, что ты можешь подтвердить.", nextNode: "end_waiter_guarded", tone: "reassuring", cooperationDelta: 6 },
                    { text: "Ты мог сказать об этом раньше.", nextNode: "end_waiter_guarded", tone: "cold" }
                ]
            },
            revision_photo_reason: {
                speaker: "npc",
                text: "На фотографии видно, когда Кейн стоял у стойки. Я восстановил порядок событий и понял, что перепутал момент у столика с тем, что случилось после. Я не хочу, чтобы из моей ошибки сделали доказательство убийства.",
                mood: "ashamed",
                innerThought: "Уточнение связано с восстановлением хронологии. Ошибка в восприятии ещё не доказывает умышленный обман.",
                answers: [
                    { text: "Это важно. Я проверю хронологию по независимым материалам.", nextNode: "end_waiter", tone: "reassuring", cooperationDelta: 4 },
                    { text: "Пока рано решать, кто лгал.", nextNode: "end_waiter", tone: "calm" }
                ]
            },
            telephone_record_scope: {
                speaker: "npc",
                text: "Нет, детектив. Я работал в зале. Я видел Кейна в баре, но не следил за телефонной будкой и не знаю, кто сделал запрос на станции. Не записывайте мои догадки как показания.",
                mood: "guarded",
                innerThought: "Документ фиксирует запрос станции, но Томас не может связать его с конкретным человеком. Нужен независимый источник о звонке.",
                answers: [
                    { text: "Понял. Отмечу границы того, что ты видел.", nextNode: "end_waiter", tone: "calm" }
                ]
            },
            unfounded_lie_accusation: {
                speaker: "npc",
                text: "Я пытаюсь исправить свою ошибку, а вы называете меня лжецом? Я не видел, как он подсыпал порошок. Больше я не хочу говорить без свидетеля.",
                mood: "hurt",
                innerThought: "Обвинение нанесло вред доверию, но не установило, что Томас лгал сознательно.",
                answers: [
                    { text: "Разговор окончен.", nextNode: "end_waiter_guarded", tone: "cold" }
                ]
            },
            testimony_given_opening: {
                speaker: "npc",
                text: "Я уже дал показания о Кейне, детектив. Мне страшно, но я готов уточнить то, что помню, если это поможет установить правду.",
                mood: "nervous",
                answers: [
                    {
                        text: "Джо организовал для твоей матери временное безопасное место. Ты убедился, что она там?",
                        nextNode: "family_safety_confirmed",
                        tone: "calm",
                        condition: "all:hasInsight:joe_arranged_safe_lodging&hasInsight:full_confession_kane&not:hasInsight:thomas_family_protected&not:hasInsight:thomas_family_address_exposed",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "После раскрытия первого укрытия Джо нашёл новое. Ты подтвердил переезд матери?",
                        nextNode: "family_safety_reconfirmed",
                        tone: "calm",
                        condition: "all:hasInsight:thomas_family_address_exposed&hasInsight:joe_relocated_family_after_leak&not:hasInsight:thomas_family_protected",
                        hiddenWhenUnavailable: true
                    },
                    { text: "Посмотри на фотографию: давай уточним, что именно ты видел.", nextNode: "protection_revision", tone: "calm", condition: "hasItem:bar_photo" },
                    {
                        text: "Я хочу вернуться к твоим прежним показаниям.",
                        nextNode: "testimony_reconsiders",
                        tone: "calm",
                        condition: "all:cooperation_state:reluctant&has_claim:waiter-kane-at-poisoning",
                        hiddenWhenUnavailable: true
                    },
                    { text: "Спасибо. Я проверю твои показания.", nextNode: "end_waiter", tone: "reassuring" },
                    { text: "В телефонном журнале есть время запроса. Ты видел, кто пользовался телефоном?", nextNode: "telephone_record_scope", tone: "calm", condition: "all:hasItem:telephone_exchange_slip&not:has_visited_node:telephone_record_scope", hiddenWhenUnavailable: true }
                ]
            },
            supported_opening: {
                speaker: "npc",
                text: "Джо поговорил со мной после смены. Я по-прежнему боюсь Кейна, но теперь хотя бы знаю, что не останусь один. Что вы хотели уточнить, детектив?",
                mood: "cautious",
                answers: [
                    {
                        text: "Джо организовал для твоей матери временное безопасное место. Ты убедился, что она там?",
                        nextNode: "family_safety_confirmed",
                        tone: "calm",
                        condition: "all:hasInsight:joe_arranged_safe_lodging&hasInsight:full_confession_kane&not:hasInsight:thomas_family_protected&not:hasInsight:thomas_family_address_exposed",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "После раскрытия первого укрытия Джо нашёл новое. Ты подтвердил переезд матери?",
                        nextNode: "family_safety_reconfirmed",
                        tone: "calm",
                        condition: "all:hasInsight:thomas_family_address_exposed&hasInsight:joe_relocated_family_after_leak&not:hasInsight:thomas_family_protected",
                        hiddenWhenUnavailable: true
                    },
                    { text: "Расскажи только то, что сам видел.", nextNode: "he_saw", tone: "calm", cooperationDelta: 3 },
                    { text: "Пока вопросов нет.", nextNode: "end_waiter", tone: "reassuring" }
                ]
            },
            greeting: {
                speaker: "npc",
                text: "Детектив? Я... я не знаю ничего. Я просто официант. Я разношу напитки.",
                mood: "scared",
                innerThought: "Он напуган. Кто-то угрожал ему?",
                answers: [
                    { text: "Томас, ты видел что-то в тот вечер. Расскажи мне.", nextNode: "he_saw", tone: "calm", cooperationDelta: 2 },
                    {
                        text: "Если ты скрываешь информацию — это соучастие.",
                        nextNode: "threat",
                        tone: "aggressive",
                        cooperationDelta: -12,
                        report: {
                            id: "detective-threatened-thomas",
                            kind: "detective_behavior",
                            networkPropagation: true,
                            targetNpcId: "waiter",
                            sourceName: "Томас",
                            text: "Детектив пригрозил обвинить меня в соучастии, когда я испугался рассказать правду.",
                        }
                    },
                    {
                        text: "Я считаю, что ты помог Кейну отравить Блэквуда. Ты соучастник.",
                        nextNode: "threat",
                        tone: "threatening",
                        cooperationDelta: -20,
                        accusation: { id: "thomas-complicity", text: "Детектив обвинил Томаса в соучастии с Кейном." },
                        report: {
                            id: "detective-accused-thomas-of-complicity",
                            kind: "detective_behavior",
                            networkPropagation: true,
                            targetNpcId: "waiter",
                            sourceName: "Томас",
                            text: "Детектив обвинил меня в соучастии с Кейном, хотя я был напуган и не помогал ему.",
                        }
                    },
                    {
                        text: "Я хочу вернуться к твоим прежним показаниям.",
                        nextNode: "testimony_reconsiders",
                        tone: "calm",
                        condition: "all:cooperation_state:reluctant&has_claim:waiter-kane-at-poisoning",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Я хочу вернуться к твоим прежним показаниям.",
                        nextNode: "testimony_reconsiders",
                        tone: "calm",
                        condition: "all:cooperation_state:reluctant&has_claim:waiter-kane-at-poisoning-v2",
                        hiddenWhenUnavailable: true
                    }                ]
            },

            he_saw: {
                speaker: "npc",
                text: "Я... я видел мужчину. В костюме. Он сидел у стойки. Когда женщина уронила пузырёк, он поднял его через сложенную салфетку и положил в карман.",
                mood: "scared",
                innerThought: "Ещё одно подтверждение! Кейн украл пузырёк.",
                givesInsight: "waiter_confirms_theft",
                answers: [
                    { text: "Ты видел, что было дальше?", nextNode: "what_next", tone: "calm" }
                ]
            },

            what_next: {
                speaker: "npc",
                text: "Да. Мужчина ненадолго выходил в коридор. Когда вернулся, дождался, пока бармен отвернётся, подошёл к столику жертвы и что-то ссыпал в стакан. Белый порошок. Я хотел крикнуть, но... испугался.",
                mood: "ashamed",
                innerThought: "Он видел момент отравления. И молчал из страха.",
                answers: [
                    { text: "Почему ты не рассказал это сразу?", nextNode: "why_silent", tone: "calm" }
                ]
            },

            why_silent: {
                speaker: "npc",
                text: "Потому что он... он посмотрел на меня. И сказал: «Ты ничего не видел, парень. Иначе твоя семья пострадает.» У меня мама больная. Я не мог рисковать.",
                mood: "crying",
                innerThought: "Кейн угрожал свидетелю. Это отягчает вину.",
                givesInsight: "kane_threatened_witness",
                answers: [
                    {
                        text: "Я обеспечу охрану твоей семьи и сделаю так, чтобы Кейн больше не мог вам угрожать. Обещаю. Но мне нужны официальные показания.",
                        nextNode: "protection",
                        tone: "reassuring",
                        trustDelta: 4,
                        pressureDelta: -8,
                        cooperationDelta: 20,
                        condition: "all:trust_at_least:53&pressure_below:15",
                        promise: {
                            id: "thomas-family-protection",
                            text: "Обеспечить безопасность семьи Томаса и лишить Кейна возможности угрожать им",
                            caseId: "case-002",
                            fulfillment: { type: "insight_gained", insightId: "thomas_family_protected" },
                            fulfilledTrustDelta: 6,
                            brokenTrustDelta: -8
                        }
                    },
                    {
                        text: "Я понимаю, что тебе страшно. Не стану давить. Вернёмся к этому, когда смогу обеспечить защиту.",
                        nextNode: "waiter_hesitates",
                        tone: "calm",
                        condition: "any:trust_below:53&pressure_at_least:15"
                    },
                    {
                        text: "Я ошибся. Ты не помогал Кейну. Прости, что обвинил тебя.",
                        nextNode: "end_waiter",
                        tone: "reassuring",
                        cooperationDelta: 16,
                        condition: "has_accusation:thomas-complicity",
                        resolveAccusation: {
                            id: "thomas-complicity",
                            outcome: "false",
                            reason: "Томас рассказал об угрозах Кейна; детектив признал обвинение ложным и извинился."
                        },
                        report: {
                            id: "detective-apologized-to-thomas",
                            kind: "detective_behavior",
                            networkPropagation: true,
                            targetNpcId: "waiter",
                            sourceName: "Томас",
                            text: "Детектив признал, что ошибочно обвинил меня в соучастии, и извинился.",
                        }
                    }
                ]
            },

            waiter_hesitates: {
                speaker: "npc",
                text: "Я хочу помочь, детектив. Но Кейн знает, где живёт моя мать. Пока я не буду уверен, что она в безопасности, я не смогу подписать показания.",
                mood: "scared",
                innerThought: "Томас не отказывается навсегда. Ему нужно доказать, что его семья защищена.",
                answers: [
                    { text: "Я вернусь, когда у меня будет официальный план защиты.", nextNode: "end_waiter", tone: "reassuring", pressureDelta: -3, cooperationDelta: 4 },
                    {
                        text: "Джо говорил с тобой после смены? Он не оставит тебя одного.",
                        nextNode: "joe_support",
                        tone: "reassuring",
                        condition: "cooperation_at_least:60"
                    }
                ]
            },

            joe_support: {
                speaker: "npc",
                text: "Да. Джо подошёл после смены и сказал, что не оставит меня одного. Я не ожидал, что он так за меня вступится. Это помогает, но мама всё ещё под угрозой. Пока я не буду уверен в её безопасности, подписывать подробные показания не могу.",
                mood: "relieved",
                innerThought: "Поддержка Джо действительно помогла Томасу, но не сняла угрозу его семье.",
                answers: [
                    { text: "Понимаю. Сначала решу вопрос с безопасностью твоей матери.", nextNode: "end_waiter", tone: "reassuring", cooperationDelta: 4 }
                ]
            },

            protection: {
                speaker: "npc",
                text: "Правда? Вы... вы можете? Спасибо. Я дам официальные показания. Я расскажу всё, что видел.",
                mood: "relieved",
                innerThought: "Томас наконец решился выступить свидетелем.",
                givesInsight: "waiter_saw_poisoning",
                claim: {
                    id: "waiter-kane-at-poisoning",
                    topic: "kane-presence-during-poisoning",
                    value: "present-at-bar-during-poisoning",
                    summary: "Томас видел, как Кейн вернулся к столику Блэквуда и подсыпал порошок",
                    sourceName: "Томас",
                    location: "Бар «У Джо»",
                    timeLabel: "Вечер отравления",
                    circumstances: "Официальное показание после согласования защиты семьи свидетеля"
                },
                answers: [
                    { text: "Посмотри на эту фотографию. Хочу уточнить твои показания.", nextNode: "protection_revision", tone: "direct", condition: "hasItem:bar_photo" },
                    { text: "Ты поступил правильно, Томас.", nextNode: "end_waiter", tone: "reassuring", cooperationDelta: 5 },
                    {
                        text: "Не вздумай менять показания, иначе обвиню тебя в соучастии.",
                        nextNode: "end_waiter",
                        tone: "threatening",
                        cooperationDelta: -25,
                        report: {
                            id: "detective-threatened-thomas-after-testimony",
                            kind: "detective_behavior",
                            networkPropagation: true,
                            targetNpcId: "waiter",
                            sourceName: "Томас",
                            text: "Детектив пригрозил мне после того, как я дал показания. Теперь я боюсь говорить с ним."
                        }
                    }
                ]
            },

            testimony_reconsiders: {
                speaker: "npc",
                text: "Я больше не могу подтверждать прежнюю формулировку. Я видел Кейна рядом со столиком, но не могу сказать, что видел, как он что-то подсыпал в стакан. После того разговора я испугался и сказал больше, чем мог подтвердить. Не хочу, чтобы мои слова снова использовали против меня.",
                mood: "withdrawn",
                innerThought: "Томас не утверждает, что Кейна не было. Он сужает показания до того, что готов подтвердить лично. Предыдущая версия остаётся в истории, но больше не считается его действующим заявлением.",
                claim: {
                    id: "waiter-kane-at-poisoning-reconsidered",
                    revisesActiveClaimTopic: true,
                    revisionReason: "Томас отказался подтверждать детали после давления и уточнил границы личного наблюдения.",
                    topic: "kane-presence-during-poisoning",
                    value: "near-victim-table-before-collapse",
                    summary: "Томас подтверждает, что видел Кейна рядом со столиком, но отказывается утверждать, что видел попадание порошка в стакан.",
                    sourceName: "Томас",
                    location: "Бар «У Джо»",
                    timeLabel: "Незадолго до ухудшения состояния Блэквуда",
                    circumstances: "Повторное показание после давления; свидетель обеспокоен безопасностью семьи.",
                    directObservation: true
                },
                answers: [
                    { text: "Я не буду заставлять тебя подтверждать то, чего ты не видел. Спасибо за уточнение.", nextNode: "end_waiter", tone: "reassuring", cooperationDelta: 8 },
                    { text: "Ты уже дал показания. Не меняй их.", nextNode: "end_waiter", tone: "threatening", cooperationDelta: -12 }
                ]
            },

            protection_revision: {
                speaker: "npc",
                text: "Теперь, когда я посмотрел на фотографию, я должен уточнить. Я видел Кейна возле столика незадолго до того, как Блэквуду стало плохо. Но сам момент, когда порошок попал в стакан, я не видел. Я испугался и тогда сказал больше, чем мог подтвердить.",
                mood: "ashamed",
                innerThought: "Томас не отказывается от того, что видел. Он уточняет границы собственного наблюдения.",
                claim: {
                    id: "waiter-kane-at-poisoning-v2",
                    revisesClaimId: "waiter-kane-at-poisoning",
                    revisionReason: "После изучения фотографии Томас уточнил временную последовательность и границы личного наблюдения.",
                    topic: "kane-presence-during-poisoning",
                    value: "near-victim-table-before-collapse",
                    summary: "Томас видел Кейна возле столика незадолго до ухудшения состояния Блэквуда, но не видел сам момент попадания порошка в стакан",
                    sourceName: "Томас",
                    location: "Бар «У Джо»",
                    timeLabel: "За несколько минут до ухудшения состояния",
                    circumstances: "Уточнение после изучения фотографии из бара",
                    directObservation: true
                },
                answers: [
                    { text: "Спасибо, что уточнил. Так показания будут точнее.", nextNode: "end_waiter", tone: "reassuring", cooperationDelta: 8 }
                ]
            },

            threat: {
                speaker: "npc",
                text: "Соучастие? Нет! Я не... я просто боялся! Пожалуйста, не арестовывайте меня!",
                mood: "panicked",
                innerThought: "Перегнул. Нужно успокоить.",
                answers: [
                    { text: "Успокойся. Я не обвиняю тебя. Давай поговорим спокойно.", nextNode: "he_saw", tone: "reassuring", cooperationDelta: 12 },
                    { text: "Я могу сделать так, что тебе станет ещё страшнее.", nextNode: "waiter_hesitates", tone: "threatening", cooperationDelta: -20 }
                ]
            },

            family_safety_reconfirmed: {
                speaker: "npc",
                text: "Первое укрытие действительно стало небезопасным. Но мы переехали по новому адресу Джо; я сам отвёз маму и сейчас с ней связался. Кейн не знает, где мы. Пожалуйста, больше никому не рассказывайте о нас.",
                mood: "guarded",
                innerThought: "Первоначальная утечка не исчезла из истории, но новое подтверждение позволяет оценить текущую безопасность.",
                givesInsight: "thomas_family_protected",
                answers: [
                    { text: "Адрес останется конфиденциальным. Прости за прежнюю ошибку.", nextNode: "end_waiter_guarded", tone: "reassuring" }
                ]
            },
            family_safety_confirmed: {
                speaker: "npc",
                text: "Да. Я сам проводил маму в место, которое нашёл Джо, и только что говорил с ней. Кейн не знает адреса, а Джо договорился, кто будет проверять её состояние. Теперь я могу сказать, что она в безопасности. Спасибо, что вы не ограничились признанием Кейна.",
                mood: "relieved",
                innerThought: "Это подтверждение фактической защиты со слов члена семьи, а не вывод из признания подозреваемого.",
                givesInsight: "thomas_family_protected",
                answers: [
                    { text: "Хорошо. Продолжим расследование без риска для твоей семьи.", nextNode: "end_waiter_guarded", tone: "reassuring" }
                ]
            },
            end_waiter_guarded: {
                speaker: "npc",
                text: "Я уже сказал всё, что могу подтвердить. Надеюсь, теперь мои слова запишут точно.",
                mood: "guarded",
                endDialogue: true
            },
            end_waiter: {
                speaker: "npc",
                text: "Спасибо, детектив. Я больше не буду молчать. Обещаю.",
                mood: "grateful",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_WAITER);
