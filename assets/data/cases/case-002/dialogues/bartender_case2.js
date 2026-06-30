const DIALOGUE_BARTENDER_CASE2 = {
    id: "dialogue-bartender-case2",
    npcId: "bartender",
    type: "face_to_face",
    
    context: {
        title: "Бар «У Джо» — дневная смена",
        text: "Днём бар выглядит иначе. Солнечный свет пробивается сквозь пыльные окна, обнажая потёртости на мебели. Джо протирает стойку — кажется, он делает это всегда.",
        mood: "tired"
    },

    tree: {
        start: "greeting",
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Снова вы, детектив. После того, что случилось... я думал закрыть бар. Но жизнь продолжается. Что я могу для вас сделать?",
                mood: "tired",
                innerThought: "Он устал. Но хочет помочь.",
                answers: [
                    { text: "Расскажите мне о вечере отравления ещё раз. Медленно.", nextNode: "retell", tone: "calm" },
                    { text: "Вы знали, что Кейн купил цианид в аптеке?", nextNode: "about_kane", tone: "direct", condition: "hasInsight:kane_bought_cyanide" }
                ]
            },

            retell: {
                speaker: "npc",
                text: "Хорошо. Я расскажу всё, что помню. Был вечер пятницы — самый busy день. Народу много. Блэквуд пришёл около восьми, сел за свой обычный столик. Заказал двойной виски.",
                mood: "focused",
                innerThought: "Он вспоминает детали. Хорошо.",
                answers: [
                    { text: "Кто подходил к нему?", nextNode: "visitors" }
                ]
            },

            visitors: {
                speaker: "npc",
                text: "Первой — Анна. Его бывшая. Они ругались. Она кричала: «Ты разрушил мою жизнь!» Он отвечал спокойно, даже холодно: «Ты сама её разрушила». Она ушла в слезах.",
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
                text: "Нет. Он положил его в карман. Анна не заметила — она как раз отвернулась к телефону. А через пятнадцать минут Блэквуду стало плохо.",
                mood: "grave",
                innerThought: "Кейн украл пузырёк. И использовал его.",
                givesInsight: "kane_stole_vial",
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