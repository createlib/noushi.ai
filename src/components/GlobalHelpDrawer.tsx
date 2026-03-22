
import { 
    Drawer, Box, Typography, IconButton, Accordion, 
    AccordionSummary, AccordionDetails, Divider, 
    List, ListItem, ListItemIcon, ListItemText
} from '@mui/material';
import { 
    Close as CloseIcon, 
    ExpandMore as ExpandMoreIcon,
    MenuBook as MenuBookIcon,
    LightbulbOutlined as LightbulbIcon,
    CameraAltOutlined as CameraIcon,
    AutoGraphOutlined as GraphIcon,
    CheckCircleOutline as CheckIcon
} from '@mui/icons-material';

interface GlobalHelpDrawerProps {
    open: boolean;
    onClose: () => void;
}

export default function GlobalHelpDrawer({ open, onClose }: GlobalHelpDrawerProps) {
    return (
        <Drawer 
            anchor="right" 
            open={open} 
            onClose={onClose} 
            PaperProps={{ 
                sx: { 
                    width: { xs: '100%', sm: 450, md: 550 }, 
                    bgcolor: '#f8fafc',
                    boxShadow: '-4px 0 24px rgba(0,0,0,0.1)'
                } 
            }}
        >
            {/* Header */}
            <Box px={3} py={2.5} display="flex" justifyContent="space-between" alignItems="center" bgcolor="#ffffff" borderBottom="1px solid #e2e8f0" position="sticky" top={0} zIndex={10}>
                <Box display="flex" alignItems="center" gap={1.5}>
                    <MenuBookIcon sx={{ color: '#4338ca', fontSize: 28 }} />
                    <Typography variant="h6" fontWeight="bold" color="#1e293b">
                        アプリの思想と使い方ガイド
                    </Typography>
                </Box>
                <IconButton onClick={onClose} sx={{ color: '#64748b', '&:hover': { bgcolor: '#f1f5f9' } }}>
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Content */}
            <Box p={{ xs: 2, sm: 3 }}>
                <Typography variant="body2" color="text.secondary" mb={3} lineHeight={1.6}>
                    このアプリは、個人事業主・フリーランスの方の「面倒な確定申告」をAIで脳死化するとともに、ビジネスと個人の生活という両輪のキャッシュフローをシームレスに管理するために設計されています。
                </Typography>

                <Accordion defaultExpanded elevation={0} sx={{ mb: 2, borderRadius: '12px !important', overflow: 'hidden', border: '1px solid #e2e8f0', '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#4338ca' }} />} sx={{ bgcolor: '#eff6ff' }}>
                        <Box display="flex" alignItems="center" gap={1.5}>
                            <LightbulbIcon sx={{ color: '#3b82f6' }} />
                            <Typography fontWeight="bold" color="#1e3a8a">1. なぜ「ビジネス」と「家計」を分けるのか？（設計思想）</Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ bgcolor: '#ffffff', p: 3 }}>
                        <Typography variant="subtitle2" fontWeight="bold" color="primary.main" gutterBottom>① 「入り口」は徹底的に分離（税法と経営分析のため）</Typography>
                        <Typography variant="body2" paragraph color="text.secondary" lineHeight={1.7}>
                            税法上、事業の経費と個人の生活費（家事費）は厳密に分ける必要があります。このアプリでは「プライベート仕訳」のスイッチを入れるだけで、確定申告用の帳簿や事業用アナリティクスから生活費が完全に除外されます。<br />
                            これにより、脱税リスクを防ぐだけでなく、「ビジネス単体でどれだけ稼ぐ力（営業利益率）があるか」を生活水準のインフレに邪魔されることなく正確に測ることができます。
                        </Typography>

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="subtitle2" fontWeight="bold" color="primary.main" gutterBottom>② 「出口」で合算し、真の貯金力を知る</Typography>
                        <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
                            法人とは異なり、個人事業主の「真の生活基盤」は事業の利益そのものです。分析画面の「真の手残り資金」では、あえて『事業の利益 ＋ プライベート収入 － 家計支出』を合算計算しています。<br />
                            これにより「今年はビジネスで稼いだが、生活費で使いすぎて結局手元にお金が残っていない」といった、個人の本質的な資産防衛力（本当に残る現金）を可視化しています。
                        </Typography>
                    </AccordionDetails>
                </Accordion>

                <Accordion elevation={0} sx={{ mb: 2, borderRadius: '12px !important', overflow: 'hidden', border: '1px solid #e2e8f0', '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#ffffff', '&:hover': { bgcolor: '#f8fafc' } }}>
                        <Box display="flex" alignItems="center" gap={1.5}>
                            <CheckIcon sx={{ color: '#10b981' }} />
                            <Typography fontWeight="bold" color="#334155">2. 仕訳入力と家計簿の基本ルール</Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ bgcolor: '#ffffff', p: 3, pt: 1, borderTop: '1px solid #f1f5f9' }}>
                        <List disablePadding>
                            <ListItem alignItems="flex-start" sx={{ px: 0, py: 1 }}>
                                <ListItemIcon sx={{ minWidth: 28, mt: 0.5 }}><CheckIcon sx={{ fontSize: 18, color: '#10b981' }}/></ListItemIcon>
                                <ListItemText 
                                    primary={<Typography variant="subtitle2" fontWeight="bold">事業と生活の境界線</Typography>}
                                    secondary="個人用クレジットカードで経費を払った場合は「事業主借」、事業用口座から生活費を引き出した場合は「事業主貸」を使うのが青色申告の基本です。"
                                    secondaryTypographyProps={{ fontSize: '0.85rem', mt: 0.5, lineHeight: 1.6 }}
                                />
                            </ListItem>
                            <ListItem alignItems="flex-start" sx={{ px: 0, py: 1 }}>
                                <ListItemIcon sx={{ minWidth: 28, mt: 0.5 }}><CheckIcon sx={{ fontSize: 18, color: '#10b981' }}/></ListItemIcon>
                                <ListItemText 
                                    primary={<Typography variant="subtitle2" fontWeight="bold">プライベート（家計簿）入力</Typography>}
                                    secondary="入力画面で「プライベートな支出等」トグルをONにすると、青色申告には載らない「家計専用の帳簿」として記録されます。勘定科目も家計用のもの（9800番台、9900番台）だけが選べるようになり、複式簿記の恩恵を受けながら正確な家計簿が作成できます。"
                                    secondaryTypographyProps={{ fontSize: '0.85rem', mt: 0.5, lineHeight: 1.6 }}
                                />
                            </ListItem>
                        </List>
                    </AccordionDetails>
                </Accordion>

                <Accordion elevation={0} sx={{ mb: 2, borderRadius: '12px !important', overflow: 'hidden', border: '1px solid #e2e8f0', '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#ffffff', '&:hover': { bgcolor: '#f8fafc' } }}>
                        <Box display="flex" alignItems="center" gap={1.5}>
                            <CameraIcon sx={{ color: '#f59e0b' }} />
                            <Typography fontWeight="bold" color="#334155">3. AI機能（写真・CSV）の上手な使い方</Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ bgcolor: '#ffffff', p: 3, pt: 1, borderTop: '1px solid #f1f5f9' }}>
                        <List disablePadding>
                            <ListItem alignItems="flex-start" sx={{ px: 0, py: 1 }}>
                                <ListItemIcon sx={{ minWidth: 28, mt: 0.5 }}><CheckIcon sx={{ fontSize: 18, color: '#f59e0b' }}/></ListItemIcon>
                                <ListItemText 
                                    primary={<Typography variant="subtitle2" fontWeight="bold">写真でイッキに解析</Typography>}
                                    secondary="レシートの写真を複数枚同時に選択してアップロードできます。Gemini AIが日付、金額、適当な勘定科目を推論します。解析プレビュー画面で「プライベート」スイッチをONにすれば、そのまま家計簿として登録可能です。"
                                    secondaryTypographyProps={{ fontSize: '0.85rem', mt: 0.5, lineHeight: 1.6 }}
                                />
                            </ListItem>
                            <ListItem alignItems="flex-start" sx={{ px: 0, py: 1 }}>
                                <ListItemIcon sx={{ minWidth: 28, mt: 0.5 }}><CheckIcon sx={{ fontSize: 18, color: '#f59e0b' }}/></ListItemIcon>
                                <ListItemText 
                                    primary={<Typography variant="subtitle2" fontWeight="bold">CSV一括インポート</Typography>}
                                    secondary="銀行やクレジットカードの明細CSVを取り込む機能です。勘定科目は完全一致で自動マッピングされ、一致しないものは「不明」となります。画面内のトグルで「一括プライベート登録」も可能です。"
                                    secondaryTypographyProps={{ fontSize: '0.85rem', mt: 0.5, lineHeight: 1.6 }}
                                />
                            </ListItem>
                        </List>
                    </AccordionDetails>
                </Accordion>

                <Accordion elevation={0} sx={{ borderRadius: '12px !important', overflow: 'hidden', border: '1px solid #e2e8f0', '&:before': { display: 'none' } }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#ffffff', '&:hover': { bgcolor: '#f8fafc' } }}>
                        <Box display="flex" alignItems="center" gap={1.5}>
                            <GraphIcon sx={{ color: '#8b5cf6' }} />
                            <Typography fontWeight="bold" color="#334155">4. レポート・分析画面の見方</Typography>
                        </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ bgcolor: '#ffffff', p: 3, pt: 1, borderTop: '1px solid #f1f5f9' }}>
                        <Typography variant="body2" color="text.secondary" paragraph lineHeight={1.6}>
                            ホーム画面では、最新の記帳データから高度な経営・家計分析を自動生成します。
                        </Typography>
                        <List disablePadding>
                            <ListItem alignItems="flex-start" sx={{ px: 0, py: 0.5 }}>
                                <ListItemText 
                                    primary={<Typography variant="subtitle2" fontWeight="bold" color="#8b5cf6">ビジネスアナリティクス</Typography>}
                                    secondary="現在の利益ペースで何ヶ月分の固定費を賄えるか（Runway）や、異常な経費のジャンプ、隠れたサブスクリプション契約の検知を行います。"
                                    secondaryTypographyProps={{ fontSize: '0.85rem', mt: 0.5, lineHeight: 1.6 }}
                                />
                            </ListItem>
                            <ListItem alignItems="flex-start" sx={{ px: 0, py: 0.5 }}>
                                <ListItemText 
                                    primary={<Typography variant="subtitle2" fontWeight="bold" color="#8b5cf6">家計簿・プライベート</Typography>}
                                    secondary="エンゲル係数（食費の割合）や、急増した娯楽費等のムダ遣いを自動警告します。ビジネスの成績から実際にいくらの「真の手残り資金」が生まれているかを要チェックです。"
                                    secondaryTypographyProps={{ fontSize: '0.85rem', mt: 0.5, lineHeight: 1.6 }}
                                />
                            </ListItem>
                        </List>
                    </AccordionDetails>
                </Accordion>
                
                <Box mt={4} textAlign="center">
                    <Typography variant="caption" color="text.secondary">
                        AI脳死申告 v1.5
                    </Typography>
                </Box>
            </Box>
        </Drawer>
    );
}
