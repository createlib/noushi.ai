import fs from 'fs';

const data = JSON.parse(fs.readFileSync('d:/cockt/ドキュメント/GitHub/noushi.ai/src/data/accounts.json', 'utf8'));
const sales = data.find(a => a.code === 500);
console.log("Account 500:", sales);
const cacheCash = data.find(a => a.code === 100);
console.log("Account 100:", cacheCash);
