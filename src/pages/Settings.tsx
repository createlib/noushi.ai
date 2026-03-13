import { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Paper, Alert, Snackbar, MenuItem, Switch, FormControlLabel } from '@mui/material';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { doc, setDoc } from 'firebase/firestore';
import { db as firestoreDb, auth } from '../firebase';
import 'dexie-export-import';
import { forceUploadSync } from '../services/sync_service';

export default function Settings() {
    const currentSettings = useLiveQuery(() => db.settings.get(1));
    const [apiKey, setApiKey] = useState('');
    const [aiModel, setAiModel] = useState('gemini-2.5-flash');
    const [useFirebaseSync, setUseFirebaseSync] = useState(false);

    const [saveSuccess, setSaveSuccess] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    useEffect(() => {
        if (currentSettings) {
            setApiKey(currentSettings.geminiApiKey || '');
            if (currentSettings.aiModel) setAiModel(currentSettings.aiModel);
            if (currentSettings.useFirebaseSync !== undefined) setUseFirebaseSync(currentSettings.useFirebaseSync);
        }
    }, [currentSettings]);

    const handleSave = async () => {
        try {
            // 1. Save locally to IndexedDB
            if (currentSettings) {
                await db.settings.update(1, { geminiApiKey: apiKey, aiModel, useFirebaseSync });
            } else {
                await db.settings.add({ id: 1, geminiApiKey: apiKey, aiModel, useFirebaseSync });
            }

            // 2. Sync to Firestore if user is logged in
            const currentUser = auth.currentUser;
            if (currentUser) {
                const docRef = doc(firestoreDb, 'artifacts', 'default-app-id', 'users', currentUser.uid, 'profile', 'data');
                // Use setDoc with merge: true to update only these fields without overwriting membershipRank
                await setDoc(docRef, {
                    geminiApiKey: apiKey,
                    aiModel,
                    useFirebaseSync
                }, { merge: true });

                // If user enabled sync, try to trigger a force upload or perform sync right now
                if (useFirebaseSync) {
                    try {
                        await forceUploadSync(currentUser.uid);
                    } catch (e) {
                        console.error("Firebase Storage Upload failed", e);
                        setSyncError("設定は保存できましたが、バックアップ同期に失敗しました。");
                        return; // Don't show success banner
                    }
                }
            }

            setSaveSuccess(true);
            setSyncError(null);
        } catch (error) {
            console.error("Failed to save settings:", error);
            setSyncError("設定の保存中にエラーが発生しました。");
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

                <Typography variant="subtitle1" gutterBottom sx={{ mt: 4 }}>Firebase Storage 同期 (自動バックアップ)</Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    有効にすると、ログイン中のアカウントに紐付いて仕訳データがクラウド上に暗号化して自動保存・同期されます。
                    複数端末で同じアカウントにログインすれば、データがリアルタイムに共有されます。
                </Typography>

                <FormControlLabel
                    control={
                        <Switch
                            checked={useFirebaseSync}
                            onChange={(e) => setUseFirebaseSync(e.target.checked)}
                            color="primary"
                        />
                    }
                    label="クラウド自動同期を有効にする"
                />

                <Box mt={4} mb={2}>
                    <Button variant="contained" color="primary" onClick={handleSave} disableElevation>
                        設定を保存する
                    </Button>
                </Box>
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
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity="success" elevation={6} variant="filled">
                    設定を保存しました
                </Alert>
            </Snackbar>

            <Snackbar
                open={!!syncError}
                autoHideDuration={4000}
                onClose={() => setSyncError(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity="error" elevation={6} variant="filled">
                    {syncError}
                </Alert>
            </Snackbar>
        </Box>
    );
}
