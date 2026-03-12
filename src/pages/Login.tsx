import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, Typography, TextField, Button, Paper, Alert } from '@mui/material';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const { user, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // If a user is already logged in, redirect them to the home page.
        // The ProtectedRoute component will handle enforcing access ranks.
        if (!authLoading && user) {
            navigate('/', { replace: true });
        }
    }, [user, authLoading, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // On success, AuthContext will handle state change
        } catch (err: any) {
            console.error(err);
            setError('ログインに失敗しました。メールアドレスとパスワードを確認してください。');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)',
                p: 2
            }}
        >
            <Paper elevation={12} sx={{ p: 4, width: '100%', maxWidth: 400, borderRadius: 4 }}>
                <Box display="flex" flexDirection="column" alignItems="center" mb={4}>
                    <AccountCircleIcon sx={{ fontSize: 64, color: '#4338ca', mb: 2 }} />
                    <Typography variant="h5" fontWeight="bold" align="center" color="text.primary">
                        SmartBiz Ledger
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center">
                        NOAHコミュニティのアカウントでログイン
                    </Typography>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                <form onSubmit={handleLogin}>
                    <TextField
                        fullWidth
                        label="メールアドレス"
                        type="email"
                        variant="outlined"
                        margin="normal"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={loading}
                    />
                    <TextField
                        fullWidth
                        label="パスワード"
                        type="password"
                        variant="outlined"
                        margin="normal"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                    />
                    <Button
                        fullWidth
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={loading}
                        sx={{
                            mt: 4,
                            mb: 2,
                            py: 1.5,
                            bgcolor: '#4338ca',
                            '&:hover': { bgcolor: '#3730a3' },
                            fontWeight: 'bold',
                            borderRadius: 2
                        }}
                    >
                        {loading ? 'ログイン中...' : 'ログイン'}
                    </Button>
                </form>

                <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 2 }}>
                    ※ GUARDIANランク以上のアカウントが必要です
                </Typography>
            </Paper>
        </Box>
    );
};
