import Dexie, { type Table } from 'dexie';

export interface Account {
    id: number;
    code: number;
    name: string;
    type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
    tax_type: 'taxable10' | 'taxable8' | 'tax_free' | 'non_taxable' | 'exempt';
    parent_id?: number;
}

export interface Journal {
    id: string; // UUID
    journal_number?: number;
    date: string; // YYYY-MM-DD
    description: string;
    status: 'draft' | 'posted';
    createdAt: number;
    updatedAt: number;
    deletedAt?: number;
}

export interface JournalLine {
    id: string; // UUID
    journal_id: string; // FK to Journal
    account_id: number; // FK to Account
    debit: number;
    credit: number;
    tax_rate?: number;
    tax_amount?: number;
}

export interface LedgerEntry {
    id: string; // UUID
    account_id: number;
    journal_line_id: string;
    date: string; // YYYY-MM-DD
    debit: number;
    credit: number;
    balance: number;
}

export interface FiscalPeriod {
    year: number;
    start_date: string;
    end_date: string;
    status: 'open' | 'closed';
}

export interface Settings {
    id?: number;
    geminiApiKey: string;
    aiModel?: string;
    useFirebaseSync?: boolean;
}

// レガシーデータ移行用
export interface OldTransactionLine {
    code: number;
    amount: number;
}

export interface OldTransaction {
    id?: string;
    date: string;
    debits: OldTransactionLine[];
    credits: OldTransactionLine[];
    description: string;
    imageId?: string;
    createdAt: number;
    updatedAt: number;
    deletedAt?: number;
}

export class AccountingDB extends Dexie {
    accounts!: Table<Account, number>;
    journals!: Table<Journal, string>;
    journal_lines!: Table<JournalLine, string>;
    ledger_entries!: Table<LedgerEntry, string>;
    fiscal_periods!: Table<FiscalPeriod, number>;
    settings!: Table<Settings, number>;

    // 移行プロセス用に古いテーブルも残す
    transactions!: Table<OldTransaction, string>;

    constructor() {
        super('AccountingDB');

        // 旧スキーマ (v4)
        this.version(4).stores({
            accounts: 'code, name, type, report',
            transactions: 'id, date, createdAt, updatedAt, deletedAt',
            settings: '++id, geminiApiKey, aiModel'
        });

        // 新スキーマ (v6)
        this.version(6).stores({
            accounts: 'code, type',
            journals: 'id, date, status, deletedAt',
            journal_lines: 'id, journal_id, account_id',
            ledger_entries: 'id, account_id, journal_line_id, date',
            fiscal_periods: 'year, status',
            settings: '++id',
            transactions: 'id, date, createdAt, updatedAt, deletedAt'
        }).upgrade(async () => {
            // アカウントテーブルの主キー構成を変えないため、エラーは起きない
            // 古いフォーマットのデータは initDb 側で定期的に上書きされる
        });
    }
}

export const db = new AccountingDB();
