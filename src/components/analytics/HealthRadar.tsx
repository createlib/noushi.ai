import { Box, Typography, Paper } from '@mui/material';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface HealthRadarProps {
    profitMargin: number; // 利益率 (攻撃力) 0-100%
    budgetAchievement: number; // 予算達成度 (防御力) 0-100 (低いほど良いがスコア化は反転)
    taxEfficiency: number; // 節税活用度 (賢さ) 0-100
    salesStability: number; // 売上安定度 (安定感) 0-100
}

export default function HealthRadar({ profitMargin, budgetAchievement, taxEfficiency, salesStability }: HealthRadarProps) {

    // スコア計算 (0-100の範囲に収める)
    const attackScore = Math.min(100, Math.max(0, profitMargin * 2)); // 利益率50%で満点
    const defenseScore = Math.min(100, Math.max(0, 100 - (budgetAchievement - 100))); // 予算内なら高得点
    const smartScore = Math.min(100, Math.max(0, taxEfficiency));
    const stabilityScore = Math.min(100, Math.max(0, salesStability));

    const data = [
        { subject: '収益力 (攻撃)', A: Math.round(attackScore), fullMark: 100 },
        { subject: '経費管理 (防御)', A: Math.round(defenseScore), fullMark: 100 },
        { subject: '節税活用 (賢さ)', A: Math.round(smartScore), fullMark: 100 },
        { subject: '資金安定度 (体力)', A: Math.round(stabilityScore), fullMark: 100 },
    ];

    // 総合偏差値 (簡易平均)
    const totalScore = Math.round((attackScore + defenseScore + smartScore + stabilityScore) / 4);

    let rank = 'C';
    let rankColor = '#64748b'; // gray
    let message = "経営体質の改善が必要です。まずは固定費の見直しから始めましょう。";

    if (totalScore >= 80) {
        rank = 'S';
        rankColor = '#be185d'; // pink/red
        message = "極めて優秀な経営状態です！並外れた収益力と管理能力を備えています。";
    } else if (totalScore >= 65) {
        rank = 'A';
        rankColor = '#1d4ed8'; // blue
        message = "優秀な経営状態です。攻守のバランスが良く、安定した事業基盤があります。";
    } else if (totalScore >= 50) {
        rank = 'B';
        rankColor = '#15803d'; // green
        message = "平均的な経営状態です。強みを伸ばすか、弱点（チャートの凹み）を補強しましょう。";
    }

    return (
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom color="primary.dark">
                経営健康度（ステータス）
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
                あなたのビジネスの強みと弱みをRPGのパラメータ風に可視化した総合評価です。
            </Typography>

            <Box display="flex" alignItems="center" justifyContent="center" gap={3} p={2} mb={2} bgcolor="#f8fafc" borderRadius={2}>
                <Box textAlign="center">
                    <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block">総合ランク</Typography>
                    <Typography variant="h2" fontWeight="900" sx={{ color: rankColor, textShadow: '2px 2px 4px rgba(0,0,0,0.1)' }}>
                        {rank}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block">総合スコア</Typography>
                    <Typography variant="h4" fontWeight="bold" fontFamily="monospace">
                        {totalScore}<Typography component="span" variant="body2" color="text.secondary">/100</Typography>
                    </Typography>
                </Box>
            </Box>

            <Box height={250} width="100%">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 12, fontWeight: 'bold' }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar name="経営スコア" dataKey="A" stroke={rankColor} fill={rankColor} fillOpacity={0.5} />
                        <Tooltip />
                    </RadarChart>
                </ResponsiveContainer>
            </Box>

            <Box mt="auto" p={2} bgcolor={`${rankColor}10`} borderRadius={2} border="1px solid" borderColor={`${rankColor}40`}>
                <Typography variant="body2" fontWeight="bold" color={rankColor}>
                    AI フィードバック
                </Typography>
                <Typography variant="body2" mt={0.5}>
                    {message}
                </Typography>
            </Box>
        </Paper>
    );
}
