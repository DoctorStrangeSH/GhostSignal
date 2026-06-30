const DIALOGUE_WIFE = {
    id: "dialogue-wife",
    npcId: "wife_blackwood",
    type: "face_to_face",
    
    context: {
        title: "Особняк Блэквудов",
        text: "Вы поднимаетесь по мраморной лестнице. Дверь открывает горничная — не Мэри, другая. Она провожает вас в гостиную, где вас ждёт Виктория Блэквуд.",
        mood: "cold"
    },

    tree: {
        start: "greeting",
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Детектив. Проходите. Я ждала вас раньше.",
                mood: "cold",
                innerThought: "Она ждала. Значит, ей есть что сказать.",
                answers: [
                    { text: "Миссис Блэквуд, расскажите о вашем муже.", nextNode: "about_husband", tone: "calm" },
                    { text: "Вы знали о его романе с горничной?", nextNode: "direct_question", tone: "direct" }
                ]
            },

            about_husband: {
                speaker: "npc",
                text: "Джонатан... Он был хорошим мужем. Первые пять лет. Потом деньги изменили его. Он стал холодным. Отстранённым. Я думала, это стресс. А потом узнала правду.",
                mood: "cold",
                innerThought: "Она говорит о нём в прошедшем времени. Как о мёртвом.",
                answers: [
                    { text: "Как вы узнали о Мэри?", nextNode: "how_she_found_out" }
                ]
            },

            how_she_found_out: {
                speaker: "npc",
                text: "Я наняла частного детектива. Он предоставил мне фотографии. Отчёты. Распечатки звонков. Я знала о каждом их шаге.",
                mood: "cold",
                innerThought: "Она следила за ними. Хладнокровно.",
                givesInsight: "wife_knew_everything",
                answers: [
                    { text: "Почему вы не противостояли ему?", nextNode: "why_no_confrontation" }
                ]
            },

            why_no_confrontation: {
                speaker: "npc",
                text: "А зачем? Чтобы он ушёл к ней? Нет. Я ждала. Я знала, что он вернётся. Они всегда возвращаются. А если нет... что ж, я была готова к этому.",
                mood: "cold",
                innerThought: "Она говорит о муже как о собственности. Не о человеке.",
                givesInsight: "wife_possessive",
                answers: [
                    { text: "Вы угрожали ему?", nextNode: "threats_question" }
                ]
            },

            threats_question: {
                speaker: "npc",
                text: "Угрожала? Нет. Я просто сказала ему, что если он уйдёт — я расскажу всем о его долгах. О его махинациях. О том, что его бизнес — финансовая пирамида. Он бы потерял всё.",
                mood: "cold",
                innerThought: "Шантаж. Она держала его на крючке.",
                givesInsight: "wife_blackmail",
                answers: [
                    { text: "Это серьёзный мотив, миссис Блэквуд.", nextNode: "motive_response" }
                ]
            },

            motive_response: {
                speaker: "npc",
                text: "Мотив? Детектив, если бы я хотела его убить — я бы сделала это чисто. Без следов. Я не стала бы марать руки о какую-то горничную.",
                mood: "arrogant",
                innerThought: "Она не отрицает способность убить. Только метод.",
                answers: [
                    { text: "Где вы были в ночь исчезновения?", nextNode: "alibi" }
                ]
            },

            alibi: {
                speaker: "npc",
                text: "Здесь. Одна. Смотрела на дождь и думала о том, как моя жизнь превратилась в дешёвый детективный роман.",
                mood: "wistful",
                innerThought: "Алиби нет. Но и прямых улик тоже.",
                answers: [
                    { text: "Спасибо за откровенность.", nextNode: "end_wife" }
                ]
            },

            direct_question: {
                speaker: "npc",
                text: "Прямо в лоб? Хорошо. Да, я знала. Я знала о Мэри, об их планах побега, о билетах. Я знала всё.",
                mood: "cold",
                innerThought: "Она не отрицает. Это необычно.",
                answers: [
                    { text: "И вы позволили этому продолжаться?", nextNode: "why_no_confrontation" }
                ]
            },

            end_wife: {
                speaker: "npc",
                text: "Детектив... найдите его. Живым или мёртвым. Я имею право знать. И когда найдёте — скажите ему, что я его простила. Хотя он этого не заслужил.",
                mood: "melancholic",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_WIFE);