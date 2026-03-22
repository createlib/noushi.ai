import { useMemo } from 'react';
import { Box, Typography, Tooltip, IconButton } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import HomeIcon from '@mui/icons-material/Home';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

interface HouseholdSummaryProps {
    privateLines: any[];
    accounts: any[];
}

export default function HouseholdSummary({ privateLines, accounts }: HouseholdSummaryProps) {
    const { totalExpense, fixedExpense, pocketMoneyExpense, foodExpense } = useMemo(() => {
        let total = 0;
        let fixed = 0;
        let pocketMoney = 0;
        let food = 0;

        const fixedAccountNames = ['家賃', '電気代', 'ガス代', '水道代', '通信費', '保険料', '車費', '教育・自己投資', 'サブスク'];
        const pocketMoneyAccountNames = ['交際費', '娯楽費', '被服費', '美容費', '特別支出'];
        
        privateLines.forEach(line => {
            const acc = accounts.find(a => String(a.code || a.id) === String(line.account_id));
            if (!acc || acc.type !== 'expense' || line.debit <= 0) return;

            total += line.debit;
            
            if (acc.name === '食費') {
                food += line.debit;
            }

            if (fixedAccountNames.includes(acc.name)) {
                fixed += line.debit;
            }
            
            if (pocketMoneyAccountNames.includes(acc.name)) {
                pocketMoney += line.debit;
            }
        });

        return { totalExpense: total, fixedExpense: fixed, pocketMoneyExpense: pocketMoney, foodExpense: food };
    }, [privateLines, accounts]);

    if (totalExpense === 0) {
        return (
            <Box p={3} borderRadius={2} bgcolor="#f8fafc" border="1px solid #e2e8f0" height="100%">
                <Typography color="text.secondary">家計簿データがありません。</Typography>
            </Box>
        );
    }

    const engelCoefficient = (foodExpense / totalExpense) * 100;
    const fixedRatio = (fixedExpense / totalExpense) * 100;

    return (
        <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: 'repeat(3, 1fr)' }} gap={3} sx={{ height: '100%' }}>
            {/* エンゲル係数 */}
            <Box p={3} borderRadius={2} bgcolor="#f0f9ff" border="1px solid #bae6fd" height="100%">
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <RestaurantIcon sx={{ color: '#0284c7', fontSize: 20 }} />
                        <Typography variant="caption" color="#0369a1" fontWeight="bold">エンゲル係数</Typography>
                    </Box>
                    <Tooltip title="全体の消費支出に占める食費の割合。25%未満が理想的、30%を超えると食費過多の傾向があります。">
                        <IconButton size="small" sx={{ p: 0, color: '#38bdf8' }}><InfoOutlinedIcon fontSize="small" /></IconButton>
                    </Tooltip>
                </Box>
                <Typography variant="h4" fontWeight="800" color={engelCoefficient > 30 ? '#be123c' : engelCoefficient > 25 ? '#b45309' : '#15803d'} mt={1}>
                    {engelCoefficient.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={2} fontSize="0.75rem">
                    {engelCoefficient > 30 ? "食費の割合が高めです。外食などを少し見直すと家計がラクになります。" :
                     engelCoefficient > 20 ? "標準的なバランスです。健康と節約の両立ができています。" :
                     "食費がとても低く抑えられています。無理しすぎないようご注意ください！"}
                </Typography>
            </Box>

            {/* 固定費率 */}
            <Box p={3} borderRadius={2} bgcolor="#fffbeb" border="1px solid #fde68a" height="100%">
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <HomeIcon sx={{ color: '#b45309', fontSize: 20 }} />
                        <Typography variant="caption" color="#b45309" fontWeight="bold">固定費の圧迫度</Typography>
                    </Box>
                    <Tooltip title="家賃、水道光熱費、通信費などの固定費が全体に占める割合。40%〜50%以内が貯蓄しやすい黄金比です。">
                        <IconButton size="small" sx={{ p: 0, color: '#fbbf24' }}><InfoOutlinedIcon fontSize="small" /></IconButton>
                    </Tooltip>
                </Box>
                <Typography variant="h4" fontWeight="800" color={fixedRatio > 55 ? '#be123c' : '#15803d'} mt={1}>
                    {fixedRatio.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={2} fontSize="0.75rem">
                    {fixedRatio > 55 ? "固定費が家計を圧迫しています。スマホのプランやサブスク、保険の見直しで劇的に改善します。" :
                     "固定費のコントロールが完璧です！非常に資産形成しやすい筋肉質な家計です。"}
                </Typography>
            </Box>

            {/* ゆとり費コントロール */}
            <Box p={3} borderRadius={2} bgcolor="#fdf4ff" border="1px solid #fbcfe8" height="100%">
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <AccountBalanceWalletIcon sx={{ color: '#be185d', fontSize: 20 }} />
                        <Typography variant="caption" color="#be185d" fontWeight="bold">ゆとり費（お小遣い・娯楽）</Typography>
                    </Box>
                </Box>
                <Typography variant="h4" fontWeight="800" color="#9d174d" mt={1}>
                    ¥{pocketMoneyExpense.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={2} fontSize="0.75rem">
                    交際費や娯楽費など、生活に必須ではない「ゆとり費」の累計です。
                    全体の {((pocketMoneyExpense / totalExpense) * 100).toFixed(1)}% を占めています。
                </Typography>
            </Box>
        </Box>
    );
}
