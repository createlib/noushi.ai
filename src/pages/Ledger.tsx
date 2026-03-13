import { useState } from 'react';
import { Box, Typography, Paper, IconButton, Button, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Checkbox } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Journal } from '../db/db';
import TransactionEditorDialog from '../components/TransactionEditorDialog';
import { useFiscalYear } from '../contexts/FiscalYearContext';

export default function Ledger() {
    const { selectedYear } = useFiscalYear();

    const allJournals = useLiveQuery(() => db.journals.orderBy('date').reverse().toArray());
    const allLines = useLiveQuery(() => db.journal_lines.toArray());
    const accounts = useLiveQuery(() => db.accounts.toArray());

    const journals = allJournals?.filter(j => j.date && j.date.startsWith(String(selectedYear)) && !j.deletedAt);

    const [editorOpen, setEditorOpen] = useState(false);
    const [editingJournal, setEditingJournal] = useState<Journal | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    if (!journals || !allLines || !accounts) return <Typography p={2}>Loading...</Typography>;

    const handleHardDelete = async (ids: string[]) => {
        if (!ids.length) return;
        const msg = ids.length === 1 ? '本当に削除しますか？' : `${ids.length}件の仕訳をまとめて削除しますか？`;
        if (window.confirm(msg)) {
            // Hard Delete
            await db.transaction('rw', [db.journals, db.journal_lines], async () => {
                await db.journals.bulkDelete(ids);
                const linesToDelete = await db.journal_lines.where('journal_id').anyOf(ids).primaryKeys();
                await db.journal_lines.bulkDelete(linesToDelete);
            });

            setSelectedIds(new Set());

            // 背景で同期を実行
            setTimeout(async () => {
                try {
                    const currentSettings = await db.settings.get(1);
                    if (currentSettings?.useFirebaseSync) {
                        const { auth } = await import('../firebase');
                        if (auth.currentUser) {
                            try {
                                const { forceUploadSync } = await import('../services/sync_service');
                                await forceUploadSync(auth.currentUser.uid);
                            } catch (e) {
                                console.error('Delete background sync failed', e);
                            }
                        }
                    }
                } catch (e) {
                    console.error('Background processing failed', e);
                }
            }, 100);
        }
    };

    return (
        <Box p={{ xs: 1, sm: 2 }} pt={2}>
            <Box px={1} mb={2} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>仕訳帳</Typography>
                <Box display="flex" gap={1}>
                    {selectedIds.size > 0 && (
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteSweepIcon />}
                            size="small"
                            onClick={() => handleHardDelete(Array.from(selectedIds))}
                        >
                            {selectedIds.size}件削除
                        </Button>
                    )}
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        size="small"
                        disableElevation
                        onClick={() => { setEditingJournal(null); setEditorOpen(true); }}
                    >
                        手動で追加
                    </Button>
                </Box>
            </Box>

            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <Table sx={{ minWidth: 800 }} size="small" aria-label="ledger table">
                    <TableHead sx={{ bgcolor: 'background.default' }}>
                        <TableRow>
                            <TableCell padding="checkbox">
                                <Checkbox
                                    color="primary"
                                    indeterminate={selectedIds.size > 0 && selectedIds.size < journals.length}
                                    checked={journals.length > 0 && selectedIds.size === journals.length}
                                    onChange={(e) => {
                                        if (e.target.checked) setSelectedIds(new Set(journals.map(j => j.id)));
                                        else setSelectedIds(new Set());
                                    }}
                                />
                            </TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary', whiteSpace: 'nowrap', width: '90px' }}>日付</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary', whiteSpace: 'nowrap', width: '130px' }}>借方</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'text.secondary', whiteSpace: 'nowrap', width: '100px' }}>金額</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary', whiteSpace: 'nowrap', width: '130px' }}>貸方</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 'bold', color: 'text.secondary', whiteSpace: 'nowrap', width: '100px' }}>金額</TableCell>
                            <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary', whiteSpace: 'nowrap', minWidth: '150px' }}>摘要</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold', color: 'text.secondary', whiteSpace: 'nowrap', width: '90px' }}>操作</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {journals.map((j) => {
                            const jLines = allLines.filter(l => l.journal_id === j.id);

                            const debitsArray = jLines.filter(l => l.debit > 0);
                            const creditsArray = jLines.filter(l => l.credit > 0);

                            const debAmount = debitsArray.reduce((sum, d) => sum + d.debit, 0);
                            const creAmount = creditsArray.reduce((sum, c) => sum + c.credit, 0);

                            const debNames = debitsArray.map(d => accounts.find(a => String(a.code || a.id) === String(d.account_id))?.name || '不明').join(',');
                            const creNames = creditsArray.map(c => accounts.find(a => String(a.code || a.id) === String(c.account_id))?.name || '不明').join(',');

                            return (
                                <TableRow key={j.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            color="primary"
                                            checked={selectedIds.has(j.id)}
                                            onChange={(e) => {
                                                const newSet = new Set(selectedIds);
                                                if (e.target.checked) newSet.add(j.id);
                                                else newSet.delete(j.id);
                                                setSelectedIds(newSet);
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' }, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                        {j.date.substring(5)} {/* MM-DD for mobile */}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' }, color: 'primary.dark', fontWeight: 600, maxWidth: '130px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top' }}>
                                        {debNames}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' }, fontWeight: 'bold', fontFamily: 'monospace', verticalAlign: 'top' }}>
                                        {debAmount.toLocaleString()}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' }, color: 'secondary.dark', fontWeight: 600, maxWidth: '130px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top' }}>
                                        {creNames}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' }, fontWeight: 'bold', fontFamily: 'monospace', verticalAlign: 'top' }}>
                                        {creAmount.toLocaleString()}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' }, color: 'text.secondary', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'top' }}>
                                        {j.description || ''}
                                    </TableCell>
                                    <TableCell align="center" sx={{ whiteSpace: 'nowrap', verticalAlign: 'top', py: 0.5 }}>
                                        <IconButton size="small" aria-label="edit" onClick={() => { setEditingJournal(j); setEditorOpen(true); }} sx={{ color: 'primary.main', opacity: 0.8, p: { xs: 0.5, sm: 1 } }}>
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" aria-label="delete" onClick={() => handleHardDelete([j.id])} sx={{ color: 'error.main', opacity: 0.8, p: { xs: 0.5, sm: 1 } }}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {journals.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    仕訳データがありません
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <TransactionEditorDialog
                open={editorOpen}
                onClose={() => setEditorOpen(false)}
                journalToEdit={editingJournal}
            />
        </Box>
    );
}
