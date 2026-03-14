
import { Box, Typography, Card, CardContent } from '@mui/material';
import CalculateIcon from '@mui/icons-material/Calculate';

interface TaxSimulationProps {
    income: number;
    expense: number;
    taxReturnMethod: 'blue' | 'white';
}

export default function TaxSimulation({ income, expense, taxReturnMethod }: TaxSimulationProps) {
    const operatingProfit = income - expense;

    // Deductions
    const basicDeduction = 480000;
    const specialDeduction = taxReturnMethod === 'blue' ? 650000 : 0;

    const taxableIncome = Math.max(0, operatingProfit - basicDeduction - specialDeduction);

    // Income Tax Calculation (Simplified Japanese Brackets)
    let incomeTax = 0;
    if (taxableIncome > 0) {
        if (taxableIncome <= 1950000) {
            incomeTax = taxableIncome * 0.05;
        } else if (taxableIncome <= 3299000) {
            incomeTax = taxableIncome * 0.10 - 97500;
        } else if (taxableIncome <= 6949000) {
            incomeTax = taxableIncome * 0.20 - 427500;
        } else if (taxableIncome <= 8999000) {
            incomeTax = taxableIncome * 0.23 - 636000;
        } else if (taxableIncome <= 17999000) {
            incomeTax = taxableIncome * 0.33 - 1536000;
        } else if (taxableIncome <= 39999000) {
            incomeTax = taxableIncome * 0.40 - 2796000;
        } else {
            incomeTax = taxableIncome * 0.45 - 4796000;
        }
    }

    // Resident Tax & Others (Roughly 10% resident, ~10% health insurance = ~20% combined estimate)
    const residentTaxEstimate = taxableIncome * 0.10;
    const healthInsuranceEstimate = taxableIncome * 0.10;

    const totalEstimatedTax = incomeTax + residentTaxEstimate + healthInsuranceEstimate;

    return (
        <Card elevation={0} sx={{ border: '1px solid #e2e8f0', bgcolor: '#f8fafc', borderRadius: 2, height: '100%' }}>
            <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <CalculateIcon color="primary" />
                    <Typography variant="subtitle1" fontWeight="bold">納税額の目安シミュレーション</Typography>
                </Box>

                <Box bgcolor="#fff" p={2} borderRadius={2} border="1px solid #e2e8f0" mb={2}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2" color="text.secondary">営業利益 (売上 - 経費)</Typography>
                        <Typography variant="body2" fontWeight="bold">¥{operatingProfit.toLocaleString()}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2" color="text.secondary">申告控除 ({taxReturnMethod === 'blue' ? '青色' : '白色'})</Typography>
                        <Typography variant="body2" color="success.main">-¥{specialDeduction.toLocaleString()}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                        <Typography variant="body2" color="text.secondary">基礎控除額</Typography>
                        <Typography variant="body2" color="success.main">-¥{basicDeduction.toLocaleString()}</Typography>
                    </Box>
                    <Box display="flex" justifyContent="space-between" borderTop="1px dashed #cbd5e1" pt={1} mt={1}>
                        <Typography variant="body2" fontWeight="bold">課税対象所得</Typography>
                        <Typography variant="body2" fontWeight="bold">¥{taxableIncome.toLocaleString()}</Typography>
                    </Box>
                </Box>

                <Typography variant="caption" color="text.secondary" display="block" mb={1}>来年の支払いに向けて確保すべき目安額</Typography>
                <Typography variant="h3" fontWeight="900" color="error.main">
                    ¥{Math.round(totalEstimatedTax).toLocaleString()}
                </Typography>
                <Typography variant="caption" color="text.secondary" mt={1} display="block">
                    ※内訳目安: 所得税 ¥{Math.round(incomeTax).toLocaleString()} / 住民税・国保等 ¥{Math.round(residentTaxEstimate + healthInsuranceEstimate).toLocaleString()}<br />
                    ※この数値は各種社会保険料控除や扶養控除を省いた簡易概算です。
                </Typography>
            </CardContent>
        </Card>
    );
}
