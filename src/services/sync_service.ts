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

    window.dispatchEvent(new CustomEvent('sync-start'));

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
            contentType: 'application/json',
            cacheControl: 'no-cache, max-age=0'
        });
        window.dispatchEvent(new CustomEvent('sync-success'));
    } catch (e: any) {
        window.dispatchEvent(new CustomEvent('sync-error', { detail: e.message || 'Sync failed' }));
        if (e.code === 'storage/unauthorized') {
            throw new Error('Firebase Storageの権限エラーです。Storageルールに accounting-backups フォルダへのアクセス許可を追加してください。');
        }
        throw e;
    }
}

/**
 * Firebase Storageから最新のバックアップをダウンロードし、
 * ローカルDBを完全にそれで上書き（同期）します。
 */
export async function performSync(uid: string): Promise<void> {
    if (!uid) throw new Error("ユーザーがログインしていません。");

    window.dispatchEvent(new CustomEvent('sync-start'));
    const storageRef = ref(storage, `accounting-backups/${uid}/database_backup.json`);

    let remoteData: SyncDataPayload | null = null;
    try {
        const url = await getDownloadURL(storageRef);
        // Firebaseの署名付きURLを壊さないようにクエリパラメータは付与せず、fetchのオプションだけでキャッシュを無効化する
        const resp = await fetch(url, {
            cache: 'no-store',
            headers: {
                'Pragma': 'no-cache',
                'Cache-Control': 'no-cache'
            }
        });
        if (!resp.ok) {
            throw new Error(`Failed to download backup: ${resp.status}`);
        }
        remoteData = await resp.json();
    } catch (e: any) {
        if (e.code === 'storage/unauthorized') {
            window.dispatchEvent(new CustomEvent('sync-error', { detail: '権限エラー' }));
            throw new Error('Firebase Storageの権限エラーです。Storageルールに accounting-backups フォルダへのアクセス・読み取り許可を追加してください。');
        }
        if (e.code === 'storage/object-not-found') {
            window.dispatchEvent(new CustomEvent('sync-error', { detail: 'データなし' }));
            throw new Error(`このアカウントのクラウドデータが見つかりません。
・PCと別のアカウント（Google/Apple等）でログインしている可能性があります。
・設定画面のアカウント欄から、PCと同じIDでログインし直してください。`);
        }
        window.dispatchEvent(new CustomEvent('sync-error', { detail: '取得エラー' }));
        throw new Error('クラウドからのデータ取得に失敗しました: ' + (e.message || ''));
    }

    if (!remoteData) {
        window.dispatchEvent(new CustomEvent('sync-error', { detail: 'データが空' }));
        throw new Error("取得したデータが空でした。");
    }

    // DBをフル上書き（ローカルの変更はクラウドのもので完全に上書きされるシンプルな同期）
    await db.transaction('rw', [db.accounts, db.journals, db.journal_lines, db.ledger_entries, db.fiscal_periods], async () => {
        // アカウント科目
        if (remoteData!.accounts && remoteData!.accounts.length > 0) {
            await db.accounts.clear();
            await db.accounts.bulkPut(remoteData!.accounts);
        }

        // 仕訳ヘッダ
        if (remoteData!.journals && remoteData!.journals.length > 0) {
            await db.journals.clear();
            await db.journals.bulkPut(remoteData!.journals);
        }

        // 仕訳明細
        if (remoteData!.journal_lines && remoteData!.journal_lines.length > 0) {
            await db.journal_lines.clear();
            await db.journal_lines.bulkPut(remoteData!.journal_lines);
        }
    });

    // 元帳（Ledger Entries）と 会計期間 の再構築
    const { rebuildLedger, rebuildFiscalPeriods } = await import('../db/init');
    await rebuildLedger();
    await rebuildFiscalPeriods();

    window.dispatchEvent(new CustomEvent('sync-success'));
}
