import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// AI脳死申告アプリ用のFirebase Config
const firebaseConfig = {
    apiKey: "AIzaSyBVDZJhL9sMzVknD5tNomLWF-0z0jPU3i0",
    authDomain: "brainbridge-4b8ac.firebaseapp.com",
    projectId: "brainbridge-4b8ac",
    storageBucket: "brainbridge-4b8ac.firebasestorage.app",
    messagingSenderId: "803209683213",
    appId: "1:803209683213:web:eccf8c52914a97879f5044"
};

// Firebaseの初期化
const app = initializeApp(firebaseConfig);

// 各種サービスの取得
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
