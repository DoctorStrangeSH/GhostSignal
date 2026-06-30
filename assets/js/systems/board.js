class InvestigationBoard {
    constructor() {
        this.slots = [];          // Слоты для улик
        this.connections = [];    // Связи между слотами
        this.maxSlots = 6;
        this.evidenceOnBoard = []; // ID улик на доске
        this._initDefaultSlots();
    }

    _initDefaultSlots() {
        this.slots = [
            { id: 'slot-1', label: 'Мотив', evidenceId: null, x: 15, y: 20 },
            { id: 'slot-2', label: 'Возможность', evidenceId: null, x: 50, y: 20 },
            { id: 'slot-3', label: 'Улика А', evidenceId: null, x: 85, y: 20 },
            { id: 'slot-4', label: 'Улика Б', evidenceId: null, x: 15, y: 70 },
            { id: 'slot-5', label: 'Свидетель', evidenceId: null, x: 50, y: 70 },
            { id: 'slot-6', label: 'Вывод', evidenceId: null, x: 85, y: 70 }
        ];

        this.connections = [
            { from: 'slot-1', to: 'slot-2', type: 'solid' },
            { from: 'slot-2', to: 'slot-3', type: 'solid' },
            { from: 'slot-4', to: 'slot-5', type: 'solid' },
            { from: 'slot-5', to: 'slot-6', type: 'solid' },
            { from: 'slot-1', to: 'slot-4', type: 'dashed' },
            { from: 'slot-3', to: 'slot-6', type: 'dashed' }
        ];
    }

    // Разместить улику на доске
    placeEvidence(evidenceId, slotId) {
        const evidence = getObjectById(evidenceId);
        if (!evidence?.isEvidence) {
            events.emit('notification:show', {
                message: 'Этот предмет не является уликой',
                type: 'warning', duration: 2000
            });
            return false;
        }

        const slot = this.slots.find(s => s.id === slotId);
        if (!slot) return false;

        // Если в слоте уже есть улика — возвращаем старую
        if (slot.evidenceId) {
            this.removeEvidence(slotId);
        }

        // Убираем улику с других слотов если она уже на доске
        this.slots.forEach(s => {
            if (s.evidenceId === evidenceId) {
                s.evidenceId = null;
            }
        });

        slot.evidenceId = evidenceId;

        if (!this.evidenceOnBoard.includes(evidenceId)) {
            this.evidenceOnBoard.push(evidenceId);
        }

        // Убираем улику из инвентаря
        events.emit('inventory:remove', evidenceId);

        events.emit('board:updated', { action: 'place', evidenceId, slotId });
        return true;
    }

    // Убрать улику с доски
    removeEvidence(slotId) {
        const slot = this.slots.find(s => s.id === slotId);
        if (!slot || !slot.evidenceId) return null;

        const evidenceId = slot.evidenceId;
        slot.evidenceId = null;

        this.evidenceOnBoard = this.evidenceOnBoard.filter(id => id !== evidenceId);

        events.emit('board:updated', { action: 'remove', evidenceId, slotId });
        return evidenceId;
    }

    // Проверить, все ли ключевые слоты заполнены
    areKeySlotsFilled() {
        const keySlots = ['slot-1', 'slot-2', 'slot-6'];
        return keySlots.every(slotId => {
            const slot = this.slots.find(s => s.id === slotId);
            return slot?.evidenceId !== null;
        });
    }

    // Получить текущую схему доски
    getBoardState() {
        return {
            slots: this.slots.map(s => ({ ...s })),
            connections: [...this.connections],
            evidenceOnBoard: [...this.evidenceOnBoard]
        };
    }

    // Получить улики, которые ещё не на доске
    getAvailableEvidence(inventoryEvidence) {
        return inventoryEvidence.filter(id => !this.evidenceOnBoard.includes(id));
    }

    // Проверить, сделаны ли правильные выводы
    checkConclusions() {
        // Проверяем ключевые пары
        const pairs = [
            { slot1: 'slot-1', slot2: 'slot-2', insight: 'motive_opportunity_linked' },
            { slot1: 'slot-3', slot2: 'slot-6', insight: 'evidence_conclusion_linked' }
        ];

        const insights = [];

        pairs.forEach(pair => {
            const slot1 = this.slots.find(s => s.id === pair.slot1);
            const slot2 = this.slots.find(s => s.id === pair.slot2);

            if (slot1?.evidenceId && slot2?.evidenceId) {
                // Обе улики на месте — даём озарение
                insights.push(pair.insight);
            }
        });

        return insights;
    }

    // Сбросить доску
    reset() {
        this.slots.forEach(s => s.evidenceId = null);
        this.evidenceOnBoard = [];
        events.emit('board:updated', { action: 'reset' });
    }

    // Сериализация
    toJSON() {
        return {
            slots: this.slots.map(s => ({ id: s.id, evidenceId: s.evidenceId })),
            evidenceOnBoard: [...this.evidenceOnBoard]
        };
    }

    // Восстановление
    static fromJSON(json) {
        const board = new InvestigationBoard();
        if (json) {
            json.slots?.forEach(savedSlot => {
                const slot = board.slots.find(s => s.id === savedSlot.id);
                if (slot && savedSlot.evidenceId) {
                    slot.evidenceId = savedSlot.evidenceId;
                }
            });
            board.evidenceOnBoard = json.evidenceOnBoard || [];
        }
        return board;
    }
}