import { useState, useRef } from 'react';
import { Box, Typography, Button, Paper, TextField, CircularProgress, Snackbar, Alert, IconButton, Card, CardMedia, CardContent, Dialog } from '@mui/material';
import { CameraAlt, UploadFile, AddCircleOutline, RemoveCircleOutline, CheckCircle, ErrorOutline, Close } from '@mui/icons-material';
import { useLiveQuery } from 'dexie-react-hooks';
import dayjs from 'dayjs';

import { db } from '../db/db';
import { type AIResult } from '../services/ai_service';
import { forceUploadSync } from '../services/sync_service';
import { auth } from '../firebase';
import { useAnalysis, type CameraQueueItem } from '../contexts/AnalysisContext';
import { AccountAutocomplete } from '../components/AccountAutocomplete';


export default function CameraInput() {
    const {
        cameraQueue, addCameraItems, removeCameraItem, retryCameraItem,
        csvQueue, addCsvItems, removeCsvItem, retryCsvItem
    } = useAnalysis();

    // We will use a unified reviewing item that could be from either queue.
    const [reviewingItem, setReviewingItem] = useState<{ id: string, type: 'camera' | 'csv' } | null>(null);
    const [successMsg, setSuccessMsg] = useState('');
    const [editingResult, setEditingResult] = useState<AIResult | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);
    const accounts = useLiveQuery(() => db.accounts.toArray(), []) || [];

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                const id = crypto.randomUUID();

                addCameraItems([{
                    id,
                    imagePreview: base64,
                    fileType: file.type,
                    status: 'analyzing'
                }]);
            };
            reader.readAsDataURL(file);
        }
        event.target.value = '';
    };

    const handleCsvFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const text = reader.result as string;
            const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

            const newItems = lines.map(line => ({
                id: crypto.randomUUID(),
                originalRow: line,
                status: 'pending' as const
            }));

            addCsvItems(newItems);
        };
        // Typically Shift_JIS for Japanese banking CSVs
        reader.readAsText(file, 'Shift_JIS');

        if (csvInputRef.current) csvInputRef.current.value = '';
    };

    const handleRetry = (item: CameraQueueItem) => {
        retryCameraItem(item.id);
    };

    const handleRemove = (id: string, type: 'camera' | 'csv') => {
        if (type === 'camera') removeCameraItem(id);
        else removeCsvItem(id);
    };

    const openReview = (item: any, type: 'camera' | 'csv') => {
        if (item.result) {
            setReviewingItem({ id: item.id, type });
            setEditingResult(JSON.parse(JSON.stringify(item.result)));
        }
    };

    const closeReview = () => {
        setReviewingItem(null);
        setEditingResult(null);
    };

    const handleSave = async () => {
        if (!editingResult || !reviewingItem || isSaving) return;

        const queueToSearch = reviewingItem.type === 'camera' ? cameraQueue : csvQueue;
        const currentItem = queueToSearch.find(q => q.id === reviewingItem.id);
        if (!currentItem) return;

        setIsSaving(true);

        const totalDebits = editingResult.debits.reduce((sum: number, d: { amount: number }) => sum + d.amount, 0);
        const totalCredits = editingResult.credits.reduce((sum: number, c: { amount: number }) => sum + c.amount, 0);

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
            handleRemove(reviewingItem.id, reviewingItem.type);
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
            <Paper elevation={0} sx={{ p: 4, textAlign: 'center', mb: 4, borderRadius: 4, border: '2px dashed', borderColor: 'primary.light', bgcolor: '#f0fdf4' }}>
                <Box mb={2} color="primary.main">
                    <CameraAlt sx={{ fontSize: 40, opacity: 0.9, mr: 2 }} />
                    <UploadFile sx={{ fontSize: 40, opacity: 0.9 }} />
                </Box>
                <Typography variant="h6" gutterBottom fontWeight="bold" color="primary.dark">AIによる自動仕訳解析</Typography>
                <Typography variant="body2" color="text.secondary" mb={4}>
                    レシート写真の中身や、クレジットカード・ネット銀行の明細CSVファイルをAIが読み解き、自動で仕訳を生成します。
                </Typography>

                <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap">
                    <Button
                        variant="contained" size="large" disableElevation
                        startIcon={<CameraAlt />} onClick={() => cameraInputRef.current?.click()}
                        sx={{ borderRadius: 8, px: 3, py: 1 }}
                    >
                        カメラで撮影
                    </Button>
                    <Button
                        variant="outlined" size="large" disableElevation
                        startIcon={<UploadFile />} onClick={() => galleryInputRef.current?.click()}
                        sx={{ borderRadius: 8, px: 3, py: 1, bgcolor: 'white' }}
                    >
                        写真を選択
                    </Button>
                    <Button
                        variant="outlined" size="large" disableElevation
                        startIcon={<UploadFile />} onClick={() => csvInputRef.current?.click()}
                        sx={{ borderRadius: 8, px: 3, py: 1, bgcolor: 'white' }}
                    >
                        CSV(明細)を選択
                    </Button>
                </Box>
                <input type="file" accept="image/*" capture="environment" multiple ref={cameraInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                <input type="file" accept="image/*" multiple ref={galleryInputRef} style={{ display: 'none' }} onChange={handleFileChange} />
                <input type="file" accept=".csv,text/csv" ref={csvInputRef} style={{ display: 'none' }} onChange={handleCsvFileChange} />
            </Paper>

            {(cameraQueue.length > 0 || csvQueue.length > 0) && (
                <Box>
                    <Typography variant="h6" fontWeight="bold" mb={2} px={1}>AI解析リスト ({cameraQueue.length + csvQueue.length}件)</Typography>
                    <Box display="flex" flexDirection="column" gap={2}>

                        {/* 1. Camera Queue */}
                        {cameraQueue.map(item => (
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
                                                    <Typography variant="body2" color="success.main" fontWeight="bold">画像解析完了</Typography>
                                                    <Typography variant="caption" color="text.secondary" ml={1}>
                                                        ¥{item.result?.debits.reduce((sum: number, d: { amount: number }) => sum + d.amount, 0).toLocaleString()}
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
                                        <IconButton size="small" onClick={() => handleRemove(item.id, 'camera')} sx={{ color: 'text.secondary' }}>
                                            <Close fontSize="small" />
                                        </IconButton>
                                    </Box>

                                    <Box mt={2}>
                                        {item.status === 'success' && (
                                            <Button variant="contained" size="small" onClick={() => openReview(item, 'camera')} disableElevation sx={{ borderRadius: 4 }}>
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

                        {/* 2. CSV Queue */}
                        {csvQueue.map(item => (
                            <Card key={item.id} elevation={0} sx={{ display: 'flex', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                                <Box sx={{ width: 100, bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', p: 1, borderRight: '1px solid #e2e8f0' }}>
                                    <Typography variant="caption" sx={{ wordBreak: 'break-all', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {item.originalRow.substring(0, 50)}...
                                    </Typography>
                                </Box>
                                <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', p: 2, '&:last-child': { pb: 2 } }}>
                                    <Box display="flex" justifyContent="space-between" alignItems="center">
                                        <Box display="flex" alignItems="center" gap={1}>
                                            {(item.status === 'pending' || item.status === 'analyzing') && (
                                                <>
                                                    <CircularProgress size={20} />
                                                    <Typography variant="body2" color="text.secondary">
                                                        {item.status === 'pending' ? '待機中...' : 'AI解析中...'}
                                                    </Typography>
                                                </>
                                            )}
                                            {item.status === 'success' && (
                                                <>
                                                    <CheckCircle color="success" fontSize="small" />
                                                    <Typography variant="body2" color="success.main" fontWeight="bold">CSV解析完了</Typography>
                                                    <Typography variant="caption" color="text.secondary" ml={1}>
                                                        ¥{item.result?.debits.reduce((sum: number, d: { amount: number }) => sum + d.amount, 0).toLocaleString()}
                                                    </Typography>
                                                </>
                                            )}
                                            {item.status === 'skipped' && (
                                                <Typography variant="body2" color="text.secondary">スキップ (私的利用など)</Typography>
                                            )}
                                            {item.status === 'error' && (
                                                <>
                                                    <ErrorOutline color="error" fontSize="small" />
                                                    <Typography variant="body2" color="error.main">{item.errorMsg}</Typography>
                                                </>
                                            )}
                                        </Box>
                                        <IconButton size="small" onClick={() => handleRemove(item.id, 'csv')} sx={{ color: 'text.secondary' }}>
                                            <Close fontSize="small" />
                                        </IconButton>
                                    </Box>

                                    <Box mt={2}>
                                        {item.status === 'success' && (
                                            <Button variant="contained" size="small" onClick={() => openReview(item, 'csv')} disableElevation sx={{ borderRadius: 4 }}>
                                                確認して登録
                                            </Button>
                                        )}
                                        {item.status === 'error' && (
                                            <Button variant="outlined" color="error" size="small" onClick={() => retryCsvItem(item.id)} sx={{ borderRadius: 4 }}>
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

            <Dialog open={!!reviewingItem} onClose={closeReview} maxWidth="md" fullWidth>
                {editingResult && reviewingItem && (
                    <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }}>
                        <Box flex={1} bgcolor={reviewingItem?.type === 'camera' ? "#000" : "#f1f5f9"} display="flex" justifyContent="center" alignItems="center" minHeight={{ xs: 200, md: 'auto' }} p={2}>
                            {reviewingItem?.type === 'camera' ? (
                                <img src={cameraQueue.find(q => q.id === reviewingItem.id)?.imagePreview} alt="Receipt" style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} />
                            ) : (
                                <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                    {csvQueue.find(q => q.id === reviewingItem.id)?.originalRow}
                                </Typography>
                            )}
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
                                    計: ¥{editingResult.debits.reduce((sum: number, d: { amount: number }) => sum + d.amount, 0).toLocaleString()}
                                </Typography>
                            </Box>
                            {editingResult.debits.map((d: { code: number, amount: number }, i: number) => (
                                <Box key={`deb-${i}`} display="flex" gap={1} alignItems="center" mb={1.5}>
                                    <AccountAutocomplete
                                        accounts={accounts}
                                        value={d.code}
                                        onChange={(newCode: number) => updateLine('debits', i, 'code', newCode)}
                                    />
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
                                    計: ¥{editingResult.credits.reduce((sum: number, c: { amount: number }) => sum + c.amount, 0).toLocaleString()}
                                </Typography>
                            </Box>
                            {editingResult.credits.map((c: { code: number, amount: number }, i: number) => (
                                <Box key={`cre-${i}`} display="flex" gap={1} alignItems="center" mb={1.5}>
                                    <AccountAutocomplete
                                        accounts={accounts}
                                        value={c.code}
                                        onChange={(newCode: number) => updateLine('credits', i, 'code', newCode)}
                                    />
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
