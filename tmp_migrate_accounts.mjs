import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filepath = path.join(__dirname, 'src/data/accounts.json');
const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));

const newData = data.map(acc => {
    let type = 'asset';
    const code = acc.code;
    if (code >= 100 && code < 300) type = 'asset';
    else if (code >= 300 && code < 400) type = 'liability';
    else if (code >= 400 && code < 500) type = 'equity';
    else if (code >= 500 && code < 600) type = 'revenue';
    else type = 'expense';

    let tax_type = 'tax_free';
    if (type === 'revenue' || type === 'expense') {
        tax_type = 'taxable10';
    }

    return {
        id: code,
        code: code,
        name: acc.name,
        type: type,
        tax_type: tax_type,
    };
});

fs.writeFileSync(filepath, JSON.stringify(newData, null, 2));
console.log('Migrated accounts.json');
