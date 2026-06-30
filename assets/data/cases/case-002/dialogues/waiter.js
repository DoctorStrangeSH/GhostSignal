const DIALOGUE_WAITER = {
    id: "dialogue-waiter",
    npcId: "waiter",
    type: "face_to_face",
    
    context: {
        title: "Подсобка бара",
        text: "Вы находите Томаса в подсобке. Он nervously крутит полотенце и избегает зрительного контакта. Ему не больше двадцати.",
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
                    { text: "Томас, ты видел что-то в тот вечер. Расскажи мне.", nextNode: "he_saw", tone: "calm" },
                    { text: "Если ты скрываешь информацию — это соучастие.", nextNode: "threat", tone: "aggressive" }
                ]
            },

            he_saw: {
                speaker: "npc",
                text: "Я... я видел мужчину. В костюме. Он сидел у стойки. Когда женщина уронила пузырёк, он поднял его и положил в карман.",
                mood: "scared",
                innerThought: "Ещё одно подтверждение! Кейн украл пузырёк.",
                givesInsight: "waiter_confirms_theft",
                answers: [
                    { text: "Ты видел, что было дальше?", nextNode: "what_next" }
                ]
            },

            what_next: {
                speaker: "npc",
                text: "Да. Когда бармен отвернулся, мужчина подошёл к столику жертвы. Он что-то сыпал в стакан. Белый порошок. Я хотел крикнуть, но... испугался.",
                mood: "ashamed",
                innerThought: "Он видел момент отравления. И молчал из страха.",
                givesInsight: "waiter_saw_poisoning",
                answers: [
                    { text: "Почему ты не рассказал это сразу?", nextNode: "why_silent" }
                ]
            },

            why_silent: {
                speaker: "npc",
                text: "Потому что он... он посмотрел на меня. И сказал: «Ты ничего не видел, парень. Иначе твоя семья пострадает.» У меня мама больная. Я не мог рисковать.",
                mood: "crying",
                innerThought: "Кейн угрожал свидетелю. Это отягчает вину.",
                givesInsight: "kane_threatened_witness",
                answers: [
                    { text: "Теперь ты в безопасности. Я защищу тебя.", nextNode: "protection" }
                ]
            },

            protection: {
                speaker: "npc",
                text: "Правда? Вы... вы можете? Спасибо. Я дам показания. Я расскажу всё, что видел.",
                mood: "relieved",
                innerThought: "Ещё один свидетель против Кейна.",
                answers: [
                    { text: "Ты поступил правильно, Томас.", nextNode: "end_waiter" }
                ]
            },

            threat: {
                speaker: "npc",
                text: "Соучастие? Нет! Я не... я просто боялся! Пожалуйста, не арестовывайте меня!",
                mood: "panicked",
                innerThought: "Перегнул. Нужно успокоить.",
                answers: [
                    { text: "Успокойся. Просто расскажи правду.", nextNode: "he_saw" }
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