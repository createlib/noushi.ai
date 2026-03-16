import React, { useRef, useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

interface AccountBalance {
    code: number;
    name: string;
    balance: number;
    balanceKishu: number;
    balanceKimatsu: number;
    balanceCurrent: number;
    type: 'debit' | 'credit' | 'unknown';
    report: 'PL' | 'BS' | 'unknown';
}

interface PdfExportConfig {
    selectedYear: number;
    plSales: AccountBalance[];
    plOtherIncome: AccountBalance[];
    totalSales: number;
    sumKishu: number;
    sumShiire: number;
    sumKimatsu: number;
    cogs: number;
    grossProfit: number;
    plTrueExpenses: AccountBalance[];
    totalTrueExpense: number;
    generalNetIncome: number;
    hasGeneralBiz: boolean;
    hasAgrBiz: boolean;
    plAgrSales: AccountBalance[];
    totalAgrSales: number;
    plAgrExpenses: AccountBalance[];
    totalAgrExpense: number;
    agrNetIncome: number;
    hasREBiz: boolean;
    plRESales: AccountBalance[];
    totalRESales: number;
    plREExpenses: AccountBalance[];
    totalREExpense: number;
    reNetIncome: number;
    netIncome: number;
    bsAssets: AccountBalance[];
    totalAssets: number;
    totalAssetsKishu: number;
    bsLiabilities: AccountBalance[];
    totalLiabilities: number;
    totalLiabilitiesKishu: number;
    hasMfgBiz: boolean;
    mfgMaterialKishu: number;
    mfgMaterialShiire: number;
    mfgMaterialKimatsu: number;
    mfgMaterialCost: number;
    mfgLaborCost: number;
    mfgExpensesList: AccountBalance[];
    mfgExpensesTotal: number;
    mfgTotalCost: number;
    mfgWipKishu: number;
    mfgWipKimatsu: number;
    mfgCostOfGoodsManufactured: number;
    monthlySales: number[];
    monthlyPurchases: number[];
    kajiShouhiTotal: number;
    zatsuShuunyuuTotal: number;    
    salaryTotal: number;
    familySalaryTotal: number;
    badDebtProvisionTotal: number;
    rentTotal: number;
    depreciationTotal: number;
    interestTotal: number;
    taxAcctTotal: number;
    blueReturnDeduction: number;
    transactions: any[];
    accounts: any[];
}

export const PdfExporter: React.FC<{ data: PdfExportConfig }> = ({ data }) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGeneratePdf = async () => {
        if (!reportRef.current) return;
        setIsGenerating(true);

        try {
            // 一時的に表示してキャプチャ
            reportRef.current.style.display = 'block';

            // Allow DOM to paint thoroughly before capturing
            await new Promise(resolve => setTimeout(resolve, 50));

            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const sections = reportRef.current.querySelectorAll('.pdf-page-section');

            for (let i = 0; i < sections.length; i++) {
                const element = sections[i] as HTMLElement;
                const canvas = await html2canvas(element, { scale: 2 });
                const imgData = canvas.toDataURL('image/png');

                if (i > 0) pdf.addPage();

                const imgRatio = canvas.height / canvas.width;
                const pdfRatio = pdfHeight / pdfWidth;

                let finalW = pdfWidth;
                let finalH = pdfWidth * imgRatio;
                if (imgRatio > pdfRatio) {
                    finalH = pdfHeight;
                    finalW = pdfHeight / imgRatio;
                }

                pdf.addImage(imgData, 'PNG', 0, 0, finalW, finalH);
            }

            reportRef.current.style.display = 'none';

            pdf.save(`TaxReport_${data.selectedYear}.pdf`);
        } catch (error) {
            console.error("Tax PDF generation failed:", error);
        } finally {
            setIsGenerating(false);
        }
    };

    const pageSx = {
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm',
        bgcolor: 'white',
        color: 'black',
        fontFamily: '"MS Mincho", serif',
        boxSizing: 'border-box'
    };

    try {
        return (
            <>
                <Button
                    variant="contained"
                    startIcon={isGenerating ? <CircularProgress size={20} sx={{ color: 'white' }} /> : <PictureAsPdfIcon />}
                    onClick={handleGeneratePdf}
                    disabled={isGenerating}
                    sx={{ bgcolor: '#dc2626', color: 'white', '&:hover': { bgcolor: '#b91c1c' }, borderRadius: 8 }}
                    disableElevation
                >
                    申告書フォーマットで出力 (PDF)
                </Button>

                {/* Hidden printable area */}
                <Box
                    ref={reportRef}
                    sx={{
                        display: 'none',
                        position: 'absolute',
                        top: '-9999px',
                        left: '-9999px',
                        width: '210mm', // A4 width
                        minHeight: '297mm', // A4 height
                        padding: '20mm',
                        bgcolor: 'white',
                        color: 'black',
                        fontFamily: '"MS Mincho", serif', // Official look
                        boxSizing: 'border-box'
                    }}
                >
                    <Box className="pdf-page-section" sx={pageSx}>
                        <Typography variant="h4" align="center" gutterBottom fontWeight="bold" sx={{ borderBottom: '2px solid black', mb: 4, pb: 1 }}>
                            令和{data.selectedYear - 2018}年分 青色申告決算書 (写)
                        </Typography>

                        <Box display="flex" justifyContent="space-between" mb={4}>
                            <Typography>事業所名: __________________</Typography>
                            <Typography>氏名: __________________ ㊞</Typography>
                        </Box>

                        {data.hasGeneralBiz && (
                            <Box>
                                <Typography variant="h6" sx={{ borderLeft: '4px solid black', pl: 1, mb: 2, fontWeight: 'bold' }}>損益計算書 (一般事業)</Typography>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black' }}>
                                    <tbody>
                                        <tr style={{ borderBottom: '1px solid black' }}>
                                            <th style={{ padding: '8px', borderRight: '1px solid black', textAlign: 'left', width: '60%' }}>項目</th>
                                            <th style={{ padding: '8px', textAlign: 'right' }}>金額 (円)</th>
                                        </tr>
                                        <tr><td colSpan={2} style={{ padding: '4px 8px', backgroundColor: '#f0f0f0', borderBottom: '1px solid #ccc' }}>売上金額</td></tr>
                                        <tr>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid black' }}>売上（収入）金額</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>{data.totalSales.toLocaleString()}</td>
                                        </tr>
                                        <tr><td colSpan={2} style={{ padding: '4px 8px', backgroundColor: '#f0f0f0', borderBottom: '1px solid #ccc', borderTop: '1px solid #ccc' }}>売上原価</td></tr>
                                        <tr>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid black' }}>期首棚卸高</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>{data.sumKishu.toLocaleString()}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid black' }}>仕入金額</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>{data.sumShiire.toLocaleString()}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid black' }}>期末棚卸高</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>▲ {data.sumKimatsu.toLocaleString()}</td>
                                        </tr>
                                        <tr style={{ fontWeight: 'bold', borderTop: '1px solid black' }}>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid black' }}>差引金額 (粗利)</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>{data.grossProfit.toLocaleString()}</td>
                                        </tr>
                                        <tr><td colSpan={2} style={{ padding: '4px 8px', backgroundColor: '#f0f0f0', borderBottom: '1px solid #ccc', borderTop: '1px solid #ccc' }}>経費</td></tr>
                                        {data.plTrueExpenses.map(e => (
                                            <tr key={e.code}>
                                                <td style={{ padding: '4px 8px', borderRight: '1px solid black' }}>{e.name}</td>
                                                <td style={{ padding: '4px 8px', textAlign: 'right' }}>{e.balance.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                        <tr style={{ borderTop: '1px solid black' }}>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid black' }}>経費計</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>{data.totalTrueExpense.toLocaleString()}</td>
                                        </tr>
                                        <tr style={{ fontWeight: 'bold', borderTop: '2px solid black' }}>
                                            <td style={{ padding: '8px', borderRight: '1px solid black' }}>一般事業所得</td>
                                            <td style={{ padding: '8px', textAlign: 'right' }}>{data.generalNetIncome.toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </Box>
                        )}
                    </Box>

                    {data.hasMfgBiz && (
                        <Box className="pdf-page-section" sx={pageSx}>
                            <Typography variant="h6" sx={{ borderLeft: '4px solid black', pl: 1, mb: 2, fontWeight: 'bold' }}>製造原価報告書</Typography>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black' }}>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid black' }}>
                                        <th colSpan={3} style={{ padding: '8px', borderRight: '1px solid black', textAlign: 'center' }}>科目</th>
                                        <th style={{ padding: '8px', textAlign: 'right' }}>金額 (円)</th>
                                    </tr>
                                    <tr>
                                        <td rowSpan={5} style={{ padding: '4px 8px', borderRight: '1px solid black', verticalAlign: 'top', width: '25%' }}>材料費</td>
                                        <td colSpan={2} style={{ padding: '4px 8px', borderRight: '1px solid black' }}>期首材料棚卸高</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{data.mfgMaterialKishu.toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={2} style={{ padding: '4px 8px', borderRight: '1px solid black' }}>材料仕入高</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{data.mfgMaterialShiire.toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={2} style={{ padding: '4px 8px', borderRight: '1px solid black' }}>計</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{(data.mfgMaterialKishu + data.mfgMaterialShiire).toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={2} style={{ padding: '4px 8px', borderRight: '1px solid black' }}>期末材料棚卸高</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>▲ {data.mfgMaterialKimatsu.toLocaleString()}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #ccc' }}>
                                        <td colSpan={2} style={{ padding: '4px 8px', borderRight: '1px solid black' }}>差引材料費</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{data.mfgMaterialCost.toLocaleString()}</td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid #ccc' }}>
                                        <td colSpan={3} style={{ padding: '4px 8px', borderRight: '1px solid black' }}>労務費</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{data.mfgLaborCost.toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td rowSpan={data.mfgExpensesList.length + 2} style={{ padding: '4px 8px', borderRight: '1px solid black', verticalAlign: 'top' }}>その他の製造経費</td>
                                    </tr>
                                    {data.mfgExpensesList.map(e => (
                                        <tr key={e.code}>
                                            <td colSpan={2} style={{ padding: '4px 8px', borderRight: '1px solid black' }}>{e.name}</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'right' }}>{e.balance.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    <tr style={{ borderBottom: '1px solid black' }}>
                                        <td colSpan={2} style={{ padding: '4px 8px', borderRight: '1px solid black' }}>計</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{data.mfgExpensesTotal.toLocaleString()}</td>
                                    </tr>
                                    <tr style={{ fontWeight: 'bold' }}>
                                        <td colSpan={3} style={{ padding: '4px 8px', borderRight: '1px solid black' }}>総製造費</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{data.mfgTotalCost.toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} style={{ padding: '4px 8px', borderRight: '1px solid black' }}>期首半製品・仕掛品棚卸高</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{data.mfgWipKishu.toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} style={{ padding: '4px 8px', borderRight: '1px solid black' }}>計</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>{(data.mfgTotalCost + data.mfgWipKishu).toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} style={{ padding: '4px 8px', borderRight: '1px solid black' }}>期末半製品・仕掛品棚卸高</td>
                                        <td style={{ padding: '4px 8px', textAlign: 'right' }}>▲ {data.mfgWipKimatsu.toLocaleString()}</td>
                                    </tr>
                                    <tr style={{ fontWeight: 'bold', borderTop: '2px solid black' }}>
                                        <td colSpan={3} style={{ padding: '8px', borderRight: '1px solid black' }}>製品製造原価</td>
                                        <td style={{ padding: '8px', textAlign: 'right' }}>{data.mfgCostOfGoodsManufactured.toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </Box>
                    )}

                    <Box className="pdf-page-section" sx={pageSx}>
                        <Typography variant="h6" sx={{ borderLeft: '4px solid black', pl: 1, mb: 2, fontWeight: 'bold' }}>貸借対照表 (B/S)</Typography>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '1px solid black' }}>
                                    <th colSpan={3} style={{ borderRight: '1px solid black', padding: '4px' }}>資産の部</th>
                                    <th colSpan={3} style={{ padding: '4px' }}>負債・資本の部</th>
                                </tr>
                                <tr style={{ borderBottom: '1px solid black', backgroundColor: '#fafafa' }}>
                                    <th style={{ padding: '4px', borderRight: '1px dashed #ccc', width: '20%' }}>科目</th>
                                    <th style={{ padding: '4px', borderRight: '1px dashed #ccc', width: '15%', textAlign: 'right' }}>期首残高</th>
                                    <th style={{ padding: '4px', borderRight: '1px solid black', width: '15%', textAlign: 'right' }}>期末残高</th>
                                    <th style={{ padding: '4px', borderRight: '1px dashed #ccc', width: '20%' }}>科目</th>
                                    <th style={{ padding: '4px', borderRight: '1px dashed #ccc', width: '15%', textAlign: 'right' }}>期首残高</th>
                                    <th style={{ padding: '4px', width: '15%', textAlign: 'right' }}>期末残高</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: Math.max(data.bsAssets.length, data.bsLiabilities.length + 1) }).map((_, i) => {
                                    const asset = data.bsAssets[i];
                                    const isNetIncomeRow = i === data.bsLiabilities.length;
                                    const liab = data.bsLiabilities[i];

                                    return (
                                        <tr key={i} style={{ borderBottom: '1px dashed #ccc' }}>
                                            <td style={{ padding: '4px', borderRight: '1px dashed #ccc' }}>{asset ? asset.name : ''}</td>
                                            <td style={{ padding: '4px', borderRight: '1px dashed #ccc', textAlign: 'right' }}>{asset ? asset.balanceKishu.toLocaleString() : ''}</td>
                                            <td style={{ padding: '4px', borderRight: '1px solid black', textAlign: 'right' }}>{asset ? asset.balanceKimatsu.toLocaleString() : ''}</td>

                                            <td style={{ padding: '4px', borderRight: '1px dashed #ccc' }}>
                                                {liab ? liab.name : (isNetIncomeRow ? <span style={{ color: 'blue' }}>青色申告特別控除前所得金額</span> : '')}
                                            </td>
                                            <td style={{ padding: '4px', borderRight: '1px dashed #ccc', textAlign: 'right' }}>
                                                {liab ? liab.balanceKishu.toLocaleString() : (isNetIncomeRow ? '' : '')}
                                            </td>
                                            <td style={{ padding: '4px', textAlign: 'right', color: isNetIncomeRow ? 'blue' : 'inherit' }}>
                                                {liab ? liab.balanceKimatsu.toLocaleString() : (isNetIncomeRow ? data.netIncome.toLocaleString() : '')}
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr style={{ fontWeight: 'bold', borderTop: '2px solid black' }}>
                                    <td style={{ padding: '8px', borderRight: '1px dashed #ccc' }}>資産合計</td>
                                    <td style={{ padding: '8px', borderRight: '1px dashed #ccc', textAlign: 'right' }}>{data.totalAssetsKishu.toLocaleString()}</td>
                                    <td style={{ padding: '8px', borderRight: '1px solid black', textAlign: 'right' }}>{data.totalAssets.toLocaleString()}</td>
                                    <td style={{ padding: '8px', borderRight: '1px dashed #ccc' }}>負債・資本合計</td>
                                    <td style={{ padding: '8px', borderRight: '1px dashed #ccc', textAlign: 'right' }}>{data.totalLiabilitiesKishu.toLocaleString()}</td>
                                    <td style={{ padding: '8px', textAlign: 'right' }}>{(data.totalLiabilities + data.netIncome).toLocaleString()}</td>
                                </tr>
                            </tbody>
                        </table>
                    </Box>

                    {/* --- 詳細内訳ページ 1 --- */}
                    {data.hasGeneralBiz && (
                        <Box className="pdf-page-section" sx={pageSx}>
                            <Typography variant="h6" sx={{ borderLeft: '4px solid black', pl: 1, mb: 2, fontWeight: 'bold' }}>損益計算書 詳細内訳 (1)</Typography>

                            <Box display="flex" gap={4} mb={4}>
                                <Box flex={1}>
                                    <Typography variant="subtitle1" fontWeight="bold">〇 月別売上（収入）金額及び仕入金額</Typography>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '0.9rem' }}>
                                        <thead>
                                            <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '1px solid black' }}>
                                                <th style={{ padding: '4px', borderRight: '1px solid black' }}>月</th>
                                                <th style={{ padding: '4px', borderRight: '1px solid black' }}>売上（収入）金額</th>
                                                <th style={{ padding: '4px' }}>仕入金額</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Array.from({ length: 12 }).map((_, i) => (
                                                <tr key={i} style={{ borderBottom: '1px dashed #ccc' }}>
                                                    <td style={{ padding: '4px', borderRight: '1px solid black', textAlign: 'center' }}>{i + 1}月</td>
                                                    <td style={{ padding: '4px', borderRight: '1px solid black', textAlign: 'right' }}>{data.monthlySales[i].toLocaleString()}</td>
                                                    <td style={{ padding: '4px', textAlign: 'right' }}>{data.monthlyPurchases[i].toLocaleString()}</td>
                                                </tr>
                                            ))}
                                            <tr style={{ fontWeight: 'bold', borderTop: '2px solid black' }}>
                                                <td style={{ padding: '4px', borderRight: '1px solid black', textAlign: 'center' }}>計</td>
                                                <td style={{ padding: '4px', borderRight: '1px solid black', textAlign: 'right' }}>{data.monthlySales.reduce((a, b) => a + b, 0).toLocaleString()}</td>
                                                <td style={{ padding: '4px', textAlign: 'right' }}>{data.monthlyPurchases.reduce((a, b) => a + b, 0).toLocaleString()}</td>
                                            </tr>
                                            <tr style={{ borderTop: '1px dashed #ccc' }}>
                                                <td style={{ padding: '4px', borderRight: '1px solid black', textAlign: 'center' }}>家事消費等</td>
                                                <td style={{ padding: '4px', borderRight: '1px solid black', textAlign: 'right' }}>{data.kajiShouhiTotal.toLocaleString()}</td>
                                                <td style={{ padding: '4px', textAlign: 'right' }}></td>
                                            </tr>
                                            <tr style={{ borderTop: '1px dashed #ccc' }}>
                                                <td style={{ padding: '4px', borderRight: '1px solid black', textAlign: 'center' }}>雑収入</td>
                                                <td style={{ padding: '4px', borderRight: '1px solid black', textAlign: 'right' }}>{data.zatsuShuunyuuTotal.toLocaleString()}</td>
                                                <td style={{ padding: '4px', textAlign: 'right' }}></td>
                                            </tr>
                                            <tr style={{ fontWeight: 'bold', borderTop: '2px solid black' }}>
                                                <td style={{ padding: '4px', borderRight: '1px solid black', textAlign: 'center' }}>合計</td>
                                                <td style={{ padding: '4px', borderRight: '1px solid black', textAlign: 'right' }}>{data.totalSales.toLocaleString()}</td>
                                                <td style={{ padding: '4px', textAlign: 'right' }}>{data.monthlyPurchases.reduce((a, b) => a + b, 0).toLocaleString()}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </Box>

                                <Box flex={1}>
                                    <Box mb={4}>
                                        <Typography variant="subtitle1" fontWeight="bold">〇 給料賃金の内訳</Typography>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '0.9rem' }}>
                                            <tbody>
                                                <tr style={{ borderBottom: '1px solid black' }}>
                                                    <th style={{ padding: '4px', borderRight: '1px solid black', backgroundColor: '#f0f0f0' }}>従業員等延人員</th>
                                                    <th style={{ padding: '4px', backgroundColor: '#f0f0f0' }}>給料・賃金・賞与 計</th>
                                                </tr>
                                                <tr>
                                                    <td style={{ padding: '4px', borderRight: '1px solid black', textAlign: 'center' }}>人</td>
                                                    <td style={{ padding: '4px', textAlign: 'right' }}>{data.salaryTotal.toLocaleString()}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </Box>

                                    <Box mb={4}>
                                        <Typography variant="subtitle1" fontWeight="bold">〇 専従者給与の内訳</Typography>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '0.9rem' }}>
                                            <tbody>
                                                <tr style={{ borderBottom: '1px solid black' }}>
                                                    <th style={{ padding: '4px', borderRight: '1px solid black', backgroundColor: '#f0f0f0' }}>専従者延人員</th>
                                                    <th style={{ padding: '4px', backgroundColor: '#f0f0f0' }}>専従者給与 計</th>
                                                </tr>
                                                <tr>
                                                    <td style={{ padding: '4px', borderRight: '1px solid black', textAlign: 'center' }}>人</td>
                                                    <td style={{ padding: '4px', textAlign: 'right' }}>{data.familySalaryTotal.toLocaleString()}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </Box>

                                    <Box mb={4}>
                                        <Typography variant="subtitle1" fontWeight="bold">〇 貸倒引当金繰入額の計算・青色申告特別控除</Typography>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '0.9rem' }}>
                                            <tbody>
                                                <tr style={{ borderBottom: '1px dashed #ccc' }}>
                                                    <td style={{ padding: '4px', borderRight: '1px solid black', width: '60%' }}>貸倒引当金繰入額</td>
                                                    <td style={{ padding: '4px', textAlign: 'right' }}>{data.badDebtProvisionTotal.toLocaleString()}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ padding: '4px', borderRight: '1px solid black' }}>青色申告特別控除額</td>
                                                    <td style={{ padding: '4px', textAlign: 'right' }}>{data.blueReturnDeduction.toLocaleString()}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    )}

                    {/* --- 詳細内訳ページ 2 --- */}
                    {data.hasGeneralBiz && (
                        <Box className="pdf-page-section" sx={pageSx}>
                            <Typography variant="h6" sx={{ borderLeft: '4px solid black', pl: 1, mb: 2, fontWeight: 'bold' }}>損益計算書 詳細内訳 (2)</Typography>

                            <Box mb={4}>
                                <Typography variant="subtitle1" fontWeight="bold">〇 減価償却費の計算</Typography>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '0.9rem' }}>
                                    <tbody>
                                        <tr style={{ borderBottom: '1px solid black', backgroundColor: '#f0f0f0' }}>
                                            <th style={{ padding: '4px', borderRight: '1px solid black', width: '80%' }}>本年分の普通償却費・特別償却費・割増償却費の計</th>
                                            <th style={{ padding: '4px', textAlign: 'right' }}>金額</th>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: '4px', borderRight: '1px solid black' }}>合計</td>
                                            <td style={{ padding: '4px', textAlign: 'right' }}>{data.depreciationTotal.toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </Box>

                            <Box mb={4}>
                                <Typography variant="subtitle1" fontWeight="bold">〇 地代家賃の内訳</Typography>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '0.9rem' }}>
                                    <tbody>
                                        <tr style={{ borderBottom: '1px solid black', backgroundColor: '#f0f0f0' }}>
                                            <th style={{ padding: '4px', borderRight: '1px solid black', width: '80%' }}>左のうち必要経費算入額 計</th>
                                            <th style={{ padding: '4px', textAlign: 'right' }}>金額</th>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: '4px', borderRight: '1px solid black' }}>合計</td>
                                            <td style={{ padding: '4px', textAlign: 'right' }}>{data.rentTotal.toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </Box>

                            <Box mb={4}>
                                <Typography variant="subtitle1" fontWeight="bold">〇 利子割引料の内訳</Typography>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '0.9rem' }}>
                                    <tbody>
                                        <tr style={{ borderBottom: '1px solid black', backgroundColor: '#f0f0f0' }}>
                                            <th style={{ padding: '4px', borderRight: '1px solid black', width: '80%' }}>左のうち必要経費算入額 計</th>
                                            <th style={{ padding: '4px', textAlign: 'right' }}>金額</th>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: '4px', borderRight: '1px solid black' }}>合計</td>
                                            <td style={{ padding: '4px', textAlign: 'right' }}>{data.interestTotal.toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </Box>

                            <Box mb={4}>
                                <Typography variant="subtitle1" fontWeight="bold">〇 税理士・弁護士等の報酬・料金の内訳</Typography>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '0.9rem' }}>
                                    <tbody>
                                        <tr style={{ borderBottom: '1px solid black', backgroundColor: '#f0f0f0' }}>
                                            <th style={{ padding: '4px', borderRight: '1px solid black', width: '80%' }}>本年中の支払金額 計</th>
                                            <th style={{ padding: '4px', textAlign: 'right' }}>金額</th>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: '4px', borderRight: '1px solid black' }}>合計</td>
                                            <td style={{ padding: '4px', textAlign: 'right' }}>{data.taxAcctTotal.toLocaleString()}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </Box>

                        </Box>
                    )}

                </Box>
            </>
        );
    } catch (e: any) {
        return <Typography color="error">PDF Export Error: {e.message}</Typography>;
    }
};
