import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  type DialogProps,
} from '@mui/material';
import type { FormEventHandler, ReactNode } from 'react';
import { dialogFormActionsSx, dialogFormSx, useResponsiveDialog } from './useResponsiveDialog';

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

/** Formulário de cadastro em diálogo: tela cheia no celular, rodapé sempre visível. */
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
  const responsive = useResponsiveDialog();

  return (
    <Dialog {...responsive} open={open} onClose={onClose} maxWidth={maxWidth} fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <Box component="form" onSubmit={onSubmit} sx={dialogFormSx}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          {children}
        </DialogContent>
        <DialogActions disableSpacing sx={dialogFormActionsSx}>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? 'Salvando...' : submitLabel}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
