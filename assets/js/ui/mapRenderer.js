class MapRenderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.locationManager = null;
        this._markers = [];
        this._init();
    }
    
    setLocationManager(manager) {
        this.locationManager = manager;
    }
    
    _init() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="map-wrapper">
                <div class="map-background">
                    <div class="map-grid"></div>
                    <div class="map-roads"></div>
                    <div class="map-markers"></div>
                </div>
                <div class="map-legend">
                    <span class="legend-item"><span class="legend-dot available"></span> Доступно</span>
                    <span class="legend-item"><span class="legend-dot locked"></span> Закрыто</span>
                    <span class="legend-item"><span class="legend-dot current"></span> Вы здесь</span>
                </div>
            </div>
        `;
        
        this.markersContainer = this.container.querySelector('.map-markers');
    }
    
    render() {
        if (!this.locationManager || !this.markersContainer) return;
        
        const locations = this.locationManager.getAvailableMapLocations();
        this.markersContainer.innerHTML = '';
        this._markers = [];
        
        locations.forEach(location => {
            const marker = this._createMarker(location);
            this.markersContainer.appendChild(marker.element);
            this._markers.push(marker);
        });
    }
    
    _createMarker(location) {
        const el = document.createElement('div');
        el.className = 'map-marker';
        el.style.left = location.mapPosition.x + '%';
        el.style.top = location.mapPosition.y + '%';
        
        if (location.isCurrent) el.classList.add('marker-current');
        if (!location.isAvailable) el.classList.add('marker-locked');
        if (location.isAvailable && !location.isCurrent) el.classList.add('marker-available');
        
        el.innerHTML = `
            <div class="marker-pin">
                <span class="marker-icon">${location.icon}</span>
            </div>
            <div class="marker-label">${location.name}</div>
            <div class="marker-status">
                ${location.isCurrent ? '📍 ВЫ ЗДЕСЬ' : 
                  location.isAvailable ? '🟢 ОТКРЫТО' : '🔴 ЗАКРЫТО'}
            </div>
        `;
        
        // КЛИК — СРАЗУ ПЕРЕХОДИМ
        el.addEventListener('click', () => {
            if (location.isAvailable || location.isUnlocked) {
                // Перемещаемся в локацию
                this.locationManager.travelTo(location.id);
                // Переключаемся на экран дела
                events.emit('navigation:go', 'screen-case-active');
            } else {
                events.emit('notification:show', {
                    message: `${location.name} недоступно.`,
                    type: 'warning',
                    duration: 3000
                });
            }
        });
        
        el.addEventListener('mouseenter', () => {
            el.querySelector('.marker-label').style.opacity = '1';
        });
        
        el.addEventListener('mouseleave', () => {
            if (!location.isCurrent) {
                el.querySelector('.marker-label').style.opacity = '0.7';
            }
        });
        
        return { element: el, location };
    }
}