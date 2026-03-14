import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, Typography, TextField, Button, Paper, Alert } from '@mui/material';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

export const Login: React.FC = () => {
    const [loginId, setLoginId] = useState('');
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
            let targetEmail = loginId.trim();

            // メールアドレス形式（@を含む）でない場合、NOAHユーザーIDとみなして公開プロフからメアドを検索する
            if (!targetEmail.includes('@')) {
                const usersRef = collection(db, 'artifacts', 'default-app-id', 'public', 'data', 'users');
                const q = query(usersRef, where('userId', '==', targetEmail));
                const snapshot = await getDocs(q);

                if (snapshot.empty) {
                    throw new Error('指定されたユーザーIDが見つかりません。');
                }

                targetEmail = snapshot.docs[0].data().email;

                if (!targetEmail) {
                    throw new Error('このユーザーIDにはメールアドレスが登録されていません。');
                }
            }

            await signInWithEmailAndPassword(auth, targetEmail, password);
            // On success, AuthContext will handle state change
        } catch (err: any) {
            console.error(err);
            if (err.message.includes('指定されたユーザーID') || err.message.includes('メールアドレスが登録されていません')) {
                setError(err.message);
            } else {
                setError('ログインに失敗しました。ID/メールアドレスとパスワードを確認してください。');
            }
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
                        AI脳死申告
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center">
                        NOAHコミュニティのアカウントでログイン
                    </Typography>
                </Box>

                {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                <form onSubmit={handleLogin}>
                    <TextField
                        fullWidth
                        label="メールアドレス または NOAHユーザーID"
                        type="text"
                        variant="outlined"
                        margin="normal"
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value)}
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
