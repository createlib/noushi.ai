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
            (t.debits || []).some((d: any) => String(d.code) === String(account.code)) ||
            (t.credits || []).some((c: any) => String(c.code) === String(account.code))
        );
    }).sort((a, b) => a.code - b.code);

    // Build pages
    const pages: any[] = [];

    activeAccounts.forEach(account => {
        const relatedTransactions = transactions.filter(t =>
            (t.debits || []).some((d: any) => String(d.code) === String(account.code)) ||
            (t.credits || []).some((c: any) => String(c.code) === String(account.code))
        );

        const kishuRaw = balancesKishu[account.code] || 0;
        const accountKishu = account.type === 'debit' ? kishuRaw : -kishuRaw;

        let currentBalance = accountKishu;

        const transactionRows = relatedTransactions.flatMap((t, tIndex) => {
            const debits = (t.debits || []).map((d: any) => ({ ...d }));
            const credits = (t.credits || []).map((c: any) => ({ ...c }));
            
            const pairs: any[] = [];
            let dIdx = 0;
            let cIdx = 0;
            
            while (dIdx < debits.length && cIdx < credits.length) {
                const d = debits[dIdx];
                const c = credits[cIdx];
                
                const matchAmount = Math.min(d.amount, c.amount);
                if (matchAmount > 0) {
                    pairs.push({ debitCode: d.code, creditCode: c.code, amount: matchAmount });
                }
                
                d.amount -= matchAmount;
                c.amount -= matchAmount;
                
                if (Math.abs(d.amount) < 0.001) dIdx++;
                if (Math.abs(c.amount) < 0.001) cIdx++;
            }
            
            // Handle any imbalanced loose ends securely
            while (dIdx < debits.length) {
                if (debits[dIdx].amount > 0.001) pairs.push({ debitCode: debits[dIdx].code, creditCode: 999, amount: debits[dIdx].amount });
                dIdx++;
            }
            while (cIdx < credits.length) {
                if (credits[cIdx].amount > 0.001) pairs.push({ debitCode: 999, creditCode: credits[cIdx].code, amount: credits[cIdx].amount });
                cIdx++;
            }
            
            const generatedRows: any[] = [];
            
            pairs.forEach(p => {
                const isDebit = String(p.debitCode) === String(account.code);
                const isCredit = String(p.creditCode) === String(account.code);
                
                if (isDebit && isCredit) {
                    generatedRows.push({ date: t.date, no: tIndex + 1, isDebit: true, isCredit: true, debitAmount: p.amount, creditAmount: p.amount, oppCode: String(account.code), oppName: '同一科目振替', desc: t.description || '' });
                } else if (isDebit) {
                    generatedRows.push({ date: t.date, no: tIndex + 1, isDebit: true, isCredit: false, debitAmount: p.amount, creditAmount: 0, oppCode: String(p.creditCode), oppName: accounts.find(a => String(a.code) === String(p.creditCode))?.name || '不明', desc: t.description || '' });
                } else if (isCredit) {
                    generatedRows.push({ date: t.date, no: tIndex + 1, isDebit: false, isCredit: true, debitAmount: 0, creditAmount: p.amount, oppCode: String(p.debitCode), oppName: accounts.find(a => String(a.code) === String(p.debitCode))?.name || '不明', desc: t.description || '' });
                }
            });
            
            return generatedRows;
        });

        transactionRows.forEach(r => {
            if (r.isDebit) currentBalance += (account.type === 'debit' ? r.debitAmount : -r.debitAmount);
            if (r.isCredit) currentBalance += (account.type === 'credit' ? r.creditAmount : -r.creditAmount);
            r.currentBalance = currentBalance;
        });

        const rows = transactionRows.map(r => ({
            date: r.date,
            no: r.no,
            oppCode: r.oppCode,
            oppName: r.oppName.length > 15 ? r.oppName.substring(0, 15) + '...' : r.oppName,
            debitAmount: r.debitAmount,
            creditAmount: r.creditAmount,
            currentBalance: r.currentBalance,
            desc: r.desc
        }));

        // Add Kishu row
        const allRows = [
            { date: '', no: '', oppCode: '', oppName: '前年度繰越', debitAmount: '', creditAmount: '', currentBalance: accountKishu, desc: '' },
            ...rows
        ];

        // Chunk into pages dynamically based on estimated height
        let currentPageRows: any[] = [];
        let currentHeight = 0;
        const USABLE_HEIGHT = 520; // safe max pixels for landscape A4

        const accountPages: any[] = [];

        allRows.forEach(r => {
            const descLines = r.desc ? Math.ceil(String(r.desc).length / 24) : 1;
            const oppLines = r.oppName ? Math.ceil(String(r.oppName).length / 16) : 1;
            const lines = Math.max(1, descLines, oppLines);
            const rowHeight = 12 + 18 * lines; // 12px padding + 18px line-height

            if (currentHeight + rowHeight > USABLE_HEIGHT && currentPageRows.length > 0) {
                accountPages.push({ account, rows: currentPageRows });
                currentPageRows = [];
                currentHeight = 0;
            }

            currentPageRows.push(r);
            currentHeight += rowHeight;
        });

        if (currentPageRows.length > 0) {
            accountPages.push({ account, rows: currentPageRows });
        }

        accountPages.forEach((p, idx) => {
            p.pageIdx = idx + 1;
            p.totalPages = accountPages.length;
            pages.push(p);
        });
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

                const finalW = pdfWidth;
                const finalH = pdfWidth * imgRatio;

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
                    fullWidth
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
