import { useState } from 'react';
import { Box, Typography, Card, CardContent, LinearProgress, FormControl, Select, MenuItem } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { JournalLine, Journal, Account } from '../../db/db';

interface BudgetAlertsProps {
    monthlyBudgets: Record<string, number>;
    yearLines: JournalLine[];
    journals: Journal[];
    accounts: Account[];
}

export default function BudgetAlerts({ monthlyBudgets, yearLines, journals, accounts }: BudgetAlertsProps) {
    const [targetMonth, setTargetMonth] = useState<number>(new Date().getMonth() + 1);

    const budgetKeys = Object.keys(monthlyBudgets).filter(k => monthlyBudgets[k] > 0);

    const targetMonthExpenses: Record<string, number> = {};
    if (budgetKeys.length > 0) {
        yearLines.forEach(line => {
            const j = journals.find(j => j.id === line.journal_id);
            const acc = accounts.find(a => String(a.code || a.id) === String(line.account_id));
            if (!j || !j.date || !acc || acc.type !== 'expense') return;

            const monthNum = parseInt(j.date.substring(5, 7), 10);
            if (monthNum === targetMonth) {
                targetMonthExpenses[acc.name] = (targetMonthExpenses[acc.name] || 0) + line.debit;
            }
        });
    }

    return (
        <Card elevation={0} sx={{ border: '1px solid #e2e8f0', bgcolor: '#f8fafc', borderRadius: 2, height: '100%' }}>
            <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <WarningAmberIcon color="warning" />
                        <Typography variant="subtitle1" fontWeight="bold">予算消化アラート</Typography>
                    </Box>
                    <FormControl size="small" variant="standard" sx={{ minWidth: 60 }}>
                        <Select
                            value={targetMonth}
                            onChange={(e) => setTargetMonth(e.target.value as number)}
                            disableUnderline
                            sx={{ fontSize: '0.875rem', fontWeight: 'bold', color: 'primary.main' }}
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <MenuItem key={m} value={m}>{m}月</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                {budgetKeys.length === 0 ? (
                    <Box display="flex" justifyContent="center" alignItems="center" height={100}>
                        <Typography variant="body2" color="text.secondary">設定画面で目標予算を登録するとアラート機能が有効になります。</Typography>
                    </Box>
                ) : (
                    <Box display="flex" flexDirection="column" gap={3}>
                        {budgetKeys.map(category => {
                            const budget = monthlyBudgets[category];
                            const spent = targetMonthExpenses[category] || 0;
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
