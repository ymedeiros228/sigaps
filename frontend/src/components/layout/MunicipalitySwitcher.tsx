import { FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { municipalitiesApi } from '../../services/api';
import { useAppStore, useAuthStore } from '../../store';
import { canAccessAdmin } from '../../utils/permissions';

export function MunicipalitySwitcher() {
  const user = useAuthStore((s) => s.user);
  const municipalityId = useAppStore((s) => s.municipalityId);
  const setMunicipalityId = useAppStore((s) => s.setMunicipalityId);
  const queryClient = useQueryClient();

  const { data: municipalities = [] } = useQuery({
    queryKey: ['municipalities'],
    queryFn: () => municipalitiesApi.list().then((r) => r.data as Array<{ id: string; name: string; state: string }>),
    enabled: canAccessAdmin(user?.role),
  });

  if (!canAccessAdmin(user?.role) || municipalities.length <= 1) return null;

  return (
    <FormControl size="small" fullWidth sx={{ px: 2, pb: 2 }}>
      <InputLabel id="municipality-switcher-label">Município ativo</InputLabel>
      <Select
        labelId="municipality-switcher-label"
        label="Município ativo"
        value={municipalityId ?? ''}
        onChange={(e) => {
          const next = e.target.value;
          setMunicipalityId(next);
          void queryClient.invalidateQueries();
        }}
      >
        {municipalities.map((m) => (
          <MenuItem key={m.id} value={m.id}>
            {m.name}/{m.state}
          </MenuItem>
        ))}
      </Select>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        Troca o contexto de dados para suporte multi-município.
      </Typography>
    </FormControl>
  );
}
