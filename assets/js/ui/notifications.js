class NotificationManager {
    constructor() {
        this.container = null;
        this._createContainer();
        this._bindEvents();
    }
    
    _createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'notifications-container';
        this.container.style.cssText = `
            position: fixed;
            bottom: 40px;
            left: 16px;
            z-index: 2000;
            display: flex;
            flex-direction: column-reverse;
            gap: 6px;
            pointer-events: none;
            max-width: 360px;
        `;
        document.body.appendChild(this.container);
    }
    
    _bindEvents() {
        events.on('notification:show', (data) => {
            this.show(data.message, data.type || 'info', data.duration || 3000);
        });
    }
    
    show(message, type = 'info', duration = 3000) {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            system: '🖥️',
            evidence: '🔍'
        };
        
        const colors = {
            info: 'var(--accent-green)',
            success: '#4caf50',
            warning: 'var(--accent-amber)',
            error: 'var(--accent-red-bright)',
            system: '#8888cc',
            evidence: 'var(--accent-amber)'
        };
        
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.cssText = `
            background: rgba(10, 15, 10, 0.95);
            border: 1px solid ${colors[type] || colors.info};
            border-left: 3px solid ${colors[type] || colors.info};
            color: var(--text-bright);
            padding: 10px 14px;
            font-family: var(--font-mono);
            font-size: 12px;
            pointer-events: auto;
            border-radius: 6px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
            animation: slide-in-left 0.3s ease-out;
            transition: opacity 0.3s, transform 0.3s;
            backdrop-filter: blur(8px);
        `;
        
        notification.innerHTML = `
            <span style="margin-right: 6px;">${icons[type] || '•'}</span>
            ${message}
        `;
        
        this.container.appendChild(notification);
        
        // Удаляем старые уведомления если их больше 4
        const allNotifications = this.container.querySelectorAll('.notification');
        if (allNotifications.length > 4) {
            allNotifications[allNotifications.length - 1].remove();
        }
        
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-20px)';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

// Анимация
const notifStyle = document.createElement('style');
notifStyle.textContent = `
    @keyframes slide-in-left {
        from { opacity: 0; transform: translateX(-30px); }
        to { opacity: 1; transform: translateX(0); }
    }
`;
document.head.appendChild(notifStyle);

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    window.notifications = new NotificationManager();
});