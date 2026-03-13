import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button } from '@mui/material';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <Box p={4} m={2} bgcolor="#fee2e2" border="1px solid #ef4444" borderRadius={2}>
                    <Typography variant="h5" color="error" gutterBottom>
                        アプリ内で予期せぬエラーが発生しました (CRASH DETECTED)
                    </Typography>
                    <Typography variant="body1" mb={2}>
                        この画面のスクリーンショットまたは以下のエラーメッセージをそのままコピーして報告してください。
                    </Typography>
                    <Box bgcolor="#fff" p={2} border="1px solid #fca5a5" borderRadius={1} mb={2} overflow="auto">
                        <Typography variant="body2" component="pre" color="error.dark" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {this.state.error && this.state.error.toString()}
                        </Typography>
                        {this.state.errorInfo && (
                            <Typography variant="caption" component="pre" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {this.state.errorInfo.componentStack}
                            </Typography>
                        )}
                    </Box>
                    <Button variant="contained" onClick={() => window.location.href = '/'}>
                        ホームに戻る
                    </Button>
                </Box>
            );
        }

        return this.props.children;
    }
}
