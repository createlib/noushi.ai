import { Box, Typography, Slider, Paper, Stack } from '@mui/material';
import { useState, useMemo } from 'react';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';

interface WhatIfSimulatorProps {
    currentIncome: number;
    currentExpense: number;
    taxReturnMethod: 'white' | 'blue_10' | 'blue_55' | 'blue_65';
}

export default function WhatIfSimulator({ currentIncome, currentExpense, taxReturnMethod }: WhatIfSimulatorProps) {
    const [extraExpense, setExtraExpense] = useState<number>(0);
    const [kyosai, setKyosai] = useState<number>(0);
    const [furusato, setFurusato] = useState<number>(0);

    // 簡易的な税金計算 (所得税+住民税+事業税のざっくり合計 30%として仮置き、青色申告控除を加味)
    const calculateTax = (income: number, expense: number, extraExp: number, kyosaiAmt: number, method: string) => {
        let deduction = 0;
        if (method === 'blue_65') deduction = 650000;
        else if (method === 'blue_55') deduction = 550000;
        else if (method === 'blue_10') deduction = 100000;

        // 事業所得
        const businessIncome = Math.max(0, income - expense - extraExp - deduction);

        // 各種控除 (基礎控除48万 + 小規模企業共済等掛金控除)
        const taxableIncome = Math.max(0, businessIncome - 480000 - kyosaiAmt);

        // 簡易税率 (ざっくり 課税所得の 20% 〜 30%)
        let taxRate = 0.15; // 住民税10% + 最小所得税5%
        if (taxableIncome > 1950000) taxRate = 0.20;
        if (taxableIncome > 3300000) taxRate = 0.30;
        if (taxableIncome > 6950000) taxRate = 0.33;

        return taxableIncome * taxRate;
    };

    const currentTax = useMemo(() => calculateTax(currentIncome, currentExpense, 0, 0, taxReturnMethod), [currentIncome, currentExpense, taxReturnMethod]);
    const simulatedTax = useMemo(() => calculateTax(currentIncome, currentExpense, extraExpense, kyosai, taxReturnMethod), [currentIncome, currentExpense, extraExpense, kyosai, taxReturnMethod]);
    const taxSaved = currentTax - simulatedTax;

    // ふるさと納税の控除上限目安の簡易計算 (課税所得の約1%~2%目安だが簡易的に)
    const furusatoLimit = Math.max(0, (currentIncome - currentExpense - 480000) * 0.02);

    return (
        <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={4}>
            {/* 左側：シミュレーター操作パネル */}
            <Box flex={{ xs: '1 1 auto', md: '0 0 58%' }}>
                <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', bgcolor: '#ffffff' }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom color="primary.dark">
                        節税「What-If」シミュレーター
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mb={4}>
                        「もしもあと〇〇円経費を使ったら？」「共済に加入したら？」税金がどう変わるかを直感的にテストできます。
                    </Typography>

                    <Stack spacing={4}>
                        {/* 1. 追加の経費 */}
                        <Box>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-end" mb={1}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <AccountBalanceIcon color="primary" fontSize="small" />
                                    <Typography variant="subtitle2" fontWeight="bold">今年の追加経費（PC購入など）</Typography>
                                </Box>
                                <Typography variant="h6" color="primary.main" fontWeight="bold" fontFamily="monospace">
                                    ¥{extraExpense.toLocaleString()}
                                </Typography>
                            </Box>
                            <Slider
                                value={extraExpense}
                                onChange={(_, val) => setExtraExpense(val as number)}
                                step={10000}
                                min={0}
                                max={1000000}
                                valueLabelDisplay="auto"
                                valueLabelFormat={v => `¥${(v / 10000).toFixed(0)}万`}
                            />
                            <Typography variant="caption" color="text.secondary">※青色申告なら30万円未満のPC等が一括経費にできます（少額減価償却資産の特例）</Typography>
                        </Box>

                        {/* 2. 小規模企業共済 */}
                        <Box>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-end" mb={1}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <LocalHospitalIcon color="secondary" fontSize="small" />
                                    <Typography variant="subtitle2" fontWeight="bold">小規模企業共済・iDeCo (年間)</Typography>
                                </Box>
                                <Typography variant="h6" color="secondary.main" fontWeight="bold" fontFamily="monospace">
                                    ¥{kyosai.toLocaleString()}
                                </Typography>
                            </Box>
                            <Slider
                                value={kyosai}
                                onChange={(_, val) => setKyosai(val as number)}
                                step={12000}
                                min={0}
                                max={840000}
                                color="secondary"
                                valueLabelDisplay="auto"
                                valueLabelFormat={v => `¥${(v / 10000).toFixed(1)}万`}
                            />
                            <Typography variant="caption" color="text.secondary">※支払った全額が「所得控除」になり、そのまま税率を掛けた額だけ税金が安くなります</Typography>
                        </Box>

                        {/* 3. ふるさと納税 */}
                        <Box>
                            <Box display="flex" justifyContent="space-between" alignItems="flex-end" mb={1}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <CardGiftcardIcon sx={{ color: '#f59e0b' }} fontSize="small" />
                                    <Typography variant="subtitle2" fontWeight="bold">ふるさと納税 (寄付額)</Typography>
                                </Box>
                                <Typography variant="h6" sx={{ color: '#f59e0b' }} fontWeight="bold" fontFamily="monospace">
                                    ¥{furusato.toLocaleString()}
                                </Typography>
                            </Box>
                            <Slider
                                value={furusato}
                                onChange={(_, val) => setFurusato(val as number)}
                                step={10000}
                                min={0}
                                max={Math.max(100000, Math.ceil(furusatoLimit / 10000) * 10000 * 2)}
                                sx={{ color: '#f59e0b' }}
                                valueLabelDisplay="auto"
                                valueLabelFormat={v => `¥${(v / 10000).toFixed(1)}万`}
                            />
                            <Typography variant="caption" color={furusato > furusatoLimit ? "error" : "text.secondary"}>
                                ※実質負担2,000円。あなたの今年の寄付上限目安は <b>約 ¥{Math.round(furusatoLimit).toLocaleString()}</b> です。
                            </Typography>
                        </Box>
                    </Stack>
                </Paper>
            </Box>

            {/* 右側：結果パネル */}
            <Box flex={{ xs: '1 1 auto', md: '1 1 auto' }}>
                <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Typography variant="subtitle1" fontWeight="bold" color="#166534" gutterBottom>
                        シミュレーション結果
                    </Typography>

                    <Box mt={3} p={2} bgcolor="#ffffff" borderRadius={2} border="1px solid #e2e8f0">
                        <Typography variant="body2" color="text.secondary" align="center">何もしなかった場合の推計税金</Typography>
                        <Typography variant="h6" align="center" fontFamily="monospace" color="text.primary" mt={0.5}>
                            約 ¥{Math.round(currentTax).toLocaleString()}
                        </Typography>
                    </Box>

                    <Box mt={2} p={2} bgcolor="#eff6ff" borderRadius={2} border="1px solid #bfdbfe">
                        <Typography variant="body2" color="text.secondary" align="center">アクション後の推計税金</Typography>
                        <Typography variant="h4" align="center" fontFamily="monospace" color="primary.main" fontWeight="900" mt={0.5}>
                            約 ¥{Math.round(simulatedTax).toLocaleString()}
                        </Typography>
                    </Box>

                    <Box mt={4} textAlign="center">
                        <Typography variant="body2" color="#166534" fontWeight="bold">
                            浮いた推計キャッシュ (節税効果)
                        </Typography>
                        <Typography variant="h3" color="#16a34a" fontWeight="900" fontFamily="monospace" mt={1}>
                            ¥{Math.round(taxSaved).toLocaleString()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" mt={2}>
                            ※あくまでも参考値であり、実際の税額を保証するものではありません。
                        </Typography>
                    </Box>
                </Paper>
            </Box>
        </Box>
    );
}
