import { useState, useRef, useEffect } from 'react';
import { Box, Typography, Button, Paper, TextField, CircularProgress, MenuItem, Snackbar, Alert, IconButton, Dialog, Stack, Checkbox, FormControlLabel } from '@mui/material';
import { UploadFile, AddCircleOutline, RemoveCircleOutline, CheckCircle, ErrorOutline, Close, SkipNext } from '@mui/icons-material';
import { useLiveQuery } from 'dexie-react-hooks';
import dayjs from 'dayjs';

import { db } from '../db/db';
import { analyzeCSVRow, type AIResult } from '../services/ai_service';

interface CSVQueueItem {
    id: string;
    originalRow: string;
    status: 'pending' | 'analyzing' | 'success' | 'skipped' | 'error';
    result?: AIResult | null;
    errorMsg?: string;
}

export default function CSVImport() {
    const [queue, setQueue] = useState<CSVQueueItem[]>([]);
    const [reviewingId, setReviewingId] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState('');
    const [editingResult, setEditingResult] = useState<AIResult | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            // CSVはShift_JISの場合もあるので適切にデコードしたいがまずはUTF-8で試す
            const text = reader.result as string;
            const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

            const newItems = lines.map(line => ({
                id: crypto.randomUUID(),
                originalRow: line,
                status: 'pending' as const
            }));

            // 先頭行などのヘッダーを含めて一旦全部キューに入れる。
            setQueue(prev => [...prev, ...newItems]);
        };
        // 一般的なネット銀行のCSVはShift_JIS形式が多いため、Shift_JISで読み込む
        reader.readAsText(file, 'Shift_JIS');

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // キューの逐次処理
    useEffect(() => {
        const processNext = async () => {
            if (isProcessing) return;

            const nextItem = queue.find(q => q.status === 'pending');
            if (!nextItem) return;

            setIsProcessing(true);
            setQueue(prev => prev.map(q => q.id === nextItem.id ? { ...q, status: 'analyzing' } : q));

            try {
                const aiData = await analyzeCSVRow(nextItem.originalRow);
                if (aiData?.isPersonalUse) {
                    setQueue(prev => prev.map(q => q.id === nextItem.id ? { ...q, status: 'skipped', result: aiData } : q));
                } else if (aiData && aiData.debits.length > 0 && aiData.credits.length > 0) {
                    setQueue(prev => prev.map(q => q.id === nextItem.id ? { ...q, status: 'success', result: aiData } : q));
                } else {
                    // 日付や金額の配列が空であれば、ヘッダー行や対象外とみなしてエラー（スキップに近い）
                    setQueue(prev => prev.map(q => q.id === nextItem.id ? { ...q, status: 'error', errorMsg: 'パース結果が空です（不要な行の可能性）' } : q));
                }
            } catch (err: any) {
                setQueue(prev => prev.map(q => q.id === nextItem.id ? { ...q, status: 'error', errorMsg: err.message || 'AI解析に失敗しました' } : q));
            } finally {
                setIsProcessing(false);
            }
        };

        processNext();
    }, [queue, isProcessing]);


    const handleRetry = (id: string) => {
        setQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'pending', errorMsg: undefined } : q));
    };

    const handleRemove = (id: string) => {
        setQueue(prev => prev.filter(q => q.id !== id));
    };

    const handleSkip = (id: string) => {
        setQueue(prev => prev.map(q => q.id === id ? { ...q, status: 'skipped' } : q));
    }

    const openReview = (item: CSVQueueItem) => {
        if (item.result) {
            setReviewingId(item.id);
            setEditingResult(JSON.parse(JSON.stringify(item.result)));
        }
    };

    const closeReview = () => {
        setReviewingId(null);
        setEditingResult(null);
    };

    const handleSave = async () => {
        if (!editingResult || !reviewingId) return;
        const currentItem = queue.find(q => q.id === reviewingId);
        if (!currentItem) return;

        const totalDebits = editingResult.debits.reduce((sum, d) => sum + d.amount, 0);
        const totalCredits = editingResult.credits.reduce((sum, c) => sum + c.amount, 0);

        if (totalDebits !== totalCredits) {
            alert(`借方合計(¥${totalDebits})と貸方合計(¥${totalCredits})が一致しません。`);
            return;
        }

        try {
            const now = Date.now();
            const journalId = crypto.randomUUID();

            // 1. Snapshot the data
            const savePayload = {
                journalId,
                date: editingResult.date || dayjs().format('YYYY-MM-DD'),
                description: editingResult.description || '',
                now,
                reviewingIdToClose: reviewingId,
                debitsSnapshot: [...editingResult.debits],
                creditsSnapshot: [...editingResult.credits]
            };

            // 2. UIを即座に解放
            setSuccessMsg('仕訳を登録しました');
            handleRemove(savePayload.reviewingIdToClose);
            closeReview();

            // 3. 背景処理でDB保存と同期を実行（次のイベントループへ）
            setTimeout(() => {
                (async () => {
                    try {
                        await db.transaction('rw', [db.journals, db.journal_lines], async () => {
                            await db.journals.add({
                                id: savePayload.journalId,
                                date: savePayload.date,
                                description: savePayload.description,
                                status: 'posted',
                                createdAt: savePayload.now,
                                updatedAt: savePayload.now
                            });

                            const newLines: any[] = [];
                            savePayload.debitsSnapshot.forEach(d => {
                                newLines.push({ id: crypto.randomUUID(), journal_id: savePayload.journalId, account_id: d.code, debit: d.amount, credit: 0 });
                            });
                            savePayload.creditsSnapshot.forEach(c => {
                                newLines.push({ id: crypto.randomUUID(), journal_id: savePayload.journalId, account_id: c.code, debit: 0, credit: c.amount });
                            });
                            await db.journal_lines.bulkAdd(newLines);
                        });

                        const currentSettings = await db.settings.get(1);
                        if (currentSettings?.useFirebaseSync) {
                            const { auth } = await import('../firebase');
                            if (auth.currentUser) {
                                try {
                                    const { forceUploadSync } = await import('../services/sync_service');
                                    await forceUploadSync(auth.currentUser.uid);
                                } catch (e) {
                                    console.error('CSV import background sync failed', e);
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Background processing failed', e);
                    }
                })();
            }, 50);

        } catch (e: any) {
            console.error(e);
            alert('保存処理の準備に失敗しました');
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
            <Paper elevation={0} sx={{ p: 3, textAlign: 'center', mb: 4, borderRadius: 4, border: '2px dashed', borderColor: 'primary.light', bgcolor: '#f0fdf4' }}>
                <Box mb={2} color="primary.main">
                    <UploadFile sx={{ fontSize: 48, opacity: 0.9 }} />
                </Box>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold" color="primary.dark">CSVファイルをアップロード</Typography>
                <Typography variant="body2" color="text.secondary" mb={3}>
                    ネット銀行やクレジットカードの明細CSVを選択してください。1行ずつAIが自動で仕訳を推論します。（私的な支出はスキップ可能です）
                </Typography>

                <Button
                    variant="contained"
                    size="large"
                    startIcon={<UploadFile />}
                    onClick={() => fileInputRef.current?.click()}
                    sx={{ borderRadius: 8, px: 4, py: 1.2 }}
                    disableElevation
                >
                    CSVファイルを選択
                </Button>
                <input
                    type="file"
                    accept=".csv,text/csv"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />
            </Paper>

            {queue.length > 0 && (
                <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} px={1}>
                        <Typography variant="h6" fontWeight="bold">CSV読取リスト ({queue.length}件)</Typography>
                        <Typography variant="caption" color="text.secondary">
                            残り処理数: {queue.filter(q => q.status === 'pending').length}件
                        </Typography>
                    </Box>

                    <Box display="flex" flexDirection="column" gap={2}>
                        {queue.map(item => (
                            <Paper key={item.id} elevation={0} sx={{ display: 'flex', flexDirection: 'column', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
                                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                                    <Box sx={{ flex: 1, mr: 2, p: 1, bgcolor: '#f1f5f9', borderRadius: 1, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                                            {item.originalRow}
                                        </Typography>
                                    </Box>
                                    <IconButton size="small" onClick={() => handleRemove(item.id)} sx={{ color: 'text.secondary', mt: -0.5, mr: -0.5 }}>
                                        <Close fontSize="small" />
                                    </IconButton>
                                </Box>

                                <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={{ xs: 2, sm: 0 }}>
                                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                                        {item.status === 'pending' && <Typography variant="body2" color="text.secondary">待機中...</Typography>}
                                        {item.status === 'analyzing' && (
                                            <>
                                                <CircularProgress size={16} />
                                                <Typography variant="body2" color="text.secondary">AI解析中...</Typography>
                                            </>
                                        )}
                                        {item.status === 'success' && (
                                            <>
                                                <CheckCircle color="success" fontSize="small" />
                                                <Typography variant="body2" color="success.main" fontWeight="bold">解析完了</Typography>
                                                <Typography variant="caption" color="text.secondary" ml={1}>
                                                    {item.result?.date} / ¥{item.result?.debits.reduce((s, d) => s + d.amount, 0).toLocaleString()}
                                                </Typography>
                                            </>
                                        )}
                                        {item.status === 'skipped' && (
                                            <>
                                                <SkipNext color="action" fontSize="small" />
                                                <Typography variant="body2" color="text.secondary" fontWeight="bold">私的利用 (スキップ)</Typography>
                                            </>
                                        )}
                                        {item.status === 'error' && (
                                            <>
                                                <ErrorOutline color="error" fontSize="small" />
                                                <Typography variant="body2" color="error.main">{item.errorMsg}</Typography>
                                            </>
                                        )}
                                    </Box>

                                    <Box width={{ xs: '100%', sm: 'auto' }} display="flex" justifyContent={{ xs: 'flex-end', sm: 'center' }}>
                                        {item.status === 'success' && (
                                            <Stack direction="row" spacing={1} width={{ xs: '100%', sm: 'auto' }}>
                                                <Button variant="outlined" color="inherit" size="small" onClick={() => handleSkip(item.id)} sx={{ borderRadius: 4, flex: { xs: 1, sm: 'none' } }}>
                                                    スキップ
                                                </Button>
                                                <Button variant="contained" size="small" onClick={() => openReview(item)} disableElevation sx={{ borderRadius: 4, flex: { xs: 1, sm: 'none' } }}>
                                                    確認・登録
                                                </Button>
                                            </Stack>
                                        )}
                                        {item.status === 'skipped' && (
                                            <Button variant="outlined" color="primary" size="small" onClick={() => openReview(item)} sx={{ borderRadius: 4, width: { xs: '100%', sm: 'auto' } }}>
                                                内容を確認
                                            </Button>
                                        )}
                                        {item.status === 'error' && (
                                            <Button variant="outlined" color="error" size="small" onClick={() => handleRetry(item.id)} sx={{ borderRadius: 4, width: { xs: '100%', sm: 'auto' } }}>
                                                再解析
                                            </Button>
                                        )}
                                    </Box>
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                </Box>
            )}

            {/* 確認・編集ダイアログ */}
            <Dialog open={!!reviewingId} onClose={closeReview} maxWidth="md" fullWidth>
                {editingResult && (
                    <Box p={{ xs: 2, sm: 3 }} sx={{ overflowY: 'auto' }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="h6" fontWeight="bold" color="primary.dark">仕訳内容の確認</Typography>
                            <IconButton onClick={closeReview}><Close /></IconButton>
                        </Box>

                        <TextField
                            fullWidth margin="dense" label="日付" type="date"
                            InputLabelProps={{ shrink: true }}
                            value={editingResult.date || ''}
                            sx={{ mb: 3 }}
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
                                    {accounts.map(a => <MenuItem key={a.code} value={a.code}>{a.code}: {a.name}</MenuItem>)}
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
                                    {accounts.map(a => <MenuItem key={a.code} value={a.code}>{a.code}: {a.name}</MenuItem>)}
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
                            value={editingResult.description || ''}
                            sx={{ mt: 3, mb: 2 }}
                            onChange={(e) => setEditingResult({ ...editingResult, description: e.target.value })}
                        />

                        <FormControlLabel
                            control={<Checkbox checked={editingResult.isPersonalUse || false} onChange={e => setEditingResult({ ...editingResult, isPersonalUse: e.target.checked })} color="warning" />}
                            label="これは事業に無関係な個人的な支出です (スキップする)"
                            sx={{ mb: 2 }}
                        />

                        <Button variant="contained" fullWidth color={editingResult.isPersonalUse ? "warning" : "primary"} sx={{ borderRadius: 8, py: 1.5, mt: 1 }} disableElevation onClick={() => {
                            if (editingResult.isPersonalUse) {
                                handleSkip(reviewingId!);
                                closeReview();
                                setSuccessMsg('スキップしました');
                            } else {
                                handleSave();
                            }
                        }}>
                            {editingResult.isPersonalUse ? "仕訳として登録せずスキップ" : "この内容で登録する"}
                        </Button>
                    </Box>
                )}
            </Dialog>

            <Snackbar open={!!successMsg} autoHideDuration={3000} onClose={() => setSuccessMsg('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
                <Alert severity="success" elevation={6} variant="filled">{successMsg}</Alert>
            </Snackbar>
        </Box>
    );
}
