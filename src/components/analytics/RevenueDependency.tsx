import { Box, Typography, Card, CardContent } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import StorefrontIcon from '@mui/icons-material/Storefront';
import type { Journal, JournalLine, Account } from '../../db/db';

const COLORS = ['#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#84cc16'];

interface RevenueDependencyProps {
    yearLines: JournalLine[];
    journals: Journal[];
    accounts: Account[];
}

export default function RevenueDependency({ yearLines, journals, accounts }: RevenueDependencyProps) {
    const revenueByClient: Record<string, number> = {};
    let totalRevenue = 0;

    yearLines.forEach(line => {
        const acc = accounts.find(a => String(a.code || a.id) === String(line.account_id));
        if (!acc || acc.type !== 'revenue' || line.credit <= 0) return;

        const j = journals.find(j => j.id === line.journal_id);
        if (!j) return;

        const clientName = j.description ? j.description.trim() : '摘要なし (不明)';
        revenueByClient[clientName] = (revenueByClient[clientName] || 0) + line.credit;
        totalRevenue += line.credit;
    });

    // Sort descending and keep top 5, bucket the rest into "Others"
    const sortedClients = Object.entries(revenueByClient).sort((a, b) => b[1] - a[1]);
    const topClients = sortedClients.slice(0, 5);
    const others = sortedClients.slice(5).reduce((sum, [, val]) => sum + val, 0);

    const chartData = topClients.map(([name, value]) => ({ name, value }));
    if (others > 0) {
        chartData.push({ name: 'その他取引先', value: others });
    }

    const maxDependency = topClients.length > 0 ? (topClients[0][1] / totalRevenue) * 100 : 0;
    const maxClientName = topClients.length > 0 ? topClients[0][0] : '-';

    return (
        <Card elevation={0} sx={{ border: '1px solid #e2e8f0', bgcolor: '#f8fafc', borderRadius: 2, height: '100%' }}>
            <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <StorefrontIcon color="info" />
                    <Typography variant="subtitle1" fontWeight="bold">取引先（摘要）別の売上依存率</Typography>
                </Box>

                {chartData.length === 0 ? (
                    <Box display="flex" justifyContent="center" alignItems="center" height={200}>
                        <Typography variant="body2" color="text.secondary">売上データがありません</Typography>
                    </Box>
                ) : (
                    <>
                        <Box height={220} width="100%">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={chartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={80}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {chartData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        formatter={(value: any) => `¥${Number(value).toLocaleString()}`}
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </Box>

                        <Box mt={3} p={2} bgcolor="#fff" borderRadius={2} border="1px solid #e2e8f0">
                            <Typography variant="caption" color="text.secondary" fontWeight="bold">最大依存リスク先: {maxClientName}</Typography>
                            <Box display="flex" alignItems="baseline" gap={1} mt={0.5}>
                                <Typography variant="h5" fontWeight="900" color={maxDependency > 70 ? 'error.main' : maxDependency > 40 ? 'warning.main' : 'success.main'}>
                                    {maxDependency.toFixed(1)}%
                                </Typography>
                                <Typography variant="caption" color="text.secondary">の売上を依存しています</Typography>
                            </Box>
                            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                                {maxDependency > 70
                                    ? "1社への依存度が極めて高く、取引停止時の事業リスクが深刻です。早急な新規開拓を推奨します。"
                                    : maxDependency > 40
                                        ? "特定顧客への依存が見られます。少しずつ取引先を分散させるのが理想です。"
                                        : "売上が適度に分散されており、安全性の高いポートフォリオです。"}
                            </Typography>
                        </Box>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
