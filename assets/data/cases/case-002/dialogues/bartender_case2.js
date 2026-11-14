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
                verifiedRestitution: { id: 'joe-confirmed-thomas-family-safety',
                    priorMemoryTag: 'player_threatened', requiresInsight: 'thomas_family_protected' },
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
                        text: "Лора сообщила вам, что удалось проверить в истории с обвинением Томаса?",
                        nextNode: "joe_lora_thomas_check_update", tone: "calm",
                        condition: "npc_action_received:lora-updates-joe-after-thomas-check",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Лора не смогла установить личность посетителя. Проверьте записи о визитах за тот вечер.",
                        nextNode: "joe_finds_visitor_log",
                        tone: "calm",
                        condition: "all:hasInsight:unknown_visitor_unverified&not:hasInsight:joe_found_inspection_entry",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Лора сказала, что я объявил личность посетителя установленной. Что вы об этом думаете?",
                        nextNode: "joe_challenges_visitor_overclaim",
                        tone: "cautious",
                        condition: "all:heard_rumor:detective-overstated-visitor-identity&not:hasInsight:joe_challenged_overstated_visitor_identity",
                        hiddenWhenUnavailable: true,
                        revealSocialEvents: {
                            reportId: "detective-overstated-visitor-identity",
                            eventTypes: ["delivered"],
                            fromNpcId: "journalist",
                            toNpcId: "bartender"
                        }
                    },
                    {
                        text: "Я привёл Илью Руденко. Посмотрите на него: это тот человек, которого вы видели?",
                        nextNode: "joe_identifies_different_visitor",
                        tone: "procedural",
                        condition: "all:hasInsight:joe_found_inspection_entry&hasInsight:inspection_cancellation_record&hasInsight:rudenko_denies_visit&hasInsight:rudenko_agreed_to_identification",
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
                        condition: "prior_case_memory:player_threatened"
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
                        condition: "prior_case_memory:player_reassured"
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
                    },
                    {
                        text: "Джо, вы мне уже помогали. Согласитесь добровольно ещё раз сверить время смены?",
                        nextNode: "joe_earned_help",
                        tone: "reassuring",
                        cooperationDelta: 7,
                        condition: "all:prior_case_memory:player_reassured&long_term_trust_at_least:50&not:has_visited_node:joe_earned_help",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Я ошибся с личностью посетителя. Поможете мне исправить сказанное Томасу?",
                        nextNode: "joe_offer_visitor_repair",
                        tone: "reassuring",
                        condition: "all:long_term_memory:player_doubled_down_on_visitor_overclaim&not:long_term_memory:player_retracted_visitor_overclaim&not:has_visited_node:joe_offer_visitor_repair",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Джо, мы уже не раз проверяли факты без давления. Можете помочь сверить записи ещё раз?",
                        nextNode: "joe_recognizes_consistent_care",
                        tone: "calm",
                        condition: "all:long_term_pattern:consistent_support&long_term_trust_at_least:50&not:has_visited_node:joe_recognizes_consistent_care",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Я понимаю, что неоднократно давил на вас. Можем начать с проверяемых фактов?",
                        nextNode: "joe_remembers_repeated_pressure",
                        tone: "calm",
                        condition: "all:long_term_pattern:repeated_pressure&not:has_visited_node:joe_remembers_repeated_pressure",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Назовите мне адрес, где сейчас укрывается мать Томаса. Я веду дело.",
                        nextNode: "joe_refuses_family_location",
                        tone: "direct",
                        condition: "all:hasInsight:joe_arranged_safe_lodging&not:has_visited_node:joe_refuses_family_location",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Томас сам обратился к вам после предупреждения?",
                        nextNode: "joe_received_thomas_contingency_request",
                        tone: "cautious",
                        condition: "all:npc_action_received:thomas-asks-joe-for-shelter-contingency&not:hasInsight:thomas_family_protected&not:has_visited_node:joe_received_thomas_contingency_request",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Вы успели узнать у сержанта Миллса, как организовать защиту свидетеля?",
                        nextNode: "joe_checked_protection_procedure",
                        tone: "procedural",
                        condition: "all:npc_protection_consultation:joe-asks-mills-about-witness-protection:written_request_required&not:hasInsight:thomas_family_protected&not:has_visited_node:joe_checked_protection_procedure",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Миллс ответил на ваш запрос о защите свидетеля?",
                        nextNode: "joe_received_mills_guidance",
                        tone: "procedural",
                        condition: "all:npc_protection_consultation:joe-asks-mills-about-witness-protection:procedure_guidance&not:hasInsight:thomas_family_protected&not:has_visited_node:joe_received_mills_guidance",
                        hiddenWhenUnavailable: true
                    }
                ]
            },

            joe_received_mills_guidance: {
                speaker: "npc",
                text: "Миллс объяснил, какие документы и подтверждения угрозы нужны для официальной защиты. Он согласился подсказать порядок подачи, потому что знает меня давно. Но это только консультация: сотрудников для охраны не выделяли, адрес я не раскрывал, а Томас ещё должен подтвердить безопасность матери.",
                mood: "thoughtful",
                innerThought: "Джо получил процессуальную консультацию благодаря доверительному контакту. Она не является одобрением охраны или доказательством эвакуации.",
                answers: [
                    { text: "Подготовим подтверждённые материалы для официального запроса.", nextNode: "greeting", tone: "procedural" },
                    { text: "Сначала уточню у Томаса, что происходит с его матерью.", nextNode: "end_bartender_guarded", tone: "calm" }
                ]
            },

            joe_checked_protection_procedure: {
                speaker: "npc",
                text: "Я сам связался с Миллсом. Он сказал, что без письменного запроса и оснований не может даже начать согласование защиты. Я не называл адрес и местонахождение матери Томаса. Придётся оформить материалы официально, а не считать наш разговор распоряжением об охране. И переезд ещё никто не подтвердил.",
                mood: "thoughtful",
                innerThought: "Обращение Джо подтверждено его собственным действием, но формальная процедура не равна обеспеченной безопасности.",
                answers: [
                    { text: "Верно. Проверим исполнение, прежде чем говорить о безопасности.", nextNode: "greeting", tone: "calm" },
                    { text: "Спасибо за инициативу. Я свяжусь с Томасом.", nextNode: "end_bartender_guarded", tone: "reassuring" }
                ]
            },

            joe_received_thomas_contingency_request: {
                speaker: "npc",
                text: "Да. После моего предупреждения Томас сам написал и попросил помочь проверить запасной план для матери. Я могу связаться с людьми, которым доверяю, но пока мы только обсуждаем варианты. Ни нового адреса, ни подтверждения переезда у меня для вас нет. Томас сам должен убедиться, что мать добралась до безопасного места.",
                mood: "worried",
                innerThought: "Самостоятельная просьба Томаса — реальное действие, но не новая улика и не доказательство завершённой эвакуации.",
                answers: [
                    { text: "Понимаю. Не стану считать подготовку состоявшимся переездом.", nextNode: "greeting", tone: "calm" },
                    { text: "Спасибо. Проверю безопасность вместе с Томасом.", nextNode: "end_bartender_guarded", tone: "reassuring" }
                ]
            },

            joe_refuses_family_location: {
                speaker: "npc",
                text: "Нет, детектив. Я помог семье найти укрытие, но это не даёт мне права раскрывать их адрес даже вам. После прежней утечки я тем более не стану рисковать. Если вам нужно проверить безопасность, поговорите с Томасом напрямую: он сам решит, что может подтвердить. Мои показания о вечере в баре остаются в силе.",
                mood: "guarded",
                innerThought: "Джо защищает частную жизнь семьи независимо от доверия к детективу. Он не сообщает адрес и не утверждает, что переезд уже завершён.",
                answers: [
                    { text: "Вы правы. Попрошу Томаса лично подтвердить, что семья в безопасности.", nextNode: "greeting", tone: "calm", memoryImportance: 2, memoryTags: ["player_respected_family_privacy"] },
                    { text: "Мне нужны только ваши показания о баре.", nextNode: "retell", tone: "calm" }
                ]
            },

            joe_recognizes_consistent_care: {
                speaker: "npc",
                text: "Вы не впервые возвращаетесь к фактам и стараетесь не превращать догадки в обвинения. Я это помню по разным расследованиям. Могу сверить собственные записи смены, но чужие личные сведения и неподтверждённые имена не передам. Доверие помогает говорить, а не заменяет документы.",
                mood: "thoughtful",
                answers: [
                    { text: "Так и поступим. Сначала проверяемые записи.", nextNode: "retell", tone: "calm", cooperationDelta: 4 },
                    { text: "Спасибо. Вернусь с официальным запросом.", nextNode: "end_bartender2", tone: "calm" }
                ]
            },

            joe_remembers_repeated_pressure: {
                speaker: "npc",
                text: "Вы давили на меня не один раз и не в одном деле. Одной спокойной фразой это не исправить. Я отвечу на вопросы о том, что видел лично, но не стану подтверждать удобные вам версии или раскрывать сведения о сотрудниках.",
                mood: "guarded",
                answers: [
                    { text: "Понимаю. Буду проверять факты без давления.", nextNode: "retell", tone: "calm" },
                    { text: "Вернусь позже.", nextNode: "end_bartender_guarded", tone: "calm" }
                ]
            },

            joe_offer_visitor_repair: {
                speaker: "npc",
                text: "Вы действительно хотите исправить запись, а не просто успокоить Томаса? Тогда скажите прямо: мы не знаем, кто приходил, и семья не должна полагаться на вашу прежнюю уверенность. Я могу передать ему ваши слова, но он сам решит, доверять ли вам.",
                mood: "cautious",
                answers: [
                    {
                        text: "Да. Мой прежний вывод был необоснованным. Передайте Томасу, что я его отзываю.",
                        nextNode: "greeting",
                        tone: "reassuring",
                        trustDelta: 2,
                        memoryImportance: 3,
                        memoryTags: ["player_retracted_visitor_overclaim"],
                        memorySummary: "Детектив открыто отозвал прежнее уверенное утверждение о личности посетителя. Джо согласился передать исправление Томасу.",
                        report: {
                            id: "joe-reports-detective-visitor-correction",
                            kind: "detective_behavior",
                            networkPropagation: true,
                            sourceName: "Джо",
                            text: "Детектив лично признал при мне, что его уверенное утверждение о личности посетителя было необоснованным, и попросил передать Томасу исправление. Проверка личности посетителя всё ещё требуется."
                        }
                    },
                    {
                        text: "Я пока не готов официально отзывать свой вывод.",
                        nextNode: "greeting",
                        tone: "cautious"
                    }
                ]
            },

            joe_earned_help: {
                speaker: "npc",
                text: "Я могу ещё раз сверить время своей смены и записи, которые делал сам. Но я не отдам вам личные сведения сотрудников и не стану утверждать, кто приходил, пока это не проверят по независимым документам.",
                mood: "thoughtful",
                answers: [
                    { text: "Спасибо. Сверим записи официально и без поспешных обвинений.", nextNode: "retell", tone: "calm" },
                    { text: "Договорились. Вернусь с официальным запросом.", nextNode: "end_bartender2", tone: "calm" }
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
            joe_identifies_different_visitor: {
                speaker: "npc",
                text: "Нет. Это не тот человек. Я хорошо рассмотрел посетителя: он был моложе, ниже и говорил иначе. Я не узнаю в Руденко мужчину, который спрашивал о Томасе. Теперь у нас есть две независимые вещи: инспектор действительно был назначен, но его визит отменили; и я лично не опознаю его как посетителя. Это исключает Руденко как человека у стойки, но не говорит, кто именно приходил и кто его послал.",
                mood: "serious",
                innerThought: "Я могу уверенно сказать, что это не тот человек, которого видел. Но у меня нет оснований назвать незнакомца человеком Кейна или обвинять кого-то ещё.",
                givesInsight: "joe_rules_out_rudenko",
                answers: [
                    {
                        text: "Опишите неизвестного подробнее. Я хочу проверить его маршрут, не делая выводов о личности.",
                        nextNode: "joe_describes_unknown_visitor",
                        tone: "procedural",
                        condition: "not:hasInsight:unknown_visitor_description",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Зафиксируем, что Руденко не был посетителем. Личность неизвестного оставим открытым вопросом.",
                        nextNode: "greeting",
                        tone: "calm",
                        trustDelta: 2,
                        memorySummary: "Детектив провёл очное опознание с Джо и зафиксировал, что Руденко не был неизвестным посетителем; личность самого посетителя осталась неустановленной.",
                        memoryTags: ["player_completed_cautious_identification"],
                        memoryImportance: 3
                    },
                    {
                        text: "Значит, это точно был человек Кейна.",
                        nextNode: "greeting",
                        tone: "defensive",
                        trustDelta: -3,
                        memorySummary: "После того как Джо исключил Руденко, детектив без доказательств приписал неизвестного посетителя Кейну.",
                        memoryTags: ["player_assumed_kane_link_without_evidence"],
                        memoryImportance: 3
                    }
                ]
            },
            joe_describes_unknown_visitor: {
                speaker: "npc",
                text: "Он был заметно моложе Руденко, невысокий — примерно мне до плеча. Тёмное пальто, узкие плечи. Когда он снял перчатку, я заметил на правой руке светлую повязку или бинт. Говорил тихо, без явного акцента. Он спросил, когда Томас вернётся, и ушёл пешком в сторону остановки. Я не видел его лица достаточно долго, чтобы уверенно опознать по фотографии.",
                mood: "focused",
                innerThought: "Я могу описать то, что запомнил. Но если детектив превратит эти детали в готовый портрет, он рискует подогнать под него первого встречного.",
                givesInsight: "unknown_visitor_description",
                answers: [
                    {
                        text: "Спасибо. Я проверю остановку и путевые листы. Пока это только описание свидетеля.",
                        nextNode: "greeting",
                        tone: "calm",
                        trustDelta: 1,
                        memorySummary: "Джо дал описание неизвестного посетителя: невысокий молодой мужчина в тёмном пальто, с повязкой на правой руке. Детектив не назвал это опознанием.",
                        memoryTags: ["player_recorded_description_cautiously"],
                        memoryImportance: 2
                    }
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
            joe_challenges_visitor_overclaim: {
                speaker: "npc",
                text: "Лора написала мне. Вы решили, что незнакомец точно был инспектором, потому что в журнале есть похожая запись, а в графике — назначенный визит. Но я не могу подтвердить, что это был один и тот же человек. Я видел посетителя, а не его документы. Не просите меня превратить совпадение в показание. И не объявляйте семью Томаса вне опасности только потому, что одна версия выглядит правдоподобно.",
                mood: "guarded",
                innerThought: "Детектив торопится закрыть вопрос. Я не стану подстраивать память под его вывод.",
                givesInsight: "joe_challenged_overstated_visitor_identity",
                claim: {
                    id: "joe-reports-lora-visitor-warning",
                    topic: "visitor-identity-rumor-source",
                    value: "lora-told-joe-about-detective-overclaim",
                    summary: "Джо говорит, что Лора сообщила ему о поспешном выводе детектива; сам разговор Лоры с детективом Джо не слышал",
                    sourceName: "Джо, бармен",
                    location: "Бар «У Джо»",
                    timeLabel: "После сообщения Лоры",
                    circumstances: "Пересказ полученного сообщения, не независимое наблюдение",
                    directObservation: false,
                    referencesRumorIds: ["detective-overstated-visitor-identity"]
                },
                answers: [
                    {
                        text: "Вы правы. Я оставлю личность посетителя неподтверждённой.",
                        nextNode: "greeting",
                        tone: "reassuring",
                        trustDelta: 2,
                        memorySummary: "Детектив принял возражение Джо и отказался выдавать вероятную версию за установленную личность.",
                        memoryTags: ["player_corrected_visitor_overclaim"],
                        memoryImportance: 2
                    },
                    {
                        text: "Мне достаточно совпадения. Не усложняйте расследование.",
                        nextNode: "greeting",
                        tone: "defensive",
                        trustDelta: -3,
                        cooperationDelta: -3,
                        memorySummary: "Детектив настоял на неподтверждённой идентификации посетителя вопреки осторожности Джо.",
                        memoryTags: ["player_doubled_down_on_visitor_overclaim"],
                        memoryImportance: 3,
                        report: {
                            id: "joe-warns-thomas-of-visitor-overclaim",
                            kind: "detective_behavior",
                            networkPropagation: true,
                            sourceName: "Джо",
                            text: "Детектив после проверки Лоры продолжил утверждать, что личность посетителя установлена. Я возразил: ни запись, ни график не доказывают, кто стоял у стойки. Это моя оценка разговора, а не новые сведения о посетителе."
                        }
                    }
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
            joe_lora_thomas_check_update: {
                speaker: "npc",
                text: "Да, Лора написала мне после разговора с Томасом. Говорит, независимого подтверждения обвинению пока нет. Это не доказывает, что версия ложная, но и повторять её как факт я не собираюсь. Томасу и так хватило неприятностей.",
                mood: "guarded",
                answers: [
                    { text: "Согласен. Проверю первичные свидетельства, прежде чем делать выводы.", nextNode: "greeting", tone: "calm" },
                    { text: "Спасибо, что рассказали. На сегодня всё.", nextNode: "end_bartender_guarded", tone: "calm" }
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
