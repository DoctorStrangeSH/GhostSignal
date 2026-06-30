const DIALOGUE_HOUSEKEEPER = {
    id: "dialogue-housekeeper",
    npcId: "housekeeper",
    type: "call",
    
    context: {
        title: "Звонок горничной",
        text: "Вы набираете номер Мэри. Долгие гудки. Наконец трубку снимают. Голос тихий, испуганный.",
        mood: "tense"
    },

    tree: {
        start: "first_contact",
        nodes: {
            first_contact: {
                speaker: "npc",
                text: "Алло? Кто это? Если вы из полиции... мне нечего вам сказать. Я просто горничная. Я ничего не знаю.",
                mood: "anxious",
                innerThought: "Она напугана. Отрицает всё с порога. Это подозрительно.",
                answers: [
                    { 
                        text: "Успокойтесь, Мэри. Я просто хочу задать несколько вопросов о мистере Блэквуде.", 
                        nextNode: "calm_down",
                        tone: "calm"
                    },
                    { 
                        text: "Не лгите мне. Я знаю, что вы были в номере 304 в ночь исчезновения.", 
                        nextNode: "caught_lie",
                        tone: "aggressive",
                        condition: "hasInsight:maid_evening_visit"
                    }
                ]
            },

            calm_down: {
                speaker: "npc",
                text: "Хорошо... Спрашивайте. Но я правда ничего не знаю. Я просто убираю номера. Это всё.",
                mood: "nervous",
                innerThought: "Она согласилась говорить. Но всё ещё защищается.",
                answers: [
                    { text: "Расскажите о ваших отношениях с мистером Блэквудом.", nextNode: "relationship_question" },
                    { text: "Где вы были в ночь исчезновения?", nextNode: "alibi_question" },
                    { text: "Что вы знаете о странном запахе в номере?", nextNode: "smell_question", condition: "hasInsight:sweet_smell" }
                ]
            },

            relationship_question: {
                speaker: "npc",
                text: "Отношения? Он был постояльцем. Я убирала его номер. Он был... вежлив. Всегда оставлял чаевые. Иногда мы разговаривали. О погоде. О жизни.",
                mood: "nervous",
                innerThought: "Она тщательно подбирает слова. Что-то скрывает.",
                answers: [
                    { text: "Вы были ближе, чем просто горничная и постоялец. Я знаю о вас.", nextNode: "confront_relationship", condition: "hasItem:torn_photo" },
                    { text: "О чём вы разговаривали?", nextNode: "conversations" }
                ]
            },

            confront_relationship: {
                speaker: "npc",
                text: "...Откуда у вас это фото? Откуда? Кто вам дал?",
                mood: "shocked",
                innerThought: "Попал в точку. Она в панике.",
                answers: [
                    { text: "Это не важно. Важно то, что вы скрываете правду.", nextNode: "truth_starts" }
                ]
            },

            truth_starts: {
                speaker: "npc",
                text: "Вы правы. Я... я любила его. Джонатан был не просто постояльцем. Он был... всем. Мы планировали уехать вместе. Начать новую жизнь.",
                mood: "sad",
                innerThought: "Она признаётся. Это прорыв.",
                givesInsight: "mary_loved_him",
                answers: [
                    { text: "Но он передумал, верно?", nextNode: "he_changed_mind" }
                ]
            },

            he_changed_mind: {
                speaker: "npc",
                text: "Да. За день до исчезновения. Он сказал, что не может бросить жену. Что между нами всё кончено. Что я была просто... развлечением.",
                mood: "crying",
                innerThought: "Он использовал её. Мотив для мести.",
                givesInsight: "blackwood_betrayal",
                answers: [
                    { text: "И что вы сделали, когда он сказал это?", nextNode: "what_she_did" }
                ]
            },

            what_she_did: {
                speaker: "npc",
                text: "Я... я пришла в ярость. Я кричала. Я плакала. Я угрожала ему. Сказала, что он пожалеет. Что я расскажу его жене.",
                mood: "angry",
                innerThought: "Она угрожала ему. Но угрозы — это ещё не преступление.",
                answers: [
                    { text: "Вы угрожали ему. А потом он исчез.", nextNode: "timeline_match" }
                ]
            },

            timeline_match: {
                speaker: "npc",
                text: "Я не убивала его! Клянусь! Я ушла из номера в 22:00. Он был жив. Он просто... просто спал. Я думала, он напился.",
                mood: "desperate",
                innerThought: "Спал? Или был без сознания от снотворного?",
                answers: [
                    { text: "Он спал? Или вы дали ему снотворное?", nextNode: "sedative_question", condition: "hasInsight:sedative_clue" }
                ]
            },

            sedative_question: {
                speaker: "npc",
                text: "Снотворное? Я... я не хотела причинить ему вред. Я просто хотела, чтобы он замолчал. Чтобы перестал говорить эти ужасные вещи.",
                mood: "breaking",
                innerThought: "Она признаётся в использовании снотворного!",
                givesInsight: "mary_used_sedative",
                answers: [
                    { text: "Мэри, что вы сделали с ним?", nextNode: "full_confession" }
                ]
            },

            full_confession: {
                speaker: "npc",
                text: "Я подсыпала снотворное в его стакан. Он выпил и уснул. А потом... потом я вывезла его в тележке для белья. Я не убивала! Он был жив! Я просто хотела, чтобы он исчез из моей жизни. Так же, как я исчезла из его.",
                mood: "crying",
                innerThought: "Вот оно. Полное признание.",
                givesInsight: "mary_full_confession",
                answers: [
                    { text: "Где он сейчас, Мэри?", nextNode: "where_is_he" }
                ]
            },

            where_is_he: {
                speaker: "npc",
                text: "В подвале отеля. Там есть старая кладовка. Я приносила ему еду. Он был в порядке. Просто спал. А потом... потом я испугалась и не знала, что делать.",
                mood: "crying",
                innerThought: "Блэквуд в подвале! Он жив!",
                answers: [
                    { text: "Мэри, вы совершили ошибку. Но он жив. Это главное.", nextNode: "resolution" }
                ]
            },

            resolution: {
                speaker: "npc",
                text: "Я знаю. Я всё испортила. Я просто... я так сильно его любила. А он меня — нет. И эта боль... она была невыносима.",
                mood: "broken",
                innerThought: "Трагическая история. Любовь и безумие.",
                answers: [
                    { text: "Я вызову полицию. Вам нужна помощь, Мэри.", nextNode: "end_call_arrest" }
                ]
            },

            caught_lie: {
                speaker: "npc",
                text: "Откуда вы... Ладно. Да, я была там. Но я не делала ничего плохого!",
                mood: "angry",
                innerThought: "Она защищается агрессией. Нужно надавить.",
                answers: [
                    { text: "Тогда почему вы солгали?", nextNode: "why_lie" }
                ]
            },

            why_lie: {
                speaker: "npc",
                text: "Потому что вы бы не поверили мне! Потому что все думают, что это сделала я!",
                mood: "desperate",
                answers: [
                    { text: "Расскажите правду, и я поверю.", nextNode: "truth_starts" }
                ]
            },

            alibi_question: {
                speaker: "npc",
                text: "Я была дома. Одна. У меня нет свидетелей. Но это правда.",
                mood: "nervous",
                answers: [
                    { text: "Без свидетелей это сложно проверить.", nextNode: "no_alibi" }
                ]
            },

            no_alibi: {
                speaker: "npc",
                text: "Я знаю. Но я говорю правду. Я не убивала его. Я бы никогда не смогла...",
                mood: "sad",
                answers: [
                    { text: "Тогда помогите мне найти того, кто это сделал.", nextNode: "truth_starts" }
                ]
            },

            smell_question: {
                speaker: "npc",
                text: "Запах? Да, я чувствовала его. Это был освежитель воздуха. Новый. Я сама его купила по просьбе мистера Блэквуда.",
                mood: "nervous",
                innerThought: "Она говорит об освежителе. Но портье сказал, что это не он.",
                answers: [
                    { text: "Портье говорит, что это был не освежитель.", nextNode: "caught_lie" }
                ]
            },

            conversations: {
                speaker: "npc",
                text: "Он рассказывал о своей жене. О том, как она его не понимает. О том, как он устал от всего. Он казался... потерянным.",
                mood: "sad",
                answers: [
                    { text: "И вы решили его спасти?", nextNode: "truth_starts" }
                ]
            },

            end_call_arrest: {
                speaker: "npc",
                text: "Спасибо... что выслушали. Я готова. Пусть будет то, что будет.",
                mood: "resigned",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_HOUSEKEEPER);