class LocationIntro {
    constructor() {
        // Загружаем сохранённые интро
        const saved = storage.get('shown_intros');
        this.shownIntros = saved || {};
        this._bindEvents();
    }

    _bindEvents() {
        events.on('location:changed', (data) => {
            const location = getLocationById(data.locationId);
            if (!location) return;

            // Показываем только при первом посещении
            if (this.shownIntros[data.locationId]) return;
            
            // Отмечаем как показанное и сохраняем
            this.shownIntros[data.locationId] = true;
            storage.set('shown_intros', this.shownIntros);

            const intro = this._getIntro(data.locationId);
            if (intro) {
                setTimeout(() => {
                    this._showIntro(location, intro);
                }, 600);
            }
        });
        
        // Сброс при начале нового дела
        events.on('case:started', () => {
            this.shownIntros = {};
            storage.set('shown_intros', {});
        });
    }

    _showIntro(location, intro) {
        // Use the shared modal pipeline so location intros respect the same
        // transition queue as dialogue, evidence and narrative windows.
        events.emit('modal:show', {
            title: `${location.icon || '📍'} ${location.name}`,
            body: `
                <p style="font-family: var(--font-serif); font-size: 15px; line-height: 1.8; font-style: italic; color: var(--text-primary);">
                    ${intro}
                </p>
            `,
            footer: '<button class="terminal-btn" data-bs-dismiss="modal">ОСМОТРЕТЬСЯ</button>'
        });
    }

    _getIntro(locationId) {
        const intros = {
            'hotel_grand': 'Люстра дрожит, отбрасывая дрожащие тени на мраморный пол. Портье за стойкой нервно теребит журнал регистрации. В воздухе — сладкий запах, похожий на цветы с химическим оттенком.',
            'hotel_room_304': 'Дверь открывается с тихим скрипом. В номере беспорядок: кровать смята, на ковре — тёмное пятно. Окно закрыто изнутри. Зеркало висит криво, будто за ним что-то спрятано.',
            'bar_joe': 'Полумрак бара встречает вас запахом виски и старого джаза. Музыкальный автомат играет блюз. За стойкой — бармен, протирающий стаканы.',
            'alley': 'Узкий переулок пахнет сыростью и мусором. Единственный фонарь разбит. В темноте что-то блестит возле переполненного бака.',
            'victim_apartment': 'В квартире тихо. Шторы задёрнуты. На столе — разбросанные бумаги. Кто-то здесь явно что-то искал.',
            'police_station': 'В участке пахнет кофе и бумагой. Сержант Миллс что-то печатает за своим столом. На доске объявлений — ориентировки.',
            'blackwood_mansion': 'Особняк встречает вас холодной тишиной. Мраморные полы отражают свет хрустальных люстр. Миссис Блэквуд ждёт вас в гостиной.',
            'morgue': 'Холодный воздух морга пробирает до костей. Пахнет формалином. Доктор Харрис поднимает глаза от бумаг.',
            'train_station': 'Вокзал гудит. Объявления о прибытии эхом разносятся под сводами. Где-то в толпе может скрываться беглянка.',
            'pharmacy': 'Колокольчик над дверью звенит. Пахнет травами и спиртом. Мистер Грин поправляет очки и смотрит на вас.',
            'newspaper_office': 'В редакции шумно — стучат пишущие машинки. Лора Лейн сидит за угловым столом, заваленным бумагами.',
            'rival_office': 'Шикарный офис с видом на город. Кейн сидит за массивным столом. На стене — дипломы и сертификаты.',
            'bank': 'Мраморные колонны и золотые таблички. Банк хранит секреты своих клиентов — нужно только знать, как их достать.'
        };
        return intros[locationId] || null;
    }
}
