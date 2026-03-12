import { Box, Typography, Card, CardContent, Paper } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import dayjs from 'dayjs';
import { useFiscalYear } from '../contexts/FiscalYearContext';
import { useState } from 'react';
import SyncIcon from '@mui/icons-material/Sync';
import { IconButton, CircularProgress } from '@mui/material';
import { loadGisScript, authenticateWithDrive, performSync } from '../services/drive_service';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

export default function Home() {
    const { selectedYear } = useFiscalYear();

    const allTransactions = useLiveQuery(
        () => db.transactions.toArray()
    );

    const accounts = useLiveQuery(
        () => db.accounts.toArray()
    );

    const settings = useLiveQuery(() => db.settings.get(1));
    const [isSyncing, setIsSyncing] = useState(false);

    if (!allTransactions || !accounts) return <Typography p={2}>Loading...</Typography>;

    const yearTransactions = allTransactions.filter(t => t.date.startsWith(String(selectedYear)));

    let income = 0;
    let expense = 0;

    const yearlyExpenses: Record<string, number> = {};

    yearTransactions.forEach(t => {
        (t.credits || []).forEach(c => {
            const creditAccount = accounts.find(a => a.code === c.code);
            if (creditAccount?.report === 'PL' && creditAccount.type === 'credit') {
                income += c.amount;
            }
        });

        (t.debits || []).forEach(d => {
            const debitAccount = accounts.find(a => a.code === d.code);
            if (debitAccount?.report === 'PL' && debitAccount.type === 'debit') {
                expense += d.amount;
                // 集計 (経費のみ)
                if (debitAccount.code >= 700) {
                    const name = debitAccount.name;
                    yearlyExpenses[name] = (yearlyExpenses[name] || 0) + d.amount;
                }
            }
        });
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
        if (!settings?.useGoogleDriveSync || !settings?.googleClientId || !settings?.googleDriveFileId) return;
        setIsSyncing(true);
        try {
            await loadGisScript();
            const token = await authenticateWithDrive(settings.googleClientId);
            await performSync(token, settings.googleDriveFileId);
        } catch (err) {
            console.error('Sync error:', err);
            alert('同期に失敗しました。詳細: ' + (err as Error).message);
        } finally {
            setIsSyncing(false);
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
                {settings?.useGoogleDriveSync && (
                    <IconButton onClick={handleSync} disabled={isSyncing} color="primary" sx={{ bgcolor: 'primary.50' }}>
                        {isSyncing ? <CircularProgress size={24} /> : <SyncIcon />}
                    </IconButton>
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
                {yearTransactions.slice(-3).reverse().map((t, idx) => {
                    const debitsArray = t.debits || [];
                    const creditsArray = t.credits || [];
                    const totalAmount = debitsArray.reduce((sum, d) => sum + d.amount, 0);
                    const debNames = debitsArray.map(d => accounts.find(a => a.code === d.code)?.name || '不明').join(',');
                    const creNames = creditsArray.map(c => accounts.find(a => a.code === c.code)?.name || '不明').join(',');
                    return (
                        <Box key={t.id || idx} p={1.5} borderBottom={idx < yearTransactions.slice(-3).length - 1 ? 1 : 0} borderColor="divider" display="flex" justifyContent="space-between" alignItems="center" sx={{ '&:hover': { bgcolor: '#f8fafc' }, flexWrap: { xs: 'wrap', sm: 'nowrap' }, gap: 1 }}>
                            <Box display="flex" alignItems="center" gap={{ xs: 1, sm: 2 }} flex={1} minWidth={0}>
                                <Typography variant="caption" color="text.secondary" fontWeight={500} flexShrink={0} sx={{ width: 45 }}>
                                    {dayjs(t.date).format('MM/DD')}
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
                {yearTransactions.length === 0 && (
                    <Box p={4} textAlign="center">
                        <Typography color="text.secondary">データがありません</Typography>
                    </Box>
                )}
            </Paper>
        </Box>
    );
}
