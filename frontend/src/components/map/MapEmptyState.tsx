import {
  Box,
  Paper,
  Typography,
  Button,
  alpha,
  useTheme,
} from '@mui/material';
import { Map, Refresh, ContactSupport } from '@mui/icons-material';

interface MapEmptyStateProps {
  onImport?: () => void;
  canImport?: boolean;
}

export function MapEmptyState({ onImport, canImport = true }: MapEmptyStateProps) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: alpha(theme.palette.background.default, 0.35),
        backdropFilter: 'blur(4px)',
        p: 2,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4 },
          maxWidth: 440,
          textAlign: 'center',
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: 3,
            mx: 'auto',
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            color: 'primary.main',
          }}
        >
          {canImport ? <Map sx={{ fontSize: 40 }} /> : <ContactSupport sx={{ fontSize: 40 }} />}
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
          {canImport ? 'Não foi possível carregar as ruas' : 'Mapa sem ruas'}
        </Typography>

        {canImport ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
              Verifique sua internet e tente novamente. O sistema carrega as ruas do município
              automaticamente — normalmente você não precisa fazer nada.
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<Refresh />}
              onClick={onImport}
              sx={{ py: 1.5 }}
            >
              Tentar novamente
            </Button>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            O mapa ainda não tem ruas. Peça ao <strong>coordenador da APS</strong> para abrir o
            sistema uma vez — as ruas são carregadas automaticamente.
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
