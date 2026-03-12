import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading, hasAccess } = useAuth();

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <CircularProgress />
            </Box>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!hasAccess) {
        return (
            <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="100vh" p={3} textAlign="center">
                <Typography variant="h5" color="error" gutterBottom fontWeight="bold">
                    アクセス権限がありません
                </Typography>
                <Typography variant="body1" color="text.secondary" mb={4}>
                    このアプリを利用するには、NOAHコミュニティで<br />
                    <strong>GUARDIANランク以上</strong>のアカウントが必要です。
                </Typography>
                <Button
                    variant="outlined"
                    onClick={() => signOut(auth)}
                >
                    別のアカウントでログイン
                </Button>
            </Box>
        );
    }

    return <>{children}</>;
};
