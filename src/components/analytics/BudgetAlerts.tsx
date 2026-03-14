
import { Box, Typography, Card, CardContent, LinearProgress } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface BudgetAlertsProps {
    currentMonthExpenses: Record<string, number>;
    monthlyBudgets: Record<string, number>;
    currentMonthNum: number;
}

export default function BudgetAlerts({ currentMonthExpenses, monthlyBudgets, currentMonthNum }: BudgetAlertsProps) {
    const budgetKeys = Object.keys(monthlyBudgets).filter(k => monthlyBudgets[k] > 0);

    return (
        <Card elevation={0} sx={{ border: '1px solid #e2e8f0', bgcolor: '#f8fafc', borderRadius: 2, height: '100%' }}>
            <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <WarningAmberIcon color="warning" />
                    <Typography variant="subtitle1" fontWeight="bold">{currentMonthNum}月の予算消化アラート</Typography>
                </Box>

                {budgetKeys.length === 0 ? (
                    <Box display="flex" justifyContent="center" alignItems="center" height={100}>
                        <Typography variant="body2" color="text.secondary">設定画面で目標予算を登録するとアラート機能が有効になります。</Typography>
                    </Box>
                ) : (
                    <Box display="flex" flexDirection="column" gap={3}>
                        {budgetKeys.map(category => {
                            const budget = monthlyBudgets[category];
                            const spent = currentMonthExpenses[category] || 0;
                            const percentage = Math.min((spent / budget) * 100, 100);

                            let barColor: 'success' | 'warning' | 'error' = 'success';
                            if (percentage >= 100) barColor = 'error';
                            else if (percentage >= 80) barColor = 'warning';

                            return (
                                <Box key={category}>
                                    <Box display="flex" justifyContent="space-between" alignItems="baseline" mb={0.5}>
                                        <Typography variant="body2" fontWeight="bold">{category}</Typography>
                                        <Box display="flex" alignItems="baseline" gap={1}>
                                            <Typography variant="body2" color={barColor === 'error' ? 'error.main' : 'text.primary'} fontWeight="bold">
                                                ¥{spent.toLocaleString()}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">/ ¥{budget.toLocaleString()}</Typography>
                                        </Box>
                                    </Box>
                                    <LinearProgress
                                        variant="determinate"
                                        value={percentage}
                                        color={barColor}
                                        sx={{ height: 8, borderRadius: 4, bgcolor: '#e2e8f0' }}
                                    />
                                    <Typography variant="caption" color="text.secondary" display="block" align="right" mt={0.5}>
                                        消化率: {percentage.toFixed(1)}%
                                    </Typography>
                                </Box>
                            );
                        })}
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
