import React from 'react';
import { Box, Typography, LinearProgress, Tooltip, IconButton } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SavingsIcon from '@mui/icons-material/Savings';

interface HouseholdRunwayProps {
    businessIncome: number;
    businessExpense: number;
    privateIncome: number;
    privateExpense: number;
    activeMonths: number;
}

export default function HouseholdRunway({ businessIncome, businessExpense, privateIncome, privateExpense, activeMonths }: HouseholdRunwayProps) {
    const businessProfit = businessIncome - businessExpense;
    const realNetCashflow = businessProfit + privateIncome - privateExpense;
    
    // 年間予測 (簡易的に現在の月平均ペースから12ヶ月分を推計)
    const validMonths = Math.max(1, activeMonths || 1);
    const monthlyNetCashflow = realNetCashflow / validMonths;
    const estimatedYearlySavings = monthlyNetCashflow * 12;

    const savingsRate = businessProfit > 0 
        ? ((businessProfit - privateExpense) / businessProfit) * 100 
        : 0;

    return (
        <Box p={3} borderRadius={2} bgcolor="#f8fafc" border="1px solid #e2e8f0" height="100%">
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                    <SavingsIcon sx={{ color: '#0f766e', fontSize: 24 }} />
                    <Typography variant="subtitle1" color="#115e59" fontWeight="bold">真の手残り資金・貯蓄予測</Typography>
                </Box>
                <Tooltip title="事業利益にプライベート収入を加え、家計支出を差し引いた純粋な「手元に残る現金」の予測です。生活を防衛し、資産を形成する力を示します。">
                    <IconButton size="small" sx={{ p: 0, color: '#14b8a6' }}><InfoOutlinedIcon fontSize="small" /></IconButton>
                </Tooltip>
            </Box>

            <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={3} mb={3}>
                <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">今期の純・手元残金 (現在)</Typography>
                    <Typography variant="h4" fontWeight="800" color={realNetCashflow > 0 ? '#15803d' : '#be123c'} mt={1}>
                        ¥{realNetCashflow.toLocaleString()}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold">年間貯蓄 推測ペース</Typography>
                    <Typography variant="h4" fontWeight="800" color={estimatedYearlySavings > 0 ? '#0369a1' : '#be123c'} mt={1}>
                        ¥{Math.round(estimatedYearlySavings).toLocaleString()}
                    </Typography>
                </Box>
            </Box>

            <Box mt={2}>
                <Box display="flex" justifyContent="space-between" mb={1}>
                    <Typography variant="caption" fontWeight="bold" color="text.secondary">事業利益からの貯蓄率</Typography>
                    <Typography variant="caption" fontWeight="bold" color={savingsRate >= 20 ? '#15803d' : savingsRate > 0 ? '#b45309' : '#be123c'}>
                        {savingsRate > 0 ? savingsRate.toFixed(1) : 0}%
                    </Typography>
                </Box>
                <LinearProgress 
                    variant="determinate" 
                    value={Math.min(100, Math.max(0, savingsRate))} 
                    sx={{ 
                        height: 10, 
                        borderRadius: 5, 
                        bgcolor: '#e2e8f0',
                        '& .MuiLinearProgress-bar': {
                            bgcolor: savingsRate >= 20 ? '#10b981' : savingsRate > 0 ? '#f59e0b' : '#ef4444',
                            borderRadius: 5
                        }
                    }} 
                />
                <Typography variant="body2" color="text.secondary" mt={2} fontSize="0.75rem">
                    {savingsRate >= 20 ? "素晴らしいペースです。事業の利益をしっかりと貯蓄や再投資に回せています。" :
                     savingsRate > 0 ? "黒字ですが、家計の出費が利益をギリギリまで食べています。浪費を見直して手残りを増やしましょう。" :
                     "【危険】事業利益を家計の支出が上回っており、資産が目減り（赤字転落）しています！"}
                </Typography>
            </Box>
        </Box>
    );
}
