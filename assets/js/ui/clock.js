class ClockUI {
    constructor() {
        this.timeEl = document.getElementById('game-time');
        this.iconEl = document.querySelector('.time-icon');
        this.dayEl = document.getElementById('game-day');
        this.body = document.body;
    }
    
    // Обновить отображение часов
    update(gameTime) {
        const timeData = {
            formatted: gameTime.getFormatted(),
            icon: gameTime.getIcon(),
            day: gameTime.day,
            period: gameTime.getPeriod()
        };
        
        // Обновляем DOM
        if (this.timeEl) this.timeEl.textContent = timeData.formatted;
        if (this.iconEl) this.iconEl.textContent = timeData.icon;
        if (this.dayEl) this.dayEl.textContent = timeData.day;
        
        // Обновляем классы на body для смены темы
        this.body.classList.remove('dawn-time', 'day-time', 'evening-time', 'night-time');
        this.body.classList.add(`${timeData.period}-time`);
        
        // Обновляем подвал
        const footerCmd = document.getElementById('footer-cmd');
        if (footerCmd) {
            const periodName = timeData.period.toUpperCase();
            footerCmd.textContent = `период_${periodName}`;
        }
    }
    
    // Анимация смены периода (плавный переход)
    animatePeriodChange(oldPeriod, newPeriod) {
        // Вспышка при смене
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: white;
            opacity: 0.3;
            pointer-events: none;
            z-index: 9999;
            transition: opacity 0.5s;
        `;
        document.body.appendChild(flash);
        
        requestAnimationFrame(() => {
            flash.style.opacity = '0';
        });
        
        setTimeout(() => flash.remove(), 500);
        
        // Уведомление о смене периода
        events.emit('notification:show', {
            message: `Время суток изменилось: ${oldPeriod} → ${newPeriod}`,
            type: 'info',
            duration: 3000
        });
    }
}