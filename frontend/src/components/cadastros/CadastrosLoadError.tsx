import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { Refresh } from '@mui/icons-material';

type CadastrosLoadErrorProps = {
  title: string;
  message?: string;
  onRetry?: () => void;
};

export function CadastrosLoadError({ title, message, onRetry }: CadastrosLoadErrorProps) {
  return (
    <Alert
      severity="error"
      sx={{ borderRadius: 2, mb: 2 }}
      action={
        onRetry ? (
          <Button color="inherit" size="small" startIcon={<Refresh />} onClick={onRetry}>
            Tentar de novo
          </Button>
        ) : undefined
      }
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {message && (
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {message}
        </Typography>
      )}
    </Alert>
  );
}

export function CadastrosBootstrapping({ hint }: { hint?: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        p: 8,
        minHeight: 320,
      }}
    >
      <CircularProgress />
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360, textAlign: 'center' }}>
        {hint ?? 'Carregando dados do município…'}
      </Typography>
    </Box>
  );
}
