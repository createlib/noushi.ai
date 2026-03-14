import { auth } from './src/firebase.ts';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { performSync } from './src/services/sync_service.ts';
import { db as firestoreDb, storage } from './src/firebase.ts';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ref, getBytes } from 'firebase/storage';

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

        // instead of calling performSync which relies on browser indexedDB,
        // let's manually fetch the storage object just to read what's inside it!

        const storageRef = ref(storage, `accounting-backups/${uid}/database_backup.json`);
        const arrayBuffer = await getBytes(storageRef);
        const decoder = new TextDecoder('utf-8');
        const jsonString = decoder.decode(arrayBuffer);
        const remoteData = JSON.parse(jsonString);

        console.log("=== REMOTE DATA DIAGNOSTICS ===");
        console.log("Accounts count:", remoteData.accounts?.length || 0);
        console.log("Journals count:", remoteData.journals?.length || 0);
        console.log("Journal Lines count:", remoteData.journal_lines?.length || 0);
        console.log("Ledger Entries count:", remoteData.ledger_entries?.length || 0);

        if (remoteData.journals && remoteData.journals.length > 0) {
            console.log("Sample Journal Date:", remoteData.journals[0].date);
        }

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
