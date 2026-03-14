import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

export const JournalPrintExporter: React.FC<{ transactions: any[], accounts: any[], selectedYear: number }> = ({ transactions, accounts, selectedYear }) => {
    const settings = useLiveQuery(() => db.settings.get(1), []);
    const businessName = settings?.businessName || '';

    const pages: any[] = [];
    const maxRowsPerPage = 18;

    const rows: any[] = [];
    let no = 1;

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

    for (let i = 0; i < rows.length; i += maxRowsPerPage) {
        pages.push({
            pageIdx: Math.floor(i / maxRowsPerPage) + 1,
            totalPages: Math.ceil(rows.length / maxRowsPerPage),
            rows: rows.slice(i, i + maxRowsPerPage)
        });
    }

    const handlePrint = () => {
        const printContent = document.getElementById('journal-print-area');
        if (!printContent) return;

        const originalContents = document.body.innerHTML;
        document.body.innerHTML = printContent.innerHTML;

        window.print();

        document.body.innerHTML = originalContents;
        window.location.reload();
    };

    if (!transactions || transactions.length === 0 || pages.length === 0) return null;

    return (
        <React.Fragment>
            <Button
                variant="contained"
                sx={{ bgcolor: 'white', color: 'error.main', border: '1px solid', borderColor: 'error.main', borderRadius: 8, '&:hover': { bgcolor: '#fef2f2' } }}
                startIcon={<PrintIcon color="error" />}
                onClick={handlePrint}
                disableElevation
            >
                仕訳帳PDF (超高速印刷)
            </Button>

            <Box id="journal-print-area" sx={{ display: 'none' }}>
                <style>
                    {`
                    @media print {
                        @page { size: A4 portrait; margin: 15mm; }
                        body { margin: 0; padding: 0; font-family: "MS Mincho", serif; color: black; }
                        .print-page { page-break-after: always; width: 100%; box-sizing: border-box; }
                        .print-page:last-child { page-break-after: auto; }
                        th { background-color: #eff6ff !important; color: #1e3a8a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                    `}
                </style>

                {pages.map((pageData, index) => (
                    <Box key={index} className="print-page">
                        <Box display="flex" justifyContent="space-between" alignItems="flex-end" mb={2}>
                            <Typography variant="h5" fontWeight="bold" color="#1e3a8a">仕訳帳 ({selectedYear}年)</Typography>
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
                ))}
            </Box>
        </React.Fragment>
    );
};
