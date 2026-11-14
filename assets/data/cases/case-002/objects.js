// ============================================
// ПРЕДМЕТЫ — ДЕЛО №2
// ============================================

registerData('object', {
    overturned_glass: {
        id: "overturned_glass", name: "Опрокинутый стакан", type: "evidence",
        description: "Стакан с остатками жидкости. Пахнет горьким миндалём — характерный запах цианида.",
        icon: "🥃", takeable: true, isEvidence: true, weight: 1,
        interactions: { examine: { text: "На дне стакана — белый осадок. Цианид. Под ножкой стола вы замечаете маленький пузырёк, прикрытый салфеткой. Кто-то оставил его так, чтобы он выглядел случайно обронённым.", timeCost: 5, givesInsight: "cyanide_poison", spawnsItem: "poison_vial" } }
    },
    red_scarf: {
        id: "red_scarf", name: "Красный шарф", type: "evidence",
        description: "Женский шёлковый шарф. На этикетке — инициалы «А.К.» — Анна Ковалёва.",
        icon: "🧣", takeable: true, isEvidence: true, weight: 0,
        interactions: { examine: { text: "Шарф дорогой, ручная работа. Такие продаются в бутике на центральной улице. Анна обронила его, когда уходила из бара.", timeCost: 5, givesInsight: "scarf_owner" } }
    },
    poison_vial: {
        id: "poison_vial", name: "Пузырёк из-под яда", type: "evidence",
        description: "Маленький стеклянный пузырёк. Этикетка стёрта. На стекле — отпечатки Анны; крышка и горлышко тщательно протёрты.",
        icon: "🧪", takeable: true, isEvidence: true, weight: 1,
        interactions: { examine: { text: "Отпечатки на стекле принадлежат Анне Ковалёвой. На крышке нет пригодных для сравнения следов. Внутри — цианид, хотя Анна покупала хлоралгидрат. Кто-то подменил содержимое, стараясь не оставить своих отпечатков.", timeCost: 10, givesInsight: "fingerprints_found" } }
    },
    anna_desk: {
        id: "anna_desk", name: "Письменный стол Анны", type: "container",
        description: "Небольшой стол у окна. В ящике — счета, старые письма и смятая записка.",
        icon: "🗄️", takeable: false,
        interactions: { examine: { text: "Под стопкой счетов лежит записка, написанная рукой Анны. Она угрожала Блэквуду, но дата показывает: записка появилась до того, как Кейн украл пузырёк.", timeCost: 5, spawnsItem: "threat_note", givesInsight: "angry_writer" } }
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
        interactions: { examine: { text: "Контактный отпечаток с плёнки фотографа, снимавшего пятничный вечер в баре. На дальнем плане Кейн наклоняется у стойки и поднимает небольшой предмет через салфетку.", timeCost: 10, givesInsight: "photo_evidence", spawnsItem: "bar_photo" } }
    },
    bar_photo: {
        id: "bar_photo", name: "Фотография из бара", type: "evidence",
        description: "Снимок бара в ночь отравления. Кейн у стойки, Анна отворачивается, пузырёк исчезает.",
        icon: "📸", takeable: true, isEvidence: true, weight: 0,
        interactions: { examine: { text: "Кейн поднимает небольшой предмет через салфетку и убирает его в карман. Сам предмет на кадре неразличим, но время совпадает с рассказами Евы и официанта. Это подтверждение их показаний, а не самостоятельное доказательство содержимого пузырька.", timeCost: 5, givesInsight: "kane_caught" } }
    },
    tram_route_entry: {
        id: "tram_route_entry", name: "Выписка из путевого листа трамвая №4", type: "evidence",
        description: "Запись дежурного кондуктора: задержка у остановки возле бара около 22:15 и пассажир, вышедший у старой текстильной улицы.",
        icon: "🎟️", takeable: true, isEvidence: true, weight: 0,
        interactions: {
            examine: {
                text: "В путевом листе зафиксирована задержка трамвая №4 около 22:15 у остановки возле бара. Кондуктор отдельно отметил пассажира в тёмном пальто, вышедшего у старой текстильной улицы. Запись подтверждает маршрут и время, но не имя пассажира и не то, что он был внутри бара.",
                timeCost: 5,
                givesInsight: "tram_passenger_route_corroboration"
            }
        }
    },
    inspection_register: {
        id: "inspection_register", name: "Журнал городской инспекции", type: "static_object",
        description: "Прошитый журнал с регистрационными номерами, назначенными проверками и заверенными отметками об отмене.",
        icon: "📚", takeable: false,
        interactions: {
            examine: {
                text: "В заверенной выписке по заявке 27-Б указано: инспектор Илья Руденко назначен на проверку бара «У Джо». Ниже стоит отметка об отмене в 15:40 из-за несчастного случая на текстильной фабрике. В графе замены — прочерк. Это первичная служебная запись: визит был назначен, затем отменён; фактического посещения она не подтверждает.",
                timeCost: 10,
                givesInsight: "inspection_cancellation_record",
                spawnsItem: "inspection_cancellation_copy"
            }
        }
    },
    inspection_cancellation_copy: {
        id: "inspection_cancellation_copy", name: "Заверенная выписка об отмене заявки 27-Б", type: "evidence",
        description: "Официальная копия журнала городской инспекции. Назначение Ильи Руденко отменено в 15:40; замена не назначена.",
        icon: "📄", takeable: true, isEvidence: true, weight: 0,
        interactions: {
            examine: {
                text: "Номер заявки 27-Б, дата, подпись дежурного регистратора и штамп отдела совпадают с записью в журнале. Документ подтверждает отмену визита Руденко, но не устанавливает, кто позднее пришёл в бар под видом инспектора.",
                timeCost: 5,
                givesInsight: "inspection_cancellation_record"
            }
        }
    },
    inspector_service_card: {
        id: "inspector_service_card", name: "Служебное удостоверение Ильи Руденко", type: "evidence",
        description: "Действующее удостоверение инспектора ИТ-0417 с фотографией и подписью отдела кадров.",
        icon: "🪪", takeable: true, isEvidence: true, weight: 0,
        interactions: {
            examine: {
                text: "Фотография, номер ИТ-0417 и подпись отдела кадров подтверждают, что предъявитель — Илья Руденко. Удостоверение не доказывает, что он был в баре в ночь происшествия.",
                timeCost: 5,
                givesInsight: "rudenko_identity_documents_verified"
            }
        }
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
    mill_gate_notice: {
        id: "mill_gate_notice", name: "Объявление о закрытии фабрики", type: "static_object",
        description: "Выцветшее объявление управляющего: фабрика закрыта на ремонт на двенадцать дней, вход посторонним запрещён.",
        icon: "📌", takeable: false,
        interactions: {
            examine: {
                text: "Объявление подтверждает, что фабрика закрыта на ремонт уже двенадцать дней. Для входа требуется распоряжение управляющего. Само объявление не доказывает, что никто не мог оказаться на территории незаконно.",
                timeCost: 2,
                givesInsight: "mill_closed_for_repairs"
            }
        }
    },
    diner_cash_slip: {
        id: "diner_cash_slip", name: "Кассовый чек закусочной", type: "evidence",
        description: "Чек на чашку кофе, пробитый около десяти вечера по часам кассового аппарата. Время аппарата на этой неделе не сверяли.",
        icon: "🧾", takeable: true, isEvidence: true, weight: 0,
        interactions: {
            examine: {
                text: "На чеке указано время 22:03. Кассирская лента подтверждает покупку кофе, но в закусочной не ведут именной учёт посетителей. Время аппарата не сверяли с официальными часами, поэтому чек не позволяет точно установить время визита и не связывает покупку с конкретным человеком.",
                timeCost: 5,
                givesInsight: "diner_time_unverified"
            }
        }
    },
    mill_shift_extract: {
        id: "mill_shift_extract", name: "Выписка из журнала ночной смены", type: "evidence",
        description: "Заверенная выписка: боковые ворота старой текстильной фабрики опечатаны в 21:50, утренняя проверка подтвердила целостность пломбы; зарегистрированных посетителей нет.",
        icon: "📋", takeable: true, isEvidence: true, weight: 0,
        interactions: {
            examine: {
                text: "Запись сторожа подтверждает, что боковые ворота фабрики были опечатаны в 21:50 и оставались закрытыми до утренней проверки. В журнале нет зарегистрированных посетителей. Это исключает незарегистрированный проход через эти ворота при целой пломбе, но не устанавливает местонахождение неизвестного на всей улице и не доказывает отсутствие связи с фабрикой.",
                timeCost: 5,
                givesInsight: "mill_gate_seal_intact"
            }
        }
    },
    public_telephone_booth: {
        id: "public_telephone_booth", name: "Уличная телефонная будка", type: "static_object",
        description: "Старая телефонная будка на текстильной улице. На внутренней табличке указан номер линии и адрес городской телефонной станции.",
        icon: "☎️", takeable: false,
        interactions: {
            examine: {
                text: "На табличке указан номер обслуживающей линии и адрес телефонной станции. В будке нет журнала звонков или записывающего устройства. Номер линии поможет запросить только те служебные документы, которые действительно сохранились на станции.",
                timeCost: 3,
                givesInsight: "textile_street_phone_line"
            }
        }
    },
    telephone_exchange_slip: {
        id: "telephone_exchange_slip", name: "Карточка междугороднего запроса", type: "evidence",
        description: "Служебная копия карточки: запрос с линии текстильного района принят в 22:18 по сверенным часам станции, адресован на Восточный узел. Поле номера абонента не сохранилось; результат соединения не отмечен.",
        icon: "📞", takeable: true, isEvidence: true, weight: 0,
        interactions: {
            examine: {
                text: "Карточка фиксирует принятие междугороднего запроса в 22:18 по служебным часам, сверенным с главным хронометром. Она не содержит номера вызываемого абонента, номера конкретной будки или имени звонившего. Отметки об успешном соединении нет. Это подтверждение служебного запроса, а не доказательство состоявшегося разговора.",
                timeCost: 5,
                givesInsight: "telephone_exchange_request_record"
            }
        }
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