const DIALOGUE_RIVAL_FULL = {
    id: "dialogue-rival-full",
    npcId: "business_rival",
    type: "face_to_face",

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
                text: "Значит, вы всё-таки докопались. Я думал, у меня есть ещё пара дней. Но вы оказались... эффективным.",
                mood: "defeated",
                innerThought: "Он не отрицает. Это упрощает дело.",
                answers: [
                    { text: "Расскажите, зачем вы это сделали.", nextNode: "why", tone: "calm" },
                    { text: "Вы убили человека. И подставили невиновную.", nextNode: "accusation", tone: "aggressive" }
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
                text: "Я купил цианид. Для себя — на случай, если не смогу жить с позором. Но в баре я увидел Анну. Она уронила пузырёк со снотворным. И я подумал: «Вот он — шанс». Я подменил содержимое.",
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