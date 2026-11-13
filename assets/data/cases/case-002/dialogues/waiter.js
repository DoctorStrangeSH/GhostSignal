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
        nodes: {
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
                    }
,
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
                            fulfillment: { type: "insight_gained", insightId: "full_confession_kane" },
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