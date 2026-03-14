import { useState, useEffect } from 'react';
import { Box, Tooltip } from '@mui/material';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { auth } from '../firebase';

export default function GlobalSyncIndicator() {
    const settings = useLiveQuery(() => db.settings.get(1), []);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    // Auth state listener might be needed if user logs out, but for simplicity we rely on auth.currentUser
    const isLoggedIn = !!auth.currentUser;

    useEffect(() => {
        if (!settings?.useFirebaseSync) return;

        const handleSyncStart = () => setSyncStatus('syncing');
        const handleSyncSuccess = () => {
            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 3000); // revert to idle after 3s
        };
        const handleSyncError = (e: any) => {
            setSyncStatus('error');
            setErrorMessage(e.detail || '同期エラー');
            setTimeout(() => setSyncStatus('idle'), 5000);
        };

        window.addEventListener('sync-start', handleSyncStart);
        window.addEventListener('sync-success', handleSyncSuccess);
        window.addEventListener('sync-error', handleSyncError);

        return () => {
            window.removeEventListener('sync-start', handleSyncStart);
            window.removeEventListener('sync-success', handleSyncSuccess);
            window.removeEventListener('sync-error', handleSyncError);
        };
    }, [settings?.useFirebaseSync]);

    if (!settings?.useFirebaseSync) {
        return (
            <Tooltip title="クラウド同期は無効です (設定で有効化できます)">
                <CloudOffIcon sx={{ color: 'text.disabled', opacity: 0.5, fontSize: 20 }} />
            </Tooltip>
        );
    }

    if (!isLoggedIn) {
        return (
            <Tooltip title="ログインしていないため同期は停止しています">
                <CloudOffIcon sx={{ color: 'warning.main', opacity: 0.7, fontSize: 20 }} />
            </Tooltip>
        );
    }

    return (
        <Box display="flex" alignItems="center" justifyContent="center">
            {syncStatus === 'syncing' && (
                <Tooltip title="クラウドと同期中...">
                    {/* Using an animation or just the upload icon with color primary */}
                    <Box sx={{ animation: 'pulse 1.5s infinite ease-in-out', color: 'primary.light', display: 'flex' }}>
                        <CloudUploadIcon sx={{ fontSize: 20 }} />
                    </Box>
                </Tooltip>
            )}

            {syncStatus === 'success' && (
                <Tooltip title="同期完了">
                    <CloudDoneIcon sx={{ color: 'success.main', fontSize: 20 }} />
                </Tooltip>
            )}

            {syncStatus === 'error' && (
                <Tooltip title={`同期エラー: ${errorMessage}`}>
                    <ErrorOutlineIcon sx={{ color: 'error.main', fontSize: 20 }} />
                </Tooltip>
            )}

            {syncStatus === 'idle' && (
                <Tooltip title="クラウド同期 有効 (自動保存中)">
                    <CloudDoneIcon sx={{ color: 'primary.main', opacity: 0.7, fontSize: 20 }} />
                </Tooltip>
            )}
            <style>
                {`
                    @keyframes pulse {
                        0% { opacity: 0.5; transform: scale(0.95); }
                        50% { opacity: 1; transform: scale(1.05); }
                        100% { opacity: 0.5; transform: scale(0.95); }
                    }
                `}
            </style>
        </Box>
    );
}
