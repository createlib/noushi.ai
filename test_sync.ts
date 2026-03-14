import { auth } from './src/firebase.ts';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { performSync } from './src/services/sync_service.ts';
import { db as firestoreDb } from './src/firebase.ts';
import { collection, query, where, getDocs } from 'firebase/firestore';

async function testSync() {
    console.log("Starting test for y_yanagimachi...");
    try {
        let emailToUse = "k_yanagimachi";
        const password = "Yagi7721@";

        // 2. Login directly with what they gave
        console.log("Logging in...");
        const userCredential = await signInWithEmailAndPassword(auth, "k.yanagimachi@createlib.com", password);
        const uid = userCredential.user.uid;
        console.log(`Logged in successfully! UID: ${uid}`);

        // 3. Attempt Sync Download
        console.log(`Attempting performSync for UID: ${uid}...`);

        // Listen to events
        window.addEventListener('sync-start', () => console.log("Event: sync-start"));
        window.addEventListener('sync-success', () => console.log("Event: sync-success"));
        window.addEventListener('sync-error', (e: any) => console.log("Event: sync-error", e.detail));

        await performSync(uid);
        console.log("performSync completed without throwing!");

    } catch (e: any) {
        console.error("Caught error during test:", e.message || e);
    }
    process.exit(0);
}

// polyfill window for CustomEvent since we are in node
(global as any).window = {
    dispatchEvent: (e: any) => console.log(`Dispatched: ${e.type}`),
    addEventListener: () => { }
};
(global as any).CustomEvent = class CustomEvent {
    type: string;
    detail: any;
    constructor(type: string, options?: { detail: any }) {
        this.type = type;
        this.detail = options?.detail;
    }
};

testSync();
