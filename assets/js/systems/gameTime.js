class GameTime {
    constructor(hour = 8, minute = 0, day = 1) {
        this.hour = hour;
        this.minute = minute;
        this.day = day;
        this._listeners = [];
    }
    
    // Продвинуть время на указанные минуты
    advance(minutes) {
        if (minutes <= 0) return;
        
        const oldPeriod = this.getPeriod();
        
        this.minute += minutes;
        while (this.minute >= 60) {
            this.minute -= 60;
            this.hour++;
        }
        while (this.hour >= 24) {
            this.hour -= 24;
            this.day++;
        }
        
        const newPeriod = this.getPeriod();
        
        // Уведомляем слушателей
        this._notify({
            hour: this.hour,
            minute: this.minute,
            day: this.day,
            period: newPeriod,
            periodChanged: oldPeriod !== newPeriod,
            oldPeriod: oldPeriod
        });
    }
    
    // Перемотать до определённого часа
    advanceToHour(targetHour) {
        let minutesToAdd = 0;
        if (targetHour > this.hour) {
            minutesToAdd = (targetHour - this.hour) * 60 - this.minute;
        } else if (targetHour < this.hour) {
            minutesToAdd = (24 - this.hour + targetHour) * 60 - this.minute;
        }
        // Если тот же час — добавляем 1 час минимум
        if (minutesToAdd <= 0) minutesToAdd = 60;
        this.advance(minutesToAdd);
    }
    
    // До утра (до 06:00)
    advanceToMorning() {
        this.advanceToHour(CONFIG.time.dawn);
    }
    
    // Получить текущий период суток
    getPeriod() {
        const h = this.hour;
        if (h >= CONFIG.time.dawn && h < CONFIG.time.day) return 'dawn';     // 06:00-09:00
        if (h >= CONFIG.time.day && h < CONFIG.time.dusk) return 'day';      // 09:00-18:00
        if (h >= CONFIG.time.dusk && h < CONFIG.time.night) return 'evening'; // 18:00-22:00
        return 'night';                                                       // 22:00-06:00
    }
    
    // Дневное ли время (для проверок)
    isDaytime() {
        return ['dawn', 'day'].includes(this.getPeriod());
    }
    
    // Ночное ли время
    isNighttime() {
        return ['evening', 'night'].includes(this.getPeriod());
    }
    
    // Форматированное время "08:00"
    getFormatted() {
        const h = String(this.hour).padStart(2, '0');
        const m = String(this.minute).padStart(2, '0');
        return `${h}:${m}`;
    }
    
    // Получить иконку времени суток
    getIcon() {
        const icons = {
            dawn: '🌅',
            day: '☀️',
            evening: '🌆',
            night: '🌙'
        };
        return icons[this.getPeriod()];
    }
    
    // Название периода на русском
    getPeriodName() {
        const names = {
            dawn: 'РАССВЕТ',
            day: 'ДЕНЬ',
            evening: 'ВЕЧЕР',
            night: 'НОЧЬ'
        };
        return names[this.getPeriod()];
    }
    
    // Подписаться на изменения времени
    onChange(callback) {
        this._listeners.push(callback);
        return () => {
            this._listeners = this._listeners.filter(cb => cb !== callback);
        };
    }
    
    // Уведомить всех слушателей
    _notify(data) {
        this._listeners.forEach(cb => {
            try { cb(data); } catch (e) { console.error('GameTime listener error:', e); }
        });
    }
    
    // Сериализация для сохранения
    toJSON() {
        return { hour: this.hour, minute: this.minute, day: this.day };
    }
    
    // Создать из сохранённых данных
    static fromJSON(json) {
        return new GameTime(json.hour, json.minute, json.day);
    }
}