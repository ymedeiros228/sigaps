import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  type DialogProps,
} from '@mui/material';
import type { FormEventHandler, ReactNode } from 'react';

type CadastrosFormDialogProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  submitLabel?: string;
  loading?: boolean;
  maxWidth?: DialogProps['maxWidth'];
};

export function CadastrosFormDialog({
  open,
  title,
  onClose,
  onSubmit,
  children,
  submitLabel = 'Salvar',
  loading = false,
  maxWidth = 'sm',
}: CadastrosFormDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth={maxWidth} fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          {children}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={loading} startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}>
            {loading ? 'Salvando...' : submitLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
