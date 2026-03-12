import { useState } from 'react';
import { Box, Typography, Paper, IconButton, Button, TableContainer, Table, TableHead, TableRow, TableCell, TableBody } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Transaction } from '../db/db';
import TransactionEditorDialog from '../components/TransactionEditorDialog';
import { useFiscalYear } from '../contexts/FiscalYearContext';

export default function Ledger() {
    const { selectedYear } = useFiscalYear();
    const allTransactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray());
    const transactions = allTransactions?.filter(t => t.date.startsWith(String(selectedYear)) && !t.deletedAt);
    const accounts = useLiveQuery(() => db.accounts.toArray());

    const [editorOpen, setEditorOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

    if (!transactions || !accounts) return <Typography p={2}>Loading...</Typography>;

    const handleDelete = async (id?: string) => {
        if (id && window.confirm('本当に削除しますか？')) {
            await db.transactions.update(id, {
                deletedAt: Date.now(),
                updatedAt: Date.now()
            });
            // Auto sync check could go here if we want immediate deletion sync
        }
    };

    return (
        <Box p={{ xs: 1, sm: 2 }} pt={2}>
            <Box px={1} mb={2} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>仕訳帳</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    size="small"
                    disableElevation
                    onClick={() => { setEditingTransaction(null); setEditorOpen(true); }}
                >
                    手動で追加
                </Button>
            </Box>

            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <Table sx={{ minWidth: 800 }} size="small" aria-label="ledger table">
                    <TableHead sx={{ bgcolor: 'background.default' }}>
                        <TableRow>
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
                        {transactions.map((t) => {
                            const debitsArray = t.debits || [];
                            const creditsArray = t.credits || [];
                            const debAmount = debitsArray.reduce((sum, d) => sum + d.amount, 0);
                            const creAmount = creditsArray.reduce((sum, c) => sum + c.amount, 0);
                            const debNames = debitsArray.map(d => accounts.find(a => a.code === d.code)?.name || '不明').join(',');
                            const creNames = creditsArray.map(c => accounts.find(a => a.code === c.code)?.name || '不明').join(',');

                            return (
                                <TableRow key={t.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                    <TableCell sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' }, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                        {t.date.substring(5)} {/* MM-DD for mobile */}
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
                                        {t.description || ''}
                                    </TableCell>
                                    <TableCell align="center" sx={{ whiteSpace: 'nowrap', verticalAlign: 'top', py: 0.5 }}>
                                        <IconButton size="small" aria-label="edit" onClick={() => { setEditingTransaction(t); setEditorOpen(true); }} sx={{ color: 'primary.main', opacity: 0.8, p: { xs: 0.5, sm: 1 } }}>
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" aria-label="delete" onClick={() => handleDelete(t.id)} sx={{ color: 'error.main', opacity: 0.8, p: { xs: 0.5, sm: 1 } }}>
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {transactions.length === 0 && (
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
                transactionToEdit={editingTransaction}
            />
        </Box>
    );
}
