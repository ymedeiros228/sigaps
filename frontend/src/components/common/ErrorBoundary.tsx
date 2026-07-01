import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Box, Button, Typography } from '@mui/material';

interface Props {
  children: ReactNode;
  title?: string;
  onRetry?: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[SIGAPS]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Box sx={{ p: 3, maxWidth: 520, mx: 'auto', mt: 4 }}>
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
              {this.props.title ?? 'Algo deu errado nesta tela'}
            </Typography>
            <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontSize: 12 }}>
              {this.state.error.message}
            </Typography>
          </Alert>
          <Button
            variant="contained"
            onClick={() => {
              this.setState({ error: null });
              this.props.onRetry?.();
              window.location.reload();
            }}
          >
            Recarregar página
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}
