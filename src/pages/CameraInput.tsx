import { useState, useRef } from 'react';
import { Box, Typography, Button, Paper, TextField, CircularProgress, MenuItem, Snackbar, Alert, IconButton, Card, CardMedia, CardContent, Dialog } from '@mui/material';
import { CameraAlt, UploadFile, AddCircleOutline, RemoveCircleOutline, CheckCircle, ErrorOutline, Close } from '@mui/icons-material';
import { useLiveQuery } from 'dexie-react-hooks';
import dayjs from 'dayjs';

import { db } from '../db/db';
import { analyzeReceipt, type AIResult } from '../services/ai_service';
import { forceUploadSync } from '../services/sync_service';
import { auth } from '../firebase';

interface QueueItem {
    id: string;
    imagePreview: string; // base64
    fileType: string;
    status: 'analyzing' | 'success' | 'error';
    result?: AIResult | null;
    errorMsg?: string;
}

export default function CameraInput() {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [reviewingId, setReviewingId] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState('');
    const [editingResult, setEditingResult] = useState<AIResult | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                const id = crypto.randomUUID();

                const newItem: QueueItem = { id, imagePreview: base64, fileType: file.type, status: 'analyzing' };
                setQueue(prev => [newItem, ...prev]);

                runAnalysis(id, base64, file.type);
            };
            reader.readAsDataURL(file);
        }
        event.target.value = '';
    };

    const runAnalysis = async (id: string, base64: string, fileType: string) => {
        try {
            const aiData = await analyzeReceipt(base64, fileType);
            if (aiData) {
                setQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'success', result: aiData } : q));
            } else {
                setQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'error', errorMsg: '解析結果が空でした' } : q));
            }
        } catch (err: any) {
            setQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'error', errorMsg: err.message || 'AI解析に失敗しました' } : q));
        }
    };

    const handleRetry = (item: QueueItem) => {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'analyzing', errorMsg: undefined } : q));
        runAnalysis(item.id, item.imagePreview, item.fileType);
    };

    const handleRemove = (id: string) => {
        setQueue(prev => prev.filter(q => q.id !== id));
    };

    const openReview = (item: QueueItem) => {
        if (item.result) {
            setReviewingId(item.id);
            // 深いコピーを作成
            setEditingResult(JSON.parse(JSON.stringify(item.result)));
        }
    };

    const closeReview = () => {
        setReviewingId(null);
        setEditingResult(null);
    };

    const handleSave = async () => {
        if (!editingResult || !reviewingId || isSaving) return;
        const currentItem = queue.find(q => q.id === reviewingId);
        if (!currentItem) return;

        setIsSaving(true);

        const totalDebits = editingResult.debits.reduce((sum, d) => sum + d.amount, 0);
        const totalCredits = editingResult.credits.reduce((sum, c) => sum + c.amount, 0);

        if (totalDebits !== totalCredits) {
            alert(`借方合計(¥${totalDebits})と貸方合計(¥${totalCredits})が一致しません。`);
            setIsSaving(false);
            return;
        }

        try {
            const journalId = crypto.randomUUID();
            const now = Date.now();

            await db.transaction('rw', [db.journals, db.journal_lines], async () => {
                // Header
                await db.journals.add({
                    id: journalId,
                    date: editingResult.date || dayjs().format('YYYY-MM-DD'),
                    description: editingResult.description || '',
                    status: 'posted',
                    createdAt: now,
                    updatedAt: now,
                });

                // Lines
                const lines: any[] = [];
                editingResult.debits.forEach(d => {
                    lines.push({
                        id: crypto.randomUUID(),
                        journal_id: journalId,
                        account_id: d.code,
                        debit: d.amount,
                        credit: 0
                    });
                });
                editingResult.credits.forEach(c => {
                    lines.push({
                        id: crypto.randomUUID(),
                        journal_id: journalId,
                        account_id: c.code,
                        debit: 0,
                        credit: c.amount
                    });
                });

                await db.journal_lines.bulkAdd(lines);
            });

            // UIを即座に解放
            setSuccessMsg('仕訳を登録しました');
            handleRemove(reviewingId);
            closeReview();
            setIsSaving(false);

            // 背景で同期を実行
            setTimeout(async () => {
                try {
                    const currentSettings = await db.settings.get(1);
                    if (currentSettings?.useFirebaseSync && auth.currentUser) {
                        await forceUploadSync(auth.currentUser.uid);
                    }
                } catch (e) {
                    console.error('Background processing failed', e);
                }
            }, 100);

        } catch (e) {
            alert('保存に失敗しました');
            setIsSaving(false);
        }
    };

    const updateLine = (type: 'debits' | 'credits', index: number, field: 'code' | 'amount', value: number) => {
        if (!editingResult) return;
        const newList = [...editingResult[type]];
        newList[index] = { ...newList[index], [field]: value };
        setEditingResult({ ...editingResult, [type]: newList });
    };

    const addLine = (type: 'debits' | 'credits') => {
        if (!editingResult) return;
        const newList = [...editingResult[type], { code: 100, amount: 0 }];
        setEditingResult({ ...editingResult, [type]: newList });
    };

    const removeLine = (type: 'debits' | 'credits', index: number) => {
        if (!editingResult) return;
        const newList = [...editingResult[type]];
        newList.splice(index, 1);
        setEditingResult({ ...editingResult, [type]: newList });
    };

    return (
        <Box p={{ xs: 1, sm: 2 }} pt={2}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3, px: 1 }}>一括レシート読取</Typography>

            <Paper elevation={0} sx={{ p: 3, textAlign: 'center', mb: 4, borderRadius: 4, border: '2px dashed', borderColor: 'primary.light', bgcolor: '#f0f9ff' }}>
                <Box mb={2} color="primary.main">
                    <CameraAlt sx={{ fontSize: 48, opacity: 0.9 }} />
                </Box>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold" color="primary.dark">レシートを連続撮影</Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                    撮影した画像はバックグラウンドで順次解析されます。解析完了後、個別に確認して登録できます。
                </Typography>

                <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<CameraAlt />}
                        onClick={() => cameraInputRef.current?.click()}
                        sx={{ borderRadius: 8, px: 4, py: 1.2 }}
                        disableElevation
                    >
                        カメラを起動
                    </Button>
                    <Button
                        variant="outlined"
                        size="large"
                        startIcon={<UploadFile />}
                        onClick={() => galleryInputRef.current?.click()}
                        sx={{ borderRadius: 8, px: 4, py: 1.2, bgcolor: 'white' }}
                    >
                        写真を選択
                    </Button>
                </Box>
                <input type="file" accept="image/*" capture="environment" multiple ref={cameraInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                <input type="file" accept="image/*" multiple ref={galleryInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
            </Paper>

            {queue.length > 0 && (
                <Box>
                    <Typography variant="h6" fontWeight="bold" mb={2} px={1}>読取リスト ({queue.length}件)</Typography>
                    <Box display="flex" flexDirection="column" gap={2}>
                        {queue.map(item => (
                            <Card key={item.id} elevation={0} sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                                <CardMedia component="img" sx={{ width: 100, objectFit: 'cover' }} image={item.imagePreview} alt="Receipt thumbnail" />
                                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', p: 2, '&:last-child': { pb: 2 } }}>
                                    <Box display="flex" justifyContent="space-between" alignItems="center">
                                        <Box display="flex" alignItems="center" gap={1}>
                                            {item.status === 'analyzing' && (
                                                <>
                                                    <CircularProgress size={20} />
                                                    <Typography variant="body2" color="text.secondary">AI解析中...</Typography>
                                                </>
                                            )}
                                            {item.status === 'success' && (
                                                <>
                                                    <CheckCircle color="success" fontSize="small" />
                                                    <Typography variant="body2" color="success.main" fontWeight="bold">解析完了</Typography>
                                                    <Typography variant="caption" color="text.secondary" ml={1}>
                                                        ¥{item.result?.debits.reduce((s, d) => s + d.amount, 0).toLocaleString()}
                                                    </Typography>
                                                </>
                                            )}
                                            {item.status === 'error' && (
                                                <>
                                                    <ErrorOutline color="error" fontSize="small" />
                                                    <Typography variant="body2" color="error.main">{item.errorMsg}</Typography>
                                                </>
                                            )}
                                        </Box>
                                        <IconButton size="small" onClick={() => handleRemove(item.id)} sx={{ color: 'text.secondary' }}>
                                            <Close fontSize="small" />
                                        </IconButton>
                                    </Box>

                                    <Box mt={2}>
                                        {item.status === 'success' && (
                                            <Button variant="contained" size="small" onClick={() => openReview(item)} disableElevation sx={{ borderRadius: 4 }}>
                                                確認して登録
                                            </Button>
                                        )}
                                        {item.status === 'error' && (
                                            <Button variant="outlined" color="error" size="small" onClick={() => handleRetry(item)} sx={{ borderRadius: 4 }}>
                                                再解析
                                            </Button>
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        ))}
                    </Box>
                </Box>
            )}

            <Dialog open={!!reviewingId} onClose={closeReview} maxWidth="md" fullWidth>
                {editingResult && (
                    <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }}>
                        <Box flex={1} bgcolor="#000" display="flex" justifyContent="center" alignItems="center" minHeight={{ xs: 200, md: 'auto' }}>
                            <img src={queue.find(q => q.id === reviewingId)?.imagePreview} alt="Receipt" style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} />
                        </Box>
                        <Box flex={1} p={{ xs: 2, sm: 3 }} sx={{ overflowY: 'auto', maxHeight: { xs: 'auto', md: '80vh' } }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Typography variant="h6" fontWeight="bold" color="primary.dark">解析結果の確認</Typography>
                                <IconButton onClick={closeReview}><Close /></IconButton>
                            </Box>

                            <TextField
                                fullWidth margin="dense" label="日付" type="date"
                                InputLabelProps={{ shrink: true }}
                                value={editingResult.date} sx={{ mb: 3 }}
                                onChange={(e) => setEditingResult({ ...editingResult, date: e.target.value })}
                            />

                            <Box mb={1.5} p={1.5} bgcolor="#ecfdf5" borderRadius={2} display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle2" color="#059669" fontWeight="bold">借方 (Debit)</Typography>
                                <Typography variant="caption" color="#059669" fontWeight="bold">
                                    計: ¥{editingResult.debits.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
                                </Typography>
                            </Box>
                            {editingResult.debits.map((d, i) => (
                                <Box key={`deb-${i}`} display="flex" gap={1} alignItems="center" mb={1.5}>
                                    <TextField select size="small" fullWidth label="科目" value={d.code} onChange={(e) => updateLine('debits', i, 'code', Number(e.target.value))}>
                                        {accounts.map(a => <MenuItem key={a.code || a.id} value={a.code || a.id}>{a.code || a.id}: {a.name}</MenuItem>)}
                                    </TextField>
                                    <TextField size="small" type="number" label="金額" value={d.amount || ''} onChange={(e) => updateLine('debits', i, 'amount', Number(e.target.value))} sx={{ width: '120px' }} />
                                    <IconButton sx={{ color: 'error.main', p: 0.5 }} onClick={() => removeLine('debits', i)} disabled={editingResult.debits.length <= 1}>
                                        <RemoveCircleOutline />
                                    </IconButton>
                                </Box>
                            ))}
                            <Button startIcon={<AddCircleOutline />} size="small" onClick={() => addLine('debits')} sx={{ color: '#059669', mb: 2 }}>借方を追加</Button>

                            <Box mt={1} mb={1.5} p={1.5} bgcolor="#fffbeb" borderRadius={2} display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle2" color="#b45309" fontWeight="bold">貸方 (Credit)</Typography>
                                <Typography variant="caption" color="#b45309" fontWeight="bold">
                                    計: ¥{editingResult.credits.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                                </Typography>
                            </Box>
                            {editingResult.credits.map((c, i) => (
                                <Box key={`cre-${i}`} display="flex" gap={1} alignItems="center" mb={1.5}>
                                    <TextField select size="small" fullWidth label="科目" value={c.code} onChange={(e) => updateLine('credits', i, 'code', Number(e.target.value))}>
                                        {accounts.map(a => <MenuItem key={a.code || a.id} value={a.code || a.id}>{a.code || a.id}: {a.name}</MenuItem>)}
                                    </TextField>
                                    <TextField size="small" type="number" label="金額" value={c.amount || ''} onChange={(e) => updateLine('credits', i, 'amount', Number(e.target.value))} sx={{ width: '120px' }} />
                                    <IconButton sx={{ color: 'error.main', p: 0.5 }} onClick={() => removeLine('credits', i)} disabled={editingResult.credits.length <= 1}>
                                        <RemoveCircleOutline />
                                    </IconButton>
                                </Box>
                            ))}
                            <Button startIcon={<AddCircleOutline />} size="small" onClick={() => addLine('credits')} sx={{ color: '#b45309' }}>貸方を追加</Button>

                            <TextField
                                fullWidth margin="dense" label="摘要 (内容)"
                                value={editingResult.description} sx={{ mt: 3, mb: 2 }}
                                onChange={(e) => setEditingResult({ ...editingResult, description: e.target.value })}
                            />

                            <Button variant="contained" fullWidth color="primary" sx={{ borderRadius: 8, py: 1.5, mt: 1 }} disableElevation onClick={handleSave} disabled={isSaving}>
                                {isSaving ? '登録中...' : 'この内容で登録する'}
                            </Button>
                        </Box>
                    </Box>
                )}
            </Dialog>

            <Snackbar open={!!successMsg} autoHideDuration={3000} onClose={() => setSuccessMsg('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
                <Alert severity="success" elevation={6} variant="filled">{successMsg}</Alert>
            </Snackbar>
        </Box>
    );
}
