import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  alpha,
  useTheme,
} from '@mui/material';
import { WarningAmber } from '@mui/icons-material';

interface ClearPaintDialogProps {
  open: boolean;
  paintedCount: number;
  microareaName?: string;
  scope: 'all' | 'microarea';
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ClearPaintDialog({
  open,
  paintedCount,
  microareaName,
  scope,
  loading,
  onClose,
  onConfirm,
}: ClearPaintDialogProps) {
  const theme = useTheme();

  const title =
    scope === 'all' ? 'Limpar todas as pinturas?' : `Limpar ${microareaName ?? 'microárea'}?`;

  const description =
    scope === 'all'
      ? `Isso remove o vínculo de ${paintedCount} rua(s) pintada(s) em todas as microáreas. Você poderá pintar novamente rua por rua.`
      : `Isso remove ${paintedCount} rua(s) vinculada(s) à ${microareaName}. As outras microáreas não serão alteradas.`;

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{title}</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.warning.main, 0.1),
            border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
          }}
        >
          <WarningAmber color="warning" sx={{ mt: 0.25 }} />
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="contained" color="warning" onClick={onConfirm} disabled={loading || paintedCount === 0}>
          {loading ? 'Removendo…' : 'Sim, remover pintura'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
