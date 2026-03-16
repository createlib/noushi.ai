import 'fake-indexeddb/auto';
import { db } from './src/db/db';
import { initDb } from './src/db/init';

async function test() {
    await initDb();
    const acc = await db.accounts.get(391);
    console.log("391 type:", acc?.type);
}

test().catch(console.error);
