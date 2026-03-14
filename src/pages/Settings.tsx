import { useState, useEffect } from 'react';
import {
    Box, Typography, TextField, Button, Alert, Snackbar, MenuItem, Switch, FormControlLabel,
    Accordion, AccordionSummary, AccordionDetails, FormGroup, Checkbox
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db as firestoreDb, auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import 'dexie-export-import';
import { forceUploadSync } from '../services/sync_service';
import { useFiscalYear } from '../contexts/FiscalYearContext';
import { closeFiscalYear, checkIsYearClosed } from '../services/closing_service';

export default function Settings() {
    const { userId } = useAuth();
    const currentSettings = useLiveQuery(() => db.settings.get(1), []);

    // AI Settings
    const [apiKey, setApiKey] = useState('');
    const [aiModel, setAiModel] = useState('gemini-2.5-flash');

    // Sync Settings
    const [useFirebaseSync, setUseFirebaseSync] = useState(false);

    // Business Profile Settings
    const [businessName, setBusinessName] = useState('');
    const [businessType, setBusinessType] = useState({
        general: false,
        agriculture: false,
        realEstate: false,
        salary: false
    });

    // Analytics Settings
    const [taxReturnMethod, setTaxReturnMethod] = useState<'blue' | 'white'>('white');
    const [budgetSelections, setBudgetSelections] = useState<{ name: string, amount: number | '' }[]>([
        { name: '', amount: '' }, { name: '', amount: '' }, { name: '', amount: '' }, { name: '', amount: '' }, { name: '', amount: '' }
    ]);

    const allAccounts = useLiveQuery(() => db.accounts.toArray(), []);
    const expenseAccounts = allAccounts?.filter(a => a.type === 'expense') || [];

    const { selectedYear } = useFiscalYear();
    const [isYearClosed, setIsYearClosed] = useState(false);
    const [isClosingProcess, setIsClosingProcess] = useState(false);

    useEffect(() => {
        checkIsYearClosed(selectedYear).then(closed => setIsYearClosed(closed));
    }, [selectedYear]);

    const handleCloseYear = async () => {
        if (!window.confirm(`${selectedYear}年度の帳簿を締め、次年度（${selectedYear + 1}年）への期首残高を作成します。\n本当によろしいですか？（※一度締めると${selectedYear}年度のデータは編集できなくなります）`)) {
            return;
        }

        setIsClosingProcess(true);
        try {
            await closeFiscalYear(selectedYear);
            setIsYearClosed(true);
            setSaveSuccess(true);
            alert(`${selectedYear}年度の締め処理が完了しました。次年度の期首残高としてスナップショットが保存されました。`);
        } catch (e: any) {
            setSyncError('年度締めに失敗しました: ' + e.message);
        } finally {
            setIsClosingProcess(false);
        }
    };

    const navigate = useNavigate();

    const [saveSuccess, setSaveSuccess] = useState(false);
    const [syncError, setSyncError] = useState<string | null>(null);

    // Accordion state
    const [expanded, setExpanded] = useState<string | false>('panel1');

    const handleAccordionChange = (panel: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
        setExpanded(isExpanded ? panel : false);
    };

    useEffect(() => {
        if (currentSettings) {
            setApiKey(currentSettings.geminiApiKey || '');
            if (currentSettings.aiModel) setAiModel(currentSettings.aiModel);
            if (currentSettings.useFirebaseSync !== undefined) setUseFirebaseSync(currentSettings.useFirebaseSync);
            if (currentSettings.businessName) setBusinessName(currentSettings.businessName);
            if (currentSettings.businessType) {
                setBusinessType({
                    general: !!currentSettings.businessType.general,
                    agriculture: !!currentSettings.businessType.agriculture,
                    realEstate: !!currentSettings.businessType.realEstate,
                    salary: !!currentSettings.businessType.salary
                });
            }
            if (currentSettings.taxReturnMethod) setTaxReturnMethod(currentSettings.taxReturnMethod);
            if (currentSettings.monthlyBudgets) {
                const arr: { name: string, amount: number | '' }[] = Object.entries(currentSettings.monthlyBudgets).map(([k, v]) => ({ name: k, amount: v as number }));
                while (arr.length < 5) arr.push({ name: '', amount: '' });
                setBudgetSelections(arr.slice(0, 5));
            }
        }
    }, [currentSettings]);

    const handleSave = async () => {
        try {
            const monthlyBudgetsRecord: Record<string, number> = {};
            budgetSelections.forEach(item => {
                if (item.name && item.amount !== '' && Number(item.amount) > 0) {
                    monthlyBudgetsRecord[item.name] = Number(item.amount);
                }
            });

            const newSettings = {
                geminiApiKey: apiKey,
                aiModel,
                useFirebaseSync,
                businessName,
                businessType,
                taxReturnMethod,
                monthlyBudgets: monthlyBudgetsRecord
            };

            // 1. Save locally to IndexedDB
            if (currentSettings) {
                await db.settings.update(1, newSettings);
            } else {
                await db.settings.add({ id: 1, ...newSettings });
            }

            // 2. Sync to Firestore if user is logged in
            const currentUser = auth.currentUser;
            if (currentUser) {
                const docRef = doc(firestoreDb, 'artifacts', 'default-app-id', 'users', currentUser.uid, 'profile', 'data');
                // Use setDoc with merge: true to update only these fields without overwriting membershipRank
                await setDoc(docRef, newSettings, { merge: true });

                // If user enabled sync, try to trigger a force upload or perform sync right now
                if (useFirebaseSync) {
                    try {
                        await forceUploadSync(currentUser.uid);
                    } catch (e) {
                        console.error("Firebase Storage Upload failed", e);
                        setSyncError("設定は保存できましたが、バックアップ同期に失敗しました。");
                        return; // Don't show success banner
                    }
                }
            }

            setSaveSuccess(true);
            setSyncError(null);
        } catch (error) {
            console.error("Failed to save settings:", error);
            setSyncError("設定の保存中にエラーが発生しました。");
        }
    };

    const handleBusinessTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setBusinessType({
            ...businessType,
            [event.target.name]: event.target.checked
        });
    };

    const handleExport = async () => {
        try {
            const blob = await db.export();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tax-accounting-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert('エクスポートに失敗しました');
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
            alert('ログアウトに失敗しました');
        }
    };

    return (
        <Box p={{ xs: 1, sm: 3 }}>
            <Typography variant="h5" gutterBottom fontWeight="bold" mb={4} color="primary.dark">設定パネル</Typography>

            <Accordion expanded={expanded === 'panel1'} onChange={handleAccordionChange('panel1')} variant="outlined" sx={{ mb: 1, borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f8fafc', borderRadius: expanded === 'panel1' ? '8px 8px 0 0' : '8px' }}>
                    <Typography variant="subtitle1" fontWeight="bold">プロフィール / 事業設定</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 3 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        ここで設定した事業主名・事業内容はPDF帳簿のヘッダー等に反映されます。
                    </Typography>

                    <TextField
                        label="事業主名 (または個人氏名)"
                        variant="outlined"
                        fullWidth
                        margin="normal"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="例: 山田 一郎 / 株式会社〇〇"
                    />

                    <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>事業内容 (該当するものすべて)</Typography>
                    <FormGroup row>
                        <FormControlLabel
                            control={<Checkbox checked={businessType.general} onChange={handleBusinessTypeChange} name="general" color="primary" />}
                            label="一般事業 (サービス、物販等)"
                        />
                        <FormControlLabel
                            control={<Checkbox checked={businessType.agriculture} onChange={handleBusinessTypeChange} name="agriculture" color="success" />}
                            label="農業事業"
                        />
                        <FormControlLabel
                            control={<Checkbox checked={businessType.realEstate} onChange={handleBusinessTypeChange} name="realEstate" color="warning" />}
                            label="不動産事業"
                        />
                        <FormControlLabel
                            control={<Checkbox checked={businessType.salary} onChange={handleBusinessTypeChange} name="salary" color="info" />}
                            label="給与所得あり"
                        />
                    </FormGroup>

                    <Box mt={3}>
                        <Button variant="contained" color="primary" onClick={handleSave} disableElevation>
                            プロフィールを保存する
                        </Button>
                    </Box>
                </AccordionDetails>
            </Accordion>

            <Accordion expanded={expanded === 'panel2'} onChange={handleAccordionChange('panel2')} variant="outlined" sx={{ mb: 1, borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f8fafc', borderRadius: expanded === 'panel2' ? '8px 8px 0 0' : '8px' }}>
                    <Typography variant="subtitle1" fontWeight="bold">Gemini API連携 (AI自動仕訳)</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 3 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        レシート画像からの自動仕訳機能を利用するには、Google AI Studio で取得したAPIキーを入力してください。キーはローカルブラウザ内に保存されます。
                    </Typography>

                    <TextField
                        label="Gemini API Key"
                        variant="outlined"
                        fullWidth
                        margin="normal"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                    />

                    <TextField
                        select
                        label="AIモデル"
                        fullWidth
                        margin="normal"
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                    >
                        <MenuItem value="gemini-2.5-flash">gemini-2.5-flash (最新・推奨)</MenuItem>
                        <MenuItem value="gemini-2.5-pro">gemini-2.5-pro (最新・高精度)</MenuItem>
                        <MenuItem value="gemini-1.5-flash">gemini-1.5-flash</MenuItem>
                        <MenuItem value="gemini-1.0-pro-vision-latest">gemini-1.0-pro-vision-latest</MenuItem>
                    </TextField>

                    <Box mt={3}>
                        <Button variant="contained" color="primary" onClick={handleSave} disableElevation>
                            API設定を保存する
                        </Button>
                    </Box>
                </AccordionDetails>
            </Accordion>

            <Accordion expanded={expanded === 'panel3'} onChange={handleAccordionChange('panel3')} variant="outlined" sx={{ mb: 1, borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f8fafc', borderRadius: expanded === 'panel3' ? '8px 8px 0 0' : '8px' }}>
                    <Typography variant="subtitle1" fontWeight="bold">バックアップ / クラウド同期</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom color="primary">Firebase Storage 同期 (自動バックアップ)</Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        有効にすると、ログイン中のアカウントに紐付いて仕訳データがクラウド上に暗号化して自動保存・同期されます。
                        複数端末で同じアカウントにログインすれば、データがリアルタイムに共有されます。
                    </Typography>

                    <FormControlLabel
                        sx={{ mt: 1, mb: 3 }}
                        control={
                            <Switch
                                checked={useFirebaseSync}
                                onChange={(e) => setUseFirebaseSync(e.target.checked)}
                                color="primary"
                            />
                        }
                        label="クラウド自動同期を有効にする"
                    />

                    <Box mb={4}>
                        <Button variant="contained" color="primary" onClick={handleSave} disableElevation>
                            同期設定を保存する
                        </Button>
                    </Box>

                    <Typography variant="subtitle2" gutterBottom color="secondary.main">ローカル・データエクスポート</Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        ローカルの仕訳データおよび設定をJSONファイルとしてダウンロードします。（手動バックアップ）
                    </Typography>
                    <Box mt={2}>
                        <Button variant="outlined" color="secondary" onClick={handleExport}>
                            全データをローカルに保存
                        </Button>
                    </Box>
                </AccordionDetails>
            </Accordion>

            <Accordion expanded={expanded === 'panel_analytics'} onChange={handleAccordionChange('panel_analytics')} variant="outlined" sx={{ mb: 1, borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f8fafc', borderRadius: expanded === 'panel_analytics' ? '8px 8px 0 0' : '8px' }}>
                    <Typography variant="subtitle1" fontWeight="bold">アナリティクス / 分析設定</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>納税額シミュレーション用設定</Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        今年の確定申告の予定申告方法を選択してください。（未設定時は保守的な白色申告としてシミュレーションされます）
                    </Typography>
                    <TextField
                        select
                        label="申告方法"
                        fullWidth
                        margin="normal"
                        value={taxReturnMethod}
                        onChange={(e) => setTaxReturnMethod(e.target.value as 'blue' | 'white')}
                        sx={{ mb: 4 }}
                    >
                        <MenuItem value="white">白色申告 (特別控除0円)</MenuItem>
                        <MenuItem value="blue">青色申告 (最大65万円控除)</MenuItem>
                    </TextField>

                    <Typography variant="subtitle2" gutterBottom>経費の月間目標予算 (予算消化アラート用)</Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        使いすぎを防ぎたい主要な経費科目を最大5つまで選択し、1ヶ月あたりの予算上限（円）を設定してください。
                    </Typography>
                    {budgetSelections.map((selection, index) => (
                        <Box key={index} display="flex" gap={2} mb={2} alignItems="center">
                            <TextField
                                select
                                label={`アラート科目 ${index + 1}`}
                                value={selection.name}
                                onChange={(e) => {
                                    const newSelections = [...budgetSelections];
                                    newSelections[index] = { ...newSelections[index], name: e.target.value };
                                    setBudgetSelections(newSelections);
                                }}
                                fullWidth
                                disabled={expenseAccounts.length === 0}
                            >
                                <MenuItem value=""><em>-- 選択なし --</em></MenuItem>
                                {expenseAccounts.map(acc => (
                                    <MenuItem key={acc.id} value={acc.name}>{acc.name}</MenuItem>
                                ))}
                            </TextField>
                            <TextField
                                label="予算上限 (円)"
                                type="number"
                                value={selection.amount}
                                onChange={(e) => {
                                    const newSelections = [...budgetSelections];
                                    newSelections[index] = { ...newSelections[index], amount: e.target.value === '' ? '' : Number(e.target.value) };
                                    setBudgetSelections(newSelections);
                                }}
                                fullWidth
                                disabled={!selection.name}
                            />
                        </Box>
                    ))}

                    <Box mt={3} mb={1}>
                        <Button variant="contained" color="primary" onClick={handleSave} disableElevation>
                            分析設定を保存する
                        </Button>
                    </Box>
                </AccordionDetails>
            </Accordion>

            <Accordion expanded={expanded === 'panel_closing'} onChange={handleAccordionChange('panel_closing')} variant="outlined" sx={{ mb: 1, borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#fffbeb', borderRadius: expanded === 'panel_closing' ? '8px 8px 0 0' : '8px' }}>
                    <Typography variant="subtitle1" fontWeight="bold" color="warning.dark">年度締め・次期繰越</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 3 }}>
                    <Typography variant="subtitle2" gutterBottom>【{selectedYear}年度】の帳簿を締める</Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        確定申告が完了したら、この年度のデータをロックし、資産・負債の残高を次年度（{selectedYear + 1}年）の「期首残高」として引き継ぎます。
                        <br />
                        <b>※一度実行すると、{selectedYear}年度の仕訳データの追加・編集・削除はできなくなります。</b>
                    </Typography>

                    <Box mt={3} mb={1}>
                        <Button
                            variant="contained"
                            color="warning"
                            onClick={handleCloseYear}
                            disabled={isYearClosed || isClosingProcess}
                            disableElevation
                        >
                            {isClosingProcess ? '処理中...' : isYearClosed ? `${selectedYear}年度は確定済みです` : `${selectedYear}年度を確定して繰り越す`}
                        </Button>
                    </Box>
                </AccordionDetails>
            </Accordion>

            <Accordion expanded={expanded === 'panel4'} onChange={handleAccordionChange('panel4')} variant="outlined" sx={{ mb: 3, borderColor: 'error.light', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#fef2f2', borderRadius: expanded === 'panel4' ? '8px 8px 0 0' : '8px' }}>
                    <Typography variant="subtitle1" fontWeight="bold" color="error.main">システム / アカウント</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 3 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        現在のアカウントからログアウトし、別のアカウントで再ログインします。<br />
                        (NOAHユーザーID: <Box component="span" sx={{ fontFamily: 'monospace', userSelect: 'all', fontSize: '1.1em', fontWeight: 'bold' }}>{userId || '未取得'}</Box>)
                    </Typography>
                    <Box mt={3}>
                        <Button variant="outlined" color="error" onClick={handleLogout}>
                            ログアウト
                        </Button>
                    </Box>
                </AccordionDetails>
            </Accordion>

            <Snackbar
                open={saveSuccess}
                autoHideDuration={3000}
                onClose={() => setSaveSuccess(false)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity="success" elevation={6} variant="filled" onClose={() => setSaveSuccess(false)}>
                    設定を保存しました
                </Alert>
            </Snackbar>

            <Snackbar
                open={!!syncError}
                autoHideDuration={4000}
                onClose={() => setSyncError(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert severity="error" elevation={6} variant="filled" onClose={() => setSyncError(null)}>
                    {syncError}
                </Alert>
            </Snackbar>
        </Box>
    );
}
