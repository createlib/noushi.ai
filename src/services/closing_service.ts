import { db, type Journal, type JournalLine } from '../db/db';

export async function closeFiscalYear(year: number): Promise<boolean> {
    try {
        // 1. 指定年度の終了日時（残高スナップショット用）
        const endStr = `${year}-12-31T23:59:59`;

        // 3. 全アカウントを取得
        const accounts = await db.accounts.toArray();
        const assetAccounts = accounts.filter(a => a.type === 'asset');
        const liabilityAccounts = accounts.filter(a => a.type === 'liability');

        // 4. 残高を計算（資産と負債のみ引き継ぐ）
        const endingBalances: Record<number, number> = {};

        // 過去の期首残高も含めるため、ここでは「全期間」の資産・負債残高をスナップショット計算する方が正確
        // 但し、今回は簡易的に指定年までの累積を再計算する
        const allPastJournals = await db.journals.where('date').belowOrEqual(endStr).toArray();
        const allValidPastJournals = allPastJournals.filter(j => !j.deletedAt);
        const allPastJournalIds = allValidPastJournals.map(j => j.id);
        const allPastLines = allPastJournalIds.length > 0
            ? await db.journal_lines.where('journal_id').anyOf(allPastJournalIds).toArray()
            : [];

        for (const acc of [...assetAccounts, ...liabilityAccounts]) {
            endingBalances[acc.code] = 0;
        }

        for (const line of allPastLines) {
            const acc = accounts.find(a => a.code === line.account_id);
            if (!acc) continue;

            if (acc.type === 'asset') {
                endingBalances[acc.code] = (endingBalances[acc.code] || 0) + line.debit - line.credit;
            } else if (acc.type === 'liability') {
                endingBalances[acc.code] = (endingBalances[acc.code] || 0) + line.credit - line.debit;
            }
        }

        // 5. 元入金（400）の計算 = 資産合計 - 負債合計
        let totalAssets = 0;
        let totalLiabilities = 0;

        for (const acc of assetAccounts) {
            totalAssets += endingBalances[acc.code] || 0;
        }
        for (const acc of liabilityAccounts) {
            totalLiabilities += endingBalances[acc.code] || 0;
        }

        const nextCapitalBalance = totalAssets - totalLiabilities;

        // 6. 新年度の期首残高仕訳を作成（1月1日）
        const nextYear = year + 1;
        const openingJournalId = crypto.randomUUID();
        const openingJournal: Journal = {
            id: openingJournalId,
            date: `${nextYear}-01-01`,
            description: `${year}年度からの繰越（期首残高）`,
            status: 'posted',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        const newLines: JournalLine[] = [];

        // 資産の繰越
        for (const acc of assetAccounts) {
            const bal = endingBalances[acc.code] || 0;
            if (bal !== 0) {
                newLines.push({
                    id: crypto.randomUUID(),
                    journal_id: openingJournalId,
                    account_id: acc.code,
                    debit: bal > 0 ? bal : 0,
                    credit: bal < 0 ? -bal : 0
                });
            }
        }

        // 負債の繰越
        for (const acc of liabilityAccounts) {
            const bal = endingBalances[acc.code] || 0;
            if (bal !== 0) {
                newLines.push({
                    id: crypto.randomUUID(),
                    journal_id: openingJournalId,
                    account_id: acc.code,
                    debit: bal < 0 ? -bal : 0,
                    credit: bal > 0 ? bal : 0
                });
            }
        }

        // 元入金の繰越 (400)
        if (nextCapitalBalance !== 0) {
            newLines.push({
                id: crypto.randomUUID(),
                journal_id: openingJournalId,
                account_id: 400, // 元入金
                debit: nextCapitalBalance < 0 ? -nextCapitalBalance : 0,
                credit: nextCapitalBalance > 0 ? nextCapitalBalance : 0
            });
        }

        // 7. DB保存トランザクション
        await db.transaction('rw', [db.journals, db.journal_lines, db.fiscal_periods], async () => {
            // 期首残高の書き込み
            if (newLines.length > 0) {
                // 既に同じ年度の期首残高仕訳がある場合は削除して作り直す（再実行可能にするため）
                const existingOpening = await db.journals
                    .where('date').equals(`${nextYear}-01-01`)
                    .toArray();
                const rollOverJournals = existingOpening.filter(j => j.description.includes('繰越（期首残高）'));
                if (rollOverJournals.length > 0) {
                    const ids = rollOverJournals.map(j => j.id);
                    await db.journals.bulkDelete(ids);
                    await db.journal_lines.where('journal_id').anyOf(ids).delete();
                }

                await db.journals.add(openingJournal);
                await db.journal_lines.bulkAdd(newLines);
            }

            // 今年度をロック (closed)
            await db.fiscal_periods.put({
                year: year,
                start_date: `${year}-01-01`,
                end_date: `${year}-12-31`,
                status: 'closed'
            });
        });

        return true;
    } catch (e) {
        console.error('Failed to close fiscal year:', e);
        throw e;
    }
}

export async function checkIsYearClosed(year: number): Promise<boolean> {
    const period = await db.fiscal_periods.get(year);
    return period?.status === 'closed';
}
