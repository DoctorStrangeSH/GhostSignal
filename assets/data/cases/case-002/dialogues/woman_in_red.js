const DIALOGUE_WOMAN_IN_RED = {
    id: "dialogue-woman-in-red",
    npcId: "woman_in_red",
    type: "face_to_face",

    context: {
        title: "Женщина в красном",
        text: "Вы замечаете её в углу бара. Рыжие волосы, алое платье. Она смотрит на вас и улыбается — как будто ждала.",
        mood: "mysterious"
    },

    tree: {
        start: "greeting",
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Детектив. Наконец-то. Я думала, вы никогда не подойдёте. Присаживайтесь.",
                mood: "mysterious",
                innerThought: "Она ждала меня. Это настораживает.",
                answers: [
                    { text: "Кто вы такая?", nextNode: "identity" },
                    { text: "Вы были здесь в ночь отравления.", nextNode: "that_night" }
                ]
            },

            identity: {
                speaker: "npc",
                text: "Меня зовут Ева. Ева Ковалёва. Анна — моя старшая сестра.",
                mood: "serious",
                innerThought: "Сестра! Вот это поворот.",
                givesInsight: "sisters_revealed",
                answers: [
                    { text: "Вы покрывали сестру?", nextNode: "covering_sister" }
                ]
            },

            covering_sister: {
                speaker: "npc",
                text: "Я пыталась её защитить. Анна... она сломлена. После развода она стала тенью самой себя. Я боялась, что она сделает что-то с собой.",
                mood: "sad",
                innerThought: "Она просто заботилась о сестре.",
                answers: [
                    { text: "Расскажите, что вы видели тем вечером.", nextNode: "that_night" }
                ]
            },

            that_night: {
                speaker: "npc",
                text: "Я следила за Анной. Боялась оставлять её одну. Она сидела у стойки, держала какой-то пузырёк. Я хотела подойти, но тут появился мужчина в костюме.",
                mood: "serious",
                innerThought: "Кейн. Снова он.",
                answers: [
                    { text: "Мужчина в костюме? Кейн?", nextNode: "describe_man" }
                ]
            },

            describe_man: {
                speaker: "npc",
                text: "Да. Он сел рядом с Анной. Они не разговаривали. Но я видела, как он смотрел на пузырёк. А потом Анна отвернулась — и пузырёк исчез.",
                mood: "suspicious",
                innerThought: "Кейн взял пузырёк. Это подтверждение!",
                givesInsight: "rival_took_vial_confirmed",
                answers: [
                    { text: "Вы видели, как он взял его?", nextNode: "saw_him" }
                ]
            },

            saw_him: {
                speaker: "npc",
                text: "Нет. Было темно. Но я видела, как он что-то прятал в карман. А через минуту бармен налил Блэквуду виски.",
                mood: "suspicious",
                innerThought: "Совпадение? Не думаю.",
                answers: [
                    { text: "Почему вы не рассказали это сразу?", nextNode: "why_silent" }
                ]
            },

            why_silent: {
                speaker: "npc",
                text: "Потому что боялась. Кейн — влиятельный человек. А я — никто. Но теперь, когда вы здесь... я готова свидетельствовать.",
                mood: "brave",
                innerThought: "Она готова дать показания. Это прорыв.",
                givesInsight: "witness_ready",
                answers: [
                    { text: "Спасибо, Ева. Вы очень помогли.", nextNode: "end_eva" }
                ]
            },

            end_eva: {
                speaker: "npc",
                text: "Детектив... позаботьтесь об Анне. Она не убийца. Она просто запуталась. Как и все мы в этом городе.",
                mood: "wistful",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_WOMAN_IN_RED);