const DIALOGUE_ANNA = {
    id: "dialogue-ex-wife",
    npcId: "ex_wife",
    type: "call",
    
    context: {
        title: "Звонок Анне Ковалёвой",
        text: "Вы набираете номер бывшей жены. Гудки. Она отвечает после пятого — голос уставший, с нотками раздражения.",
        mood: "tense"
    },

    tree: {
        start: "greeting",
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Кто это? Если вы журналист — я вешаю трубку. Если полиция — я уже всё сказала.",
                mood: "angry",
                innerThought: "Она на взводе. Нужно быть осторожным.",
                answers: [
                    { text: "Я детектив. Расследую отравление в баре. Вы были там.", nextNode: "was_there", tone: "calm" },
                    { text: "Анна, я знаю, что вы принесли яд в бар.", nextNode: "direct_accusation", tone: "aggressive", condition: "hasItem:poison_vial" }
                ]
            },

            was_there: {
                speaker: "npc",
                text: "Да, я была там. И что? Это преступление — выпить в баре, где бывает твой бывший муж?",
                mood: "defensive",
                innerThought: "Она защищается. Но не отрицает присутствие.",
                answers: [
                    { text: "Вы подходили к его столику. О чём вы говорили?", nextNode: "conversation" },
                    { text: "Расскажите, что произошло тем вечером.", nextNode: "her_story" }
                ]
            },

            her_story: {
                speaker: "npc",
                text: "Я пришла выпить. Одна. Он сидел за своим обычным столиком. Увидел меня и скривился. Сказал: «Анна, уходи. Ты портишь мне вечер.»",
                mood: "hurt",
                innerThought: "Он унизил её публично. Это ранит даже после развода.",
                givesInsight: "public_humiliation_anna",
                answers: [
                    { text: "И вы ушли?", nextNode: "left_or_stayed" }
                ]
            },

            left_or_stayed: {
                speaker: "npc",
                text: "Нет. Я осталась. Села у стойки и заказала мартини. Я имею право быть где хочу.",
                mood: "defiant",
                innerThought: "Она осталась назло ему. Гордость.",
                answers: [
                    { text: "У вас был с собой пузырёк. Что в нём было?", nextNode: "vial_question", condition: "hasItem:poison_vial" }
                ]
            },

            vial_question: {
                speaker: "npc",
                text: "Пузырёк? Я... Откуда вы знаете?",
                mood: "shocked",
                innerThought: "Она не ожидала, что я знаю о пузырьке.",
                answers: [
                    { text: "Мы нашли его. С вашими отпечатками.", nextNode: "fingerprints" }
                ]
            },

            fingerprints: {
                speaker: "npc",
                text: "Хорошо. Да, это мой пузырёк. Но я не травила его. Я хотела... я хотела отравить себя.",
                mood: "breaking",
                innerThought: "Вот оно. Она признаётся. Но мотив — суицид, а не убийство.",
                givesInsight: "suicide_plan",
                answers: [
                    { text: "Отравить себя? Почему?", nextNode: "why_suicide" }
                ]
            },

            why_suicide: {
                speaker: "npc",
                text: "Потому что он уничтожил меня! Он забрал всё — мою молодость, мою веру в людей, мою способность любить. Я думала, что без него моя жизнь кончена.",
                mood: "crying",
                innerThought: "Глубокая депрессия. Она действительно страдает.",
                answers: [
                    { text: "Но яд попал в его стакан. Как?", nextNode: "how_poison_transferred" }
                ]
            },

            how_poison_transferred: {
                speaker: "npc",
                text: "Я не знаю! Я сидела у стойки, держала пузырёк в руке. Потом заказала ещё мартини. Бармен отвлёк меня разговором. А когда я обернулась — пузырька не было.",
                mood: "desperate",
                innerThought: "Кто-то взял пузырёк, пока она отвлеклась. Конкурент?",
                givesInsight: "someone_took_vial",
                answers: [
                    { text: "Кто-то взял его? Кто?", nextNode: "who_took" }
                ]
            },

            who_took: {
                speaker: "npc",
                text: "Там был мужчина в костюме. Конкурент Джонатана. Он сидел рядом. Я видела, как он смотрел на пузырёк.",
                mood: "suspicious",
                innerThought: "Кейн! Он был рядом.",
                givesInsight: "rival_near_vial",
                answers: [
                    { text: "Вы уверены? Это серьёзное обвинение.", nextNode: "almost_sure" }
                ]
            },

            almost_sure: {
                speaker: "npc",
                text: "На 90%. Но у меня нет доказательств. Только мои слова.",
                mood: "frustrated",
                answers: [
                    { text: "Я проверю. Спасибо, Анна.", nextNode: "end_anna" }
                ]
            },

            direct_accusation: {
                speaker: "npc",
                text: "Что? Нет! Я не... Откуда у вас эта информация?",
                mood: "panicked",
                innerThought: "Она в панике. Самое время надавить.",
                answers: [
                    { text: "Расскажите правду, или будет хуже.", nextNode: "fingerprints" }
                ]
            },

            conversation: {
                speaker: "npc",
                text: "Я сказала ему: «Ты разрушил мою жизнь». А он ответил: «Ты сама её разрушила, Анна. Ты всегда была слабой». Я хотела ударить его. Но сдержалась.",
                mood: "angry",
                innerThought: "Он спровоцировал её. Но она сдержалась.",
                answers: [
                    { text: "И вы просто ушли?", nextNode: "left_after" }
                ]
            },

            left_after: {
                speaker: "npc",
                text: "Да. Пошла к стойке и заказала выпить. Я не хотела устраивать сцену.",
                answers: [
                    { text: "Что было дальше?", nextNode: "vial_question", condition: "hasItem:poison_vial" }
                ]
            },

            end_anna: {
                speaker: "npc",
                text: "Детектив... найдите того, кто это сделал. Я не ангел. Но я не убийца. Я просто сломленная женщина, которая хотела забыть.",
                mood: "broken",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_ANNA);