import { auth, db } from './src/firebase.ts';
import { collectionGroup, query, where, getDocs } from 'firebase/firestore';

async function test() {
    console.log("Checking for user document...");
    try {
        const q = query(collectionGroup(db, 'profile'), where('userId', '==', 'test')); // replace with a real check or just query one doc
        const snapshot = await getDocs(query(collectionGroup(db, 'profile')));
        if (!snapshot.empty) {
            console.log("Found some docs. Fields available in the first one:");
            console.log(Object.keys(snapshot.docs[0].data()));
        } else {
            console.log("No docs found using collectionGroup('profile'). Maybe permissions?");
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
test();
