class NotificationManager {
    constructor() {
        this.container = null;
        this.queue = [];
        this._createContainer();
        this._bindEvents();
        window.addEventListener('resize', () => this._updatePosition());
    }

    _createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'notifications-container';
        this.container.setAttribute('role', 'status');
        this.container.setAttribute('aria-live', 'polite');
        this.container.setAttribute('aria-atomic', 'false');
        this._updatePosition();
        document.body.appendChild(this.container);
    }

    _updatePosition() {
        if (!this.container) return;
        const isMobile = window.innerWidth < 768;

        this.container.style.cssText = `
            position: fixed;
            ${isMobile ? 'top: 56px; left: 8px; right: 8px;' : 'top: 60px; right: 16px;'}
            z-index: 2000;
            display: flex;
            flex-direction: column;
            gap: 6px;
            pointer-events: none;
            ${isMobile ? '' : 'width: 360px;'}
        `;
    }

    _bindEvents() {
        events.on('notification:show', (data) => {
            this.show(data.message, data.type || 'info', data.duration || 3000);
        });
        events.on('npc:contradiction_detected', (data) => {
            if (!data?.contradictions?.length) return;
            this.show('Обнаружено расхождение в показаниях. Проверьте источники на доске расследования.', 'discovery', 5500);
        });
    }

    show(message, type = 'info', duration = 3000) {
        const icons = {
            info: 'ℹ️', success: '✅', warning: '⚠️',
            error: '❌', system: '🖥️', evidence: '🔍', discovery: '⚖️'
        };

        const colors = {
            info: 'rgba(240, 192, 64, 0.3)',
            success: 'rgba(76, 175, 80, 0.3)',
            warning: 'rgba(255, 152, 0, 0.3)',
            error: 'rgba(192, 57, 43, 0.3)',
            system: 'rgba(136, 136, 204, 0.3)',
            evidence: 'rgba(240, 192, 64, 0.3)', discovery: 'rgba(125, 196, 189, 0.48)'
        };

        const notification = document.createElement('div');
        notification.className = `notification notification--${Object.hasOwn(icons, type) ? type : 'info'}`;
        notification.style.cssText = `
            background: rgba(13, 10, 8, 0.95);
            border: 1px solid ${colors[type] || colors.info};
            border-left: 3px solid ${colors[type] || colors.info};
            color: var(--text-bright);
            padding: 10px 14px;
            font-family: var(--font-mono);
            font-size: 11px;
            pointer-events: none;
            border-radius: var(--radius-sm);
            box-shadow: var(--shadow-md);
            animation: notif-in 0.3s ease-out;
            transition: opacity 0.3s, transform 0.3s;
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        const icon = document.createElement('span');
        icon.className = 'notification-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = icons[type] || '•';
        const content = document.createElement('span');
        content.className = 'notification-text';
        content.textContent = String(message ?? '');
        notification.append(icon, content);

        this.container.appendChild(notification);

        // Удаляем старые (больше 4)
        const all = this.container.querySelectorAll('.notification');
        if (all.length > 4) all[0].remove();

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(20px)';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

const notifStyle = document.createElement('style');
notifStyle.textContent = `
    @keyframes notif-in {
        from { opacity: 0; transform: translateX(30px); }
        to { opacity: 1; transform: translateX(0); }
    }
`;
document.head.appendChild(notifStyle);

document.addEventListener('DOMContentLoaded', () => {
    window.notifications = new NotificationManager();
});
