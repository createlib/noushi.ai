import { db, type Transaction } from '../db/db';

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

export interface DriveTokenResult {
    access_token: string;
    expires_in: number;
}

function getCachedToken(): { token: string; expiry: number } | null {
    const raw = localStorage.getItem('drive_auth_token');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function setCachedToken(token: string, expiresInSeconds: number) {
    const expiry = Date.now() + (expiresInSeconds * 1000);
    localStorage.setItem('drive_auth_token', JSON.stringify({ token, expiry }));
}

export function clearCachedToken() {
    localStorage.removeItem('drive_auth_token');
}

// 1. Load GSI script dynamically
export function loadGisScript(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (window.google && window.google.accounts) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = GIS_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
        document.head.appendChild(script);
    });
}

// 2. Init and request token
export function authenticateWithDrive(clientId: string, interactive: boolean = true): Promise<string> {
    return new Promise((resolve, reject) => {
        // Return cached token from localStorage if still valid (adding a small buffer for safety)
        const cached = getCachedToken();
        if (cached && Date.now() < cached.expiry - 60000) {
            resolve(cached.token);
            return;
        }

        // If not interactive and we have no valid token, fail silently instead of triggering popup
        if (!interactive) {
            reject(new Error('No valid cached token. Background sync skipped.'));
            return;
        }

        try {
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: 'https://www.googleapis.com/auth/drive.file',
                callback: (tokenResponse: any) => {
                    if (tokenResponse.error !== undefined) {
                        reject(new Error(tokenResponse.error));
                    } else {
                        // Cache the newly acquired token in localStorage
                        setCachedToken(tokenResponse.access_token, tokenResponse.expires_in);
                        resolve(tokenResponse.access_token);
                    }
                },
            });
            tokenClient.requestAccessToken({ prompt: '' });
        } catch (err: any) {
            reject(err);
        }
    });
}

// 3. Find existing file by name
async function findFileByName(token: string, fileName: string): Promise<string | null> {
    const q = encodeURIComponent(`name='${fileName}' and trashed=false`);
    const resp = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await resp.json();
    if (data.files && data.files.length > 0) {
        return data.files[0].id;
    }
    return null;
}

// 4. Create new JSON file in Drive
async function createNewFile(token: string, fileName: string): Promise<string> {
    const metadata = { name: fileName, mimeType: 'application/json' };
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', new Blob(['[]'], { type: 'application/json' })); // Empty array initially

    const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
    });

    if (!resp.ok) throw new Error('Failed to create file on Google Drive');
    const data = await resp.json();
    return data.id as string;
}

// 5. Setup / Find file wrapper
export async function setupDriveFile(token: string, fileName: string = 'smartbiz_ledger_transactions.json'): Promise<string> {
    let fileId = await findFileByName(token, fileName);
    if (!fileId) {
        fileId = await createNewFile(token, fileName);
    }
    return fileId;
}

// 6. Upload transactions
export async function uploadTransactions(token: string, fileId: string, transactions: Transaction[]): Promise<void> {
    const content = JSON.stringify(transactions);
    const metadata = { mimeType: 'application/json' };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', new Blob([content], { type: 'application/json' }));

    const resp = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to upload to Google Drive: ${resp.status} - ${text}`);
    }
}

// 7. Download transactions
export async function downloadTransactions(token: string, fileId: string): Promise<Transaction[]> {
    const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!resp.ok) {
        if (resp.status === 404) return []; // Not found
        throw new Error('Failed to download from Google Drive');
    }

    const text = await resp.text();
    if (!text || text.trim() === '') return [];

    try {
        return JSON.parse(text);
    } catch {
        // If parsing fails, maybe the file is empty or corrupt
        return [];
    }
}

// 8. One-click sync logic (Downloads, merges, then uploads back)
// Note: In real app, consider conflict resolution based on `createdAt` or `id`.
export async function performSync(token: string, fileId: string): Promise<void> {
    // A) Get Google Drive Data
    const remoteData = await downloadTransactions(token, fileId);

    // B) Get Local Data
    const localData = await db.transactions.toArray();

    // C) Merge (Last-Write-Wins based on updatedAt)
    const remoteMap = new Map(remoteData.map(t => [t.id, t]));
    const localMap = new Map(localData.map(t => [t.id, t]));

    const mergedDataMap = new Map<string, Transaction>();

    // Process all unique IDs
    const allIds = new Set([...remoteMap.keys(), ...localMap.keys()]);

    for (const id of allIds) {
        if (!id) continue;
        const localTx = localMap.get(id);
        const remoteTx = remoteMap.get(id);

        if (localTx && remoteTx) {
            // Both exist: pick the one with the later updatedAt (or fallback to createdAt)
            const localTime = localTx.updatedAt || localTx.createdAt || 0;
            const remoteTime = remoteTx.updatedAt || remoteTx.createdAt || 0;

            if (localTime >= remoteTime) {
                mergedDataMap.set(id, localTx);
            } else {
                mergedDataMap.set(id, remoteTx);
            }
        } else if (localTx) {
            // Only local exists (it's new or was not synced yet)
            mergedDataMap.set(id, localTx);
        } else if (remoteTx) {
            // Only remote exists
            mergedDataMap.set(id, remoteTx);
        }
    }

    const mergedArray = Array.from(mergedDataMap.values());

    // Write back to local DB by BulkPut
    await db.transactions.bulkPut(mergedArray);

    // D) Upload full merged back to Drive
    await uploadTransactions(token, fileId, mergedArray);
}

// 9. Force Upload Local to Drive (Overwrite)
export async function forceUploadSync(token: string, fileId: string): Promise<void> {
    const localData = await db.transactions.toArray();
    await uploadTransactions(token, fileId, localData);
}

// Global declaration for Google API
declare global {
    interface Window {
        google?: any;
    }
}
