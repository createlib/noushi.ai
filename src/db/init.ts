import { db } from './db';
import accountsDataJSON from '../data/accounts.json';
import { type Account } from './db';

const accountsData = accountsDataJSON as Account[];

export async function initDb() {
    const accountCount = await db.accounts.count();

    // If the count doesn't match the new JSON list length, refresh the accounts store
    if (accountCount !== accountsData.length) {
        console.log('Refreshing account data with new master list...');
        await db.accounts.clear();
        await db.accounts.bulkPut(accountsData);
        console.log('Accounts seeded:', accountsData.length);
    }
}
