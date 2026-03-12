import Dexie, { type Table } from 'dexie';

export interface Account {
    code: number;
    name: string;
    type: 'debit' | 'credit' | 'unknown'; // 借方 / 貸方
    report: 'BS' | 'PL' | 'unknown';      // 貸借対照表 / 損益計算書
}

export interface TransactionLine {
    code: number;
    amount: number;
}

export interface Transaction {
    id?: string;
    date: string; // YYYY-MM-DD
    debits: TransactionLine[];  // 借方
    credits: TransactionLine[]; // 貸方
    description: string;
    imageId?: string;   // 画像参照用 (Firebase/Local)
    createdAt: number;  // 作成日時
    updatedAt: number;  // 同期・最終更新日時
    deletedAt?: number; // ソフトデリート用
}

export interface Settings {
    id?: number;
    geminiApiKey: string;
    aiModel?: string;
    saveDirectoryHandle?: any;
    googleClientId?: string;
    useGoogleDriveSync?: boolean;
    googleDriveFileId?: string;
}

export class AccountingDB extends Dexie {
    accounts!: Table<Account, number>;
    transactions!: Table<Transaction, string>;
    settings!: Table<Settings, number>;

    constructor() {
        super('AccountingDB');
        this.version(4).stores({
            accounts: 'code, name, type, report',
            transactions: 'id, date, createdAt, updatedAt, deletedAt',
            settings: '++id, geminiApiKey, aiModel'
        });
    }
}

export const db = new AccountingDB();
