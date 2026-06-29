class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isLoggedIn = false;
        this._listeners = [];
        
        // Инициализируем Firebase если ещё нет
        if (!firebaseApp) {
            initFirebase();
        }
        
        // Слушаем изменения авторизации
        if (firebaseAuth) {
            firebaseAuth.onAuthStateChanged((user) => {
                this.currentUser = user;
                this.isLoggedIn = !!user;
                
                if (user) {
                    console.log('👤 Пользователь вошёл:', user.email);
                    events.emit('auth:login', { user });
                } else {
                    console.log('👤 Пользователь вышел');
                    events.emit('auth:logout');
                }
                
                this._notifyListeners();
            });
        }
    }
    
    // Регистрация
    async register(email, password) {
        if (!firebaseAuth) {
            throw new Error('Firebase не инициализирован');
        }
        
        try {
            const result = await firebaseAuth.createUserWithEmailAndPassword(email, password);
            console.log('✅ Регистрация успешна:', result.user.email);
            return result.user;
        } catch (error) {
            console.error('❌ Ошибка регистрации:', error.message);
            throw error;
        }
    }
    
    // Вход
    async login(email, password) {
        if (!firebaseAuth) {
            throw new Error('Firebase не инициализирован');
        }
        
        try {
            const result = await firebaseAuth.signInWithEmailAndPassword(email, password);
            console.log('✅ Вход выполнен:', result.user.email);
            return result.user;
        } catch (error) {
            console.error('❌ Ошибка входа:', error.message);
            throw error;
        }
    }
    
    // Выход
    async logout() {
        if (!firebaseAuth) return;
        
        try {
            await firebaseAuth.signOut();
            console.log('✅ Выход выполнен');
        } catch (error) {
            console.error('❌ Ошибка выхода:', error.message);
        }
    }
    
    // Сброс пароля
    async resetPassword(email) {
        if (!firebaseAuth) {
            throw new Error('Firebase не инициализирован');
        }
        
        try {
            await firebaseAuth.sendPasswordResetEmail(email);
            console.log('✅ Письмо для сброса отправлено');
        } catch (error) {
            console.error('❌ Ошибка сброса пароля:', error.message);
            throw error;
        }
    }
    
    // Получить текущего пользователя
    getUser() {
        return this.currentUser;
    }
    
    // Проверить, вошёл ли пользователь
    isUserLoggedIn() {
        return this.isLoggedIn;
    }
    
    // Подписка на изменения
    onChange(callback) {
        this._listeners.push(callback);
        return () => {
            this._listeners = this._listeners.filter(cb => cb !== callback);
        };
    }
    
    _notifyListeners() {
        this._listeners.forEach(cb => {
            try { cb(this.currentUser); } catch(e) {}
        });
    }
}