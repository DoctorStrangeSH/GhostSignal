class DetectiveThoughts {
    constructor() {
        this._createBubble();
        this._bindEvents();
    }

    _createBubble() {
        this.bubble = document.createElement('div');
        this.bubble.id = 'detective-thought';
        this.bubble.style.cssText = `
            position: fixed;
            bottom: 60px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(10, 15, 10, 0.9);
            border: 1px solid var(--accent-green);
            border-radius: 20px;
            padding: 10px 20px;
            font-family: var(--font-serif);
            font-style: italic;
            font-size: 13px;
            color: var(--text-bright);
            max-width: 400px;
            text-align: center;
            z-index: 1500;
            opacity: 0;
            transition: opacity 0.5s;
            pointer-events: none;
        `;
        document.body.appendChild(this.bubble);
    }

    _bindEvents() {
        events.on('object:interact', (data) => {
            const thoughts = {
                'bed_304': 'Смятая постель... Кто-то спал беспокойно. Или боролся?',
                'carpet_stain': 'Пятно ещё влажное. Это произошло недавно.',
                'mirror': 'Зеркало висит криво. За ним что-то есть.',
                'window_304': 'Окно закрыто изнутри. Как же он исчез?',
                'wardrobe': 'Пустой шкаф. Но на дне что-то блестит...',
                'guest_book': 'Запись вырвана. Кому-то есть что скрывать.',
                'lobby_phone': 'Стёртые цифры... Кому он звонил?',
                'dumpster': 'Фотография в мусоре? Неслучайно.',
                'graffiti_wall': '«Она здесь была»... Послание или угроза?',
                'broken_lamp': 'Кровь на стекле. Борьба?',
                'hidden_suitcase': 'Чемодан с билетом. Планировал побег.',
                'bar_counter': 'Спичечный коробок с адресом. Зацепка!',
                'safe': 'Сейф. Нужен код или ключ.',
                'desk': 'Бумаги в беспорядке. Кто-то рылся.',
                'photo_frame': 'Семейное фото? Или улика?',
                'poison_vial': 'Пузырёк из-под яда. Чей он?',
                'red_scarf': 'Красный шарф. Инициалы «А.К.» — Анна Ковалёва?',
                'threat_note': 'Угрозы. Почерк женский. Кто писал?',
                'overturned_glass': 'Стакан опрокинут. Яд подсыпали в напиток.',
                'jukebox': 'Царапина и клочок ткани. Кто-то торопился.',
                'back_door': 'Чёрный ход. Удобно для незаметного ухода.'
            };

            const thought = thoughts[data.itemId];
            if (thought) this.show(thought);
        });
    }

    show(text) {
        if (!this.bubble) return;
        this.bubble.textContent = text;
        this.bubble.style.opacity = '1';

        clearTimeout(this._timeout);
        this._timeout = setTimeout(() => {
            this.bubble.style.opacity = '0';
        }, 4000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.detectiveThoughts = new DetectiveThoughts();
});