// ============================================
// ПРЕДМЕТЫ — ДЕЛО №2
// ============================================

registerData('object', {
    overturned_glass: {
        id: "overturned_glass", name: "Опрокинутый стакан", type: "evidence",
        description: "Стакан с остатками жидкости. Пахнет горьким миндалём — характерный запах цианида.",
        icon: "🥃", takeable: true, isEvidence: true, weight: 1,
        interactions: { examine: { text: "На дне стакана — белый осадок. Цианид. Яд был подсыпан в напиток. Профессионально и быстро.", timeCost: 5, givesInsight: "cyanide_poison" } }
    },
    red_scarf: {
        id: "red_scarf", name: "Красный шарф", type: "evidence",
        description: "Женский шёлковый шарф. На этикетке — инициалы «А.К.» — Анна Ковалёва.",
        icon: "🧣", takeable: true, isEvidence: true, weight: 0,
        interactions: { examine: { text: "Шарф дорогой, ручная работа. Такие продаются в бутике на центральной улице. Анна обронила его, когда уходила из бара.", timeCost: 5, givesInsight: "scarf_owner" } }
    },
    poison_vial: {
        id: "poison_vial", name: "Пузырёк из-под яда", type: "evidence",
        description: "Маленький стеклянный пузырёк. Этикетка стёрта. На стекле — отпечатки пальцев.",
        icon: "🧪", takeable: true, isEvidence: true, weight: 1,
        interactions: { examine: { text: "Отпечатки принадлежат Анне Ковалёвой. Но яд внутри — не снотворное, а цианид. Кто-то заменил содержимое.", timeCost: 10, givesInsight: "fingerprints_found" } }
    },
    threat_note: {
        id: "threat_note", name: "Записка с угрозами", type: "evidence",
        description: "Смятая записка: «Ты за всё заплатишь. Очень скоро.» Почерк женский, буквы острые.",
        icon: "📝", takeable: true, isEvidence: true, weight: 0,
        interactions: { examine: { text: "Почерк Анны. Она была в ярости. Но угрозы — это ещё не убийство.", timeCost: 5, givesInsight: "angry_writer" } }
    },
    prescription_journal: {
        id: "prescription_journal", name: "Журнал продаж", type: "static_object",
        description: "Толстая книга в кожаном переплёте. Все продажи лекарств за последний год.",
        icon: "📖", takeable: false,
        interactions: { examine: { text: "Две записи за 13-е число. Анна Ковалёва — хлоралгидрат. Виктор Кейн — цианистый калий. Два яда. Один день.", timeCost: 10, givesInsight: "kane_bought_cyanide", spawnsItem: "prescription_copy" } }
    },
    prescription_copy: {
        id: "prescription_copy", name: "Копия рецепта", type: "evidence",
        description: "Копия страницы из журнала продаж. Две записи: Анна и Кейн.",
        icon: "📄", takeable: true, isEvidence: true, weight: 0,
        interactions: { examine: { text: "Два покупателя. Два яда. Одна цель — Блэквуд. Но кто нажал на спусковой крючок?", timeCost: 5, givesInsight: "two_poisons_one_day" } }
    },
    medicine_shelf: {
        id: "medicine_shelf", name: "Полка с лекарствами", type: "static_object",
        description: "Стеклянная витрина с препаратами. Заперта на ключ. Одно место пустует.",
        icon: "🧪", takeable: false,
        interactions: { examine: { text: "Пустое место на полке. Этикетка: «Цианистый калий». Последнюю упаковку купил Кейн.", timeCost: 5, givesInsight: "cyanide_sold" } }
    },
    lora_desk: {
        id: "lora_desk", name: "Стол Лоры Лейн", type: "container",
        description: "Заваленный бумагами стол журналистки. Папка с надписью «Кейн: расследование».",
        icon: "🗄️", takeable: false,
        interactions: { examine: { text: "Лора собирала компромат на Кейна. Связи с бандой, отмывание денег, подкуп свидетелей.", timeCost: 10, givesInsight: "kane_criminal_connections", spawnsItem: "lora_notes" } }
    },
    lora_notes: {
        id: "lora_notes", name: "Заметки Лоры", type: "evidence",
        description: "Потрёпанный блокнот с записями журналистского расследования о Кейне.",
        icon: "📝", takeable: true, isEvidence: true, weight: 0,
        interactions: { examine: { text: "«Кейн использовал Анну как козла отпущения. Он знал о её планах и подменил яд.»", timeCost: 5, givesInsight: "lora_investigation" } }
    },
    press_photos: {
        id: "press_photos", name: "Фотографии прессы", type: "static_object",
        description: "Стена с фотографиями городской хроники за последний месяц.",
        icon: "📸", takeable: false,
        interactions: { examine: { text: "Фото бара в ночь отравления. На снимке видно: Кейн наклоняется и поднимает пузырёк Анны!", timeCost: 10, givesInsight: "photo_evidence", spawnsItem: "bar_photo" } }
    },
    bar_photo: {
        id: "bar_photo", name: "Фотография из бара", type: "evidence",
        description: "Снимок бара в ночь отравления. Кейн у стойки, Анна отворачивается, пузырёк исчезает.",
        icon: "📸", takeable: true, isEvidence: true, weight: 0,
        interactions: { examine: { text: "Вот он — момент кражи. Кейн поднимает пузырёк и кладёт в карман. Фото не врёт.", timeCost: 5, givesInsight: "kane_caught" } }
    },
    rival_desk: {
        id: "rival_desk", name: "Стол Кейна", type: "container",
        description: "Массивный дубовый стол. В ящике — папка с судебным иском «Блэквуд против Кейна».",
        icon: "📋", takeable: false,
        interactions: { examine: { text: "Кейн выиграл суд за неделю до отравления. Но Блэквуд прислал ему издевательское письмо.", timeCost: 5, givesInsight: "lawsuit_won" } }
    },
    contract_folder: {
        id: "contract_folder", name: "Папка с контрактом", type: "evidence",
        description: "Документы по судебному иску. Кейн против Блэквуда. Кейн выиграл.",
        icon: "📁", takeable: true, isEvidence: true, weight: 1,
        interactions: { examine: { text: "Согласно документам, Кейн выиграл суд. Зачем ему убивать того, кого он уже победил?", timeCost: 5, givesInsight: "no_motive" } }
    },
    family_photo: {
        id: "family_photo", name: "Семейная фотография Кейна", type: "static_object",
        description: "Фотография в рамке: Кейн с женой и двумя детьми. На обороте надпись.",
        icon: "📷", takeable: false,
        interactions: { examine: { text: "«Моей любимой семье. Вы — всё, что у меня есть.» Кейн — семейный человек. Это не вяжется с образом убийцы.", timeCost: 5, givesInsight: "family_man" } }
    },
    pharmacy_counter: {
        id: "pharmacy_counter", name: "Прилавок аптеки", type: "static_object",
        description: "Стеклянная витрина с лекарствами. За прилавком — журнал продаж.",
        icon: "💊", takeable: false,
        interactions: { examine: { text: "Мистер Грин ведёт meticulous записи. Каждая покупка задокументирована.", timeCost: 5 } }
    },
    archive_shelf: {
        id: "archive_shelf", name: "Архивный шкаф", type: "static_object",
        description: "Подшивки газет за последний год. Статьи о Кейне и его бизнесе.",
        icon: "🗄️", takeable: false,
        interactions: { examine: { text: "Лора Лейн писала о Кейне не раз. Она знала о его тёмных делах задолго до отравления.", timeCost: 5 } }
    },
    bank_records: {
        id: "bank_records", name: "Банковские записи", type: "static_object",
        description: "Финансовые документы Блэквуда и Кейна. Подозрительные переводы.",
        icon: "📄", takeable: false,
        interactions: { examine: { text: "Кейн переводил крупные суммы на счета фирмы-однодневки. Отмывание денег?", timeCost: 10, givesInsight: "money_trail" } }
    },
    safety_deposit_box: {
        id: "safety_deposit_box", name: "Ячейка хранения", type: "locked_container",
        description: "Банковская ячейка. Нужен ключ или ордер.",
        icon: "🔒", takeable: false,
        interactions: { examine: { text: "Ячейка закрыта. Возможно, внутри — недостающие улики.", timeCost: 5 } }
    }
});