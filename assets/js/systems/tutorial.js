class TutorialSystem {
    constructor() {
        this.completedSteps = [];
        this.isActive = false;
        this.currentStep = 0;
        
        this.steps = [
            {
                id: 'welcome',
                title: '👻 Добро пожаловать в Ghost Signal',
                text: 'Вы — детектив, получивший доступ к полицейскому терминалу. Ваша задача — раскрывать нераскрытые дела.',
                highlight: null,
                position: 'center'
            },
            {
                id: 'first_case',
                title: '📂 Первое дело',
                text: 'Нажмите [1] чтобы открыть список дел. Начните с дела «Исчезновение в отеле Гранд».',
                highlight: '#btn-open-cases',
                position: 'bottom'
            },
            {
                id: 'map_navigation',
                title: '🗺️ Карта города',
                text: 'После начала дела вы увидите карту. Кликайте на локации чтобы перемещаться. Нажмите M для быстрого доступа.',
                highlight: '#btn-map',
                position: 'bottom'
            },
            {
                id: 'examine_objects',
                title: '🔍 Осмотр предметов',
                text: 'На локациях есть объекты для осмотра. Кликайте на них — некоторые можно взять как улики.',
                highlight: '.scene-object-card',
                position: 'top'
            },
            {
                id: 'inventory',
                title: '🎒 Инвентарь',
                text: 'Собранные улики хранятся во вкладке УЛИКИ. Нажмите I для быстрого доступа.',
                highlight: '[data-tab="tab-inventory"]',
                position: 'left'
            },
            {
                id: 'npc_calling',
                title: '👥 Свидетели',
                text: 'Во вкладке КОНТАКТЫ вы можете звонить свидетелям. Учитывайте время суток — некоторые спят!',
                highlight: '[data-tab="tab-npcs"]',
                position: 'left'
            },
            {
                id: 'board',
                title: '📋 Доска расследования',
                text: 'Перетаскивайте улики на доску, чтобы устанавливать связи и получать озарения.',
                highlight: '[data-tab="tab-board"]',
                position: 'left'
            },
            {
                id: 'final_answer',
                title: '🔍 Обвинение',
                text: 'Когда соберёте достаточно улик — кнопка ОБВИНИТЬ станет активной. Введите имя преступника.',
                highlight: '#btn-final-answer',
                position: 'top'
            },
            {
                id: 'complete',
                title: '✅ Вы готовы!',
                text: 'Удачи, детектив. Каждое дело — это шанс повысить свою репутацию.',
                highlight: null,
                position: 'center'
            }
        ];
    }
    
    start() {
        if (this.isActive) return;
        if (storage.get('tutorial_completed', false)) return;
        
        this.isActive = true;
        this.currentStep = 0;
        this._showStep();
    }
    
    _showStep() {
        if (this.currentStep >= this.steps.length) {
            this._complete();
            return;
        }
        
        const step = this.steps[this.currentStep];
        
        // Показываем подсказку
        events.emit('modal:show', {
            title: step.title,
            body: `
                <div class="tutorial-step">
                    <p>${step.text}</p>
                    <div class="tutorial-progress">
                        Шаг ${this.currentStep + 1} из ${this.steps.length}
                    </div>
                </div>
            `,
            footer: `
                <button id="btn-tutorial-skip" class="terminal-btn btn-sm">ПРОПУСТИТЬ</button>
                <button id="btn-tutorial-next" class="terminal-btn">ДАЛЕЕ</button>
            `
        });
        
        // Подсвечиваем элемент
        if (step.highlight) {
            this._highlightElement(step.highlight);
        }
        
        // Обработчики
        setTimeout(() => {
            document.getElementById('btn-tutorial-next')?.addEventListener('click', () => {
                this._clearHighlight();
                const modal = bootstrap.Modal.getInstance(document.getElementById('universal-modal'));
                if (modal) modal.hide();
                this.currentStep++;
                setTimeout(() => this._showStep(), 300);
            });
            
            document.getElementById('btn-tutorial-skip')?.addEventListener('click', () => {
                this._clearHighlight();
                const modal = bootstrap.Modal.getInstance(document.getElementById('universal-modal'));
                if (modal) modal.hide();
                this._complete();
            });
        }, 100);
    }
    
    _highlightElement(selector) {
        try {
            const el = document.querySelector(selector);
            if (el) {
                el.classList.add('tutorial-highlight');
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } catch(e) {}
    }
    
    _clearHighlight() {
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });
    }
    
    _complete() {
        this.isActive = false;
        storage.set('tutorial_completed', true);
        
        events.emit('notification:show', {
            message: '✅ Обучение завершено! Удачи в расследованиях.',
            type: 'success',
            duration: 4000
        });
    }
    
    // Сбросить обучение (в настройках)
    reset() {
        storage.remove('tutorial_completed');
        this.completedSteps = [];
        this.currentStep = 0;
    }
}