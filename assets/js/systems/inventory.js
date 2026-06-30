class Inventory {
    constructor() {
        this.items = [];
        this.evidence = [];
        this.insights = [];
        this.maxWeight = 20;
        this.currentWeight = 0;
    }

    // Добавить предмет
    addItem(itemId) {
        const object = getObjectById(itemId);
        if (!object) {
            console.warn('Предмет не найден:', itemId);
            return false;
        }

        if (!object.takeable) {
            events.emit('notification:show', {
                message: `Нельзя взять: ${object.name}`,
                type: 'warning', duration: 2000
            });
            return false;
        }

        if (this.items.includes(itemId)) {
            events.emit('notification:show', {
                message: `У вас уже есть: ${object.name}`,
                type: 'info', duration: 2000
            });
            return false;
        }

        if (this.currentWeight + (object.weight || 0) > this.maxWeight) {
            events.emit('notification:show', {
                message: 'Инвентарь переполнен! Освободите место.',
                type: 'error', duration: 3000
            });
            return false;
        }

        this.items.push(itemId);
        this.currentWeight += (object.weight || 0);

        if (object.isEvidence) {
            this.evidence.push(itemId);
        }

        if (object.isKeyItem) {
            events.emit('keyitem:acquired', { itemId, object });
        }

        events.emit('inventory:changed', { action: 'add', itemId });
        events.emit('notification:show', {
            message: `Взят предмет: ${object.name}`,
            type: 'success', duration: 2500
        });

        return true;
    }

    // Удалить предмет
    removeItem(itemId) {
        const index = this.items.indexOf(itemId);
        if (index === -1) return false;

        const object = getObjectById(itemId);
        this.items.splice(index, 1);
        if (object) {
            this.currentWeight -= (object.weight || 0);
        }

        const evIndex = this.evidence.indexOf(itemId);
        if (evIndex !== -1) this.evidence.splice(evIndex, 1);

        events.emit('inventory:changed', { action: 'remove', itemId });
        return true;
    }

    // Удалить улику из списка evidence (при переносе на доску)
    removeFromEvidence(evidenceId) {
        const index = this.evidence.indexOf(evidenceId);
        if (index !== -1) {
            this.evidence.splice(index, 1);
        }
    }

    // Проверить наличие предмета
    hasItem(itemId) {
        return this.items.includes(itemId);
    }

    // Проверить наличие озарения
    hasInsight(insightId) {
        return this.insights.includes(insightId);
    }

    // Добавить озарение
    addInsight(insightId) {
        if (!this.insights.includes(insightId)) {
            this.insights.push(insightId);
            events.emit('insight:gained', { insightId });
        }
    }

    // Получить все предметы как объекты
    getAllItems() {
        return getObjectsByIds(this.items);
    }

    // Получить все улики
    getEvidence() {
        return getObjectsByIds(this.evidence);
    }

    // Использовать предмет
    useItem(itemId, targetId = null) {
        const object = getObjectById(itemId);
        if (!object) return null;

        if (object.interactions?.use) {
            return object.interactions.use;
        }

        return {
            text: `Вы используете ${object.name}. Ничего не происходит.`,
            timeCost: 5
        };
    }

    // Комбинировать два предмета
    combineItems(itemId1, itemId2) {
        const obj1 = getObjectById(itemId1);
        const obj2 = getObjectById(itemId2);

        const combinations = {
            'magnifying_glass+torn_photo': {
                result: 'insight:photo_detail',
                text: 'Под лупой видна дата на обороте: 13-е число. За день до исчезновения.',
                timeCost: 10
            }
        };

        const key1 = `${itemId1}+${itemId2}`;
        const key2 = `${itemId2}+${itemId1}`;
        const combo = combinations[key1] || combinations[key2];

        if (combo) {
            if (combo.result.startsWith('insight:')) {
                this.addInsight(combo.result.replace('insight:', ''));
            }
            return combo;
        }

        return {
            text: `Вы пытаетесь соединить ${obj1?.name || '?'} и ${obj2?.name || '?'}. Бесполезно.`,
            timeCost: 5
        };
    }

    // Сериализация
    toJSON() {
        return {
            items: [...this.items],
            evidence: [...this.evidence],
            insights: [...this.insights],
            currentWeight: this.currentWeight
        };
    }

    // Восстановление
    static fromJSON(json) {
        const inv = new Inventory();
        if (json) {
            inv.items = json.items || [];
            inv.evidence = json.evidence || [];
            inv.insights = json.insights || [];
            inv.currentWeight = json.currentWeight || 0;

            if (!inv.items.includes('magnifying_glass')) {
                inv.items.push('magnifying_glass');
                inv.currentWeight += 1;
            }
        } else {
            inv.items.push('magnifying_glass');
            inv.currentWeight += 1;
        }
        return inv;
    }
}