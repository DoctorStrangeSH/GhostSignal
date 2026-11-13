const DIALOGUE_RIVAL_FULL = {
    id: "dialogue-rival-full",
    npcId: "business_rival",
    type: "face_to_face",

    contradictionReactions: {
        "kane-presence-during-poisoning": {
            text: "Вы сопоставили мои слова с показаниями Томаса. Хорошо, я вернулся в зал после короткого выхода в коридор. Но это ещё не доказывает, что я подходил к столику Блэквуда. Томас мог видеть только то, что хотел увидеть.",
            mood: "defensive",
            givesInsight: "kane_alibi_broken",
            answers: [
                { text: "Томас видел, как вы подсыпали порошок в стакан.", nextNode: "caught_in_lie", tone: "direct", condition: "lie_exposed:kane-left-before-poisoning" },
                { text: "Почему вы солгали о том, что уехали из бара?", nextNode: "why", tone: "direct", condition: "pressure_at_least:20" },
                { text: "Я проверю ваши слова. Продолжим.", nextNode: "why", tone: "calm" }
            ]
        }
    },

    evidenceReactions: {
        bar_photo: {
            text: "Фотография доказывает лишь то, что я был в баре. Она не показывает, что я подходил к столику Блэквуда.",
            mood: "defensive"
        },
        poison_vial: {
            text: "Я не обязан объяснять вам каждый пузырёк. Вы строите обвинение на догадках.",
            mood: "cold"
        },
        prescription_copy: {
            text: "Рецепт подтверждает покупку снотворного Анной. Но он ничего не говорит о том, кто подменил содержимое.",
            mood: "guarded"
        }
    },

    context: {
        title: "Допросная",
        text: "Кейн сидит за столом в допросной. Без галстука. Без лоска. Просто уставший человек, на которого давят стены.",
        mood: "tense"
    },

    tree: {
        start: "confrontation",
        nodes: {
            confrontation: {
                speaker: "npc",
                text: "Я ушёл из бара до того, как Блэквуду стало плохо. К его столику я не подходил. Вы можете проверить время — я уже был в коридоре.",
                mood: "defeated",
                innerThought: "Он заранее подготовил алиби. Нужно сопоставить его слова с показаниями свидетелей.",
                claim: {
                    id: "kane-left-before-poisoning",
                    topic: "kane-presence-during-poisoning",
                    value: "left-before-poisoning",
                    summary: "Кейн утверждает, что покинул бар до отравления и не подходил к столику",
                    sourceName: "Виктор Кейн",
                    location: "Офис Виктора Кейна",
                    timeLabel: "Допрос после сбора свидетельств",
                    circumstances: "Алиби изложено в ответ на вопрос о его присутствии в баре",
                    deception: { deliberate: true, motive: "self_preservation" }
                },
                answers: [
                    { text: "Томас видел, как вы вернулись к столику и подсыпали порошок.", nextNode: "caught_in_lie", tone: "direct", condition: "hasInsight:waiter_saw_poisoning" },
                    { text: "Расскажите, зачем вы это сделали.", nextNode: "why", tone: "calm" },
                    { text: "Вы пытались убить человека. И подставили невиновную.", nextNode: "accusation", tone: "aggressive" }
                ]
            },

            caught_in_lie: {
                speaker: "npc",
                text: "Томас? Он молодой и напуганный. Вы уверены, что правильно его поняли? Я вышел в коридор, но к столику Блэквуда не возвращался.",
                mood: "defensive",
                innerThought: "Кейн пытается обесценить показания свидетеля. Его алиби больше не выглядит надёжным.",
                givesInsight: "kane_alibi_broken",
                answers: [
                    { text: "Бармен тоже видел, как вы забрали пузырёк.", nextNode: "why", tone: "direct", condition: "hasInsight:kane_stole_vial" },
                    { text: "Тогда объясните, что вы сделали с пузырьком.", nextNode: "final_decision", tone: "direct", condition: "hasInsight:kane_stole_vial" },
                    { text: "Я проверю ваши слова. Продолжим.", nextNode: "why", tone: "calm" }
                ]
            },

            why: {
                speaker: "npc",
                text: "Зачем? Вы правда хотите знать? Не для протокола — для себя?",
                mood: "bitter",
                innerThought: "Он хочет исповедаться. Нужно слушать.",
                answers: [
                    { text: "Я слушаю.", nextNode: "confession" }
                ]
            },

            confession: {
                speaker: "npc",
                text: "Блэквуд... он уничтожил меня. Не бизнес — бизнес я восстановил. Он уничтожил моё имя. На суде он сказал, что я мошенник. Что я ворую у партнёров. Мои дети плакали. Моя жена не выходила из дома месяц.",
                mood: "angry",
                innerThought: "Месть за репутацию. Это глубже, чем деньги.",
                answers: [
                    { text: "И вы решили убить его?", nextNode: "murder_decision" }
                ]
            },

            murder_decision: {
                speaker: "npc",
                text: "Нет. Сначала я хотел просто выиграть суд. И я выиграл. Но он... он прислал мне письмо. «Поздравляю с победой, Виктор. Только кому ты теперь нужен? Твоя репутация уничтожена. Ты — ничто.»",
                mood: "cold",
                innerThought: "Письмо. Блэквуд спровоцировал его.",
                givesInsight: "blackwood_provoked_kane",
                answers: [
                    { text: "И тогда вы решились?", nextNode: "final_decision" }
                ]
            },

            final_decision: {
                speaker: "npc",
                text: "Я купил цианид под видом реактива для лаборатории. Сначала держал его для себя — на случай, если не смогу жить с позором. В баре я увидел, как Анна уронила пузырёк со снотворным. Я поднял его через салфетку, а потом в уборной перелил туда цианид из своей склянки. Вернулся и дождался, когда Блэквуд отвлечётся. После первого глотка он понял, что происходит. Я оставил пузырёк под столом — хотел, чтобы полиция нашла только отпечатки Анны.",
                mood: "cold",
                innerThought: "Импульсивное решение. Или спланированное?",
                answers: [
                    { text: "Вы понимаете, что погубили не только его, но и себя?", nextNode: "realization" }
                ]
            },

            realization: {
                speaker: "npc",
                text: "Понимаю. Теперь — понимаю. Тогда я думал только о мести. О том, как увидеть страх в его глазах. И я увидел. Когда он сделал первый глоток — он посмотрел на меня. И понял.",
                mood: "haunted",
                innerThought: "Он видел страх жертвы. Это будет преследовать его.",
                answers: [
                    { text: "Этого достаточно для признания.", nextNode: "formal_confession" }
                ]
            },

            formal_confession: {
                speaker: "npc",
                text: "Да. Я признаю. Я, Виктор Кейн, украл пузырёк Анны Ковалёвой, заменил снотворное на цианид и подсыпал яд в стакан Джонатана Блэквуда. Я действовал один. Анна невиновна.",
                mood: "resigned",
                innerThought: "Полное признание. Дело закрыто.",
                givesInsight: "full_confession_kane",
                answers: [
                    { text: "Спасибо за честность.", nextNode: "end_rival" }
                ]
            },

            accusation: {
                speaker: "npc",
                text: "Невиновную? Анна? Она сама принесла яд в бар! Если бы не она — ничего бы не случилось!",
                mood: "angry",
                innerThought: "Он перекладывает вину. Типично.",
                answers: [
                    { text: "Она принесла снотворное для себя. Вы это знаете.", nextNode: "why" }
                ]
            },

            end_rival: {
                speaker: "npc",
                text: "Детектив... когда выйдете отсюда — позвоните моей жене. Скажите, что я... что мне жаль. Что я люблю её. И детей. Скажете?",
                mood: "broken",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_RIVAL_FULL);