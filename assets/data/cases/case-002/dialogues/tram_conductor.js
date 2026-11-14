// ============================================
 // ДИАЛОГ — КОНДУКТОР НОЧНОГО ТРАМВАЯ
 // ============================================

const DIALOGUE_TRAM_CONDUCTOR = {
    id: "dialogue-tram-conductor",
    npcId: "tram_conductor",
    type: "face_to_face",

    context: {
        title: "Трамвайное депо",
        text: "В депо пахнет мокрой одеждой, угольной пылью и машинным маслом. Дежурный кондуктор заканчивает смену и сверяет путевые листы.",
        mood: "quiet"
    },

    tree: {
        start: "greeting",
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Ночная смена была шумной. Если вы ищете конкретного пассажира, мне понадобится описание и хотя бы примерное время. Лица всех подряд я не запоминаю.",
                mood: "wary",
                answers: [
                    {
                        text: "Джо описал посетителя бара: мужчина ниже инспектора Руденко, моложе его, говорил негромко. Он мог уйти после разговора с барменом.",
                        nextNode: "checks_route_book",
                        tone: "calm",
                        condition: "hasInsight:unknown_visitor_description",
                        hiddenWhenUnavailable: true
                    },
                    { text: "Спасибо. Пока больше ничего не нужно.", nextNode: "end_conductor", tone: "calm" }
                ]
            },

            checks_route_book: {
                speaker: "npc",
                text: "В путевом листе есть отметка о задержке трамвая №4 у остановки возле бара около 22:15. Я помню пассажира, который сел там один: невысокий мужчина в тёмном пальто, с перевязанной или испачканной правой рукой. Он не разговаривал с другими и вышел у старой текстильной улицы. Но я не могу утверждать, что это тот самый человек из бара: я не видел его внутри и не знаю его имени.",
                mood: "thoughtful",
                innerThought: "Время и направление могут помочь проверить маршрут. Сходство по общему описанию — ещё не опознание.",
                givesInsight: "tram_passenger_route_corroboration",
                spawnsItem: "tram_route_entry",
                answers: [
                    {
                        text: "Запишите время и остановки. Это независимая зацепка, но не опознание.",
                        nextNode: "end_conductor",
                        tone: "procedural",
                        trustDelta: 1,
                        memorySummary: "Детектив получил путевую запись о пассажире у бара, но не стал выдавать совпадение по описанию за установленную личность.",
                        memoryTags: ["player_kept_route_lead_unconfirmed"],
                        memoryImportance: 2
                    },
                    {
                        text: "Значит, это точно был посетитель бара.",
                        nextNode: "overstates_route_match",
                        tone: "defensive",
                        trustDelta: -2,
                        memorySummary: "Детектив объявил пассажира трамвая тем же человеком, хотя кондуктор не видел его в баре.",
                        memoryTags: ["player_overstated_route_match"],
                        memoryImportance: 2
                    }
                ]
            },

            overstates_route_match: {
                speaker: "npc",
                text: "Нет. Я сказал, что описание отчасти совпадает и что пассажир сел рядом с баром. Я не видел, откуда он вышел, и не могу связать его с вашим свидетелем. В путевом листе нет имени. Не превращайте маршрутную зацепку в опознание.",
                mood: "firm",
                answers: [
                    { text: "Понял. Зафиксируем только то, что подтверждает запись.", nextNode: "end_conductor", tone: "calm" }
                ]
            },

            end_conductor: {
                speaker: "npc",
                text: "Могу подтвердить время и остановки по путевому листу. Личность пассажира мне неизвестна.",
                mood: "neutral",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_TRAM_CONDUCTOR);
