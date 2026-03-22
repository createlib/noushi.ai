import { useMemo } from 'react';
import { Box, Typography, Alert, AlertTitle } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface HouseholdWasteScannerProps {
    privateLines: any[];
    journals: any[];
    accounts: any[];
}

export default function HouseholdWasteScanner({ privateLines, journals, accounts }: HouseholdWasteScannerProps) {
    const warnings = useMemo(() => {
        // 対象とする無駄遣いになりやすい変動費（浪費・ゆとり費）
        const targetAccounts = ['交際費', '娯楽費', '被服費', '美容費', '特別支出', 'サブスク'];
        
        // アカウントごとの月別集計: { '交際費': { '1': 10000, '2': 50000, ... } }
        const monthlyCatMap: Record<string, Record<string, number>> = {};
        targetAccounts.forEach(name => {
            monthlyCatMap[name] = {};
        });

        privateLines.forEach(line => {
            const j = journals.find(j => j.id === line.journal_id);
            const acc = accounts.find(a => String(a.code || a.id) === String(line.account_id));
            if (!j || !j.date || !acc || acc.type !== 'expense' || line.debit <= 0) return;

            if (targetAccounts.includes(acc.name)) {
                const monthNum = parseInt(j.date.substring(5, 7), 10);
                if (!isNaN(monthNum)) {
                    monthlyCatMap[acc.name][monthNum] = (monthlyCatMap[acc.name][monthNum] || 0) + line.debit;
                }
            }
        });

        const alerts: { title: string, desc: string, severity: 'error' | 'warning' }[] = [];

        Object.keys(monthlyCatMap).forEach(cat => {
            const monthMap = monthlyCatMap[cat];
            
            // 全月の平均を計算（発生した月のみ）
            const activeMonths = Object.keys(monthMap).length;
            if (activeMonths < 1) return;
            
            let total = 0;
            Object.values(monthMap).forEach(v => total += v);
            const avg = total / activeMonths;

            // 直近の発生月（必ずしも今月ではないが最新月）
            const latestMonth = Math.max(...Object.keys(monthMap).map(m => parseInt(m, 10)));
            const latestValue = monthMap[latestMonth] || 0;

            // 1万円以上で、平均の1.5倍以上のスパイクがあれば警告
            if (latestValue > 10000 && latestValue > avg * 1.5) {
                // To avoid spam, check if we have more than 1 month of history
                if (activeMonths > 1) {
                    alerts.push({
                        title: `${cat}の急上昇 (${latestMonth}月: ¥${latestValue.toLocaleString()})`,
                        desc: `平均額(¥${Math.round(avg).toLocaleString()})のなんと${(latestValue / avg).toFixed(1)}倍に達しています。衝動買いや不要な飲み会などの「浪費」を見直してください！`,
                        severity: latestValue > avg * 2.0 ? 'error' : 'warning'
                    });
                } else if (latestValue > 30000) {
                    alerts.push({
                        title: `${cat}が高額 (${latestMonth}月: ¥${latestValue.toLocaleString()})`,
                        desc: `まだ比較データが少ないですが、1ヶ月で¥${latestValue.toLocaleString()}の支出は使いすぎのサインです。`,
                        severity: 'warning'
                    });
                }
            }
        });

        return alerts;
    }, [privateLines, journals, accounts]);

    if (warnings.length === 0) {
        return (
            <Box p={3} borderRadius={2} bgcolor="#f0fdf4" border="1px solid #bbf7d0">
                <Typography color="#166534" fontWeight="bold">素晴らしいコントロールです！現在、趣味や娯楽等での異常な無駄遣いは検知されていません。</Typography>
            </Box>
        );
    }

    return (
        <Box display="flex" flexDirection="column" gap={2}>
            {warnings.map((w, idx) => (
                <Alert key={idx} severity={w.severity} icon={<WarningAmberIcon />} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
                    <AlertTitle sx={{ fontWeight: 'bold' }}>{w.title}</AlertTitle>
                    {w.desc}
                </Alert>
            ))}
        </Box>
    );
}
