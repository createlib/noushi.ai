import { storage, auth } from './src/firebase.ts';
import { ref, getMetadata } from 'firebase/storage';
import { signInWithEmailAndPassword } from 'firebase/auth';

async function testMetadata() {
    try {
        await signInWithEmailAndPassword(auth, "k.yanagimachi@createlib.com", "Yagi7721@");
        const uid = auth.currentUser!.uid;
        const storageRef = ref(storage, `accounting-backups/${uid}/database_backup.json`);

        const metadata = await getMetadata(storageRef);
        console.log("=== FILE METADATA ===");
        console.log("Size:", metadata.size, "bytes");
        console.log("Time Created:", metadata.timeCreated);
        console.log("Updated:", metadata.updated);
        console.log("Resource:", metadata.fullPath);
    } catch (e: any) {
        console.error("Error fetching metadata:", e.message);
    }
    process.exit(0);
}

testMetadata();
