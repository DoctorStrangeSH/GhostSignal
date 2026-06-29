class CloudStorage {
    constructor(authManager) {
        this.authManager = authManager;
        this.isOnline = false;
        
        if (firestoreDB) {
            this.isOnline = true;
        }
    }
    
    // Сохранить прогресс в облако
    async saveToCloud(progressData) {
        if (!this.isOnline || !this.authManager.isUserLoggedIn()) {
            console.warn('⚠️ Не могу сохранить в облако: офлайн или не вошёл');
            return false;
        }
        
        const userId = this.authManager.getUser().uid;
        
        try {
            await firestoreDB
                .collection('users')
                .doc(userId)
                .collection('progress')
                .doc('current')
                .set({
                    data: progressData,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    version: CONFIG.version
                }, { merge: true });
            
            console.log('☁️ Прогресс сохранён в облако');
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения в облако:', error);
            return false;
        }
    }
    
    // Загрузить прогресс из облака
    async loadFromCloud() {
        if (!this.isOnline || !this.authManager.isUserLoggedIn()) {
            console.warn('⚠️ Не могу загрузить из облака');
            return null;
        }
        
        const userId = this.authManager.getUser().uid;
        
        try {
            const doc = await firestoreDB
                .collection('users')
                .doc(userId)
                .collection('progress')
                .doc('current')
                .get();
            
            if (doc.exists) {
                const cloudData = doc.data();
                console.log('☁️ Прогресс загружен из облака');
                return cloudData.data;
            } else {
                console.log('☁️ В облаке нет сохранений');
                return null;
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки из облака:', error);
            return null;
        }
    }
    
    // Удалить облачное сохранение
    async deleteCloudSave() {
        if (!this.isOnline || !this.authManager.isUserLoggedIn()) return false;
        
        const userId = this.authManager.getUser().uid;
        
        try {
            await firestoreDB
                .collection('users')
                .doc(userId)
                .collection('progress')
                .doc('current')
                .delete();
            
            console.log('☁️ Облачное сохранение удалено');
            return true;
        } catch (error) {
            console.error('❌ Ошибка удаления:', error);
            return false;
        }
    }
}