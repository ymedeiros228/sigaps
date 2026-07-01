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
  loadError?: boolean;
  autoRetrying?: boolean;
}

export function MapEmptyState({ onImport, canImport = true, loadError = false, autoRetrying = false }: MapEmptyStateProps) {
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
          {autoRetrying
            ? 'Reconectando ao servidor…'
            : loadError
              ? 'Não foi possível carregar as ruas'
              : canImport
                ? 'Mapa sem ruas'
                : 'Mapa sem ruas'}
        </Typography>

        {autoRetrying ? (
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            Tentando novamente automaticamente. Na hospedagem gratuita, o primeiro acesso do dia pode levar até 1 minuto.
          </Typography>
        ) : canImport ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
              {loadError
                ? 'Verifique sua internet e tente novamente. O sistema carrega as ruas do município automaticamente.'
                : 'As ruas serão carregadas automaticamente. Se nada acontecer, clique abaixo.'}
            </Typography>
            <Button
              variant="contained"
              size="large"
              startIcon={<Refresh />}
              onClick={onImport}
              sx={{ py: 1.5 }}
            >
              {loadError ? 'Tentar novamente' : 'Carregar ruas'}
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
