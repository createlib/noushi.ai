import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography, MenuItem, IconButton, Alert } from '@mui/material';
import { AddCircleOutline, RemoveCircleOutline } from '@mui/icons-material';
import { useLiveQuery } from 'dexie-react-hooks';
import dayjs from 'dayjs';
import { db, type Journal } from '../db/db';
import { auth } from '../firebase';
// import { forceUploadSync } removed to avoid unused variable warning

interface Props {
    open: boolean;
    onClose: () => void;
    journalToEdit?: Journal | null;
}

export default function TransactionEditorDialog({ open, onClose, journalToEdit }: Props) {
    const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
    const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [debits, setDebits] = useState<{ code: number; amount: number }[]>([{ code: 100, amount: 0 }]);
    const [credits, setCredits] = useState<{ code: number; amount: number }[]>([{ code: 100, amount: 0 }]);
    const [description, setDescription] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isLoadingLines, setIsLoadingLines] = useState(false);

    useEffect(() => {
        if (open) {
            setErrorMsg('');
            if (journalToEdit) {
                setDate(journalToEdit.date);
                setDescription(journalToEdit.description || '');
                setIsLoadingLines(true);
                // Load existing lines
                db.journal_lines.where('journal_id').equals(journalToEdit.id).toArray().then(lines => {
                    const loadedDebits = lines.filter(l => l.debit > 0).map(l => ({ code: l.account_id, amount: l.debit }));
                    const loadedCredits = lines.filter(l => l.credit > 0).map(l => ({ code: l.account_id, amount: l.credit }));

                    if (loadedDebits.length > 0) setDebits(loadedDebits);
                    else setDebits([{ code: 100, amount: 0 }]);

                    if (loadedCredits.length > 0) setCredits(loadedCredits);
                    else setCredits([{ code: 400, amount: 0 }]);

                    setIsLoadingLines(false);
                });
            } else {
                setDate(dayjs().format('YYYY-MM-DD'));
                setDebits([{ code: 100, amount: 0 }]);
                setCredits([{ code: 400, amount: 0 }]);
                setDescription('');
            }
        }
    }, [open, journalToEdit]);

    const handleSave = async () => {
        const totalDebits = debits.reduce((sum, d) => sum + d.amount, 0);
        const totalCredits = credits.reduce((sum, c) => sum + c.amount, 0);

        if (totalDebits !== totalCredits) {
            setErrorMsg(`借方合計(¥${totalDebits})と貸方合計(¥${totalCredits})が一致しません。`);
            return;
        }

        try {
            const now = Date.now();
            let journalId = journalToEdit?.id || crypto.randomUUID();

            await db.transaction('rw', [db.journals, db.journal_lines], async () => {
                if (journalToEdit) {
                    await db.journals.update(journalId, {
                        date, description, updatedAt: now
                    });
                    // Clear existing lines to replace them
                    const existingLines = await db.journal_lines.where('journal_id').equals(journalId).toArray();
                    const existingLineIds = existingLines.map(l => l.id);
                    await db.journal_lines.bulkDelete(existingLineIds);
                } else {
                    await db.journals.add({
                        id: journalId,
                        date, description, status: 'posted',
                        createdAt: now,
                        updatedAt: now
                    });
                }

                // Add lines
                const newLines: any[] = [];
                debits.forEach(d => {
                    newLines.push({
                        id: crypto.randomUUID(),
                        journal_id: journalId,
                        account_id: d.code,
                        debit: d.amount,
                        credit: 0
                    });
                });
                credits.forEach(c => {
                    newLines.push({
                        id: crypto.randomUUID(),
                        journal_id: journalId,
                        account_id: c.code,
                        debit: 0,
                        credit: c.amount
                    });
                });
                await db.journal_lines.bulkAdd(newLines);
            });

            // UIを即座に解放
            onClose();

            // 背景で元帳再構築と同期を実行
            setTimeout(async () => {
                try {
                    const { rebuildLedger, rebuildFiscalPeriods } = await import('../db/init');
                    await rebuildLedger();
                    await rebuildFiscalPeriods();

                    const currentSettings = await db.settings.get(1);
                    if (currentSettings?.useFirebaseSync && auth.currentUser) {
                        try {
                            const { forceUploadSync } = await import('../services/sync_service');
                            await forceUploadSync(auth.currentUser.uid);
                        } catch (e) {
                            console.error('Background sync failed', e);
                        }
                    }
                } catch (e) {
                    console.error('Background processing failed', e);
                }
            }, 100);

        } catch (err) {
            setErrorMsg('保存に失敗しました');
        }
    };

    const updateLine = (type: 'debits' | 'credits', index: number, field: 'code' | 'amount', value: number) => {
        const list = type === 'debits' ? [...debits] : [...credits];
        list[index] = { ...list[index], [field]: value };
        if (type === 'debits') setDebits(list); else setCredits(list);
    };

    const addLine = (type: 'debits' | 'credits') => {
        const list = type === 'debits' ? [...debits] : [...credits];
        list.push({ code: 100, amount: 0 });
        if (type === 'debits') setDebits(list); else setCredits(list);
    };

    const removeLine = (type: 'debits' | 'credits', index: number) => {
        const list = type === 'debits' ? [...debits] : [...credits];
        list.splice(index, 1);
        if (type === 'debits') setDebits(list); else setCredits(list);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{journalToEdit ? '仕訳の編集' : '手動で仕訳を追加'}</DialogTitle>
            <DialogContent dividers>
                {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}
                <TextField
                    fullWidth margin="dense" label="日付" type="date"
                    InputLabelProps={{ shrink: true }}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    sx={{ mb: 3 }}
                    disabled={isLoadingLines}
                />

                <Box mb={1.5} p={1.5} bgcolor="#ecfdf5" borderRadius={2} display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" color="#059669" fontWeight="bold">借方 (Debit)</Typography>
                    <Typography variant="caption" color="#059669" fontWeight="bold">
                        計: ¥{debits.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
                    </Typography>
                </Box>
                {debits.map((d, i) => (
                    <Box key={`deb-${i}`} display="flex" gap={1} alignItems="center" mb={1.5}>
                        <TextField
                            select size="small" fullWidth label="科目" value={d.code}
                            onChange={(e) => updateLine('debits', i, 'code', Number(e.target.value))}
                            disabled={isLoadingLines}
                        >
                            {accounts.map(a => <MenuItem key={a.code || a.id} value={a.code || a.id}>{a.code || a.id}: {a.name}</MenuItem>)}
                        </TextField>
                        <TextField
                            size="small" type="number" label="金額" value={d.amount || ''}
                            onChange={(e) => updateLine('debits', i, 'amount', Number(e.target.value))}
                            sx={{ width: '140px' }}
                            disabled={isLoadingLines}
                        />
                        <IconButton sx={{ color: 'error.main', p: 0.5 }} onClick={() => removeLine('debits', i)} disabled={debits.length <= 1 || isLoadingLines}>
                            <RemoveCircleOutline />
                        </IconButton>
                    </Box>
                ))}
                <Button startIcon={<AddCircleOutline />} size="small" onClick={() => addLine('debits')} sx={{ color: '#059669', mb: 2 }} disabled={isLoadingLines}>借方を追加</Button>

                <Box mt={1} mb={1.5} p={1.5} bgcolor="#fffbeb" borderRadius={2} display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle2" color="#b45309" fontWeight="bold">貸方 (Credit)</Typography>
                    <Typography variant="caption" color="#b45309" fontWeight="bold">
                        計: ¥{credits.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                    </Typography>
                </Box>
                {credits.map((c, i) => (
                    <Box key={`cre-${i}`} display="flex" gap={1} alignItems="center" mb={1.5}>
                        <TextField
                            select size="small" fullWidth label="科目" value={c.code}
                            onChange={(e) => updateLine('credits', i, 'code', Number(e.target.value))}
                            disabled={isLoadingLines}
                        >
                            {accounts.map(a => <MenuItem key={a.code || a.id} value={a.code || a.id}>{a.code || a.id}: {a.name}</MenuItem>)}
                        </TextField>
                        <TextField
                            size="small" type="number" label="金額" value={c.amount || ''}
                            onChange={(e) => updateLine('credits', i, 'amount', Number(e.target.value))}
                            sx={{ width: '140px' }}
                            disabled={isLoadingLines}
                        />
                        <IconButton sx={{ color: 'error.main', p: 0.5 }} onClick={() => removeLine('credits', i)} disabled={credits.length <= 1 || isLoadingLines}>
                            <RemoveCircleOutline />
                        </IconButton>
                    </Box>
                ))}
                <Button startIcon={<AddCircleOutline />} size="small" onClick={() => addLine('credits')} sx={{ color: '#b45309' }} disabled={isLoadingLines}>貸方を追加</Button>

                <TextField
                    fullWidth margin="dense" label="摘要 (内容)"
                    value={description} sx={{ mt: 3 }}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isLoadingLines}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">キャンセル</Button>
                <Button onClick={handleSave} variant="contained" disableElevation disabled={isLoadingLines}>保存</Button>
            </DialogActions>
        </Dialog>
    );
}
