// ============================================
 // ДИАЛОГ — ИНСПЕКТОР ИЛЬЯ РУДЕНКО
 // ============================================

const DIALOGUE_LABOUR_INSPECTOR = {
    id: "dialogue-labour-inspector",
    npcId: "labour_inspector",
    type: "face_to_face",

    context: {
        title: "Городская инспекция труда",
        text: "В приёмной пахнет бумагой и холодным табаком. За стеклянной перегородкой инспектор Илья Руденко разбирает папки с проверками.",
        mood: "formal"
    },

    tree: {
        start: "greeting",
        nodes: {
            greeting: {
                speaker: "npc",
                text: "Инспектор Илья Руденко. Если вы по заявке 27-Б, предупреждаю сразу: в журнале есть и назначение, и отметка об отмене. Не путайте план визита с фактической проверкой.",
                mood: "professional",
                innerThought: "Детектив пришёл из-за бара Джо. Нужно показать запись целиком, а не только удобную строку.",
                answers: [
                    {
                        text: "У Джо есть запись о человеке, представившемся инспектором по заявке 27-Б. Покажите официальный журнал.",
                        nextNode: "rudenko_checks_register",
                        tone: "direct",
                        condition: "hasInsight:joe_found_inspection_entry",
                        hiddenWhenUnavailable: true
                    },
                    {
                        text: "Мне нужно проверить ваши служебные документы и фотографию.",
                        nextNode: "rudenko_identity_documents",
                        tone: "calm"
                    },
                    { text: "Я вернусь, когда соберу больше сведений.", nextNode: "end_inspector", tone: "calm" }
                ]
            },

            rudenko_checks_register: {
                speaker: "npc",
                text: "Вот заверенная выписка из журнала. Заявка 27-Б действительно была назначена мне на тот вечер. Но в 15:40 её отменили: на текстильной фабрике произошёл несчастный случай, и меня направили туда. В графе замены стоит прочерк. Я не посещал бар Джо и никого не направлял вместо себя.",
                mood: "serious",
                innerThought: "Это официальная запись о назначении и отмене. Она объясняет отсутствие инспекции, но сама по себе не устанавливает личность человека, которого видел бармен.",
                givesInsight: "inspection_cancellation_record",
                answers: [
                    {
                        text: "Покажите удостоверение. Я хочу сверить фотографию и номер.",
                        nextNode: "rudenko_identity_documents",
                        tone: "procedural"
                    },
                    {
                        text: "Сопроводите меня к Джо. Он сможет сравнить вас с человеком, которого видел.",
                        nextNode: "rudenko_agrees_to_identification",
                        tone: "direct"
                    },
                    { text: "Спасибо. Пока этого достаточно.", nextNode: "end_inspector", tone: "calm" }
                ]
            },

            rudenko_identity_documents: {
                speaker: "npc",
                text: "Это моё действующее служебное удостоверение: фотография, номер ИТ-0417 и подпись отдела кадров. Можете записать реквизиты и показать фотографию свидетелю. Но удостоверение подтверждает мою личность сейчас, а не то, кто приходил в бар в тот вечер.",
                mood: "formal",
                innerThought: "Проверка документа устанавливает, кто стоит перед детективом. Для опознания посетителя всё равно нужен свидетель, который видел того человека.",
                spawnsItem: "inspector_service_card",
                givesInsight: "rudenko_identity_documents_verified",
                answers: [
                    {
                        text: "Поедемте к Джо. Он видел посетителя лично.",
                        nextNode: "rudenko_agrees_to_identification",
                        tone: "direct"
                    },
                    { text: "Сначала сверю запись об отмене.", nextNode: "rudenko_checks_register", tone: "procedural", condition: "hasInsight:joe_found_inspection_entry" },
                    { text: "Благодарю. Я проверю остальные обстоятельства.", nextNode: "end_inspector", tone: "calm" }
                ]
            },

            rudenko_agrees_to_identification: {
                speaker: "npc",
                text: "Хорошо. Я поеду с вами. Если Джо действительно видел другого человека, это нужно зафиксировать отдельно. Но прошу не называть неизвестного самозванцем или человеком Кейна, пока у вас нет доказательств его личности и мотива.",
                mood: "determined",
                innerThought: "Я могу подтвердить собственный маршрут и документы. Кто использовал моё имя — пока неизвестно.",
                givesInsight: "rudenko_agreed_to_identification",
                answers: [
                    { text: "Идёмте. Пусть Джо сам скажет, узнаёт ли он вас.", nextNode: "end_inspector", tone: "calm" }
                ]
            },

            end_inspector: {
                speaker: "npc",
                text: "Официальная выписка и мои показания доступны для проверки. Если появится новая информация, приходите. Не делайте выводов раньше свидетелей.",
                mood: "professional",
                endDialogue: true
            }
        }
    }
};

registerData('dialogue', DIALOGUE_LABOUR_INSPECTOR);
