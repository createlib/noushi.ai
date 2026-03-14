import React, { useRef, useState } from 'react';
import { Box, Typography, Button, Paper, Alert, Stack, CircularProgress } from '@mui/material';
import { UploadFile, Download } from '@mui/icons-material';
import { useLiveQuery } from 'dexie-react-hooks';
import dayjs from 'dayjs';

import { db, type Account } from '../db/db';

export default function CSVImport() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const accounts = useLiveQuery(() => db.accounts.toArray()) || [];

    const handleDownloadTemplate = () => {
        const headers = ["日付", "借方勘定科目", "借方金額", "貸方勘定科目", "貸方金額", "摘要"];
        const csvContent = headers.join(",") + "\n" + "2024/01/01,普通預金,1000,売上（収入）,1000,システム開発費";

        const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "noushi_import_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const findAccountCode = (accList: Account[], searchStr: string): number => {
        if (!searchStr) return 9999;
        const cleanedStr = searchStr.trim();
        // Try strict code match first
        const byCode = accList.find(a => String(a.code) === cleanedStr || String(a.id) === cleanedStr);
        if (byCode) return byCode.code;
        // Try name match
        const byName = accList.find(a => a.name === cleanedStr);
        if (byName) return byName.code;

        return 9999; // Fallback to unknown
    };

    const parseCSVLine = (line: string): string[] => {
        // Handle basic CSV parsing including quotes
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(cur);
                cur = '';
            } else {
                cur += char;
            }
        }
        result.push(cur);
        return result;
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setSuccessMsg('');
        setErrorMsg('');
        setIsProcessing(true);

        try {
            const text = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsText(file, 'Shift_JIS'); // Attempt Shift_JIS first for Excel compatibility in JP
            });

            // If parsed text yields gibberish (mojibake) due to actual UTF-8 file, re-read. This is a very rough heuristic.
            let finalText = text;
            if (text.includes('')) {
                finalText = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsText(file, 'UTF-8');
                });
            }

            const lines = finalText.split(/\r?\n/).filter(line => line.trim().length > 0);

            if (lines.length === 0) {
                throw new Error("CSVファイルが空です");
            }

            let startIndex = 0;
            // Check if first line is a header
            if (lines[0].includes('日付') || lines[0].includes('借方')) {
                startIndex = 1;
            }

            const journalsToInsert: any[] = [];
            const linesToInsert: any[] = [];
            let unknownCount = 0;
            let successCount = 0;
            const now = Date.now();

            for (let i = startIndex; i < lines.length; i++) {
                const row = parseCSVLine(lines[i]);
                if (row.length < 5) continue; // Skip malformed trailing lines

                const rawDate = row[0]?.trim() || '';
                const rawDebitAcc = row[1]?.trim() || '';
                const rawDebitAmt = row[2]?.replace(/,/g, '').trim() || '0';
                const rawCreditAcc = row[3]?.trim() || '';
                const rawCreditAmt = row[4]?.replace(/,/g, '').trim() || '0';
                const rawDesc = row[5]?.trim() || '';

                // Date parsing
                let parsedDate = dayjs().format('YYYY-MM-DD');
                if (rawDate) {
                    const d = dayjs(rawDate.replace(/\//g, '-'));
                    if (d.isValid()) {
                        parsedDate = d.format('YYYY-MM-DD');
                    }
                }

                const debitCode = findAccountCode(accounts, rawDebitAcc);
                const creditCode = findAccountCode(accounts, rawCreditAcc);
                const debitAmt = parseInt(rawDebitAmt, 10) || 0;
                const creditAmt = parseInt(rawCreditAmt, 10) || 0;

                if (debitCode === 9999 || creditCode === 9999) {
                    unknownCount++;
                }

                const journalId = crypto.randomUUID();
                journalsToInsert.push({
                    id: journalId,
                    date: parsedDate,
                    description: rawDesc,
                    status: 'posted',
                    createdAt: now,
                    updatedAt: now
                });

                if (debitAmt > 0) {
                    linesToInsert.push({
                        id: crypto.randomUUID(),
                        journal_id: journalId,
                        account_id: debitCode,
                        debit: debitAmt,
                        credit: 0
                    });
                }

                if (creditAmt > 0) {
                    linesToInsert.push({
                        id: crypto.randomUUID(),
                        journal_id: journalId,
                        account_id: creditCode,
                        debit: 0,
                        credit: creditAmt
                    });
                }

                successCount++;
            }

            if (journalsToInsert.length > 0) {
                await db.transaction('rw', [db.journals, db.journal_lines], async () => {
                    await db.journals.bulkAdd(journalsToInsert);
                    await db.journal_lines.bulkAdd(linesToInsert);
                });

                // Trigger background sync
                const currentSettings = await db.settings.get(1);
                if (currentSettings?.useFirebaseSync) {
                    const { auth } = await import('../firebase');
                    if (auth.currentUser) {
                        try {
                            const { forceUploadSync } = await import('../services/sync_service');
                            forceUploadSync(auth.currentUser.uid).catch(console.error);
                        } catch (e) {
                            console.error('Background sync failed', e);
                        }
                    }
                }

                let finalMsg = `${successCount}件の仕訳を取り込みました。`;
                if (unknownCount > 0) {
                    finalMsg += `（うち、勘定科目が一致せず「不明」として登録された項目が ${unknownCount}件 あります）`;
                }
                setSuccessMsg(finalMsg);
            } else {
                setErrorMsg("取り込める有効なデータ行が見つかりませんでした。列の構成を確認してください。");
            }

        } catch (e: any) {
            console.error(e);
            setErrorMsg(e.message || "CSVの読み込み中にエラーが発生しました。");
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <Box p={{ xs: 1, sm: 2 }} pt={2}>
            <Paper elevation={0} sx={{ p: 4, mb: 4, borderRadius: 4, border: '1px solid', borderColor: 'divider', bgcolor: '#ffffff' }}>
                <Box textAlign="center" mb={4}>
                    <Typography variant="h5" fontWeight="bold" color="primary.main" gutterBottom>
                        一括CSVインポート
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        AIによる推論を行わず、指定のフォーマットのCSVをそのまま仕訳帳に一括登録します。
                    </Typography>
                </Box>

                <Box mb={4} p={3} bgcolor="#f8fafc" borderRadius={2} border="1px solid #e2e8f0">
                    <Typography variant="subtitle1" fontWeight="bold" mb={2}>必要なCSVの列構成</Typography>
                    <Stack direction="row" flexWrap="wrap" gap={1} mb={2}>
                        {['日付', '借方勘定科目', '借方金額', '貸方勘定科目', '貸方金額', '摘要'].map((col, idx) => (
                            <Box key={idx} px={1.5} py={0.5} bgcolor="white" border="1px solid #cbd5e1" borderRadius={1} fontSize="0.875rem" fontWeight={500}>
                                {idx + 1}. {col}
                            </Box>
                        ))}
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        ※1行目が「日付」等のヘッダー名になっている場合は自動スキップされます。<br />
                        ※勘定科目はDBに登録されている「科目コード」または「科目名」と完全一致する必要があります。一致しない場合は強制的に「不明」として取り込まれます。<br />
                        ※金額のカンマ(,)は自動で除去されます。
                    </Typography>
                    <Button variant="outlined" size="small" startIcon={<Download />} onClick={handleDownloadTemplate}>
                        テンプレートCSVをダウンロード
                    </Button>
                </Box>

                {errorMsg && (
                    <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>
                )}

                {successMsg && (
                    <Alert severity="success" sx={{ mb: 3 }}>
                        {successMsg.includes('不明') ? (
                            <>
                                {successMsg.split('（')[0]}<br />
                                <strong style={{ color: '#b45309' }}>（{successMsg.split('（')[1]}</strong>
                            </>
                        ) : successMsg}
                    </Alert>
                )}

                <Box textAlign="center">
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={isProcessing ? <CircularProgress size={24} color="inherit" /> : <UploadFile />}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessing}
                        sx={{ borderRadius: 8, px: 6, py: 1.5, fontSize: '1.1rem' }}
                        disableElevation
                    >
                        {isProcessing ? '処理中...' : 'CSVファイルを選択してインポート'}
                    </Button>
                    <input
                        type="file"
                        accept=".csv,text/csv"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                </Box>
            </Paper>
        </Box>
    );
}
