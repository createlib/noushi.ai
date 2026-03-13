import { Box, Typography, Card, CardContent, Paper, Tooltip, IconButton, CircularProgress } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SyncIcon from '@mui/icons-material/Sync';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import dayjs from 'dayjs';
import { useFiscalYear } from '../contexts/FiscalYearContext';
import { useState } from 'react';
import { forceUploadSync, performSync } from '../services/sync_service';
import { auth } from '../firebase';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

export default function Home() {
    const { selectedYear } = useFiscalYear();

    const journals = useLiveQuery(() => db.journals.toArray(), []);
    const journalLines = useLiveQuery(() => db.journal_lines.toArray(), []);
    const accounts = useLiveQuery(() => db.accounts.toArray(), []);
    const settings = useLiveQuery(() => db.settings.get(1), []);

    const [isSyncing, setIsSyncing] = useState(false);
    const [isForceUploading, setIsForceUploading] = useState(false);

    if (!journals || !journalLines || !accounts) return <Typography p={2}>Loading...</Typography>;

    // Filter valid journals for the selected year
    const yearJournals = journals.filter(j => j.date && j.date.startsWith(String(selectedYear)) && !j.deletedAt);
    const yearJournalIds = new Set(yearJournals.map(j => j.id));

    // Get lines for those valid journals
    const yearLines = journalLines.filter(l => yearJournalIds.has(l.journal_id));

    let income = 0;
    let expense = 0;
    const yearlyExpenses: Record<string, number> = {};

    yearLines.forEach(line => {
        const acc = accounts.find(a => String(a.code || a.id) === String(line.account_id));
        if (!acc) return;

        if (acc.type === 'revenue' && line.credit > 0) {
            income += line.credit;
        }

        if (acc.type === 'expense' && line.debit > 0) {
            expense += line.debit;
            yearlyExpenses[acc.name] = (yearlyExpenses[acc.name] || 0) + line.debit;
        }
    });

    const expenseData = Object.entries(yearlyExpenses)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6); // Top 6 + Others if needed

    if (Object.keys(yearlyExpenses).length > 6) {
        const othersValue = Object.entries(yearlyExpenses)
            .sort((a, b) => b[1] - a[1])
            .slice(6)
            .reduce((sum, [, val]) => sum + val, 0);
        expenseData.push({ name: 'その他', value: othersValue });
    }

    const handleSync = async () => {
        if (!settings?.useFirebaseSync) return;
        const currentUser = auth.currentUser;
        if (!currentUser) return alert('同期するにはログインが必要です。');

        setIsSyncing(true);
        try {
            await performSync(currentUser.uid);
            alert('同期が完了しました。');
        } catch (err) {
            console.error('Sync error:', err);
            alert('同期に失敗しました。詳細: ' + (err as Error).message);
        } finally {
            setIsSyncing(false);
        }
    };

    const handleForceUpload = async () => {
        if (!settings?.useFirebaseSync) return;
        const currentUser = auth.currentUser;
        if (!currentUser) return alert('同期するにはログインが必要です。');

        if (!window.confirm('この端末のデータでクラウド上のデータを完全に上書きします。よろしいですか？')) return;

        setIsForceUploading(true);
        try {
            await forceUploadSync(currentUser.uid);
            alert('クラウドへの上書き保存が完了しました。');
        } catch (err) {
            console.error('Force Upload error:', err);
            alert('上書き保存に失敗しました。詳細: ' + (err as Error).message);
        } finally {
            setIsForceUploading(false);
        }
    };

    return (
        <Box p={{ xs: 1, sm: 2 }} pt={2}>
            <Box px={1} mb={3} display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box>
                    <Typography variant="h5" fontWeight="bold">ダッシュボード</Typography>
                    <Typography variant="body2" color="text.secondary">
                        {selectedYear}年度 の財務サマリーと分析
                    </Typography>
                </Box>
                {settings?.useFirebaseSync && (
                    <Box display="flex" gap={1}>

                        <Tooltip title="この端末のデータをクラウドへ上書きアップロード">
                            <IconButton onClick={handleForceUpload} disabled={isSyncing || isForceUploading} color="warning" sx={{ bgcolor: 'warning.50' }}>
                                {isForceUploading ? <CircularProgress size={24} /> : <CloudUploadIcon />}
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="クラウドと統合同期 (ダウンロード＆マージ)">
                            <IconButton onClick={handleSync} disabled={isSyncing || isForceUploading} color="primary" sx={{ bgcolor: 'primary.50' }}>
                                {isSyncing ? <CircularProgress size={24} /> : <SyncIcon />}
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
            </Box>

            <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: 'repeat(3, 1fr)' }} gap={2} sx={{ mb: 4, px: 1 }}>
                <Box>
                    <Card elevation={0} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 2, p: 0.5, boxShadow: '0 10px 15px -3px rgba(67, 56, 202, 0.3)' }}>
                        <CardContent sx={{ pb: '16px !important' }}>
                            <Box display="flex" alignItems="center" gap={1} mb={2}>
                                <TrendingUpIcon fontSize="small" sx={{ opacity: 0.9 }} />
                                <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 600 }}>年間収入</Typography>
                            </Box>
                            <Typography variant="h4" sx={{ fontWeight: '800', fontFamily: 'monospace', letterSpacing: -1, fontSize: { xs: '1.75rem', sm: '2.125rem' } }}>¥{income.toLocaleString()}</Typography>
                        </CardContent>
                    </Card>
                </Box>
                <Box>
                    <Card elevation={0} sx={{ bgcolor: '#fffbeb', color: '#b45309', borderRadius: 2, p: 0.5, border: '1px solid #fde68a' }}>
                        <CardContent sx={{ pb: '16px !important' }}>
                            <Box display="flex" alignItems="center" gap={1} mb={2}>
                                <TrendingDownIcon fontSize="small" sx={{ opacity: 0.9 }} />
                                <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 600 }}>年間支出</Typography>
                            </Box>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: -1 }}>¥{expense.toLocaleString()}</Typography>
                        </CardContent>
                    </Card>
                </Box>
                <Box>
                    <Card elevation={0} sx={{ bgcolor: '#f0fdf4', color: '#166534', borderRadius: 2, p: 0.5, border: '1px solid #bbf7d0' }}>
                        <CardContent sx={{ pb: '16px !important' }}>
                            <Box display="flex" alignItems="center" gap={1} mb={2}>
                                <AccountBalanceWalletIcon fontSize="small" sx={{ opacity: 0.9 }} />
                                <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 600 }}>年間利益</Typography>
                            </Box>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: -1 }}>¥{(income - expense).toLocaleString()}</Typography>
                        </CardContent>
                    </Card>
                </Box>
            </Box>

            <Box px={1} mb={4}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>経費アナリティクス</Typography>
                <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 3, pt: 4, pb: 2 }}>
                    {expenseData.length > 0 ? (
                        <Box height={260} width="100%">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={expenseData}
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {expenseData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        formatter={(value: any) => `¥${Number(value).toLocaleString()}`}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </Box>
                    ) : (
                        <Box display="flex" justifyContent="center" alignItems="center" height={200}>
                            <Typography color="text.secondary">経費データがありません</Typography>
                        </Box>
                    )}
                </Paper>
            </Box>

            <Box px={1} mb={2} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" sx={{ fontWeight: 'bold' }}>最近の仕訳</Typography>
                <Typography variant="body2" color="primary.main" fontWeight={600} sx={{ cursor: 'pointer' }}>すべて見る</Typography>
            </Box>
            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden', mx: 1 }}>
                {yearJournals.slice(-3).reverse().map((j, idx) => {
                    // Find lines for this journal
                    const lines = yearLines.filter(l => l.journal_id === j.id);
                    const debitsArray = lines.filter(l => l.debit > 0);
                    const creditsArray = lines.filter(l => l.credit > 0);

                    const totalAmount = debitsArray.reduce((sum, d) => sum + d.debit, 0);
                    const debNames = debitsArray.map(d => accounts.find(a => String(a.code || a.id) === String(d.account_id))?.name || '不明').join(',');
                    const creNames = creditsArray.map(c => accounts.find(a => String(a.code || a.id) === String(c.account_id))?.name || '不明').join(',');

                    return (
                        <Box key={j.id || idx} p={1.5} borderBottom={idx < yearJournals.slice(-3).length - 1 ? 1 : 0} borderColor="divider" display="flex" justifyContent="space-between" alignItems="center" sx={{ '&:hover': { bgcolor: '#f8fafc' }, flexWrap: { xs: 'wrap', sm: 'nowrap' }, gap: 1 }}>
                            <Box display="flex" alignItems="center" gap={{ xs: 1, sm: 2 }} flex={1} minWidth={0}>
                                <Typography variant="caption" color="text.secondary" fontWeight={500} flexShrink={0} sx={{ width: 45 }}>
                                    {dayjs(j.date).format('MM/DD')}
                                </Typography>
                                <Typography variant="body2" color="primary.dark" fontWeight={500} noWrap sx={{ maxWidth: '35%' }}>{debNames}</Typography>
                                <Typography variant="body2" color="text.secondary" flexShrink={0}>→</Typography>
                                <Typography variant="body2" sx={{ color: '#b45309', fontWeight: 500, maxWidth: '35%' }} noWrap>{creNames}</Typography>
                            </Box>
                            <Box flexShrink={0}>
                                <Typography variant="body2" fontWeight="bold">¥{totalAmount.toLocaleString()}</Typography>
                            </Box>
                        </Box>
                    );
                })}
                {yearJournals.length === 0 && (
                    <Box p={4} textAlign="center">
                        <Typography color="text.secondary">データがありません</Typography>
                    </Box>
                )}
            </Paper>
        </Box>
    );
}
