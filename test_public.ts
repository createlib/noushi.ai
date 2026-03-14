import { db } from './src/firebase.ts';
import { collection, getDocs, limit, query } from 'firebase/firestore';

async function test() {
    try {
        const q = query(collection(db, 'artifacts', 'default-app-id', 'public', 'data', 'users'), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            console.log("Found public user data:");
            console.log(snapshot.docs[0].data());
        } else {
            console.log("No public users found.");
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
test();
