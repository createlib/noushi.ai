import { db, type Account, type Journal, type JournalLine, type LedgerEntry, type FiscalPeriod } from '../db/db';
import { storage } from '../firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export interface SyncDataPayload {
    accounts: Account[];
    journals: Journal[];
    journal_lines: JournalLine[];
    ledger_entries: LedgerEntry[];
    fiscal_periods: FiscalPeriod[];
}

/**
 * 現在のローカルDBの状態をすべてFirebase Storageにバックアップ（上書き）します。
 */
export async function forceUploadSync(uid: string): Promise<void> {
    if (!uid) throw new Error("ユーザーがログインしていません。");

    const payload: SyncDataPayload = {
        accounts: await db.accounts.toArray(),
        journals: await db.journals.toArray(),
        journal_lines: await db.journal_lines.toArray(),
        ledger_entries: await db.ledger_entries.toArray(),
        fiscal_periods: await db.fiscal_periods.toArray()
    };

    const storageRef = ref(storage, `accounting-backups/${uid}/database_backup.json`);
    try {
        await uploadString(storageRef, JSON.stringify(payload), 'raw', {
            contentType: 'application/json'
        });
    } catch (e: any) {
        if (e.code === 'storage/unauthorized') {
            throw new Error('Firebase Storageの権限エラーです。Storageルールに accounting-backups フォルダへのアクセス許可を追加してください。');
        }
        throw e;
    }
}

/**
 * Firebase Storageから直近のバックアップをダウンロードし、
 * ローカルDBと Last-Write-Wins 方式でマージします。
 * 完了後、綺麗な状態を再度 Storage にアップロードします。
 */
export async function performSync(uid: string): Promise<void> {
    if (!uid) throw new Error("ユーザーがログインしていません。");

    const storageRef = ref(storage, `accounting-backups/${uid}/database_backup.json`);

    let remoteData: SyncDataPayload | null = null;
    try {
        const url = await getDownloadURL(storageRef);
        const resp = await fetch(url);
        if (resp.ok) {
            remoteData = await resp.json();
        }
    } catch (e: any) {
        if (e.code === 'storage/unauthorized') {
            throw new Error('Firebase Storageの権限エラーです。Storageルールに accounting-backups フォルダへのアクセス・読み取り許可を追加してください。');
        }
        console.log("No remote backup found. Assuming first-time sync:", e);
    }

    if (!remoteData) {
        // リモートデータがない場合は、現在のローカルデータをアップロードして終了
        await forceUploadSync(uid);
        return;
    }

    // ============================================
    // 1. 仕訳ヘッダ（Journals）のマージ (Last-Write-Wins)
    // ============================================
    const localJournals = await db.journals.toArray();
    const localJMap = new Map(localJournals.map(j => [j.id, j]));
    const remoteJMap = new Map((remoteData.journals || []).map(j => [j.id, j]));

    const mergedJournalsMap = new Map<string, Journal>();
    const allJournalIds = new Set([...localJMap.keys(), ...remoteJMap.keys()]);

    for (const id of allJournalIds) {
        const local = localJMap.get(id);
        const remote = remoteJMap.get(id);

        if (local && remote) {
            // updatedAtが新しい方を正とする
            if (local.updatedAt >= remote.updatedAt) {
                mergedJournalsMap.set(id, local);
            } else {
                mergedJournalsMap.set(id, remote);
            }
        } else if (local) {
            mergedJournalsMap.set(id, local); // ここにしかない（新設）
        } else if (remote) {
            mergedJournalsMap.set(id, remote); // あっちにしかない（別端末で新設）
        }
    }
    const mergedJournals = Array.from(mergedJournalsMap.values());

    // ============================================
    // 2. 仕訳明細（Journal Lines）のマージ
    // ============================================
    // ヘッダ（Journal）がローカル・リモートどちらから採用されたかによって、
    // 紐付く明細もその採用側から引っ張ってくる（明細単位のLWWは整合性が壊れるため）

    const mergedLines: JournalLine[] = [];

    // ローカル明細のグループ化
    const localLinesByJId = new Map<string, JournalLine[]>();
    const localLines = await db.journal_lines.toArray();
    for (const line of localLines) {
        if (!localLinesByJId.has(line.journal_id)) localLinesByJId.set(line.journal_id, []);
        localLinesByJId.get(line.journal_id)!.push(line);
    }

    // リモート明細のグループ化
    const remoteLinesByJId = new Map<string, JournalLine[]>();
    for (const line of (remoteData.journal_lines || [])) {
        if (!remoteLinesByJId.has(line.journal_id)) remoteLinesByJId.set(line.journal_id, []);
        remoteLinesByJId.get(line.journal_id)!.push(line);
    }

    for (const j of mergedJournals) {
        const localJ = localJMap.get(j.id);
        const isFromLocal = localJ && localJ.updatedAt === j.updatedAt;

        if (isFromLocal) {
            const lines = localLinesByJId.get(j.id);
            if (lines) mergedLines.push(...lines);
        } else {
            const lines = remoteLinesByJId.get(j.id);
            if (lines) {
                mergedLines.push(...lines);
            } else {
                // 安全策：リモートに明細が無い場合はローカルから補填
                const fallback = localLinesByJId.get(j.id);
                if (fallback) mergedLines.push(...fallback);
            }
        }
    }

    // DBへの書き戻し
    await db.transaction('rw', [db.journals, db.journal_lines, db.ledger_entries, db.fiscal_periods], async () => {
        await db.journals.clear();
        await db.journals.bulkPut(mergedJournals);

        await db.journal_lines.clear();
        await db.journal_lines.bulkPut(mergedLines);
    });

    // ============================================
    // 3. 元帳（Ledger Entries）と 会計期間 の再構築
    // ============================================
    // 明細がマージされて変化したため、残高を計算し直す
    const { rebuildLedger, rebuildFiscalPeriods } = await import('../db/init');
    await rebuildLedger();
    await rebuildFiscalPeriods();

    // ============================================
    // 4. マージ完了後の最新状態をStorageにアップロード
    // ============================================
    await forceUploadSync(uid);
}
