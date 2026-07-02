import { useState } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  Button,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { municipalitiesApi } from '../../services/api';
import { useAppStore, useAuthStore } from '../../store';
import { canAccessAdmin } from '../../utils/permissions';

export function MunicipalitySwitcher() {
  const user = useAuthStore((s) => s.user);
  const municipalityId = useAppStore((s) => s.municipalityId);
  const setMunicipalityId = useAppStore((s) => s.setMunicipalityId);
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: municipalities = [] } = useQuery({
    queryKey: ['municipalities'],
    queryFn: () =>
      municipalitiesApi.list().then(
        (r) => r.data as Array<{ id: string; name: string; state: string; mapHomologatedAt?: string | null }>,
      ),
    enabled: canAccessAdmin(user?.role),
  });

  if (!canAccessAdmin(user?.role) || municipalities.length <= 1) return null;

  const pending = municipalities.find((m) => m.id === pendingId);

  const applySwitch = (next: string) => {
    setMunicipalityId(next);
    void queryClient.invalidateQueries();
    setPendingId(null);
  };

  return (
    <>
      <FormControl size="small" fullWidth sx={{ px: 2, pb: 2 }}>
        <InputLabel id="municipality-switcher-label">Município ativo</InputLabel>
        <Select
          labelId="municipality-switcher-label"
          label="Município ativo"
          value={municipalityId ?? ''}
          onChange={(e) => {
            const next = e.target.value;
            if (next && next !== municipalityId) setPendingId(next);
          }}
        >
          {municipalities.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.name}/{m.state}
              {m.mapHomologatedAt ? ' ✓' : ''}
            </MenuItem>
          ))}
        </Select>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          Troca o contexto de dados para suporte multi-município.
        </Typography>
      </FormControl>

      <Dialog open={!!pendingId} onClose={() => setPendingId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Trocar município?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Os dados exibidos passarão a ser de{' '}
            <strong>
              {pending?.name}/{pending?.state}
            </strong>
            . Alterações não salvas em outras telas podem ser perdidas.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingId(null)}>Cancelar</Button>
          <Button variant="contained" onClick={() => pendingId && applySwitch(pendingId)}>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
