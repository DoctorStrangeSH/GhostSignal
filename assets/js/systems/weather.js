class WeatherSystem {
    constructor(gameTime) {
        this.gameTime = gameTime;
        this.currentWeather = 'clear';
        this.weatherDuration = 0;
        this.weatherHistory = [];
        this._timeoutId = null;
        
        this.weatherTypes = {
            clear: {
                name: 'Ясно',
                icon: '☀️',
                duration: [120, 480],
                chance: 40,
                affectsLocations: [],
                itemModifiers: {}
            },
            rain: {
                name: 'Дождь',
                icon: '🌧️',
                duration: [60, 180],
                chance: 30,
                affectsLocations: ['alley'],
                itemModifiers: {
                    hideItems: [],
                    revealItems: ['muddy_footprints'],
                }
            },
            fog: {
                name: 'Туман',
                icon: '🌫️',
                duration: [90, 240],
                chance: 20,
                affectsLocations: ['alley'],
                itemModifiers: {
                    hideItems: ['graffiti_wall'],
                    revealItems: [],
                }
            },
            storm: {
                name: 'Гроза',
                icon: '⛈️',
                duration: [30, 90],
                chance: 10,
                affectsLocations: ['alley'],
                itemModifiers: {
                    hideItems: ['broken_lamp'],
                    revealItems: ['lightning_clue'],
                }
            }
        };
        
        this._scheduleChange();
    }
    
    _scheduleChange() {
        if (this._timeoutId) clearTimeout(this._timeoutId);
        
        if (!window.app?.progress?.activeCase) {
            this._timeoutId = setTimeout(() => this._scheduleChange(), 30000);
            return;
        }
        
        const interval = 5 * 60 * 1000 + Math.floor(Math.random() * 5 * 60 * 1000);
        
        this._timeoutId = setTimeout(() => {
            this._changeWeather();
            this._scheduleChange();
        }, interval);
    }
    
    _changeWeather() {
        if (!window.app?.progress?.activeCase) return;
        
        const rand = Math.random() * 100;
        let cumulative = 0;
        let newWeather = 'clear';
        
        for (const [type, config] of Object.entries(this.weatherTypes)) {
            if (type === this.currentWeather) continue;
            cumulative += config.chance;
            if (rand <= cumulative) { newWeather = type; break; }
        }
        
        const config = this.weatherTypes[newWeather];
        this.weatherDuration = config.duration[0] + Math.floor(Math.random() * (config.duration[1] - config.duration[0]));
        this.currentWeather = newWeather;
        
        this._applyWeatherEffects(newWeather);
        
        // Атмосферные сообщения
        const messages = {
            clear: {
                title: '☀️ Небо прояснилось',
                text: 'Тучи рассеялись. Город снова виден как на ладони. Самое время для прогулки по переулкам.'
            },
            rain: {
                title: '🌧️ Начинается дождь',
                text: 'Крупные капли барабанят по крышам. Улицы пустеют. Следы на асфальте расскажут больше, чем свидетели.'
            },
            fog: {
                title: '🌫️ Опускается туман',
                text: 'Город тонет в серой мгле. В двух шагах ничего не видно. Будьте осторожны — в тумане легко пропустить важное.'
            },
            storm: {
                title: '⛈️ Надвигается гроза',
                text: 'Молнии разрезают небо. Гром сотрясает стены. Лучше переждать в помещении — на улице сейчас опасно.'
            }
        };
        
        const msg = messages[newWeather];
        if (msg) {
            events.emit('modal:show', {
                title: msg.title,
                body: `
                    <div style="font-family: var(--font-serif); font-size: 15px; line-height: 1.8; color: var(--text-primary); font-style: italic; text-align: center;">
                        <p>${msg.text}</p>
                        ${newWeather === 'storm' ? '<p style="color: var(--accent-amber); margin-top: 12px;">⚡ На улице сейчас небезопасно. Рекомендуется оставаться в помещении.</p>' : ''}
                        ${newWeather === 'fog' ? '<p style="color: var(--text-dim); margin-top: 12px;">🔍 Некоторые предметы могут быть скрыты туманом.</p>' : ''}
                        ${newWeather === 'rain' ? '<p style="color: var(--accent-blue-light); margin-top: 12px;">💧 Дождь может открыть новые улики, скрытые в земле.</p>' : ''}
                    </div>
                `,
                footer: '<button class="terminal-btn" data-bs-dismiss="modal">ПОНЯТНО</button>'
            });
        }
        
        events.emit('notification:show', {
            message: `Погода: ${config.icon} ${config.name}`,
            type: 'info',
            duration: 3000
        });
        
        events.emit('weather:changed', { weather: newWeather, config });
    }
    
    _applyWeatherEffects(weather) {
        const body = document.body;
        body.classList.remove('weather-rain', 'weather-fog', 'weather-storm');
        if (weather !== 'clear') body.classList.add('weather-' + weather);
    }
    
    getModifiedItems(locationId, baseItems) {
        const config = this.weatherTypes[this.currentWeather];
        if (!config.affectsLocations.includes(locationId)) return baseItems;
        
        let items = [...baseItems];
        
        if (config.itemModifiers.hideItems) {
            items = items.filter(item => !config.itemModifiers.hideItems.includes(item));
        }
        
        if (config.itemModifiers.revealItems) {
            items = [...items, ...config.itemModifiers.revealItems];
        }
        
        return items;
    }
    
    getCurrentWeather() {
        return this.weatherTypes[this.currentWeather];
    }
    
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