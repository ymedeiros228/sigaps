import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { Verified } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { municipalitiesApi, type Municipality } from '../../services/api';
import { useAppStore, useAuthStore } from '../../store';
import { canAccessAdmin } from '../../utils/permissions';
import { queryKeys } from '../../utils/queryKeys';

export function MunicipalitySwitcher() {
  const user = useAuthStore((s) => s.user);
  const municipalityId = useAppStore((s) => s.municipalityId);
  const setMunicipalityId = useAppStore((s) => s.setMunicipalityId);
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const { data: municipalities = [] } = useQuery({
    queryKey: queryKeys.municipalities,
    queryFn: () => municipalitiesApi.list().then((r) => r.data),
    enabled: !!user && canAccessAdmin(user.role),
    staleTime: 60_000,
  });

  if (!canAccessAdmin(user?.role) || municipalities.length <= 1) return null;

  const pending = municipalities.find((m) => m.id === pendingId);
  const active = municipalities.find((m) => m.id === municipalityId);

  const applySwitch = (next: string) => {
    setMunicipalityId(next);
    void queryClient.invalidateQueries();
    setPendingId(null);
  };

  return (
    <>
      <Box sx={{ px: 2, pb: 2 }}>
        <FormControl size="small" fullWidth>
          <InputLabel id="municipality-switcher-label">Município ativo</InputLabel>
          <Select
            data-testid="municipality-switcher"
            labelId="municipality-switcher-label"
            label="Município ativo"
            value={municipalityId ?? ''}
            onChange={(e) => {
              const next = e.target.value;
              if (next && next !== municipalityId) setPendingId(next);
            }}
          >
            {municipalities.map((m) => (
              <MenuItem key={m.id} value={m.id} data-testid={`municipality-option-${m.name.toLowerCase()}`}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {m.name}/{m.state}
                  </Typography>
                  {m.mapHomologatedAt ? (
                    <Verified fontSize="inherit" color="success" aria-label="Homologado" />
                  ) : null}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {active?.mapHomologatedAt ? (
          <Chip
            size="small"
            color="success"
            icon={<Verified />}
            label="Mapa homologado"
            sx={{ mt: 1 }}
          />
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
            Troca o contexto de dados entre municípios cadastrados.
          </Typography>
        )}
      </Box>

      <ConfirmSwitchDialog
        open={!!pendingId}
        pending={pending}
        onCancel={() => setPendingId(null)}
        onConfirm={() => pendingId && applySwitch(pendingId)}
      />
    </>
  );
}

function ConfirmSwitchDialog({
  open,
  pending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  pending?: Municipality;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <Box data-testid="municipality-switch-dialog">
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
        <Button onClick={onCancel} data-testid="municipality-switch-cancel">
          Cancelar
        </Button>
        <Button variant="contained" onClick={onConfirm} data-testid="municipality-switch-confirm">
          Confirmar
        </Button>
      </DialogActions>
      </Box>
    </Dialog>
  );
}
