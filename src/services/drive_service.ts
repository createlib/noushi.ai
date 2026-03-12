import { db, type Transaction } from '../db/db';

const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

export interface DriveTokenResult {
    access_token: string;
    expires_in: number;
}

let cachedToken: string | null = null;
let tokenExpiryTime: number = 0;

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
export function authenticateWithDrive(clientId: string): Promise<string> {
    return new Promise((resolve, reject) => {
        // Return cached token if still valid (adding a small buffer for safety)
        if (cachedToken && Date.now() < tokenExpiryTime - 60000) {
            resolve(cachedToken as string);
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
                        // Cache the newly acquired token
                        cachedToken = tokenResponse.access_token;
                        // expiresIn is usually 3599 seconds
                        tokenExpiryTime = Date.now() + (tokenResponse.expires_in * 1000);
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

    // C) Merge (simple union by id, prioritizing remote if conflict, but preserving local-only)
    const remoteMap = new Map(remoteData.map(t => [t.id, t]));
    const localMap = new Map(localData.map(t => [t.id, t]));

    const mergedDataMap = new Map<string, Transaction>();

    // Add all local
    for (const [id, localTx] of localMap) {
        if (id) mergedDataMap.set(id, localTx);
    }

    // Add/Overwrite all remote
    for (const [id, remoteTx] of remoteMap) {
        if (id) mergedDataMap.set(id, remoteTx);
    }

    const mergedArray = Array.from(mergedDataMap.values());

    // Write back to local DB by BulkPut
    await db.transactions.bulkPut(mergedArray);

    // D) Upload full merged back to Drive
    await uploadTransactions(token, fileId, mergedArray);
}

// Global declaration for Google API
declare global {
    interface Window {
        google?: any;
    }
}
