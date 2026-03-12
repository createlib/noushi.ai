import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { CssBaseline, ThemeProvider, createTheme, Box, AppBar, Toolbar, Typography, BottomNavigation, BottomNavigationAction, Paper, CircularProgress } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import ReceiptIcon from '@mui/icons-material/Receipt';
import SettingsIcon from '@mui/icons-material/Settings';

import { initDb } from './db/init';

import Home from './pages/Home';
import Ledger from './pages/Ledger';
import Settings from './pages/Settings';
import DataInputTabs from './pages/DataInputTabs';
import Report from './pages/Report';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { FiscalYearProvider, useFiscalYear } from './contexts/FiscalYearContext';
import { Select, MenuItem, FormControl } from '@mui/material';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/db';

function YearSelector() {
  const { selectedYear, setSelectedYear } = useFiscalYear();
  const currentYear = new Date().getFullYear();

  const allTx = useLiveQuery(() => db.transactions.toArray());

  let validYears = [currentYear];
  if (allTx) {
    const txYears = allTx
      .map(t => parseInt(t.date.substring(0, 4), 10))
      .filter(y => !isNaN(y) && y > 1900 && y < 2100);
    validYears = Array.from(new Set([...validYears, ...txYears])).sort((a, b) => b - a);
  }

  if (validYears.length < 5) {
    const minYears = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
    validYears = Array.from(new Set([...validYears, ...minYears])).sort((a, b) => b - a);
  }

  return (
    <FormControl size="small" variant="outlined" sx={{ minWidth: 100 }}>
      <Select
        value={selectedYear}
        onChange={(e) => setSelectedYear(Number(e.target.value))}
        sx={{
          bgcolor: 'rgba(16, 185, 129, 0.1)',
          color: 'primary.dark',
          fontWeight: 'bold',
          borderRadius: 4,
          '& .MuiOutlinedInput-notchedOutline': { border: 'none' }
        }}
      >
        {validYears.map(y => (
          <MenuItem key={y} value={y}>{y}年度</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

const theme = createTheme({
  palette: {
    primary: {
      main: '#4338ca', // Modern Indigo (SaaS feel)
      dark: '#312e81',
      light: '#6366f1',
    },
    secondary: {
      main: '#0ea5e9', // Sky blue for accents
    },
    background: {
      default: '#f1f5f9', // Slate 100 for a professional background
      paper: '#ffffff',
    },
    mode: 'light',
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    subtitle1: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 4, // slightly less rounded to prevent clipping
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          padding: '10px 16px',
        },
        contained: {
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
        elevation1: {
          boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        },
        elevation2: {
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        },
        elevation3: {
          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#ffffff',
          color: '#1e293b',
          boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          height: 64,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(8px)',
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        label: {
          fontWeight: 600,
          '&.Mui-selected': {
            fontSize: '0.75rem',
          },
        },
      },
    },
  },
});

function App() {
  const [navValue, setNavValue] = useState(0);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    initDb().then(() => {
      setInitialized(true);
    });
  }, []);

  if (!initialized) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <AuthProvider>
        <FiscalYearProvider>
          <CssBaseline />
          <BrowserRouter>
            <Box sx={{ pb: 7, maxWidth: '800px', mx: 'auto', width: '100%', minHeight: '100vh', bgcolor: 'background.default', boxShadow: '0 0 20px rgba(0,0,0,0.05)', position: 'relative' }}>
              <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', zIndex: 1100 }}>
                <Toolbar>
                  <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold', color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                    AI脳死申告
                  </Typography>
                  <YearSelector />
                </Toolbar>
              </AppBar>

              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                <Route path="/import" element={<ProtectedRoute><DataInputTabs /></ProtectedRoute>} />
                <Route path="/ledger" element={<ProtectedRoute><Ledger /></ProtectedRoute>} />
                <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              </Routes>

              {/* Navigation is only relevant for authenticated users viewing protected routes */}
              <Routes>
                <Route path="/login" element={null} />
                <Route path="*" element={
                  <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
                    <Paper sx={{ width: '100%', maxWidth: '800px', pb: 'env(safe-area-inset-bottom)', pointerEvents: 'auto', borderRadius: { xs: 0, md: '16px 16px 0 0' }, overflow: 'hidden' }} elevation={3}>
                      <BottomNavigation
                        showLabels
                        value={navValue}
                        onChange={(_, newValue) => {
                          setNavValue(newValue);
                        }}
                      >
                        <BottomNavigationAction component={Link} to="/" label="ホーム" icon={<HomeIcon />} />
                        <BottomNavigationAction component={Link} to="/ledger" label="仕訳帳" icon={<ReceiptIcon />} />
                        <BottomNavigationAction
                          component={Link}
                          to="/import"
                          label="データ入力"
                          icon={<CameraAltIcon sx={{ fontSize: 32, color: 'primary.main' }} />}
                        />
                        <BottomNavigationAction component={Link} to="/report" label="各種帳簿" icon={<AssessmentIcon />} />
                        <BottomNavigationAction component={Link} to="/settings" label="設定" icon={<SettingsIcon />} />
                      </BottomNavigation>
                    </Paper>
                  </Box>
                }
                />
              </Routes>
            </Box>
          </BrowserRouter>
        </FiscalYearProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
