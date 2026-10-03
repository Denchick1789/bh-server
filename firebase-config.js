// Конфигурация Firebase для BH Server
const firebaseConfig = {
    apiKey: "AIzaSyDn9fKBWzrskoj_TdER_XknrGLzHLcxkIE",
    authDomain: "bh-server-c739a.firebaseapp.com",
    databaseURL: "https://bh-server-c739a-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "bh-server-c739a",
    storageBucket: "bh-server-c739a.firebasestorage.app",
    messagingSenderId: "522542158027",
    appId: "1:522542158027:web:5cb34cbd552cdc3aeb0b4e",
    measurementId: "G-B5JYXWB721"
};

// Инициализация Firebase (compat SDK)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

console.log("✅ Firebase успешно подключен к bh-server-c739a");
