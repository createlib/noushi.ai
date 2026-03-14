import { Box, Typography, Paper, Tooltip, Chip } from '@mui/material';
import FindInPageIcon from '@mui/icons-material/FindInPage';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

interface SubscriptionMatch {
    name: string;
    amount: number;
    count: number;
    annualCost: number;
}

interface SubscriptionScannerProps {
    transactions: any[]; // AppのjournalLinesやjournalsを結合したもの、あるいは簡易に表示するためのデータ
}

export default function SubscriptionScanner({ transactions }: SubscriptionScannerProps) {
    // 簡易的なサブスク抽出ロジック（実際はもっと高度なNLPや一致率計算が必要だが、今回は名前か摘要の完全一致・金額完全一致で判定）

    // 摘要(name) と 金額(debit) でグループ化
    const countMap: Record<string, { count: number, amount: number, name: string }> = {};

    transactions.forEach(t => {
        // 経費（debit > 0）のみを対象とする
        if (t.debit > 0 && t.name) {
            const key = `${t.name}_${t.debit}`;
            if (!countMap[key]) {
                countMap[key] = { count: 0, amount: t.debit, name: t.name };
            }
            countMap[key].count++;
        }
    });

    // 毎月発生している可能性が高い（出現回数が3回以上）ものを抽出
    const subscriptions: SubscriptionMatch[] = Object.values(countMap)
        .filter(m => m.count >= 3 && m.amount > 0)
        .map(m => ({
            ...m,
            annualCost: m.amount * 12 // 年間換算概算
        }))
        .sort((a, b) => b.annualCost - a.annualCost) // 年間コストが高い順
        .slice(0, 5); // 上位5件

    const totalWastedPotential = subscriptions.reduce((sum, s) => sum + s.annualCost, 0);

    return (
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: '#e2e8f0', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
                <FindInPageIcon color="primary" />
                <Typography variant="h6" fontWeight="bold" color="primary.dark">
                    隠れサブスク・無駄払いチェッカー
                </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" mb={3}>
                毎月似たような金額で引き落とされている「固定費」を自動抽出し、年間コストに換算します。使っていないツールはありませんか？
            </Typography>

            {subscriptions.length > 0 ? (
                <>
                    <Box display="flex" flexDirection="column" gap={1.5} flex={1}>
                        {subscriptions.map((sub, idx) => (
                            <Box key={idx} p={1.5} borderRadius={2} border="1px solid #f1f5f9" bgcolor="#f8fafc" display="flex" justifyContent="space-between" alignItems="center" sx={{ '&:hover': { bgcolor: '#f1f5f9' } }}>
                                <Box>
                                    <Typography variant="body2" fontWeight="bold" noWrap sx={{ maxWidth: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
                                        {sub.name.length > 15 ? sub.name.substring(0, 15) + '...' : sub.name}
                                        <Chip label={`${sub.count}回検知`} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">月額: ¥{sub.amount.toLocaleString()}</Typography>
                                </Box>
                                <Box textAlign="right">
                                    <Typography variant="caption" color="error.main" fontWeight="bold" display="block">年間試算</Typography>
                                    <Typography variant="body2" fontWeight="bold" color="error.dark" fontFamily="monospace">
                                        ¥{sub.annualCost.toLocaleString()}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>

                    <Box mt={3} p={1.5} bgcolor="#fef2f2" borderRadius={2} display="flex" justifyContent="space-between" alignItems="center">
                        <Box display="flex" alignItems="center" gap={1}>
                            <ErrorOutlineIcon color="error" fontSize="small" />
                            <Typography variant="body2" fontWeight="bold" color="error.dark">年間節約ポテンシャル</Typography>
                        </Box>
                        <Tooltip title="これらすべてを解約解約した場合の年間目安">
                            <Typography variant="h6" fontWeight="900" color="error.main" fontFamily="monospace">
                                ¥{totalWastedPotential.toLocaleString()}
                            </Typography>
                        </Tooltip>
                    </Box>
                </>
            ) : (
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" flex={1} bgcolor="#f8fafc" borderRadius={2} color="text.secondary" p={3}>
                    <CheckCircleOutlineIcon sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
                    <Typography variant="body2" fontWeight="bold">現在、隠れサブスクは見つかりません。</Typography>
                    <Typography variant="caption">クリーンな支出状況です。</Typography>
                </Box>
            )}
        </Paper>
    );
}
