import fs from 'fs';
import path from 'path';

function check() {
    const p = path.join(process.cwd(), 'src/data/accounts.json');
    const d = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const acc = d.find((a: any) => a.code === 391);
    console.log('Account 391 ON DISK:', acc);
}
check();
