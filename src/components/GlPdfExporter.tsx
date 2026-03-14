import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';

export const GlPrintExporter: React.FC<{ accounts: any[], transactions: any[], selectedYear: number, balancesKishu: Record<number, number> }> = ({ accounts, transactions, selectedYear, balancesKishu }) => {
    const settings = useLiveQuery(() => db.settings.get(1), []);
    const businessName = settings?.businessName || '';

    const activeAccounts = accounts.filter(account => {
        return transactions.some(t =>
            (t.debits || []).some((d: any) => d.code === account.code) ||
            (t.credits || []).some((c: any) => c.code === account.code)
        );
    }).sort((a, b) => a.code - b.code);

    const pages: any[] = [];
    const maxRowsPerPage = 20;

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
            if (isDebit && (t.credits || []).length === 1) {
                oppName = accounts.find(a => a.code === t.credits[0].code)?.name || '不明';
            } else if (isCredit && (t.debits || []).length === 1) {
                oppName = accounts.find(a => a.code === t.debits[0].code)?.name || '不明';
            }

            return {
                date: t.date,
                no: index + 1,
                oppName,
                debitAmount,
                creditAmount,
                currentBalance,
                desc: t.description || ''
            };
        });

        const allRows = [
            { date: '', no: '', oppName: '前年度繰越', debitAmount: '', creditAmount: '', currentBalance: accountKishu, desc: '' },
            ...rows
        ];

        for (let i = 0; i < allRows.length; i += maxRowsPerPage) {
            pages.push({
                account,
                pageIdx: Math.floor(i / maxRowsPerPage) + 1,
                totalPages: Math.ceil(allRows.length / maxRowsPerPage),
                rows: allRows.slice(i, i + maxRowsPerPage)
            });
        }
    });

    const handlePrint = () => {
        const printContent = document.getElementById('gl-print-area');
        if (!printContent) return;

        const originalContents = document.body.innerHTML;
        document.body.innerHTML = printContent.innerHTML;

        window.print();

        document.body.innerHTML = originalContents;
        window.location.reload(); // Re-hydrate React
    };

    if (pages.length === 0) return null;

    return (
        <React.Fragment>
            <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                sx={{ borderRadius: 8 }}
            >
                総勘定元帳PDF (超高速印刷)
            </Button>

            {/* This area is hidden in the normal UI but becomes the exact body content on print */}
            <Box id="gl-print-area" sx={{ display: 'none' }}>
                <style>
                    {`
                    @media print {
                        @page { size: A4 landscape; margin: 15mm; }
                        body { margin: 0; padding: 0; font-family: "MS Mincho", serif; }
                        .print-page { page-break-after: always; width: 100%; box-sizing: border-box; }
                        .print-page:last-child { page-break-after: auto; }
                        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                    `}
                </style>
                {pages.map((pageData, index) => (
                    <Box key={index} className="print-page">
                        <Box display="flex" justifyContent="space-between" mb={2}>
                            <Typography variant="h5" fontWeight="bold">総勘定元帳 ({selectedYear}年)</Typography>
                            <Box textAlign="right">
                                {businessName && <Typography variant="subtitle2" color="text.secondary">{businessName}</Typography>}
                                <Typography variant="h6">
                                    勘定科目: {pageData.account.code} {pageData.account.name} ({pageData.pageIdx}/{pageData.totalPages})
                                </Typography>
                            </Box>
                        </Box>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid black', fontSize: '13px' }}>
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
                ))}
            </Box>
        </React.Fragment>
    );
};
