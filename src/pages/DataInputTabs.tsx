import { useState } from 'react';
import { Box, Tabs, Tab, Typography } from '@mui/material';
import CameraInput from './CameraInput';
import CSVImport from '../components/CSVImport';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`data-input-tabpanel-${index}`}
            aria-labelledby={`data-input-tab-${index}`}
            {...other}
            style={{ height: '100%' }}
        >
            {value === index && (
                <Box height="100%">
                    {children}
                </Box>
            )}
        </div>
    );
}

export default function DataInputTabs() {
    const [value, setValue] = useState(0);

    const handleChange = (_event: React.SyntheticEvent, newValue: number) => {
        setValue(newValue);
    };

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white' }}>
                <Tabs value={value} onChange={handleChange} variant="fullWidth" textColor="primary" indicatorColor="primary">
                    <Tab label={<Typography fontWeight="bold" sx={{ fontSize: { xs: '0.75rem', sm: '1rem' } }}>AI解析<br /><span style={{ fontSize: '0.65rem', fontWeight: 'normal' }}>(写真 / 画像 / 取引CSV)</span></Typography>} />
                    <Tab label={<Typography fontWeight="bold" sx={{ fontSize: { xs: '0.75rem', sm: '1rem' } }}>一括CSVインポート<br /><span style={{ fontSize: '0.65rem', fontWeight: 'normal' }}>(AI解析なし固定形式)</span></Typography>} />
                </Tabs>
            </Box>
            <Box flex={1}>
                <TabPanel value={value} index={0}>
                    <CameraInput />
                </TabPanel>
                <TabPanel value={value} index={1}>
                    <CSVImport />
                </TabPanel>
            </Box>
        </Box>
    );
}
