import { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Paper, Alert, Snackbar, MenuItem } from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { doc, setDoc } from 'firebase/firestore';
import { db as firestoreDb, auth } from '../firebase';
import 'dexie-export-import';

export default function Settings() {
    const currentSettings = useLiveQuery(() => db.settings.get(1));
    const [apiKey, setApiKey] = useState('');
    const [aiModel, setAiModel] = useState('gemini-2.5-flash');
    const [directoryName, setDirectoryName] = useState('未設定');
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    useEffect(() => {
        if (currentSettings) {
            setApiKey(currentSettings.geminiApiKey || '');
            if (currentSettings.aiModel) setAiModel(currentSettings.aiModel);
            if (currentSettings.saveDirectoryHandle) {
                setDirectoryName(currentSettings.saveDirectoryHandle.name);
            }
        }
    }, [currentSettings]);

    const handleSave = async () => {
        try {
            // 1. Save locally to IndexedDB
            if (currentSettings) {
                await db.settings.update(1, { geminiApiKey: apiKey, aiModel });
            } else {
                await db.settings.add({ id: 1, geminiApiKey: apiKey, aiModel });
            }

            // 2. Sync to Firestore if user is logged in
            const currentUser = auth.currentUser;
            if (currentUser) {
                const docRef = doc(firestoreDb, 'artifacts', 'default-app-id', 'users', currentUser.uid, 'profile', 'data');
                // Use setDoc with merge: true to update only the these fields without overwriting membershipRank
                await setDoc(docRef, {
                    geminiApiKey: apiKey,
                    aiModel
                }, { merge: true });
            }

            setSaveSuccess(true);
            setSyncError(null);
        } catch (error) {
            console.error("Failed to save settings:", error);
            setSyncError("設定の保存中にエラーが発生しました。");
        }
    };

    const handleSelectDirectory = async () => {
        try {
            const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
            if (currentSettings) {
                await db.settings.update(1, { saveDirectoryHandle: handle });
            } else {
                await db.settings.add({ id: 1, geminiApiKey: apiKey, aiModel, saveDirectoryHandle: handle });
            }
            setDirectoryName(handle.name);
        } catch (e) {
            console.error('Directory picking failed or cancelled', e);
        }
    };

    const handleExport = async () => {
        try {
            const blob = await db.export();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tax-accounting-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('エクスポートに失敗しました');
        }
    };

    return (
        <Box p={2}>
            <Typography variant="h5" gutterBottom fontWeight="bold">設定</Typography>

            <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>Gemini API連携</Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    レシート画像からの自動仕訳機能を利用するには、Google AI Studio で取得したAPIキーを入力してください。キーはローカルブラウザ内に保存されます。
                </Typography>

                <TextField
                    label="Gemini API Key"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />

                <TextField
                    select
                    label="AIモデル"
                    fullWidth
                    margin="normal"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                >
                    <MenuItem value="gemini-2.5-flash">gemini-2.5-flash (最新・推奨)</MenuItem>
                    <MenuItem value="gemini-2.5-pro">gemini-2.5-pro (最新・高精度)</MenuItem>
                    <MenuItem value="gemini-1.5-flash">gemini-1.5-flash</MenuItem>
                    <MenuItem value="gemini-1.0-pro-vision-latest">gemini-1.0-pro-vision-latest</MenuItem>
                </TextField>

                <Box mt={2} mb={4}>
                    <Button variant="contained" color="primary" onClick={handleSave} disableElevation>
                        API設定を保存する
                    </Button>
                </Box>

                <Typography variant="subtitle1" gutterBottom>画像保存フォルダ</Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    レシート画像をローカルPCの特定のフォルダに保存します（年/月ごとに自動でフォルダ分けされます）。
                </Typography>
                <Box mt={1} p={2} bgcolor="grey.100" borderRadius={1} mb={2}>
                    <Typography variant="body2" fontWeight="bold">現在の保存先: {directoryName}</Typography>
                </Box>
                <Button variant="outlined" onClick={handleSelectDirectory}>
                    保存フォルダを選択する
                </Button>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>データエクスポート</Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    ローカルの仕訳データおよび設定をバックアップとしてダウンロードします。
                </Typography>
                <Box mt={2}>
                    <Button variant="outlined" onClick={handleExport}>
                        全データをエクスポート
                    </Button>
                </Box>
            </Paper>

            <Snackbar
                open={saveSuccess}
                autoHideDuration={3000}
                onClose={() => setSaveSuccess(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="success" elevation={6} variant="filled">
                    設定を保存しました
                </Alert>
            </Snackbar>

            <Snackbar
                open={!!syncError}
                autoHideDuration={4000}
                onClose={() => setSyncError(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity="error" elevation={6} variant="filled">
                    {syncError}
                </Alert>
            </Snackbar>
        </Box>
    );
}
