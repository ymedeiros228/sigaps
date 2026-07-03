import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';
import { getApiErrorMessage } from '../../utils/apiError';
import { canManageAcs, canManageCadastros, canManagePlaces, canDeleteCadastros, canDeleteAcs, canDeletePlaces, canDeleteMicroareas } from '../../utils/permissions';
import { useAuthStore } from '../../store';

type CadastrosContextValue = {
  canManage: boolean;
  canManageAcs: boolean;
  canManagePlaces: boolean;
  canDelete: boolean;
  canDeleteAcs: boolean;
  canDeletePlaces: boolean;
  canDeleteMicroareas: boolean;
  reportError: (error: unknown) => void;
  reportSuccess: (message: string) => void;
  confirmDelete: (label: string, onConfirm: () => void) => void;
};

const CadastrosContext = createContext<CadastrosContextValue>({
  canManage: false,
  canManageAcs: false,
  canManagePlaces: false,
  canDelete: false,
  canDeleteAcs: false,
  canDeletePlaces: false,
  canDeleteMicroareas: false,
  reportError: () => {},
  reportSuccess: () => {},
  confirmDelete: () => {},
});

export function useCadastros() {
  return useContext(CadastrosContext);
}

export function CadastrosProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const canManage = canManageCadastros(user?.role);
  const manageAcs = canManageAcs(user?.role);
  const managePlaces = canManagePlaces(user?.role);
  const deleteCadastros = canDeleteCadastros(user?.role);
  const deleteAcs = canDeleteAcs(user?.role);
  const deletePlaces = canDeletePlaces(user?.role);
  const deleteMicroareas = canDeleteMicroareas(user?.role);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ label: string; onConfirm: () => void } | null>(null);

  return (
    <CadastrosContext.Provider
      value={{
        canManage,
        canManageAcs: manageAcs,
        canManagePlaces: managePlaces,
        canDelete: deleteCadastros,
        canDeleteAcs: deleteAcs,
        canDeletePlaces: deletePlaces,
        canDeleteMicroareas: deleteMicroareas,
        reportError: (e) => setError(getApiErrorMessage(e)),
        reportSuccess: (message) => setSuccess(message),
        confirmDelete: (label, onConfirm) => setConfirm({ label, onConfirm }),
      }}
    >
      {children}
      <Snackbar open={!!error} autoHideDuration={5000} onClose={() => setError(null)}>
        <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 2 }}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess(null)}>
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ borderRadius: 2 }}>
          {success}
        </Alert>
      </Snackbar>
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Confirmar exclusão</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Tem certeza que deseja remover <strong>{confirm?.label}</strong>? Esta ação não pode ser desfeita.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirm(null)}>Cancelar</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              confirm?.onConfirm();
              setConfirm(null);
            }}
          >
            Remover
          </Button>
        </DialogActions>
      </Dialog>
    </CadastrosContext.Provider>
  );
}
