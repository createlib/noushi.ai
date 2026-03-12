import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Box, Typography, MenuItem, IconButton, Alert } from '@mui/material';
import { AddCircleOutline, RemoveCircleOutline } from '@mui/icons-material';
import { useLiveQuery } from 'dexie-react-hooks';
import dayjs from 'dayjs';
import { db, type Transaction, type TransactionLine } from '../db/db';

interface Props {
    open: boolean;
    onClose: () => void;
    transactionToEdit?: Transaction | null;
}

export default function TransactionEditorDialog({ open, onClose, transactionToEdit }: Props) {
    const accounts = useLiveQuery(() => db.accounts.toArray()) || [];
    const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
    const [debits, setDebits] = useState<TransactionLine[]>([{ code: 100, amount: 0 }]);
    const [credits, setCredits] = useState<TransactionLine[]>([{ code: 100, amount: 0 }]);
    const [description, setDescription] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (open) {
            setErrorMsg('');
            if (transactionToEdit) {
                setDate(transactionToEdit.date);
                setDebits([...transactionToEdit.debits]);
                setCredits([...transactionToEdit.credits]);
                setDescription(transactionToEdit.description || '');
            } else {
                setDate(dayjs().format('YYYY-MM-DD'));
                setDebits([{ code: 100, amount: 0 }]);
                setCredits([{ code: 400, amount: 0 }]);
                setDescription('');
            }
        }
    }, [open, transactionToEdit]);

    const handleSave = async () => {
        const totalDebits = debits.reduce((sum, d) => sum + d.amount, 0);
        const totalCredits = credits.reduce((sum, c) => sum + c.amount, 0);

        if (totalDebits !== totalCredits) {
            setErrorMsg(`借方合計(¥${totalDebits})と貸方合計(¥${totalCredits})が一致しません。`);
            return;
        }

        try {
            if (transactionToEdit && transactionToEdit.id) {
                await db.transactions.update(transactionToEdit.id, {
                    date, debits, credits, description
                });
            } else {
                await db.transactions.add({
                    id: crypto.randomUUID(),
                    date, debits, credits, description,
                    createdAt: Date.now()
                });
            }
            onClose();
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
            <DialogTitle>{transactionToEdit ? '仕訳の編集' : '手動で仕訳を追加'}</DialogTitle>
            <DialogContent dividers>
                {errorMsg && <Alert severity="error" sx={{ mb: 2 }}>{errorMsg}</Alert>}
                <TextField
                    fullWidth margin="dense" label="日付" type="date"
                    InputLabelProps={{ shrink: true }}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    sx={{ mb: 3 }}
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
                        >
                            {accounts.map(a => <MenuItem key={a.code} value={a.code}>{a.code}: {a.name}</MenuItem>)}
                        </TextField>
                        <TextField
                            size="small" type="number" label="金額" value={d.amount || ''}
                            onChange={(e) => updateLine('debits', i, 'amount', Number(e.target.value))}
                            sx={{ width: '140px' }}
                        />
                        <IconButton sx={{ color: 'error.main', p: 0.5 }} onClick={() => removeLine('debits', i)} disabled={debits.length <= 1}>
                            <RemoveCircleOutline />
                        </IconButton>
                    </Box>
                ))}
                <Button startIcon={<AddCircleOutline />} size="small" onClick={() => addLine('debits')} sx={{ color: '#059669', mb: 2 }}>借方を追加</Button>

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
                        >
                            {accounts.map(a => <MenuItem key={a.code} value={a.code}>{a.code}: {a.name}</MenuItem>)}
                        </TextField>
                        <TextField
                            size="small" type="number" label="金額" value={c.amount || ''}
                            onChange={(e) => updateLine('credits', i, 'amount', Number(e.target.value))}
                            sx={{ width: '140px' }}
                        />
                        <IconButton sx={{ color: 'error.main', p: 0.5 }} onClick={() => removeLine('credits', i)} disabled={credits.length <= 1}>
                            <RemoveCircleOutline />
                        </IconButton>
                    </Box>
                ))}
                <Button startIcon={<AddCircleOutline />} size="small" onClick={() => addLine('credits')} sx={{ color: '#b45309' }}>貸方を追加</Button>

                <TextField
                    fullWidth margin="dense" label="摘要 (内容)"
                    value={description} sx={{ mt: 3 }}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">キャンセル</Button>
                <Button onClick={handleSave} variant="contained" disableElevation>保存</Button>
            </DialogActions>
        </Dialog>
    );
}
