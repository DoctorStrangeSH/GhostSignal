class AuthUI {
    constructor(authManager) {
        this.authManager = authManager;
        this._createLoginButton();
        this._bindEvents();
    }
    
    _createLoginButton() {
        // Добавляем кнопку в главное меню
        const menuActions = document.querySelector('.menu-actions');
        if (!menuActions) return;
        
        const authBtn = document.createElement('button');
        authBtn.id = 'btn-auth';
        authBtn.className = 'terminal-btn';
        authBtn.textContent = '[5] ВОЙТИ';
        authBtn.style.cssText = 'margin-top: 8px; border-color: var(--accent-blue);';
        
        menuActions.appendChild(authBtn);
        
        // Обновляем текст кнопки при изменении авторизации
        this.authManager.onChange((user) => {
            if (user) {
                authBtn.textContent = '[5] 👤 ' + user.email;
                authBtn.style.borderColor = 'var(--accent-green)';
            } else {
                authBtn.textContent = '[5] ВОЙТИ';
                authBtn.style.borderColor = 'var(--accent-blue)';
            }
        });
    }
    
    _bindEvents() {
        document.getElementById('btn-auth')?.addEventListener('click', () => {
            if (this.authManager.isUserLoggedIn()) {
                this._showAccountMenu();
            } else {
                this._showLoginForm();
            }
        });
        
        // Клавиша 5
        document.addEventListener('keydown', (e) => {
            if (e.key === '5' && window.app?.currentScreen === 'screen-main-menu') {
                document.getElementById('btn-auth')?.click();
            }
        });
    }
    
    _showLoginForm() {
        const modalBody = document.getElementById('modal-body');
        const modalTitle = document.getElementById('modal-title');
        const modalFooter = document.getElementById('modal-footer');
        
        if (!modalBody || !modalTitle || !modalFooter) return;
        
        modalTitle.textContent = '🔐 ВХОД';
        modalBody.innerHTML = `
            <div id="auth-form">
                <div class="auth-input-group">
                    <label>Email:</label>
                    <input type="email" id="auth-email" class="terminal-input" placeholder="detective@example.com">
                </div>
                <div class="auth-input-group">
                    <label>Пароль:</label>
                    <input type="password" id="auth-password" class="terminal-input" placeholder="••••••••">
                </div>
                <div id="auth-error" class="auth-error hidden"></div>
                <div class="auth-links">
                    <button id="btn-register-link" class="terminal-btn btn-sm">Создать аккаунт</button>
                    <button id="btn-reset-link" class="terminal-btn btn-sm">Забыли пароль?</button>
                </div>
            </div>
        `;
        
        modalFooter.innerHTML = `
            <button id="btn-login-submit" class="terminal-btn">ВОЙТИ</button>
            <button class="terminal-btn" data-bs-dismiss="modal">ОТМЕНА</button>
        `;
        
        const modal = new bootstrap.Modal(document.getElementById('universal-modal'));
        modal.show();
        
        // Обработчики
        document.getElementById('btn-login-submit').addEventListener('click', () => this._handleLogin(modal));
        document.getElementById('auth-password').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._handleLogin(modal);
        });
        document.getElementById('btn-register-link').addEventListener('click', () => this._showRegisterForm(modal));
    }
    
    async _handleLogin(modal) {
        const email = document.getElementById('auth-email')?.value || '';
        const password = document.getElementById('auth-password')?.value || '';
        const errorEl = document.getElementById('auth-error');
        
        if (!email || !password) {
            if (errorEl) { errorEl.textContent = 'Заполните все поля'; errorEl.classList.remove('hidden'); }
            return;
        }
        
        try {
            await this.authManager.login(email, password);
            modal.hide();
            events.emit('notification:show', { message: 'Вход выполнен!', type: 'success', duration: 3000 });
        } catch (error) {
            if (errorEl) { errorEl.textContent = this._translateError(error.message); errorEl.classList.remove('hidden'); }
        }
    }
    
    _showRegisterForm(modal) {
        const modalBody = document.getElementById('modal-body');
        const modalFooter = document.getElementById('modal-footer');
        
        modalBody.innerHTML = `
            <div id="auth-form">
                <div class="auth-input-group">
                    <label>Email:</label>
                    <input type="email" id="auth-email" class="terminal-input" placeholder="detective@example.com">
                </div>
                <div class="auth-input-group">
                    <label>Пароль:</label>
                    <input type="password" id="auth-password" class="terminal-input" placeholder="••••••••">
                </div>
                <div class="auth-input-group">
                    <label>Повторите пароль:</label>
                    <input type="password" id="auth-password-confirm" class="terminal-input" placeholder="••••••••">
                </div>
                <div id="auth-error" class="auth-error hidden"></div>
            </div>
        `;
        
        modalFooter.innerHTML = `
            <button id="btn-register-submit" class="terminal-btn">СОЗДАТЬ</button>
            <button class="terminal-btn" data-bs-dismiss="modal">ОТМЕНА</button>
        `;
        
        document.getElementById('btn-register-submit').addEventListener('click', async () => {
            const email = document.getElementById('auth-email')?.value || '';
            const password = document.getElementById('auth-password')?.value || '';
            const confirm = document.getElementById('auth-password-confirm')?.value || '';
            const errorEl = document.getElementById('auth-error');
            
            if (!email || !password) {
                if (errorEl) { errorEl.textContent = 'Заполните все поля'; errorEl.classList.remove('hidden'); }
                return;
            }
            
            if (password !== confirm) {
                if (errorEl) { errorEl.textContent = 'Пароли не совпадают'; errorEl.classList.remove('hidden'); }
                return;
            }
            
            if (password.length < 6) {
                if (errorEl) { errorEl.textContent = 'Пароль должен быть не менее 6 символов'; errorEl.classList.remove('hidden'); }
                return;
            }
            
            try {
                await this.authManager.register(email, password);
                modal.hide();
                events.emit('notification:show', { message: 'Аккаунт создан!', type: 'success', duration: 3000 });
            } catch (error) {
                if (errorEl) { errorEl.textContent = this._translateError(error.message); errorEl.classList.remove('hidden'); }
            }
        });
    }
    
    _showAccountMenu() {
        const modalBody = document.getElementById('modal-body');
        const modalTitle = document.getElementById('modal-title');
        const modalFooter = document.getElementById('modal-footer');
        
        if (!modalBody || !modalTitle || !modalFooter) return;
        
        const user = this.authManager.getUser();
        
        modalTitle.textContent = '👤 АККАУНТ';
        modalBody.innerHTML = `
            <p>Вы вошли как: <strong>${user?.email || 'Неизвестно'}</strong></p>
            <p style="font-size: 12px; color: var(--text-dim);">Прогресс синхронизируется автоматически.</p>
        `;
        modalFooter.innerHTML = `
            <button id="btn-logout" class="terminal-btn" style="border-color: var(--accent-red-bright);">ВЫЙТИ</button>
            <button class="terminal-btn" data-bs-dismiss="modal">ЗАКРЫТЬ</button>
        `;
        
        const modal = new bootstrap.Modal(document.getElementById('universal-modal'));
        modal.show();
        
        document.getElementById('btn-logout').addEventListener('click', async () => {
            await this.authManager.logout();
            modal.hide();
        });
    }
    
    _translateError(message) {
        const translations = {
            'invalid-email': 'Неверный формат email',
            'user-disabled': 'Аккаунт отключён',
            'user-not-found': 'Пользователь не найден',
            'wrong-password': 'Неверный пароль',
            'email-already-in-use': 'Email уже используется',
            'weak-password': 'Слишком простой пароль',
            'too-many-requests': 'Слишком много попыток. Попробуйте позже.',
        };
        
        for (const [key, value] of Object.entries(translations)) {
            if (message.includes(key)) return value;
        }
        return message;
    }
}