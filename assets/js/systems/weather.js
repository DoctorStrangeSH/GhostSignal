class WeatherSystem {
    constructor(gameTime) {
        this.gameTime = gameTime;
        this.currentWeather = 'clear'; // clear, rain, fog, storm
        this.weatherDuration = 0;       // Сколько игровых минут осталось
        this.weatherHistory = [];
        
        // Настройки погоды
        this.weatherTypes = {
            clear: {
                name: 'Ясно',
                icon: '☀️',
                duration: [120, 480],      // 2-8 часов
                chance: 50,                // Вероятность (%)
                affectsLocations: [],
                itemModifiers: {}
            },
            rain: {
                name: 'Дождь',
                icon: '🌧️',
                duration: [60, 180],       // 1-3 часа
                chance: 25,
                affectsLocations: ['alley'],
                itemModifiers: {
                    hideItems: [],          // Предметы, которые скрываются
                    revealItems: ['washed_note', 'muddy_footprints'], // Появляются в дождь
                }
            },
            fog: {
                name: 'Туман',
                icon: '🌫️',
                duration: [90, 240],       // 1.5-4 часа
                chance: 15,
                affectsLocations: ['alley'],
                itemModifiers: {
                    hideItems: ['broken_lamp', 'graffiti_wall'],
                    revealItems: [],
                }
            },
            storm: {
                name: 'Гроза',
                icon: '⛈️',
                duration: [30, 90],        // 0.5-1.5 часа
                chance: 10,
                affectsLocations: ['alley'],
                itemModifiers: {
                    hideItems: ['broken_lamp', 'graffiti_wall', 'dumpster'],
                    revealItems: ['lightning_clue'],
                }
            }
        };
        
        // Запускаем цикл смены погоды
        this._scheduleChange();
    }
    
    _scheduleChange() {
        // Меняем погоду каждые 2-8 игровых часов
        const interval = 120 + Math.floor(Math.random() * 360);
        
        setTimeout(() => {
            this._changeWeather();
            this._scheduleChange();
        }, interval * 100); // Ускорено для игры (1 игровой час = 100 реальных секунд)
    }
    
    _changeWeather() {
        // Выбираем новую погоду на основе вероятностей
        const rand = Math.random() * 100;
        let cumulative = 0;
        let newWeather = 'clear';
        
        for (const [type, config] of Object.entries(this.weatherTypes)) {
            if (type === this.currentWeather) continue; // Не повторяем ту же погоду
            cumulative += config.chance;
            if (rand <= cumulative) {
                newWeather = type;
                break;
            }
        }
        
        const config = this.weatherTypes[newWeather];
        this.weatherDuration = config.duration[0] + 
            Math.floor(Math.random() * (config.duration[1] - config.duration[0]));
        this.currentWeather = newWeather;
        this.weatherHistory.push({ weather: newWeather, time: this.gameTime.getFormatted() });
        
        // Применяем эффекты
        this._applyWeatherEffects(newWeather);
        
        // Уведомление
        events.emit('notification:show', {
            message: `Погода изменилась: ${config.icon} ${config.name}`,
            type: 'info',
            duration: 4000
        });
        
        events.emit('weather:changed', { weather: newWeather, config });
    }
    
    _applyWeatherEffects(weather) {
        const body = document.body;
        
        // Убираем все погодные классы
        body.classList.remove('weather-rain', 'weather-fog', 'weather-storm');
        
        switch (weather) {
            case 'rain':
                body.classList.add('weather-rain');
                break;
            case 'fog':
                body.classList.add('weather-fog');
                break;
            case 'storm':
                body.classList.add('weather-storm');
                break;
        }
    }
    
    // Получить предметы, которые должны быть скрыты/показаны на локации
    getModifiedItems(locationId, baseItems) {
        const config = this.weatherTypes[this.currentWeather];
        if (!config.affectsLocations.includes(locationId)) return baseItems;
        
        let items = [...baseItems];
        
        // Скрываем предметы
        if (config.itemModifiers.hideItems) {
            items = items.filter(item => !config.itemModifiers.hideItems.includes(item));
        }
        
        // Добавляем погодные предметы
        if (config.itemModifiers.revealItems) {
            items = [...items, ...config.itemModifiers.revealItems];
        }
        
        return items;
    }
    
    getCurrentWeather() {
        return this.weatherTypes[this.currentWeather];
    }
    
    // Сериализация
    toJSON() {
        return {
            currentWeather: this.currentWeather,
            weatherDuration: this.weatherDuration
        };
    }
    
    static fromJSON(json, gameTime) {
        const system = new WeatherSystem(gameTime);
        if (json) {
            system.currentWeather = json.currentWeather || 'clear';
            system.weatherDuration = json.weatherDuration || 0;
        }
        return system;
    }
}