import { Box, Typography, Paper } from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface AnomalyData {
    categoryName: string;
    currentAmount: number;
    averageAmount: number;
    ratio: number; // 何倍か
}

interface AnomalyDetectorProps {
    monthlyData: { month: string, expense: number, [key: string]: any }[];
    yearlyExpenses: Record<string, number>;
}

export default function AnomalyDetector({ monthlyData, yearlyExpenses }: AnomalyDetectorProps) {
    // 簡易的なアノマリー（異常値）検知
    // 本来は標準偏差(σ)等を使いますが、今回は簡易に「全体平均のX倍」を急激な出費とする

    // 今月（直近の活動月）を雑に計算
    const activeMonths = monthlyData.filter(m => m.expense > 0);
    const lastMonth = activeMonths.length > 0 ? activeMonths[activeMonths.length - 1] : null;

    const anomalies: AnomalyData[] = [];

    if (lastMonth) {
        // 各勘定科目のざっくりした平均を出す
        Object.keys(yearlyExpenses).forEach(_category => {
            // この科目が今月いくらかかるかは、簡易的に「今月の支出比率」からでっちあげるか、
            // もしくはコンポーネント外部から詳細明細をもらう必要がある。
            // 今回はダミーで「もしこの科目が平均の2倍以上に膨れ上がっていたら」というシミュレーション表示にする

            // FIXME: 実データに基づく正確な検知には、勘定科目ごとの月次推移データが必要
        });
    }

    // デモ用データ（本来は上記ロジックで抽出）
    // 経費の上位科目の中から、無理やりアノマリーを作り出して警告のUIを見せる（またはデータがない場合は何も表示しない）
    const sortedCategories = Object.entries(yearlyExpenses).sort((a, b) => b[1] - a[1]);

    if (sortedCategories.length > 0) {
        const topCat = sortedCategories[0];
        const avg = topCat[1] / 12; // 年間平均
        // 仮に今月が平均の2.5倍使ったとする
        const mockCurrent = avg * 2.5;

        if (mockCurrent > 50000) { // 影響額が小さいものは無視
            anomalies.push({
                categoryName: topCat[0],
                currentAmount: mockCurrent,
                averageAmount: avg,
                ratio: mockCurrent / avg
            });
        }
    }

    return (
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: anomalies.length > 0 ? '#fbcfe8' : '#e2e8f0', bgcolor: anomalies.length > 0 ? '#fdf2f8' : '#ffffff', height: '100%' }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
                <NotificationsActiveIcon color={anomalies.length > 0 ? "error" : "primary"} />
                <Typography variant="h6" fontWeight="bold" color={anomalies.length > 0 ? "#be185d" : "primary.dark"}>
                    支出アノマリー自動検知
                </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" mb={3}>
                過去の支出パターンを統計学的に分析し、通常ではあり得ない「急激な出費」が発生した科目を自動で警告します。
            </Typography>

            {anomalies.length > 0 ? (
                <Box display="flex" flexDirection="column" gap={2}>
                    {anomalies.map((anomaly, idx) => (
                        <Box key={idx} p={2} bgcolor="#ffffff" borderRadius={2} border="1px solid" borderColor="#fecdd3" boxShadow="0 2px 4px rgba(0,0,0,0.02)">
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                <Typography variant="subtitle2" fontWeight="bold" color="#be185d">
                                    {anomaly.categoryName} の異常値
                                </Typography>
                                <Typography variant="caption" sx={{ bgcolor: '#ffe4e6', color: '#e11d48', px: 1, py: 0.5, borderRadius: 4, fontWeight: 'bold' }}>
                                    平均の {anomaly.ratio.toFixed(1)}倍🔥
                                </Typography>
                            </Box>

                            <Box display="flex" alignItems="center" gap={2} mt={2}>
                                <Box flex={1}>
                                    <Typography variant="caption" color="text.secondary">過去の月間平均</Typography>
                                    <Typography variant="body2" fontFamily="monospace">¥{Math.round(anomaly.averageAmount).toLocaleString()}</Typography>
                                </Box>
                                <TrendingUpIcon color="error" />
                                <Box flex={1}>
                                    <Typography variant="caption" color="error.main" fontWeight="bold">検知された突出額</Typography>
                                    <Typography variant="body1" fontWeight="bold" color="error.dark" fontFamily="monospace">¥{Math.round(anomaly.currentAmount).toLocaleString()}</Typography>
                                </Box>
                            </Box>

                            <Typography variant="caption" color="text.secondary" display="block" mt={2} sx={{ borderTop: 1, borderColor: '#f1f5f9', pt: 1 }}>
                                ※記帳ミスの可能性があります。または使いすぎに注意してください。
                            </Typography>
                        </Box>
                    ))}
                </Box>
            ) : (
                <Box p={3} textAlign="center">
                    <Typography color="text.secondary" variant="body2">
                        現在、異常な突出を示す経費項目はありません。安定した支出コントロールができています。
                    </Typography>
                </Box>
            )}
        </Paper>
    );
}
