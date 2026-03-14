import React, { useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

export const GlPdfExporter: React.FC<{ accounts: any[], transactions: any[], selectedYear: number, balancesKishu: Record<number, number> }> = ({ accounts, transactions, selectedYear, balancesKishu }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const settings = useLiveQuery(() => db.settings.get(1), []);
    const businessName = settings?.businessName || '';

    // Filter accounts that have transactions
    const activeAccounts = accounts.filter(account => {
        return transactions.some(t =>
            (t.debits || []).some((d: any) => d.code === account.code) ||
            (t.credits || []).some((c: any) => c.code === account.code)
        );
    }).sort((a, b) => a.code - b.code);

    // Build pages
    const pages: any[] = [];
    const maxRowsPerPage = 18; // Reduced to fit landscape A4 safely with bottom margins

    activeAccounts.forEach(account => {
        const relatedTransactions = transactions.filter(t =>
            (t.debits || []).some((d: any) => d.code === account.code) ||
            (t.credits || []).some((c: any) => c.code === account.code)
        );

        const kishuRaw = balancesKishu[account.code] || 0;
        const accountKishu = account.type === 'debit' ? kishuRaw : -kishuRaw;

        let currentBalance = accountKishu;

        const rows = relatedTransactions.map((t, index) => {
            const isDebit = (t.debits || []).find((d: any) => d.code === account.code);
            const isCredit = (t.credits || []).find((c: any) => c.code === account.code);

            const debitAmount = isDebit ? isDebit.amount : 0;
            const creditAmount = isCredit ? isCredit.amount : 0;

            if (isDebit) currentBalance += (account.type === 'debit' ? isDebit.amount : -isDebit.amount);
            if (isCredit) currentBalance += (account.type === 'credit' ? isCredit.amount : -isCredit.amount);

            let oppName = '諸口';
            let oppCode = '999';
            if (isDebit && (t.credits || []).length === 1) {
                oppCode = String(t.credits[0].code);
                oppName = accounts.find(a => a.code === t.credits[0].code)?.name || '不明';
            } else if (isCredit && (t.debits || []).length === 1) {
                oppCode = String(t.debits[0].code);
                oppName = accounts.find(a => a.code === t.debits[0].code)?.name || '不明';
            }

            return {
                date: t.date,
                no: index + 1,
                oppCode,
                oppName,
                debitAmount,
                creditAmount,
                currentBalance,
                desc: t.description || ''
            };
        });

        // Add Kishu row
        const allRows = [
            { date: '', no: '', oppCode: '', oppName: '前年度繰越', debitAmount: '', creditAmount: '', currentBalance: accountKishu, desc: '' },
            ...rows
        ];

        // Chunk into pages
        for (let i = 0; i < allRows.length; i += maxRowsPerPage) {
            pages.push({
                account,
                pageIdx: Math.floor(i / maxRowsPerPage) + 1,
                totalPages: Math.ceil(allRows.length / maxRowsPerPage),
                rows: allRows.slice(i, i + maxRowsPerPage)
            });
        }
    });

    const handleGeneratePdf = async () => {
        setIsGenerating(true);

        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.top = '-9999px';
        tempContainer.style.left = '-9999px';
        document.body.appendChild(tempContainer);

        const root = createRoot(tempContainer);

        try {
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            for (let i = 0; i < pages.length; i++) {
                const pageData = pages[i];

                flushSync(() => {
                    root.render(
                        <Box
                            id="gl-pdf-render-target"
                            sx={{
                                width: '297mm', // A4 Landscape
                                minHeight: '210mm',
                                padding: '15mm 20mm 20mm 20mm',
                                bgcolor: 'white',
                                color: 'black',
                                fontFamily: '"MS Mincho", serif',
                                boxSizing: 'border-box'
                            }}
                        >
                            <Box display="flex" justifyContent="space-between" mb={2}>
                                <Typography variant="h5" fontWeight="bold">総勘定元帳 ({selectedYear}年)</Typography>
                                <Box textAlign="right">
                                    {businessName && <Typography variant="subtitle2" color="text.secondary">{businessName}</Typography>}
                                    <Typography variant="h6">
                                        勘定科目: {pageData.account.code} {pageData.account.name} ({pageData.pageIdx}/{pageData.totalPages})
                                    </Typography>
                                </Box>
                            </Box>
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid black', fontSize: '12px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid black' }}>
                                        <th style={{ padding: '6px', borderRight: '1px solid black', width: '10%' }}>日付</th>
                                        <th style={{ padding: '6px', borderRight: '1px solid black', width: '5%' }}>No.</th>
                                        <th style={{ padding: '6px', borderRight: '1px solid black', width: '20%' }}>相手科目</th>
                                        <th style={{ padding: '6px', borderRight: '1px solid black', width: '30%' }}>摘要</th>
                                        <th style={{ padding: '6px', borderRight: '1px solid black', width: '12%' }}>借方</th>
                                        <th style={{ padding: '6px', borderRight: '1px solid black', width: '12%' }}>貸方</th>
                                        <th style={{ padding: '6px', width: '11%' }}>残高</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageData.rows.map((r: any, rIdx: number) => (
                                        <tr key={rIdx} style={{ borderBottom: '1px solid black' }}>
                                            <td style={{ padding: '6px', borderRight: '1px solid black', textAlign: 'center' }}>{r.date}</td>
                                            <td style={{ padding: '6px', borderRight: '1px solid black', textAlign: 'center' }}>{r.no}</td>
                                            <td style={{ padding: '6px', borderRight: '1px solid black' }}>{r.oppName}</td>
                                            <td style={{ padding: '6px', borderRight: '1px solid black' }}>{r.desc}</td>
                                            <td style={{ padding: '6px', borderRight: '1px solid black', textAlign: 'right' }}>{r.debitAmount ? r.debitAmount.toLocaleString() : ''}</td>
                                            <td style={{ padding: '6px', borderRight: '1px solid black', textAlign: 'right' }}>{r.creditAmount ? r.creditAmount.toLocaleString() : ''}</td>
                                            <td style={{ padding: '6px', textAlign: 'right' }}>{r.currentBalance.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Box>
                    );
                });

                // Wait for paint and let GC kick in periodically
                await new Promise(resolve => setTimeout(resolve, 80));

                const element = tempContainer.querySelector('#gl-pdf-render-target') as HTMLElement;
                if (!element) continue;

                // Scale 1.5 instead of 2 significantly reduces RAM usage.
                const canvas = await html2canvas(element, { scale: 1.5 });
                // Use JPEG compression instead of PNG to vastly reduce PDF size and memory consumption
                const imgData = canvas.toDataURL('image/jpeg', 0.85);

                if (i > 0) pdf.addPage();

                const imgRatio = canvas.height / canvas.width;
                const pdfRatio = pdfHeight / pdfWidth;

                let finalW = pdfWidth;
                let finalH = pdfWidth * imgRatio;
                if (imgRatio > pdfRatio) {
                    finalH = pdfHeight;
                    finalW = pdfHeight / imgRatio;
                }

                pdf.addImage(imgData, 'JPEG', 0, 0, finalW, finalH);

                // Clear canvas from memory
                canvas.width = 0;
                canvas.height = 0;
            }

            pdf.save(`GeneralLedger_${selectedYear}.pdf`);
        } catch (error) {
            console.error("PDF generation failed", error);
        } finally {
            root.unmount();
            document.body.removeChild(tempContainer);
            setIsGenerating(false);
        }
    };

    try {
        if (!activeAccounts || activeAccounts.length === 0) return null;

        return (
            <React.Fragment>
                <Button
                    variant="outlined"
                    startIcon={isGenerating ? <CircularProgress size={20} /> : <PictureAsPdfIcon />}
                    onClick={handleGeneratePdf}
                    disabled={isGenerating}
                    sx={{ borderRadius: 8 }}
                >
                    総勘定元帳PDF{isGenerating ? ' 生成中...' : ''}
                </Button>
            </React.Fragment>
        );
    } catch (e: any) {
        return <Typography color="error">GL PDF Export Error: {e.message}</Typography>;
    }
};
