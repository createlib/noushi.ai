import { Box, Typography, Paper, LinearProgress } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

interface RunwayForecastProps {
    currentCash: number;
    monthlyBurnRate: number;
    upcomingTax: number;
}

export default function RunwayForecast({ currentCash, monthlyBurnRate, upcomingTax }: RunwayForecastProps) {
    // 税金支払い後の残キャッシュ
    const cashAfterTax = currentCash - upcomingTax;
    const runwayAfterTax = monthlyBurnRate > 0 ? Math.max(0, cashAfterTax) / monthlyBurnRate : 999;

    const isDanger = runwayAfterTax < 3; // 3ヶ月未満は危険水域
    const isWarning = runwayAfterTax >= 3 && runwayAfterTax < 6; // 6ヶ月未満は注意水域

    // プログレスバー（最大12ヶ月）
    const progressValue = Math.min(100, (runwayAfterTax / 12) * 100);

    return (
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: isDanger ? '#fca5a5' : isWarning ? '#fcd34d' : '#86efac', bgcolor: isDanger ? '#fef2f2' : isWarning ? '#fffbeb' : '#f0fdf4' }}>
            <Box display="flex" alignItems="center" gap={1} mb={2}>
                {isDanger || isWarning ? <WarningAmberIcon color={isDanger ? "error" : "warning"} /> : <CheckCircleOutlineIcon color="success" />}
                <Typography variant="h6" fontWeight="bold" color={isDanger ? "error.main" : isWarning ? "warning.dark" : "success.dark"}>
                    資金ショート予測 (Runway Forecast)
                </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" mb={3}>
                あなたの現在の平均的な月次支出（Burn Rate）と手元資金をもとに、ビジネスが何ヶ月継続できるかを予測します。
            </Typography>

            <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" fontWeight="bold">推定手元資金 (Cash)</Typography>
                <Typography variant="body2" fontFamily="monospace">¥{currentCash.toLocaleString()}</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" fontWeight="bold">平均月次支出 (Burn Rate)</Typography>
                <Typography variant="body2" fontFamily="monospace">¥{Math.round(monthlyBurnRate).toLocaleString()} / 月</Typography>
            </Box>
            <Box display="flex" justifyContent="space-between" mb={2} color="error.main">
                <Typography variant="body2" fontWeight="bold">推計の税金支払額目安</Typography>
                <Typography variant="body2" fontFamily="monospace">▲ ¥{Math.round(upcomingTax).toLocaleString()}</Typography>
            </Box>

            <Box p={2} bgcolor="#ffffff" borderRadius={2} border="1px solid #e2e8f0" mb={3}>
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    税金支払い後の生存可能期間 (ランウェイ)
                </Typography>
                <Typography variant="h4" fontWeight="900" fontFamily="monospace" color={isDanger ? "error.main" : isWarning ? "warning.main" : "success.main"}>
                    {runwayAfterTax > 24 ? "24+" : runwayAfterTax.toFixed(1)} ヶ月
                </Typography>

                <Box mt={2} mb={1}>
                    <LinearProgress
                        variant="determinate"
                        value={progressValue}
                        sx={{
                            height: 10,
                            borderRadius: 5,
                            bgcolor: '#f1f5f9',
                            '& .MuiLinearProgress-bar': {
                                bgcolor: isDanger ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981'
                            }
                        }}
                    />
                </Box>
                <Box display="flex" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">0ヶ月 (ショート)</Typography>
                    <Typography variant="caption" color="text.secondary">12ヶ月以上 (安全)</Typography>
                </Box>
            </Box>

            <Typography variant="body2" fontWeight="bold" color={isDanger ? "error.main" : isWarning ? "warning.dark" : "success.dark"}>
                {isDanger ? "⚠️ 危険アラート: 今のペースだと数ヶ月以内に資金がショートする確率が極めて高いです。至急、経費の削減か資金調達（借り入れ等）を検討してください。" :
                    isWarning ? "⚠️ 注意: 手元資金が半年分を切っています。大きな投資（機材購入等）は慎重に行ってください。" :
                        "✅ 安全: 健全なキャッシュポジションです。不測の事態（売上の急減）が起きても当面は事業の継続が可能です。"}
            </Typography>
        </Paper>
    );
}
