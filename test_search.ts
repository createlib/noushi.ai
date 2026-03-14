import { db } from './src/firebase.ts';
import { collection, getDocs, limit, query } from 'firebase/firestore';

async function test() {
    try {
        const q = query(collection(db, 'artifacts', 'default-app-id', 'public', 'data', 'users'));
        const snapshot = await getDocs(q);

        console.log(`Checking ${snapshot.size} public users...`);
        let found = false;
        snapshot.forEach(doc => {
            const data = doc.data();
            const id = data.userId || "";
            const email = data.email || "";
            const name = data.name || "";

            // Broad search for anything matching "yanagi" or "yagi"
            if (id.toLowerCase().includes('yana') || email.toLowerCase().includes('yana') || name.includes('柳') || id.includes('y_y') || id.toLowerCase().includes('yagi') || email.toLowerCase().includes('yagi')) {
                console.log("Match found!", data);
                found = true;
            }
        });

        if (!found) {
            console.log("Could not find any user matching those keywords.");
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
test();
