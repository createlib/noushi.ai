import { db, type Account, type Journal, type JournalLine, type LedgerEntry, type FiscalPeriod } from './db';
import accountsDataJSON from '../data/accounts.json';

const accountsData = accountsDataJSON as Account[];

// 汎用的なUUIDジェネレータ（crypto.randomUUID()のフォールバック付き）
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export async function initDb() {
    // 1. アカウント（勘定科目）の初期化
    const accountCount = await db.accounts.count();
    if (accountCount !== accountsData.length) {
        console.log('Refreshing account data with v5 schema...');
        await db.accounts.clear();
        await db.accounts.bulkPut(accountsData);
        console.log('Accounts seeded:', accountsData.length);
    }

    // 2. 旧バージョン（フラットなTransaction構造）からの移行
    const legacyTxCount = await db.transactions.count();

    if (legacyTxCount > 0) {
        console.log(`Found ${legacyTxCount} legacy transactions. Starting v5 migration...`);
        const oldTxs = await db.transactions.toArray();

        const newJournals: Journal[] = [];
        const newJournalLines: JournalLine[] = [];

        for (const tx of oldTxs) {
            const journalId = tx.id || generateUUID();

            // ヘッダ（Journal）作成
            newJournals.push({
                id: journalId,
                date: tx.date,
                description: tx.description || '旧データからの移行',
                status: 'posted',
                createdAt: tx.createdAt || Date.now(),
                updatedAt: tx.updatedAt || Date.now(),
                deletedAt: tx.deletedAt
            });

            // 借方明細（Journal Line for Debits）作成
            if (tx.debits) {
                for (const d of tx.debits) {
                    newJournalLines.push({
                        id: generateUUID(),
                        journal_id: journalId,
                        account_id: d.code,
                        debit: d.amount,
                        credit: 0
                    });
                }
            }

            // 貸方明細（Journal Line for Credits）作成
            if (tx.credits) {
                for (const c of tx.credits) {
                    newJournalLines.push({
                        id: generateUUID(),
                        journal_id: journalId,
                        account_id: c.code,
                        debit: 0,
                        credit: c.amount
                    });
                }
            }
        }

        // ヘッダと明細を一括保存
        await db.journals.bulkPut(newJournals);
        await db.journal_lines.bulkPut(newJournalLines);

        // 元帳と会計期間の再構築
        await rebuildLedger();
        await rebuildFiscalPeriods();

        // 移行完了後に、もう二度と実行されないように旧テーブルを空にする
        await db.transactions.clear();
        console.log('v5 Migration completed successfully.');
    } else {
        // レガシーデータが存在しない場合でも、初回であれば元帳などは再構築される
        const journalCount = await db.journals.count();
        if (journalCount > 0) {
            const ledgerCount = await db.ledger_entries.count();
            if (ledgerCount === 0) {
                // バックアップから復元した直後などでledgerが空の時のため
                await rebuildLedger();
                await rebuildFiscalPeriods();
            }
        }
    }
}

/**
 * 登録されている全ての仕訳明細（JournalLines）から元帳（LedgerEntries）を再構築する
 */
export async function rebuildLedger() {
    console.log('Rebuilding ledger entries...');
    await db.ledger_entries.clear();

    const lines = await db.journal_lines.toArray();
    const journals = await db.journals.toArray();

    // 高速検索用Mapの作成
    const journalMap = new Map<string, Journal>();
    for (const j of journals) {
        journalMap.set(j.id, j);
    }

    // 削除済み仕訳に紐づく明細は元帳に含めない
    const validLines = lines.filter(l => {
        const j = journalMap.get(l.journal_id);
        return j && !j.deletedAt;
    });

    // 1. 日付順、2. 仕訳ID順でソート（同じ仕訳の明細は連続させる）
    validLines.sort((a, b) => {
        const jA = journalMap.get(a.journal_id);
        const jB = journalMap.get(b.journal_id);
        if (!jA || !jB) return 0;

        if (jA.date !== jB.date) {
            return jA.date.localeCompare(jB.date);
        }
        return a.journal_id.localeCompare(b.journal_id);
    });

    // 科目ごとの累積残高計算
    const balances: Record<number, number> = {};
    const ledgerEntries: LedgerEntry[] = [];

    for (const line of validLines) {
        const accId = line.account_id;
        if (balances[accId] === undefined) balances[accId] = 0;

        // ※残高 = （これまでの残高） + 借方発生 - 貸方発生
        // （負債・資本・収益科目は残高がマイナスで表現される形だが、試算表計算で絶対値にする）
        balances[accId] += (line.debit || 0) - (line.credit || 0);

        const journal = journalMap.get(line.journal_id)!;

        ledgerEntries.push({
            id: generateUUID(),
            account_id: accId,
            journal_line_id: line.id,
            date: journal.date,
            debit: line.debit || 0,
            credit: line.credit || 0,
            balance: balances[accId]
        });
    }

    await db.ledger_entries.bulkPut(ledgerEntries);
    console.log(`Rebuilt ${ledgerEntries.length} ledger entries.`);
}

/**
 * 仕訳の年度一覧から会計期間テーブルを再構築する
 */
export async function rebuildFiscalPeriods() {
    console.log('Rebuilding fiscal periods...');
    const journals = await db.journals.toArray();
    const years = new Set<number>();

    journals.forEach(j => {
        const y = parseInt(j.date.substring(0, 4), 10);
        if (!isNaN(y)) years.add(y);
    });

    // 現在の年は必ず含める
    years.add(new Date().getFullYear());

    const periods: FiscalPeriod[] = [];
    for (const year of Array.from(years)) {
        periods.push({
            year: year,
            start_date: `${year}-01-01`,
            end_date: `${year}-12-31`,
            status: 'open'
        });
    }

    await db.fiscal_periods.clear();
    await db.fiscal_periods.bulkPut(periods);
}
