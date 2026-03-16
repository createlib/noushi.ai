import { db } from './src/db/db';

async function scanSalesDebits() {
    console.log("Scanning Dexie DB for Sales Debits...");
    const salesCodes = [500, 501, 580, 581, 583, 590, 5999, 5100, 5101, 5102, 5200, 5201, 5202];
    
    const lines = await db.journal_lines.filter(l => salesCodes.includes(l.account_id) && l.debit > 0).toArray();
    
    if (lines.length === 0) {
        console.log("No Sales Debits found!");
        return;
    }

    for (const l of lines) {
        const journal = await db.journals.get(l.journal_id);
        const account = await db.accounts.get(l.account_id);
        console.log(`\nFound Debit on Sales:`);
        console.log(`Journal: ${journal?.date} - ${journal?.description}`);
        console.log(`Account: ${account?.code} ${account?.name}`);
        console.log(`Amount: ${l.debit}`);
    }
}

scanSalesDebits().then(() => {
    console.log("Done.");
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
