// ============================================
// КОНФИГУРАЦИЯ FIREBASE
// ============================================

const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDtLOw-KR46NOQeHSXt3Y-S8ZIeUttPlQY",
    authDomain: "ghostsignal-47a15.firebaseapp.com",
    projectId: "ghostsignal-47a15",
    storageBucket: "ghostsignal-47a15.firebasestorage.app",
    messagingSenderId: "114137750345",
    appId: "1:114137750345:web:79fb645a9f3b0732b41898"
};

let firebaseApp = null;
let firebaseAuth = null;
let firestoreDB = null;

function initFirebase() {
    if (typeof firebase === 'undefined') {
        console.warn('⚠️ Firebase SDK не загружен. Работаем офлайн.');
        return false;
    }

    try {
        firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
        firebaseAuth = firebase.auth();
        firestoreDB = firebase.firestore();

        console.log('✅ Firebase инициализирован');
        return true;
    } catch (e) {
        console.warn('⚠️ Ошибка Firebase. Работаем офлайн.');
        return false;
    }
}