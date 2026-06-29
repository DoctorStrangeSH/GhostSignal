class AmbianceDetails {
    constructor(gameTime, weatherSystem) {
        this.gameTime = gameTime;
        this.weather = weatherSystem;
        this._init();
    }
    
    _init() {
        // Обновляем детали при смене локации
        events.on('location:changed', (data) => {
            this._updateLocationAmbiance(data.locationId);
        });
        
        // Обновляем при смене погоды
        events.on('weather:changed', (data) => {
            this._updateWeatherAmbiance(data.weather);
        });
    }
    
    _updateLocationAmbiance(locationId) {
        const body = document.body;
        
        // Убираем все локационные классы
        body.classList.remove('loc-bar', 'loc-alley', 'loc-hotel', 'loc-station');
        
        // Добавляем специфичный класс
        switch (locationId) {
            case 'bar_joe':
                body.classList.add('loc-bar');
                break;
            case 'alley':
                body.classList.add('loc-alley');
                break;
            case 'hotel_grand':
            case 'hotel_room_304':
                body.classList.add('loc-hotel');
                break;
            case 'police_station':
                body.classList.add('loc-station');
                break;
        }
    }
    
    _updateWeatherAmbiance(weather) {
        // Можно добавить звуки погоды
        switch (weather) {
            case 'rain':
                // Тихий шум дождя уже есть в CSS
                break;
            case 'storm':
                // Гром через Web Audio API
                break;
        }
    }
}