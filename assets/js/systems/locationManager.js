class LocationManager {
    constructor(gameTime) {
        this.gameTime = gameTime;
        this.currentLocation = null;
        this.unlockedLocations = new Set(['police_station', 'hotel_grand', 'hotel_room_304', 'bar_joe', 'alley']);
        this.visitedLocations = new Set();
        this._listeners = [];
    }
    
    // Проверить, доступна ли локация сейчас
    isLocationAvailable(locationId) {
        const location = getLocationById(locationId);
        if (!location) return false;
        
        // Проверяем, разблокирована ли
        if (!this.unlockedLocations.has(locationId) && !location.unlockedByDefault) {
            return false;
        }
        
        // Проверяем часы работы
        const currentHour = this.gameTime.hour;
        const { open, close } = location.hours;
        
        if (close > open) {
            // Обычный режим: открыто с open до close
            if (currentHour < open || currentHour >= close) return false;
        } else if (close < open) {
            // Ночной режим: открыто с open до close следующего дня
            if (currentHour < open && currentHour >= close) return false;
        }
        // Если open === close (0 и 24) — круглосуточно
        
        return true;
    }
    
    // Разблокировать локацию
    unlockLocation(locationId) {
        if (!this.unlockedLocations.has(locationId)) {
            this.unlockedLocations.add(locationId);
            events.emit('location:unlocked', { locationId });
            events.emit('notification:show', {
                message: `Новая локация открыта: ${getLocationById(locationId)?.name || locationId}`,
                type: 'success',
                duration: 4000
            });
            return true;
        }
        return false;
    }
    
    // Переместиться в локацию
    travelTo(locationId) {
        const location = getLocationById(locationId);
        if (!location) {
            console.error('Локация не найдена:', locationId);
            return false;
        }
        
        if (!this.isLocationAvailable(locationId)) {
            const currentHour = this.gameTime.hour;
            const { open, close } = location.hours;
            events.emit('notification:show', {
                message: `${location.name} закрыто. Часы работы: ${open}:00–${close}:00. Сейчас ${this.gameTime.getFormatted()}.`,
                type: 'warning',
                duration: 4000
            });
            return false;
        }
        
        const prevLocation = this.currentLocation;
        this.currentLocation = locationId;
        this.visitedLocations.add(locationId);
        
        // Тратим время на перемещение (если не первое действие)
        if (prevLocation && prevLocation !== locationId) {
            this.gameTime.advance(CONFIG.time.costs.travel);
        }
        
        // Уведомляем
        events.emit('location:changed', {
            locationId,
            location,
            previousLocation: prevLocation
        });
        
        events.emit('notification:show', {
            message: `Перемещение: ${location.name}`,
            type: 'info',
            duration: 2000
        });
        
        return true;
    }
    
    // Получить список доступных локаций на карте
    getAvailableMapLocations() {
        return getMapLocations().filter(loc => {
            // Доступна или разблокирована
            return this.isLocationAvailable(loc.id) || this.unlockedLocations.has(loc.id);
        }).map(loc => ({
            ...loc,
            isAvailable: this.isLocationAvailable(loc.id),
            isUnlocked: this.unlockedLocations.has(loc.id) || loc.unlockedByDefault,
            isCurrent: loc.id === this.currentLocation
        }));
    }
    
    // Получить подлокации текущей локации
    getCurrentSubLocations() {
        if (!this.currentLocation) return [];
        return getSubLocations(this.currentLocation).filter(loc => 
            this.isLocationAvailable(loc.id)
        );
    }
    
    // Получить предметы на локации с учётом времени суток
    getLocationItems(locationId) {
        const location = getLocationById(locationId);
        if (!location) return [];
        
        let items = [...location.defaultItems];
        
        // Добавляем ночные предметы
        if (location.nightOnlyItems && this.gameTime.isNighttime()) {
            items = [...items, ...location.nightOnlyItems];
        }
        
        return items;
    }
    
    // Получить NPC на локации
    getLocationNPCs(locationId) {
        const location = getLocationById(locationId);
        if (!location) return [];
        return location.npcsPresent || [];
    }
    
    // Подписаться на изменения
    onChange(callback) {
        this._listeners.push(callback);
        return () => {
            this._listeners = this._listeners.filter(cb => cb !== callback);
        };
    }
    
    // Сериализация
    toJSON() {
        return {
            currentLocation: this.currentLocation,
            unlockedLocations: [...this.unlockedLocations],
            visitedLocations: [...this.visitedLocations]
        };
    }
    
    // Восстановление
    static fromJSON(json, gameTime) {
        const manager = new LocationManager(gameTime);
        if (json) {
            manager.currentLocation = json.currentLocation || null;
            manager.unlockedLocations = new Set(json.unlockedLocations || []);
            manager.visitedLocations = new Set(json.visitedLocations || []);
        }
        return manager;
    }
}