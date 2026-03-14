import { Box, Typography, Card, CardContent, Paper, Tooltip, IconButton, CircularProgress, Tabs, Tab } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SyncIcon from '@mui/icons-material/Sync';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import dayjs from 'dayjs';
import { useFiscalYear } from '../contexts/FiscalYearContext';
import { useState, useEffect, Suspense } from 'react';
import { performSync } from '../services/sync_service';
import { auth } from '../firebase';

const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

export default function Home() {
    const { selectedYear } = useFiscalYear();

    const journals = useLiveQuery(() => db.journals.toArray(), []);
    const journalLines = useLiveQuery(() => db.journal_lines.toArray(), []);
    const accounts = useLiveQuery(() => db.accounts.toArray(), []);
    const settings = useLiveQuery(() => db.settings.get(1), []);

    const [isSyncing, setIsSyncing] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

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
        .slice(0, 6);

    if (Object.keys(yearlyExpenses).length > 6) {
        const othersValue = Object.entries(yearlyExpenses)
            .sort((a, b) => b[1] - a[1])
            .slice(6)
            .reduce((sum, [, val]) => sum + val, 0);
        expenseData.push({ name: 'その他', value: othersValue });
    }

    // Prepare Monthly Trend Data
    const monthlyDataMap: Record<string, { month: string, income: number, expense: number, profit: number }> = {};
    for (let i = 1; i <= 12; i++) {
        const mm = i.toString().padStart(2, '0');
        monthlyDataMap[mm] = { month: `${i}月`, income: 0, expense: 0, profit: 0 };
    }

    yearLines.forEach(line => {
        const j = journals.find(j => j.id === line.journal_id);
        const acc = accounts.find(a => String(a.code || a.id) === String(line.account_id));
        if (!j || !j.date || !acc) return;

        const monthKey = j.date.substring(5, 7);
        if (!monthlyDataMap[monthKey]) return;

        if (acc.type === 'revenue' && line.credit > 0) {
            monthlyDataMap[monthKey].income += line.credit;
        }

        if (acc.type === 'expense' && line.debit > 0) {
            monthlyDataMap[monthKey].expense += line.debit;
        }
    });

    const monthlyData = Object.values(monthlyDataMap).map(m => ({
        ...m,
        profit: m.income - m.expense
    }));

    // Calculate KPIs
    const profitMargin = income > 0 ? ((income - expense) / income) * 100 : 0;
    const activeMonths = monthlyData.filter(m => m.income > 0 || m.expense > 0).length || 1;
    const avgMonthlyProfit = (income - expense) / activeMonths;
    const highestExpense = expenseData.length > 0 ? expenseData[0] : null;
    const costDependency = (highestExpense && income > 0) ? (highestExpense.value / income) * 100 : 0;

    const [tabIndex, setTabIndex] = useState(0);

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
                        <Tooltip title="クラウドからデータをダウンロードして最新化">
                            <IconButton onClick={handleSync} disabled={isSyncing} color="primary" sx={{ bgcolor: 'primary.50' }}>
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
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>ビジネスアナリティクス</Typography>

                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} variant="scrollable" scrollButtons="auto">
                        <Tab label="経費内訳" />
                        <Tab label="月別収支トレンド" />
                        <Tab label="経営ヘルスチェック" />
                    </Tabs>
                </Box>

                <Suspense fallback={<Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>}>
                    <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: { xs: 1, sm: 3 }, pt: 3, pb: 2, minHeight: 320 }}>
                        {tabIndex === 0 && (
                            <>
                                {expenseData.length > 0 ? (
                                    <Box height={260} width="100%">
                                        {isMounted && (
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
                                        )}
                                    </Box>
                                ) : (
                                    <Box display="flex" justifyContent="center" alignItems="center" height={260}>
                                        <Typography color="text.secondary">経費データがありません</Typography>
                                    </Box>
                                )}
                            </>
                        )}

                        {tabIndex === 1 && (
                            <Box height={280} width="100%" mt={2}>
                                {isMounted && (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={monthlyData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                            <XAxis dataKey="month" style={{ fontSize: '0.75rem', fill: '#64748b' }} tickLine={false} axisLine={false} />
                                            <YAxis
                                                tickFormatter={(val) => `¥${val >= 10000 ? (val / 10000) + '万' : val}`}
                                                style={{ fontSize: '0.75rem', fill: '#64748b' }}
                                                tickLine={false}
                                                axisLine={false}
                                            />
                                            <RechartsTooltip
                                                formatter={(value: any) => `¥${Number(value).toLocaleString()}`}
                                                labelStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                                                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                                            <Bar dataKey="income" name="収入" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                            <Bar dataKey="expense" name="経費" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                            <Line type="monotone" dataKey="profit" name="利益" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                )}
                            </Box>
                        )}

                        {tabIndex === 2 && (
                            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={3} sx={{ p: 1 }}>
                                <Box flex={1}>
                                    <Box p={3} borderRadius={2} bgcolor="#f8fafc" border="1px solid #e2e8f0" height="100%">
                                        <Typography variant="caption" color="text.secondary" fontWeight="bold">売上高利益率 (Profit Margin)</Typography>
                                        <Typography variant="h4" fontWeight="800" color={profitMargin >= 20 ? '#166534' : profitMargin > 0 ? '#1e40af' : '#991b1b'} mt={1}>
                                            {profitMargin.toFixed(1)}%
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" mt={2} fontSize="0.75rem">
                                            {profitMargin >= 20 ? "非常に高収益で安定した体質です。この水準を維持しましょう。" :
                                                profitMargin > 10 ? "適正な利益水準です。手堅くビジネスが推移しています。" :
                                                    profitMargin > 0 ? "利益が出ていますが、少し余力が少ない状態です。経費の見直しを推奨します。" :
                                                        "現在、赤字状態です。早急に固定費などの見直しラインを確認してください。"}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Box flex={1}>
                                    <Box p={3} borderRadius={2} bgcolor="#f8fafc" border="1px solid #e2e8f0" height="100%">
                                        <Typography variant="caption" color="text.secondary" fontWeight="bold">月平均生成キャッシュフロー</Typography>
                                        <Typography variant="h4" fontWeight="800" color={avgMonthlyProfit > 0 ? '#166534' : '#991b1b'} mt={1}>
                                            ¥{Math.round(avgMonthlyProfit).toLocaleString()}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" mt={2} fontSize="0.75rem">
                                            活動月（{activeMonths}ヶ月ベース）でならした場合、毎月手元にこれだけの現金が新しく残る計算です。
                                        </Typography>
                                    </Box>
                                </Box>
                                <Box flex={1}>
                                    <Box p={3} borderRadius={2} bgcolor="#f8fafc" border="1px solid #e2e8f0" height="100%">
                                        <Typography variant="caption" color="text.secondary" fontWeight="bold">最大コスト過多リスク</Typography>
                                        <Typography variant="h4" fontWeight="800" color={costDependency > 50 ? '#991b1b' : costDependency > 30 ? '#b45309' : '#166534'} mt={1}>
                                            {costDependency.toFixed(1)}%
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" mt={2} fontSize="0.75rem">
                                            最大の経費「{highestExpense?.name || '-'}」が売上の何割を占めているかの指標です。
                                            {costDependency > 50 ? " 特定の経費に総収入の半分以上を持っていかれており、ハイリスク体質です。" :
                                                " 特定の経費に対する過度な依存はなく、分散が効いています。"}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        )}
                    </Paper>
                </Suspense>
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
