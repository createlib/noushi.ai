import { Box, Typography, Card, CardContent, LinearProgress } from '@mui/material';
import FlagCircleIcon from '@mui/icons-material/FlagCircle';
import type { JournalLine, Account } from '../../db/db';

interface BreakEvenPointProps {
    income: number;
    expense: number;
    yearLines: JournalLine[];
    accounts: Account[];
}

// 簡易的な変動費の推測（一般的な商業・サービス業向け）
// 仕入、外注、販売手数料などを変動費とみなす
const VARIABLE_COST_KEYWORDS = ['仕入', '外注', '手数料', '荷造', '運賃', '外注工賃'];

export default function BreakEvenPoint({ income, expense, yearLines, accounts }: BreakEvenPointProps) {
    let variableCost = 0;

    yearLines.forEach(line => {
        const acc = accounts.find(a => String(a.code || a.id) === String(line.account_id));
        if (!acc || acc.type !== 'expense' || line.debit <= 0) return;

        // 変動費キーワードが含まれる勘定科目を変動費とする
        const isVariable = VARIABLE_COST_KEYWORDS.some(kw => acc.name.includes(kw));
        if (isVariable) {
            variableCost += line.debit;
        }
    });

    const fixedCost = Math.max(0, expense - variableCost);
    const variableCostRatio = income > 0 ? variableCost / income : 0;

    // 損益分岐点売上高 = 固定費 / (1 - 変動費率)
    let breakEvenSales = 0;
    if (variableCostRatio < 1 && variableCostRatio >= 0) {
        breakEvenSales = fixedCost / (1 - variableCostRatio);
    }

    const isProfitable = income >= breakEvenSales;
    const safetyMargin = income > 0 ? ((income - breakEvenSales) / income) * 100 : 0;

    const progressToBEP = breakEvenSales > 0 ? Math.min((income / breakEvenSales) * 100, 100) : 0;
    const remainingToBEP = Math.max(0, breakEvenSales - income);

    return (
        <Card elevation={0} sx={{ border: '1px solid #e2e8f0', bgcolor: '#f8fafc', borderRadius: 2, height: '100%' }}>
            <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <FlagCircleIcon color={isProfitable ? "success" : "warning"} />
                    <Typography variant="subtitle1" fontWeight="bold">損益分岐点 (BEP) 分析</Typography>
                </Box>

                <Box bgcolor="#fff" p={2} borderRadius={2} border="1px solid #e2e8f0" mb={3}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2" color="text.secondary">固定費 (家賃・光熱費等)</Typography>
                        <Typography variant="body2" fontWeight="bold">¥{fixedCost.toLocaleString()}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2" color="text.secondary">変動費 (仕入・外注等)</Typography>
                        <Typography variant="body2" fontWeight="bold">¥{variableCost.toLocaleString()}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" borderTop="1px dashed #cbd5e1" pt={1} mt={1}>
                        <Typography variant="body2" fontWeight="bold">黒字化ライン (損益分岐点)</Typography>
                        <Typography variant="body2" fontWeight="bold" color="primary.dark">¥{Math.round(breakEvenSales).toLocaleString()}</Typography>
                    </Box>
                </Box>

                <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="baseline" mb={0.5}>
                        <Typography variant="caption" fontWeight="bold" color="text.secondary">黒字化までの進捗</Typography>
                        <Typography variant="caption" fontWeight="bold">{progressToBEP.toFixed(1)}%</Typography>
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={progressToBEP}
                        color={isProfitable ? "success" : "primary"}
                        sx={{ height: 10, borderRadius: 5, bgcolor: '#e2e8f0' }}
                    />
                </Box>

                {isProfitable ? (
                    <Box mt={2}>
                        <Typography variant="h6" fontWeight="900" color="success.main">
                            黒字達成済み！
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                            現在の安全余裕率は <strong>{safetyMargin.toFixed(1)}%</strong> です。<br />
                            （売上がこれだけ下がっても赤字にならない余裕の度合い）
                        </Typography>
                    </Box>
                ) : (
                    <Box mt={2}>
                        <Typography variant="caption" color="text.secondary" display="block">
                            損益分岐点クリアまであと...
                        </Typography>
                        <Typography variant="h5" fontWeight="900" color="error.main">
                            ¥{Math.round(remainingToBEP).toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                            上記金額を売り上げると、今期の累計損益が±0になります。
                        </Typography>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
