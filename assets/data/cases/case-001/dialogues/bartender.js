const DIALOGUE_BARTENDER = {
    id: "dialogue-bartender",
    npcId: "bartender",
    type: "face_to_face",
    
    context: {
        title: "Бар «У Джо»",
        text: "Вы заходите в бар. Джаз льётся из музыкального автомата. Бармен Джо поднимает глаза и кивает вам.",
        mood: "noir"
    },

    tree: {
        start: "greeting",
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Детектив. Рад видеть. Хотя... учитывая обстоятельства, визит, наверное, не для удовольствия. Виски? За счёт заведения.",
                mood: "friendly",
                innerThought: "Джо пытается быть дружелюбным. Посмотрим, что он знает.",
                answers: [
                    { text: "Я по делу, Джо. Расскажи мне о Блэквуде.", nextNode: "about_blackwood" },
                    { text: "Виски подождёт. Сначала — информация.", nextNode: "business_first" },
                    { text: "Наливай. И рассказывай всё, что знаешь.", nextNode: "drink_and_talk" }
                ]
            },

            about_blackwood: {
                speaker: "npc",
                text: "Блэквуд... Хороший клиент. Всегда заказывал двойной виски. Неразбавленный. Говорил, что лёд портит вкус жизни.",
                mood: "nostalgic",
                innerThought: "«Лёд портит вкус жизни». Интересная фраза.",
                answers: [
                    { text: "Когда ты видел его в последний раз?", nextNode: "last_night" },
                    { text: "Он был один?", nextNode: "not_alone" }
                ]
            },

            last_night: {
                speaker: "npc",
                text: "Позавчера. Он пришёл около девяти вечера. Выглядел... взволнованным. Заказал двойной. Потом ещё один. И ещё.",
                mood: "concerned",
                innerThought: "Он был взволнован. Пил много. Что-то готовилось.",
                answers: [
                    { text: "К нему кто-то подходил?", nextNode: "visitors" }
                ]
            },

            visitors: {
                speaker: "npc",
                text: "Сначала — женщина. Молодая. Блондинка. Они сидели в углу, спорили. Она плакала. Он был... жесток. Словами. Я слышал, как он сказал: «Ты была просто игрушкой».",
                mood: "angry",
                innerThought: "Он унижал её. Публично. Это жестоко.",
                givesInsight: "public_humiliation",
                answers: [
                    { text: "Кто эта женщина?", nextNode: "who_was_she" },
                    { text: "Что было потом?", nextNode: "after_woman" }
                ]
            },

            who_was_she: {
                speaker: "npc",
                text: "Горничная из отеля. Мэри, кажется. Она часто приходила с ним. Они выглядели как пара. Но в тот вечер... всё было иначе.",
                mood: "sad",
                innerThought: "Мэри. Подтверждение от Джо.",
                givesInsight: "mary_regular_visitor",
                answers: [
                    { text: "Она ушла после ссоры?", nextNode: "she_left" }
                ]
            },

            she_left: {
                speaker: "npc",
                text: "Да. В слезах. Он даже не посмотрел ей вслед. Просто заказал ещё виски.",
                mood: "angry",
                innerThought: "Хладнокровие. Он не любил её.",
                answers: [
                    { text: "Кто-то ещё подходил к нему?", nextNode: "other_visitor" }
                ]
            },

            other_visitor: {
                speaker: "npc",
                text: "Через час пришёл мужчина. Высокий, в чёрной шляпе. Они говорили тихо. Я слышал только обрывки: «билеты», «завтра», «она не должна знать».",
                mood: "suspicious",
                innerThought: "Билеты. Завтра. Она не должна знать. План побега?",
                givesInsight: "escape_plan_overheard",
                answers: [
                    { text: "Ты знаешь этого мужчину?", nextNode: "know_man" }
                ]
            },

            know_man: {
                speaker: "npc",
                text: "Нет. Но он был... элегантный. Дорогое пальто. Чувствовалось, что у него есть деньги. И власть.",
                mood: "impressed",
                innerThought: "Элиас? Или кто-то ещё?",
                answers: [
                    { text: "Спасибо, Джо. Ты очень помог.", nextNode: "end_talk" }
                ]
            },

            not_alone: {
                speaker: "npc",
                text: "Нет. С ним была женщина. Горничная. И позже — какой-то мужчина в шляпе. Они о чём-то договаривались.",
                answers: [
                    { text: "О чём договаривались?", nextNode: "overheard_details" }
                ]
            },

            overheard_details: {
                speaker: "npc",
                text: "Я не подслушивал. Но когда проходил мимо, услышал: «Поезд в полночь. Не опаздывай.»",
                mood: "serious",
                innerThought: "Поезд в полночь. Он планировал уехать.",
                givesInsight: "midnight_train",
                answers: [
                    { text: "Это важно. Спасибо, Джо.", nextNode: "end_talk" }
                ]
            },

            business_first: {
                speaker: "npc",
                text: "Как скажете, детектив. Я весь во внимании.",
                answers: [
                    { text: "Расскажи о вечере исчезновения.", nextNode: "last_night" }
                ]
            },

            drink_and_talk: {
                speaker: "npc",
                text: "Отличный выбор. Держите. И слушайте.",
                mood: "friendly",
                answers: [
                    { text: "Я слушаю.", nextNode: "last_night" }
                ]
            },

            after_woman: {
                speaker: "npc",
                text: "Он сидел один. Пил. Потом пришёл тот мужчина в шляпе. Они поговорили, и Блэквуд ушёл.",
                answers: [
                    { text: "Куда ушёл?", nextNode: "where_he_went" }
                ]
            },

            where_he_went: {
                speaker: "npc",
                text: "В отель, наверное. Это было около полуночи.",
                answers: [
                    { text: "Спасибо, Джо.", nextNode: "end_talk" }
                ]
            },

            end_talk: {
                speaker: "npc",
                text: "Детектив... будьте осторожны. В этом городе правда бывает опаснее лжи.",
                mood: "serious",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_BARTENDER);