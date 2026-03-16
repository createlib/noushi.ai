import React from 'react';
import { Box, Typography, Paper, Divider, Button, Stack } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useLiveQuery } from 'dexie-react-hooks';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';

import { db } from '../db/db';
import { useFiscalYear } from '../contexts/FiscalYearContext';
import { PdfExporter } from '../components/PdfExporter';
import { GlPdfExporter } from '../components/GlPdfExporter';
import { JournalPdfExporter } from '../components/JournalPdfExporter';

export default function Report() {
    const { selectedYear } = useFiscalYear();

    const endStr = `${selectedYear}-12-31T23:59:59`;

    // 過去全ての期のデータ（期首残高計算用）と、当期のデータを取得（翌期以降のデータは読み込まない）
    const allJournalsLive = useLiveQuery(() => db.journals.where('date').belowOrEqual(endStr).toArray(), [selectedYear]);

    const allLinesLive = useLiveQuery(async () => {
        const j = await db.journals.where('date').belowOrEqual(endStr).toArray();
        const ids = j.map(x => x.id);
        if (ids.length === 0) return [];
        return db.journal_lines.where('journal_id').anyOf(ids).toArray();
    }, [selectedYear]);
    const accounts = useLiveQuery(() => db.accounts.toArray(), []);

    const allTransactions = React.useMemo(() => {
        if (!allJournalsLive || !allLinesLive) return null;

        const linesByJournalId = new Map<string, any[]>();
        for (const line of allLinesLive) {
            let list = linesByJournalId.get(line.journal_id);
            if (!list) {
                list = [];
                linesByJournalId.set(line.journal_id, list);
            }
            list.push(line);
        }

        return allJournalsLive.filter(j => !j.deletedAt).map(j => {
            const lines = linesByJournalId.get(j.id) || [];
            return {
                id: j.id,
                date: j.date,
                description: j.description,
                debits: lines.filter(l => l.debit > 0).map(l => ({ code: l.account_id, amount: l.debit })),
                credits: lines.filter(l => l.credit > 0).map(l => ({ code: l.account_id, amount: l.credit }))
            };
        });
    }, [allJournalsLive, allLinesLive]);

    const transactions = allTransactions?.filter(t => t.date && t.date.startsWith(String(selectedYear)));

    const [renderError, setRenderError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!allTransactions || !accounts) return;
        try {
            // Test heavy compute just to catch errors, normally sync compute is fine.
        } catch (e: any) {
            setRenderError(e.message);
        }
    }, [allTransactions, accounts, selectedYear]);

    if (!allTransactions || !accounts || !transactions) return <Typography p={2}>Loading...</Typography>;

    const accountBalancesKishu: Record<number, number> = {};
    const accountBalancesCurrent: Record<number, number> = {};
    const accountBalancesKimatsu: Record<number, number> = {};

    accounts.forEach(a => {
        accountBalancesKishu[a.code] = 0;
        accountBalancesCurrent[a.code] = 0;
        accountBalancesKimatsu[a.code] = 0;
    });

    if (renderError) {
        return <Box p={3}><Typography color="error">Error in Report rendering: {renderError}</Typography></Box>;
    }

    const isPLAccount = (a: any) => a.type === 'revenue' || a.type === 'expense';
    const isBSAccount = (a: any) => a.type === 'asset' || a.type === 'liability' || a.type === 'equity';
    const isDebitAccount = (a: any) => a.type === 'asset' || a.type === 'expense';
    const isCreditAccount = (a: any) => a.type === 'liability' || a.type === 'equity' || a.type === 'revenue';

    try {
        const pastTransactionsByYear: Record<string, any[]> = {};

        const isOpeningBalanceEntry = (t: any) => {
            const hasKeyword = (t.description || '').includes('期首') || (t.description || '').includes('開始') || (t.description || '').includes('繰越');
            const hasCapitalRow = (t.debits || []).some((d: any) => d.code === 400) || (t.credits || []).some((c: any) => c.code === 400);
            return hasKeyword || hasCapitalRow;
        }

        allTransactions.forEach(t => {
            if (!t.date) return;
            const tYear = t.date.substring(0, 4);
            const sYear = String(selectedYear);


            if (tYear < sYear) {
                if (!pastTransactionsByYear[tYear]) pastTransactionsByYear[tYear] = [];
                pastTransactionsByYear[tYear].push(t);
            } else if (tYear === sYear && isOpeningBalanceEntry(t)) {
                // 当期の期首設定仕訳: current には含めず、別途 kishu の残高に直接加算する
                let capitalCode = 300;
                const capitalAcct = accounts.find(a => a.name.includes("元入金"));
                if (capitalAcct) capitalCode = capitalAcct.code;
                
                (t.debits || []).forEach((d: any) => {
                    if (d.code === 291 || d.code === 390 || accounts.find(a => a.code === d.code)?.name.includes("事業主")) {
                        accountBalancesKishu[capitalCode] += d.amount; // 借方(Debit)は通常通りプラス加算 (表示時に負債計として反転されるため)
                    } else {
                        accountBalancesKishu[d.code] += d.amount;
                    }
                });
                (t.credits || []).forEach((c: any) => {
                    if (c.code === 291 || c.code === 390 || accounts.find(a => a.code === c.code)?.name.includes("事業主")) {
                        accountBalancesKishu[capitalCode] -= c.amount; // 貸方(Credit)は通常通りマイナス加算
                    } else {
                        accountBalancesKishu[c.code] -= c.amount;
                    }
                });
            } else if (tYear === sYear) {
                // 通常の当期取引
                (t.debits || []).forEach((d: any) => {
                    accountBalancesCurrent[d.code] += d.amount;
                });
                (t.credits || []).forEach((c: any) => {
                    accountBalancesCurrent[c.code] -= c.amount;
                });
            }
        });

        const pastYears = Object.keys(pastTransactionsByYear).sort();
        pastYears.forEach(year => {
            const txs = pastTransactionsByYear[year];
            txs.forEach(t => {
                (t.debits || []).forEach((d: any) => { accountBalancesKishu[d.code] += d.amount; });
                (t.credits || []).forEach((c: any) => { accountBalancesKishu[c.code] -= c.amount; });
            });

            let deltaCapital = 0;

            accounts.forEach(a => {
                if (isPLAccount(a)) {
                    deltaCapital += accountBalancesKishu[a.code];
                    accountBalancesKishu[a.code] = 0;
                } else if (a.code === 210 || a.name.includes("事業主貸")) {
                    deltaCapital += accountBalancesKishu[a.code];
                    accountBalancesKishu[a.code] = 0;
                } else if (a.code === 310 || a.name.includes("事業主借")) {
                    deltaCapital += accountBalancesKishu[a.code];
                    accountBalancesKishu[a.code] = 0;
                }
            });

            let capitalCode = 300;
            const capitalAcct = accounts.find(a => a.name.includes("元入金"));
            if (capitalAcct) capitalCode = capitalAcct.code;
            if (accounts.some(a => a.code === capitalCode)) {
                accountBalancesKishu[capitalCode] += deltaCapital;
            }
        });



        accounts.forEach(a => {
            if (isBSAccount(a)) {
                accountBalancesKimatsu[a.code] = accountBalancesKishu[a.code] + accountBalancesCurrent[a.code];
            } else {
                accountBalancesKimatsu[a.code] = accountBalancesCurrent[a.code];
            }
        });

        const getFilteredAccounts = (reportType: 'PL' | 'BS', accNormalBal: 'debit' | 'credit') => {
            return accounts
                .filter(a => (reportType === 'PL' ? isPLAccount(a) : isBSAccount(a)) && (accNormalBal === 'debit' ? isDebitAccount(a) : isCreditAccount(a)))
                .map(a => {
                    const isDebit = isDebitAccount(a);

                    const rawKishu = accountBalancesKishu[a.code] || 0;
                    const balanceKishu = isDebit ? rawKishu : -rawKishu;

                    const rawCurrent = accountBalancesCurrent[a.code] || 0;
                    const balanceCurrent = isDebit ? rawCurrent : -rawCurrent;

                    const rawKimatsu = accountBalancesKimatsu[a.code] || 0;
                    const balanceKimatsu = isDebit ? rawKimatsu : -rawKimatsu;

                    const balance = reportType === 'BS' ? balanceKimatsu : balanceCurrent;

                    return { ...a, balance, balanceKishu, balanceKimatsu, balanceCurrent, type: (isDebit ? 'debit' : 'credit') as 'debit' | 'credit', report: reportType as 'PL' | 'BS' };
                })
                .filter(a => a.balance !== 0 || (reportType === 'BS' && a.balanceKishu !== 0));
        };

        const plExpenses = getFilteredAccounts('PL', 'debit');
        const plIncomes = getFilteredAccounts('PL', 'credit');

        const bsAssets = getFilteredAccounts('BS', 'debit');
        const bsLiabilities = getFilteredAccounts('BS', 'credit');

        // 売上関係
        const salesCodes = [500, 501, 580, 581, 583, 590, 5999]; // 一般売上
        const agrSalesCodes = [5100, 5101, 5102]; // 農業売上
        const reSalesCodes = [5200, 5201, 5202]; // 不動産売上

        const plSales = plIncomes.filter(a => salesCodes.includes(a.code));
        const plAgrSales = plIncomes.filter(a => agrSalesCodes.includes(a.code));
        const plRESales = plIncomes.filter(a => reSalesCodes.includes(a.code));
        const plOtherIncome = plIncomes.filter(a => !salesCodes.includes(a.code) && !agrSalesCodes.includes(a.code) && !reSalesCodes.includes(a.code) && a.code !== 650 && a.code !== 690);

        // 売上原価 (一般)
        const kishuAssets = plExpenses.filter(a => a.code === 600 || a.code === 605);
        const shiireAssets = plExpenses.filter(a => a.code === 610);
        const kimatsuAssets = accounts.filter(a => a.code === 650 || a.code === 690).map(a => {
            const bal = accountBalancesCurrent[a.code] || 0;
            return { ...a, balance: -bal };
        }).filter(a => a.balance !== 0);

        const sumKishu = kishuAssets.reduce((sum, a) => sum + a.balance, 0);
        const sumShiire = shiireAssets.reduce((sum, a) => sum + a.balance, 0);
        const sumKimatsu = kimatsuAssets.reduce((sum, a) => sum + a.balance, 0);
        const cogs = sumKishu + sumShiire - sumKimatsu;

        // 経費分類
        const agrExpenseCodes = [8000, 8001, 8002, 8003, 8004, 8005, 8006, 8007, 8008, 8009, 8010];
        const reExpenseCodes = [9000, 9001, 9002, 9003, 9004];

        const plAgrExpenses = plExpenses.filter(a => agrExpenseCodes.includes(a.code));
        const plREExpenses = plExpenses.filter(a => reExpenseCodes.includes(a.code));
        const plTrueExpenses = plExpenses.filter(a =>
            a.code !== 600 && a.code !== 605 && a.code !== 610 &&
            a.code !== 6498 && a.code !== 6499 &&
            !agrExpenseCodes.includes(a.code) &&
            !reExpenseCodes.includes(a.code)
        );

        // 一般事業の計算
        const hasGeneralBiz = plSales.length > 0 || plOtherIncome.length > 0 || plTrueExpenses.length > 0 || cogs !== 0;
        const totalSales = plSales.reduce((sum, a) => sum + a.balance, 0) + plOtherIncome.reduce((sum, a) => sum + a.balance, 0);
        const grossProfit = totalSales - cogs;
        const totalTrueExpense = plTrueExpenses.reduce((sum, a) => sum + a.balance, 0);
        const generalNetIncome = grossProfit - totalTrueExpense;

        // 農業所得の計算
        const hasAgrBiz = plAgrSales.length > 0 || plAgrExpenses.length > 0;
        const totalAgrSales = plAgrSales.reduce((sum, a) => sum + a.balance, 0);
        const totalAgrExpense = plAgrExpenses.reduce((sum, a) => sum + a.balance, 0);
        const agrNetIncome = totalAgrSales - totalAgrExpense;

        // 不動産所得の計算
        const hasREBiz = plRESales.length > 0 || plREExpenses.length > 0;
        const totalRESales = plRESales.reduce((sum, a) => sum + a.balance, 0);
        const totalREExpense = plREExpenses.reduce((sum, a) => sum + a.balance, 0);
        const reNetIncome = totalRESales - totalREExpense;

        const netIncome = generalNetIncome + agrNetIncome + reNetIncome;

        const totalAssets = bsAssets.reduce((sum, a) => sum + a.balance, 0);
        const totalLiabilities = bsLiabilities.reduce((sum, a) => sum + a.balance, 0);

        // B/S 期首の合計
        const totalAssetsKishu = bsAssets.reduce((sum, a) => sum + a.balanceKishu, 0);
        const totalLiabilitiesKishu = bsLiabilities.reduce((sum, a) => sum + a.balanceKishu, 0);

        // 製造原価計算
        const getBal = (code: number, type: 'debit' | 'credit') => {
            const bal = accountBalancesCurrent[code] || 0;
            return type === 'debit' ? bal : -bal;
        };
        const mfgMaterialKishu = getBal(5310, 'debit');
        const mfgMaterialShiire = getBal(5300, 'debit');
        const mfgMaterialKimatsu = getBal(5320, 'credit');
        const mfgMaterialCost = mfgMaterialKishu + mfgMaterialShiire - mfgMaterialKimatsu;

        const mfgLaborCost = getBal(5400, 'debit');

        const mfgExpenseCodes = [5500, 5510, 5520, 5530, 5590];
        const mfgExpensesList = plExpenses.filter(a => mfgExpenseCodes.includes(a.code));
        const mfgExpensesTotal = mfgExpensesList.reduce((sum, a) => sum + a.balance, 0);

        const mfgTotalCost = mfgMaterialCost + mfgLaborCost + mfgExpensesTotal;

        const mfgWipKishu = getBal(5610, 'debit');
        const mfgWipKimatsu = getBal(5620, 'credit');

        const mfgCostOfGoodsManufactured = mfgTotalCost + mfgWipKishu - mfgWipKimatsu;
        const hasMfgBiz = mfgCostOfGoodsManufactured > 0 || mfgTotalCost > 0;

        // --- 月別売上・仕入計算 ---
        const monthlySales = Array(12).fill(0);
        const monthlyPurchases = Array(12).fill(0);
        const allSalesCodes = [...salesCodes, ...agrSalesCodes, ...reSalesCodes];
        
        // 月別売上には家事消費(583)や雑収入等は含めない
        const allSalesCodesForMonthly = allSalesCodes.filter(c => c !== 583 && c !== 590 && c !== 5999);
        const allPurchaseCodes = [610, 5300, 8000]; // 一般仕入, 製造原材料仕入, 農業種苗等

        const plKajiShouhi = plSales.find(a => a.code === 583);
        const kajiShouhiTotal = plKajiShouhi ? plKajiShouhi.balance : 0;
        
        const plZatsu = plSales.find(a => a.code === 590);
        // その他の収入（雑収入、受取利息など）の合計
        const zatsuShuunyuuTotal = (plZatsu ? plZatsu.balance : 0) + plOtherIncome.reduce((sum, a) => sum + a.balance, 0);

        transactions.forEach(t => {
            if (isOpeningBalanceEntry(t)) return; // 期首残高仕訳は月別合計から除外
            const monthNum = parseInt(t.date.substring(5, 7), 10);
            if (monthNum >= 1 && monthNum <= 12) {
                const idx = monthNum - 1;
                const salesInT = (t.credits || []).filter((c: any) => allSalesCodesForMonthly.includes(c.code)).reduce((sum: number, c: any) => sum + c.amount, 0);
                monthlySales[idx] += salesInT;

                const purchasesInT = (t.debits || []).filter((d: any) => allPurchaseCodes.includes(d.code)).reduce((sum: number, d: any) => sum + d.amount, 0);
                monthlyPurchases[idx] += purchasesInT;
            }
        });

        // --- 各種内訳・計算書用データ作成 (名前による動的コード抽出) ---
        const getIdBySubstring = (subStr: string) => accounts.filter(a => a.name.includes(subStr)).map(a => a.code);
        const getPlExpenseTotal = (codes: number[]) => plExpenses.filter(a => codes.includes(a.code)).reduce((sum, a) => sum + a.balance, 0);

        const salaryCodes = getIdBySubstring("給料").concat(getIdBySubstring("賃金"));
        const familySalaryCodes = getIdBySubstring("専従者");
        const badDebtProvisionCodes = getIdBySubstring("貸倒引当金");
        const rentCodes = getIdBySubstring("地代").concat(getIdBySubstring("家賃")).concat(getIdBySubstring("小作料・賃借料"));
        const depreciationCodes = getIdBySubstring("減価償却費");
        const interestCodes = getIdBySubstring("利子割引").concat(getIdBySubstring("借入金利子"));
        const taxAcctCodes = getIdBySubstring("税理士").concat(getIdBySubstring("弁護士"));

        const salaryTotal = getPlExpenseTotal(salaryCodes);
        const familySalaryTotal = getPlExpenseTotal(familySalaryCodes);
        const badDebtProvisionTotal = getPlExpenseTotal(badDebtProvisionCodes);
        const rentTotal = getPlExpenseTotal(rentCodes);
        const depreciationTotal = getPlExpenseTotal(depreciationCodes);
        const interestTotal = getPlExpenseTotal(interestCodes);
        const taxAcctTotal = getPlExpenseTotal(taxAcctCodes);
        const blueReturnDeduction = accounts.find(a => a.name.includes("青色申告特別控除")) ? 650000 : 0; // Simplified assumption for deduction value if account exists, normally dynamic based on user entry or max 650000

        const handleDownloadExcel = () => {
            if (!transactions || !accounts) return;

            // 総勘定元帳の生成 (Excelシートごと、あるいは縦に並べる)
            // 今回の要件にあるように、「年度ごとに」「UIのような形で一覧化」するため、
            // ひとつのシートに全科目の元帳データを時系列で並べます。

            const wb = XLSX.utils.book_new();
            const wsData: any[][] = [];

            wsData.push(['総勘定元帳', '', '', '', '', '', '']);
            wsData.push(['']);

            // 年度ごとにまとめるなら、表示されている取引データの年を取得（ここでは全体を出力）
            // 各勘定科目ごとにブロックを作成
            const sortedAccounts = [...accounts].sort((a, b) => a.code - b.code);

            sortedAccounts.forEach(account => {
                // この科目が関わるトランザクションを抽出
                const relatedTransactions = transactions.filter(t =>
                    (t.debits || []).some(d => d.code === account.code) ||
                    (t.credits || []).some(c => c.code === account.code)
                );

                if (relatedTransactions.length === 0) return; // 取引なしはスキップ

                // 勘定科目のヘッダー行
                const accountKishuRaw = accountBalancesKishu[account.code] || 0;
                const accountKishu = isDebitAccount(account) ? accountKishuRaw : -accountKishuRaw;

                wsData.push([String(account.code), account.name, isDebitAccount(account) ? '借方' : '貸方']);
                wsData.push(['日付', '仕訳No / 税区分', '科目コード', '相手科目', '金額 (借方)', '金額 (貸方)', '残高']);
                wsData.push(['', '', '', '摘要', '', '', '']);
                wsData.push(['', '', '', '前年度繰越', '', '', accountKishu]);

                let currentBalance = accountKishu;

                relatedTransactions.forEach((t, index) => {
                    const isDebit = (t.debits || []).find(d => d.code === account.code);
                    const isCredit = (t.credits || []).find(c => c.code === account.code);

                    let debitAmount = isDebit ? isDebit.amount : '';
                    let creditAmount = isCredit ? isCredit.amount : '';

                    if (isDebit) currentBalance += (isDebitAccount(account) ? isDebit.amount : -isDebit.amount);
                    if (isCredit) currentBalance += (isCreditAccount(account) ? isCredit.amount : -isCredit.amount);

                    // 相手科目の特定 (複合仕訳の場合は "諸口" とするか、逆側の最初の科目とする)
                    let oppName = '諸口';
                    let oppCode = '999';
                    if (isDebit && (t.credits || []).length === 1) {
                        oppCode = String(t.credits[0].code);
                        oppName = accounts.find(a => a.code === t.credits[0].code)?.name || '不明';
                    } else if (isCredit && (t.debits || []).length === 1) {
                        oppCode = String(t.debits[0].code);
                        oppName = accounts.find(a => a.code === t.debits[0].code)?.name || '不明';
                    }

                    wsData.push([
                        t.date,
                        index + 1, // 仕訳No
                        oppCode,
                        oppName,
                        debitAmount,
                        creditAmount,
                        currentBalance
                    ]);
                    wsData.push([
                        '', '', '', t.description || '', '', '', ''
                    ]);
                });

                wsData.push(['']);
                wsData.push(['']);
            });

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, "元帳");

            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
            saveAs(data, `GeneralLedger_${selectedYear}.xlsx`);
        };

        const handleDownloadJournalExcel = () => {
            if (!transactions || !accounts) return;

            const wb = XLSX.utils.book_new();
            const wsData: any[][] = [];

            wsData.push(['仕訳帳', '', '', '', '', '', '']);
            wsData.push([`年度: ${selectedYear}年`, '', '', '', '', '', '']);
            wsData.push(['']);
            wsData.push(['日付', '仕訳No', '借方科目', '借方金額', '貸方科目', '貸方金額', '摘要']);

            // Sort by date ascending for general journal order
            const sortedTransactions = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            sortedTransactions.forEach((t, idx) => {
                const tDebits = t.debits || [];
                const tCredits = t.credits || [];
                const maxLines = Math.max(tDebits.length, tCredits.length, 1);

                for (let i = 0; i < maxLines; i++) {
                    const d = tDebits[i];
                    const c = tCredits[i];

                    const debName = d ? (accounts.find(a => String(a.code) === String(d.code))?.name || '不明') : '';
                    const creName = c ? (accounts.find(a => String(a.code) === String(c.code))?.name || '不明') : '';

                    wsData.push([
                        i === 0 ? t.date : '',
                        i === 0 ? idx + 1 : '',
                        debName,
                        d ? d.amount : '',
                        creName,
                        c ? c.amount : '',
                        i === 0 ? t.description || '' : ''
                    ]);
                }
            });

            const ws = XLSX.utils.aoa_to_sheet(wsData);

            // Auto size columns (lazy approach setting decent explicit widths)
            ws['!cols'] = [
                { wch: 12 }, // Date
                { wch: 8 },  // No
                { wch: 15 }, // Debit Code
                { wch: 12 }, // Debit Amt
                { wch: 15 }, // Credit Code
                { wch: 12 }, // Credit Amt
                { wch: 30 }, // Desc
            ];

            XLSX.utils.book_append_sheet(wb, ws, "仕訳帳");
            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
            saveAs(data, `Journal_${selectedYear}.xlsx`);
        };

        const handleDownloadPL = () => {
            const wb = XLSX.utils.book_new();
            const wsData: any[][] = [];

            wsData.push(['損益計算書 (P/L)', '', '']);
            wsData.push(['作成日', dayjs().format('YYYY-MM-DD'), '']);
            wsData.push(['']);

            if (hasGeneralBiz) {
                wsData.push(['【一般事業所得】']);
                wsData.push(['【売上・収入金額】', '', '']);
                plSales.forEach(a => wsData.push([a.code, a.name, a.balance]));
                plOtherIncome.forEach(a => wsData.push([a.code, a.name, a.balance]));
                wsData.push(['', '売上(収入)金額 計', totalSales]);
                wsData.push(['']);

                wsData.push(['【売上原価】', '', '']);
                wsData.push(['', '期首棚卸高', sumKishu]);
                wsData.push(['', '仕入金額', sumShiire]);
                wsData.push(['', '期末棚卸高', -sumKimatsu]);
                wsData.push(['', '差引原価', cogs]);
                wsData.push(['']);

                wsData.push(['', '差引金額 (粗利)', grossProfit]);
                wsData.push(['']);

                wsData.push(['【経費】', '', '']);
                plTrueExpenses.forEach(a => wsData.push([a.code, a.name, a.balance]));
                wsData.push(['', '経費 計', totalTrueExpense]);
                wsData.push(['']);

                wsData.push(['', '一般事業所得', generalNetIncome]);
                wsData.push(['']);
            }

            if (hasAgrBiz) {
                wsData.push(['【農業所得】']);
                wsData.push(['【農業等収入金額】', '', '']);
                plAgrSales.forEach(a => wsData.push([a.code, a.name, a.balance]));
                wsData.push(['', '農業収入金額 計', totalAgrSales]);
                wsData.push(['']);

                wsData.push(['【農業等経費】', '', '']);
                plAgrExpenses.forEach(a => wsData.push([a.code, a.name, a.balance]));
                wsData.push(['', '農業経費 計', totalAgrExpense]);
                wsData.push(['']);

                wsData.push(['', '農業所得', agrNetIncome]);
                wsData.push(['']);
            }

            if (hasREBiz) {
                wsData.push(['【不動産所得】']);
                wsData.push(['【不動産収入金額】', '', '']);
                plRESales.forEach(a => wsData.push([a.code, a.name, a.balance]));
                wsData.push(['', '不動産収入金額 計', totalRESales]);
                wsData.push(['']);

                wsData.push(['【不動産経費】', '', '']);
                plREExpenses.forEach(a => wsData.push([a.code, a.name, a.balance]));
                wsData.push(['', '不動産経費 計', totalREExpense]);
                wsData.push(['']);

                wsData.push(['', '不動産所得', reNetIncome]);
                wsData.push(['']);
            }

            wsData.push(['', '【合計】 青色申告控除前所得', netIncome]);

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, "損益計算書");
            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), `PL_${selectedYear}.xlsx`);
        };

        const handleDownloadBS = () => {
            const wb = XLSX.utils.book_new();
            const wsData: any[][] = [];

            wsData.push(['貸借対照表 (B/S)', '', '']);
            wsData.push(['作成日', dayjs().format('YYYY-MM-DD'), '']);
            wsData.push(['']);

            wsData.push(['【資産 (借方)】', '', '']);
            bsAssets.forEach(a => wsData.push([a.code, a.name, a.balance]));
            wsData.push(['', '資産合計', totalAssets]);
            wsData.push(['']);

            wsData.push(['【負債・資本 (貸方)】', '', '']);
            bsLiabilities.forEach(a => wsData.push([a.code, a.name, a.balance]));
            wsData.push(['', '青色申告控除前所得', netIncome]);
            wsData.push(['', '負債・資本合計', totalLiabilities + netIncome]);

            const ws = XLSX.utils.aoa_to_sheet(wsData);
            XLSX.utils.book_append_sheet(wb, ws, "貸借対照表");
            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            saveAs(new Blob([excelBuffer], { type: 'application/octet-stream' }), `BS_${selectedYear}.xlsx`);
        };

        const pdfData = {
            selectedYear,
            plSales,
            plOtherIncome,
            totalSales,
            sumKishu,
            sumShiire,
            sumKimatsu,
            cogs,
            grossProfit,
            plTrueExpenses,
            totalTrueExpense,
            generalNetIncome,
            hasGeneralBiz,
            hasAgrBiz,
            plAgrSales,
            totalAgrSales,
            plAgrExpenses,
            totalAgrExpense,
            agrNetIncome,
            hasREBiz,
            plRESales,
            totalRESales,
            plREExpenses,
            totalREExpense,
            reNetIncome,
            netIncome,
            bsAssets,
            totalAssets,
            totalAssetsKishu,
            bsLiabilities,
            totalLiabilities,
            totalLiabilitiesKishu,
            hasMfgBiz,
            mfgMaterialKishu,
            mfgMaterialShiire,
            mfgMaterialKimatsu,
            mfgMaterialCost,
            mfgLaborCost,
            mfgExpensesList,
            mfgExpensesTotal,
            mfgTotalCost,
            mfgWipKishu,
            mfgWipKimatsu,
            mfgCostOfGoodsManufactured,
            monthlySales,
            monthlyPurchases,
            kajiShouhiTotal,
            zatsuShuunyuuTotal,
            salaryTotal,
            familySalaryTotal,
            badDebtProvisionTotal,
            rentTotal,
            depreciationTotal,
            interestTotal,
            taxAcctTotal,
            blueReturnDeduction,
            transactions,
            accounts
        };

        return (
            <Box p={{ xs: 1, sm: 2 }} pt={2}>

                <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3, px: 1 }}>各種帳簿</Typography>

                <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, mb: 4, borderRadius: 2, bgcolor: '#f0f9ff', border: '1px solid', borderColor: '#bae6fd' }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom color="#0284c7">データエクスポート</Typography>
                    <Typography variant="body2" color="text.secondary" mb={2}>
                        年間の取引データを各種Excel形式でダウンロードできます。確定申告ソフトや税理士への提出に利用可能です。
                    </Typography>
                    <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={2}>
                        <Button fullWidth variant="contained" color="secondary" startIcon={<DownloadIcon />} onClick={handleDownloadJournalExcel} disableElevation sx={{ borderRadius: 8, height: '100%' }}>
                            仕訳帳 (Excel)
                        </Button>
                        <Button fullWidth variant="contained" color="primary" startIcon={<DownloadIcon />} onClick={handleDownloadExcel} disableElevation sx={{ borderRadius: 8, height: '100%' }}>
                            総勘定元帳 (Excel)
                        </Button>
                        <Button fullWidth variant="contained" sx={{ bgcolor: 'white', color: 'primary.main', border: '1px solid', borderColor: 'primary.main', borderRadius: 8, '&:hover': { bgcolor: '#f0fdf4' }, height: '100%' }} startIcon={<DownloadIcon />} onClick={handleDownloadPL} disableElevation>
                            損益計算書 (Excel)
                        </Button>
                        <Button fullWidth variant="contained" sx={{ bgcolor: 'white', color: 'primary.main', border: '1px solid', borderColor: 'primary.main', borderRadius: 8, '&:hover': { bgcolor: '#f0fdf4' }, height: '100%' }} startIcon={<DownloadIcon />} onClick={handleDownloadBS} disableElevation>
                            貸借対照表 (Excel)
                        </Button>
                    </Box>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mt={3}>
                        <Box flex={1}>
                            <JournalPdfExporter transactions={transactions} accounts={accounts} selectedYear={selectedYear} />
                        </Box>
                        <Box flex={1}>
                            <GlPdfExporter accounts={accounts} transactions={transactions} selectedYear={selectedYear} balancesKishu={accountBalancesKishu} />
                        </Box>
                        <PdfExporter data={pdfData} />
                    </Stack>
                </Paper>

                {hasGeneralBiz && (
                    <>
                        <Typography variant="h6" mt={4} mb={1} sx={{ fontWeight: 'bold', px: 1 }}>損益計算書 (一般事業)</Typography>
                        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={4}>
                                <Box flex={1}>
                                    <Box mb={3}>
                                        <Typography variant="subtitle2" color="primary.dark" fontWeight="bold" borderBottom={2} borderColor="primary.main" pb={0.5} mb={2}>売上・収入金額</Typography>
                                        <Stack spacing={1}>
                                            {plSales.map(a => (
                                                <Box key={a.code} display="flex" justifyContent="space-between" pl={1} py={0.5}>
                                                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', pr: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>{a.name}</Typography>
                                                    <Typography variant="body2" fontWeight={500} fontFamily="monospace" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>¥{a.balance.toLocaleString()}</Typography>
                                                </Box>
                                            ))}
                                            {plOtherIncome.map(a => (
                                                <Box key={a.code} display="flex" justifyContent="space-between" pl={1} py={0.5}>
                                                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', pr: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>{a.name}</Typography>
                                                    <Typography variant="body2" fontWeight={500} fontFamily="monospace" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>¥{a.balance.toLocaleString()}</Typography>
                                                </Box>
                                            ))}
                                        </Stack>
                                        <Box display="flex" justifyContent="space-between" mt={1} pt={1} borderTop={1} borderColor="divider">
                                            <Typography variant="body2" fontWeight="bold" color="text.secondary">月別売上 計</Typography>
                                            <Typography variant="body2" fontWeight="bold" color="text.secondary">¥{(totalSales - kajiShouhiTotal - zatsuShuunyuuTotal).toLocaleString()}</Typography>
                                        </Box>
                                        <Box display="flex" justifyContent="space-between" pt={0.5}>
                                            <Typography variant="body2" fontWeight="bold" color="text.secondary">家事消費等</Typography>
                                            <Typography variant="body2" fontWeight="bold" color="text.secondary">¥{kajiShouhiTotal.toLocaleString()}</Typography>
                                        </Box>
                                        <Box display="flex" justifyContent="space-between" pt={0.5}>
                                            <Typography variant="body2" fontWeight="bold" color="text.secondary">雑収入</Typography>
                                            <Typography variant="body2" fontWeight="bold" color="text.secondary">¥{zatsuShuunyuuTotal.toLocaleString()}</Typography>
                                        </Box>
                                        <Box display="flex" justifyContent="space-between" mt={1} pt={1} borderTop={1} borderColor="divider">
                                            <Typography variant="body2" fontWeight="bold">売上 (収入) 金額 計</Typography>
                                            <Typography variant="body2" fontWeight="bold">¥{totalSales.toLocaleString()}</Typography>
                                        </Box>
                                    </Box>

                                    <Box mb={3}>
                                        <Typography variant="subtitle2" color="primary.dark" fontWeight="bold" borderBottom={2} borderColor="primary.main" pb={0.5} mb={2}>売上原価</Typography>
                                        <Stack spacing={1} pl={1}>
                                            <Box display="flex" justifyContent="space-between" py={0.5}>
                                                <Typography variant="body2" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>期首棚卸高</Typography>
                                                <Typography variant="body2" fontFamily="monospace" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>¥{sumKishu.toLocaleString()}</Typography>
                                            </Box>
                                            <Box display="flex" justifyContent="space-between" py={0.5}>
                                                <Typography variant="body2" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>仕入金額</Typography>
                                                <Typography variant="body2" fontFamily="monospace" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>¥{sumShiire.toLocaleString()}</Typography>
                                            </Box>
                                            <Box display="flex" justifyContent="space-between" py={0.5}>
                                                <Typography variant="body2" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>期末棚卸高</Typography>
                                                <Typography variant="body2" color="error.main" fontFamily="monospace" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>▲ ¥{sumKimatsu.toLocaleString()}</Typography>
                                            </Box>
                                        </Stack>
                                        <Box display="flex" justifyContent="space-between" mt={1} pt={1} borderTop={1} borderColor="divider">
                                            <Typography variant="body2" fontWeight="bold">差引原価</Typography>
                                            <Typography variant="body2" fontWeight="bold" fontFamily="monospace">¥{cogs.toLocaleString()}</Typography>
                                        </Box>
                                    </Box>

                                    <Box display="flex" justifyContent="space-between" mb={{ xs: 3, md: 0 }} p={1.5} bgcolor="#f0fdfa" borderRadius={2}>
                                        <Typography variant="subtitle1" fontWeight="bold" color="primary.dark">差引金額 (粗利)</Typography>
                                        <Typography variant="subtitle1" fontWeight="bold" color="primary.dark">¥{grossProfit.toLocaleString()}</Typography>
                                    </Box>
                                </Box>

                                <Box flex={1} display="flex" flexDirection="column">
                                    <Box mb={3} flexGrow={1}>
                                        <Typography variant="subtitle2" color="primary.dark" fontWeight="bold" borderBottom={2} borderColor="primary.main" pb={0.5} mb={2}>経費</Typography>
                                        <Stack spacing={1} pl={1}>
                                            {plTrueExpenses.map(a => (
                                                <Box key={a.code} display="flex" justifyContent="space-between" py={0.5}>
                                                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', pr: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>{a.name}</Typography>
                                                    <Typography variant="body2" fontWeight={500} fontFamily="monospace" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>¥{a.balance.toLocaleString()}</Typography>
                                                </Box>
                                            ))}
                                        </Stack>
                                        <Box display="flex" justifyContent="space-between" mt={1} pt={1} borderTop={1} borderColor="divider">
                                            <Typography variant="body2" fontWeight="bold">経費 計</Typography>
                                            <Typography variant="body2" fontWeight="bold">¥{totalTrueExpense.toLocaleString()}</Typography>
                                        </Box>
                                    </Box>

                                    <Box display="flex" justifyContent="space-between" p={1.5} bgcolor="#f8fafc" borderRadius={2} border={1} borderColor="divider" mt="auto">
                                        <Typography variant="body1" fontWeight="bold" color="text.secondary">一般事業所得</Typography>
                                        <Typography variant="body1" fontWeight="bold" color="text.secondary">¥{generalNetIncome.toLocaleString()}</Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </Paper>
                    </>
                )}

                {hasAgrBiz && (
                    <>
                        <Typography variant="h6" mt={4} mb={1} sx={{ fontWeight: 'bold', px: 1 }}>損益計算書 (農業)</Typography>
                        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Box mb={3}>
                                <Typography variant="subtitle2" color="#059669" fontWeight="bold" borderBottom={2} borderColor="#34d399" pb={0.5} mb={2}>農業・収入金額</Typography>
                                <Stack spacing={1}>
                                    {plAgrSales.map(a => (
                                        <Box key={a.code} display="flex" justifyContent="space-between" pl={1} py={0.5}>
                                            <Typography variant="body2" sx={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', pr: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>{a.name}</Typography>
                                            <Typography variant="body2" fontWeight={500} fontFamily="monospace" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>¥{a.balance.toLocaleString()}</Typography>
                                        </Box>
                                    ))}
                                </Stack>
                                <Box display="flex" justifyContent="space-between" mt={1} pt={1} borderTop={1} borderColor="divider">
                                    <Typography variant="body2" fontWeight="bold">農業収入 計</Typography>
                                    <Typography variant="body2" fontWeight="bold">¥{totalAgrSales.toLocaleString()}</Typography>
                                </Box>
                            </Box>

                            <Box mb={3}>
                                <Typography variant="subtitle2" color="#059669" fontWeight="bold" borderBottom={2} borderColor="#34d399" pb={0.5} mb={2}>農業・経費</Typography>
                                <Stack spacing={1} pl={1}>
                                    {plAgrExpenses.map(a => (
                                        <Box key={a.code} display="flex" justifyContent="space-between" py={0.5}>
                                            <Typography variant="body2" sx={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', pr: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>{a.name}</Typography>
                                            <Typography variant="body2" fontWeight={500} fontFamily="monospace" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>¥{a.balance.toLocaleString()}</Typography>
                                        </Box>
                                    ))}
                                </Stack>
                                <Box display="flex" justifyContent="space-between" mt={1} pt={1} borderTop={1} borderColor="divider">
                                    <Typography variant="body2" fontWeight="bold">農業経費 計</Typography>
                                    <Typography variant="body2" fontWeight="bold">¥{totalAgrExpense.toLocaleString()}</Typography>
                                </Box>
                            </Box>

                            <Box display="flex" justifyContent="space-between" p={1.5} bgcolor="#f8fafc" borderRadius={2} border={1} borderColor="divider">
                                <Typography variant="body1" fontWeight="bold" color="text.secondary">農業所得</Typography>
                                <Typography variant="body1" fontWeight="bold" color="text.secondary">¥{agrNetIncome.toLocaleString()}</Typography>
                            </Box>
                        </Paper>
                    </>
                )}

                {hasREBiz && (
                    <>
                        <Typography variant="h6" mt={4} mb={1} sx={{ fontWeight: 'bold', px: 1 }}>損益計算書 (不動産)</Typography>
                        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Box mb={3}>
                                <Typography variant="subtitle2" color="#b45309" fontWeight="bold" borderBottom={2} borderColor="#fbbf24" pb={0.5} mb={2}>不動産・収入金額</Typography>
                                <Stack spacing={1}>
                                    {plRESales.map(a => (
                                        <Box key={a.code} display="flex" justifyContent="space-between" pl={1} py={0.5}>
                                            <Typography variant="body2" sx={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', pr: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>{a.name}</Typography>
                                            <Typography variant="body2" fontWeight={500} fontFamily="monospace" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>¥{a.balance.toLocaleString()}</Typography>
                                        </Box>
                                    ))}
                                </Stack>
                                <Box display="flex" justifyContent="space-between" mt={1} pt={1} borderTop={1} borderColor="divider">
                                    <Typography variant="body2" fontWeight="bold">不動産収入 計</Typography>
                                    <Typography variant="body2" fontWeight="bold">¥{totalRESales.toLocaleString()}</Typography>
                                </Box>
                            </Box>

                            <Box mb={3}>
                                <Typography variant="subtitle2" color="#b45309" fontWeight="bold" borderBottom={2} borderColor="#fbbf24" pb={0.5} mb={2}>不動産・経費</Typography>
                                <Stack spacing={1} pl={1}>
                                    {plREExpenses.map(a => (
                                        <Box key={a.code} display="flex" justifyContent="space-between" py={0.5}>
                                            <Typography variant="body2" sx={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', pr: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>{a.name}</Typography>
                                            <Typography variant="body2" fontWeight={500} fontFamily="monospace" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>¥{a.balance.toLocaleString()}</Typography>
                                        </Box>
                                    ))}
                                </Stack>
                                <Box display="flex" justifyContent="space-between" mt={1} pt={1} borderTop={1} borderColor="divider">
                                    <Typography variant="body2" fontWeight="bold">不動産経費 計</Typography>
                                    <Typography variant="body2" fontWeight="bold">¥{totalREExpense.toLocaleString()}</Typography>
                                </Box>
                            </Box>

                            <Box display="flex" justifyContent="space-between" p={1.5} bgcolor="#f8fafc" borderRadius={2} border={1} borderColor="divider">
                                <Typography variant="body1" fontWeight="bold" color="text.secondary">不動産所得</Typography>
                                <Typography variant="body1" fontWeight="bold" color="text.secondary">¥{reNetIncome.toLocaleString()}</Typography>
                            </Box>
                        </Paper>
                    </>
                )}

                <Box mt={3} mb={3} display="flex" justifyContent="space-between" p={2} bgcolor="#eff6ff" borderRadius={2} border={1} borderColor="#bfdbfe">
                    <Typography variant="h6" fontWeight="bold" color="#1e3a8a">総合: 青色申告控除前所得</Typography>
                    <Typography variant="h6" fontWeight="bold" color="#1e3a8a">¥{netIncome.toLocaleString()}</Typography>
                </Box>

                <Typography variant="h6" mt={5} mb={1} sx={{ fontWeight: 'bold', px: 1 }}>貸借対照表 (B/S)</Typography>
                <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, mb: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={4}>
                        <Box flex={1}>
                            <Typography variant="subtitle2" color="text.secondary" fontWeight="bold" mb={2} borderBottom={1} borderColor="divider" pb={1}>資産 (借方)</Typography>
                            <Stack spacing={1}>
                                {bsAssets.map(a => (
                                    <Box key={a.code} display="flex" justifyContent="space-between" py={0.5}>
                                        <Typography variant="body2" sx={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', pr: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>{a.name}</Typography>
                                        <Typography variant="body2" fontWeight={500} fontFamily="monospace" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>¥{a.balance.toLocaleString()}</Typography>
                                    </Box>
                                ))}
                            </Stack>
                            <Divider sx={{ my: 2 }} />
                            <Box display="flex" justifyContent="space-between" mt={1}>
                                <Typography variant="body2" fontWeight="bold">資産合計</Typography>
                                <Typography variant="body2" fontWeight="bold">¥{totalAssets.toLocaleString()}</Typography>
                            </Box>
                        </Box>
                        <Box flex={1}>
                            <Typography variant="subtitle2" color="text.secondary" fontWeight="bold" mb={2} borderBottom={1} borderColor="divider" pb={1}>負債・資本 (貸方)</Typography>
                            <Stack spacing={1}>
                                {bsLiabilities.map(a => (
                                    <Box key={a.code} display="flex" justifyContent="space-between" py={0.5}>
                                        <Typography variant="body2" sx={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', pr: 1, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>{a.name}</Typography>
                                        <Typography variant="body2" fontWeight={500} fontFamily="monospace" fontSize={{ xs: '0.8rem', sm: '0.875rem' }}>¥{a.balance.toLocaleString()}</Typography>
                                    </Box>
                                ))}
                            </Stack>
                            <Divider sx={{ my: 2 }} />
                            <Box display="flex" justifyContent="space-between" mb={1.5}>
                                <Typography variant="body2" color="primary.main" fontWeight={600}>青色申告控除前所得</Typography>
                                <Typography variant="body2" color="primary.main" fontWeight={600}>¥{netIncome.toLocaleString()}</Typography>
                            </Box>
                            <Box display="flex" justifyContent="space-between" mt={1}>
                                <Typography variant="body2" fontWeight="bold">負債・資本合計</Typography>
                                <Typography variant="body2" fontWeight="bold">¥{(totalLiabilities + netIncome).toLocaleString()}</Typography>
                            </Box>
                        </Box>
                    </Box>
                </Paper>
            </Box>
        );
    } catch (e: any) {
        return <Box p={3}><Typography color="error">CRASH DETECTED: {e.message}</Typography></Box>;
    }
}
