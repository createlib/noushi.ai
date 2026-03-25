import React, { useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

export const JournalPdfExporter: React.FC<{ transactions: any[], accounts: any[], selectedYear: number }> = ({ transactions, accounts, selectedYear }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const settings = useLiveQuery(() => db.settings.get(1), []);
    const businessName = settings?.businessName || '';

    // Build pages
    const pages: any[] = [];
    const maxRowsPerPage = 14; // Fit portrait A4 without bottom crop

    // Prepare flat rows from transactions
    const rows: any[] = [];
    let no = 1;

    // Sort transactions by date ascending for the journal
    const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    sortedTransactions.forEach(t => {
        const tDebits = t.debits || [];
        const tCredits = t.credits || [];
        const maxLines = Math.max(tDebits.length, tCredits.length, 1);

        for (let i = 0; i < maxLines; i++) {
            const d = tDebits[i];
            const c = tCredits[i];

            const debName = d ? (accounts.find(a => String(a.code) === String(d.code))?.name || '不明') : '';
            const creName = c ? (accounts.find(a => String(a.code) === String(c.code))?.name || '不明') : '';

            rows.push({
                date: i === 0 ? t.date : '',
                no: i === 0 ? no++ : '',
                debName,
                debAmount: d ? d.amount : '',
                creName,
                creAmount: c ? c.amount : '',
                desc: i === 0 ? t.description : ''
            });
        }
    });

    // Chunk into pages
    for (let i = 0; i < rows.length; i += maxRowsPerPage) {
        pages.push({
            pageIdx: Math.floor(i / maxRowsPerPage) + 1,
            totalPages: Math.ceil(rows.length / maxRowsPerPage),
            rows: rows.slice(i, i + maxRowsPerPage)
        });
    }

    const handleGeneratePdf = async () => {
        setIsGenerating(true);
        // Create a temporary detached container for rendering single pages
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.top = '-9999px';
        tempContainer.style.left = '-9999px';
        document.body.appendChild(tempContainer);

        const root = createRoot(tempContainer);

        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();

            for (let i = 0; i < pages.length; i++) {
                const pageData = pages[i];

                // Synchronously render exactly one page into the DOM
                flushSync(() => {
                    root.render(
                        <Box
                            id="pdf-render-target"
                            sx={{
                                width: '210mm', // A4 Portrait
                                minHeight: '297mm',
                                padding: '15mm 20mm 20mm 20mm', // Safe margins
                                bgcolor: 'white',
                                color: 'black',
                                fontFamily: '"MS Mincho", serif',
                                boxSizing: 'border-box'
                            }}
                        >
                            <Box display="flex" justifyContent="space-between" alignItems="flex-end" mb={2}>
                                <Typography variant="h4" fontWeight="bold" color="#1e3a8a">仕訳帳 ({selectedYear}年)</Typography>
                                <Box textAlign="right">
                                    {businessName && <Typography variant="subtitle1" fontWeight="bold" color="#475569">{businessName}</Typography>}
                                    <Typography variant="body1" color="text.secondary">
                                        ページ: {pageData.pageIdx} / {pageData.totalPages}
                                    </Typography>
                                </Box>
                            </Box>

                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #1e3a8a', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#eff6ff', borderBottom: '2px solid #1e3a8a' }}>
                                        <th style={{ padding: '8px', borderRight: '1px solid #93c5fd', width: '14%', color: '#1e3a8a', whiteSpace: 'nowrap' }}>日付</th>
                                        <th style={{ padding: '8px', borderRight: '1px solid #93c5fd', width: '5%', color: '#1e3a8a' }}>No.</th>
                                        <th style={{ padding: '8px', borderRight: '1px solid #93c5fd', width: '16%', color: '#1e3a8a' }}>借方科目</th>
                                        <th style={{ padding: '8px', borderRight: '1px solid #93c5fd', width: '13%', color: '#1e3a8a' }}>借方金額</th>
                                        <th style={{ padding: '8px', borderRight: '1px solid #93c5fd', width: '16%', color: '#1e3a8a' }}>貸方科目</th>
                                        <th style={{ padding: '8px', borderRight: '1px solid #93c5fd', width: '13%', color: '#1e3a8a' }}>貸方金額</th>
                                        <th style={{ padding: '8px', width: '23%', color: '#1e3a8a' }}>摘要</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageData.rows.map((r: any, rIdx: number) => {
                                        const isNewTransaction = r.no !== '';
                                        const bgColor = isNewTransaction && r.no % 2 === 0 ? '#f8fafc' : 'white';
                                        const topBorder = isNewTransaction ? '1px solid #93c5fd' : 'none';

                                        return (
                                            <tr key={rIdx} style={{ backgroundColor: bgColor, borderTop: topBorder }}>
                                                <td style={{ padding: '8px', borderRight: '1px solid #93c5fd', textAlign: 'center' }}>{r.date}</td>
                                                <td style={{ padding: '8px', borderRight: '1px solid #93c5fd', textAlign: 'center', color: '#64748b' }}>{r.no}</td>
                                                <td style={{ padding: '8px', borderRight: '1px solid #93c5fd' }}>{r.debName}</td>
                                                <td style={{ padding: '8px', borderRight: '1px solid #93c5fd', textAlign: 'right', color: '#059669', fontWeight: r.debAmount ? 'bold' : 'normal' }}>
                                                    {r.debAmount ? r.debAmount.toLocaleString() : ''}
                                                </td>
                                                <td style={{ padding: '8px', borderRight: '1px solid #93c5fd' }}>{r.creName}</td>
                                                <td style={{ padding: '8px', borderRight: '1px solid #93c5fd', textAlign: 'right', color: '#ea580c', fontWeight: r.creAmount ? 'bold' : 'normal' }}>
                                                    {r.creAmount ? r.creAmount.toLocaleString() : ''}
                                                </td>
                                                <td style={{ padding: '8px', color: '#334155' }}>{r.desc}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </Box>
                    );
                });

                // Allow DOM to paint thoroughly and give GC a moment
                await new Promise(resolve => setTimeout(resolve, 80));

                const element = tempContainer.querySelector('#pdf-render-target') as HTMLElement;
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

            pdf.save(`Journal_${selectedYear}.pdf`);
        } catch (error) {
            console.error("PDF generation failed", error);
        } finally {
            root.unmount();
            document.body.removeChild(tempContainer);
            setIsGenerating(false);
        }
    };

    try {
        if (!transactions || transactions.length === 0) return null;

        return (
            <React.Fragment>
                <Button
                    fullWidth
                    variant="contained"
                    sx={{ bgcolor: 'white', color: 'error.main', border: '1px solid', borderColor: 'error.main', borderRadius: 8, '&:hover': { bgcolor: '#fef2f2' } }}
                    startIcon={isGenerating ? <CircularProgress size={20} color="error" /> : <PictureAsPdfIcon />}
                    onClick={handleGeneratePdf}
                    disabled={isGenerating}
                    disableElevation
                >
                    仕訳帳 (PDF){isGenerating ? ' 生成中...' : ''}
                </Button>
            </React.Fragment>
        );
    } catch (e: any) {
        return <Typography color="error">Journal PDF Export Error: {e.message}</Typography>;
    }
};
