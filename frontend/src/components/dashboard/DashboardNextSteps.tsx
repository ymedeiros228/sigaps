import { Alert, Box, Button, LinearProgress, Typography } from '@mui/material';
import {
  CheckCircle,
  FamilyRestroom,
  FormatPaint,
  PictureAsPdf,
  Verified,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { dashboardApi } from '../../services/api';
import { useAuthStore } from '../../store';
import { CACHE, queryKeys } from '../../utils/queryKeys';
import { canAccessAdmin } from '../../utils/permissions';

type DashboardNextStepsProps = {
  municipalityId: string;
  coverage: number;
  families: number;
  streets: number;
  mapHomologatedAt?: string | null;
};

export function DashboardNextSteps({
  municipalityId,
  coverage,
  families,
  streets,
  mapHomologatedAt,
}: DashboardNextStepsProps) {
  const user = useAuthStore((s) => s.user);
  const isAdmin = canAccessAdmin(user?.role);

  const { data: checklist } = useQuery({
    queryKey: queryKeys.operationalChecklist(municipalityId),
    queryFn: () => dashboardApi.checklist(municipalityId).then((r) => r.data),
    staleTime: CACHE.dashboard,
  });

  if (mapHomologatedAt) return null;

  const ready = checklist?.readyForHomologation ?? false;
  const coverageGoal = 80;
  const coverageGap = Math.max(0, coverageGoal - coverage);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
      {ready && isAdmin && (
        <Alert
          severity="success"
          icon={<Verified />}
          action={
            <Button
              component={RouterLink}
              to="/admin?tab=homologacao"
              color="inherit"
              size="small"
              variant="outlined"
            >
              Homologar mapa
            </Button>
          }
          sx={{ borderRadius: 2, alignItems: 'center' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Pronto para homologação pela SMS
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }} color="text.secondary">
            Gere o PDF A3, leve à secretaria e registre o aceite em Administração → Homologação.
          </Typography>
        </Alert>
      )}

      {streets > 0 && coverage < coverageGoal && (
        <Alert
          severity={coverage >= 50 ? 'info' : 'warning'}
          icon={<FormatPaint />}
          action={
            <Button component={RouterLink} to="/mapa" color="inherit" size="small" variant="outlined">
              Pintar mapa
            </Button>
          }
          sx={{ borderRadius: 2, alignItems: 'flex-start' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
            Cobertura territorial: {coverage}% (meta {coverageGoal}%)
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, coverage)}
            sx={{ mb: 0.75, height: 6, borderRadius: 3, maxWidth: 320 }}
          />
          <Typography variant="caption" color="text.secondary">
            {coverageGap > 0
              ? `Faltam cerca de ${coverageGap} pontos percentuais para a homologação do mapa oficial.`
              : 'Continue pintando ruas até atingir a meta.'}
          </Typography>
        </Alert>
      )}

      {streets > 0 && families === 0 && (
        <Alert
          severity="info"
          icon={<FamilyRestroom />}
          action={
            <Button
              component={RouterLink}
              to="/cadastros?secao=municipio"
              color="inherit"
              size="small"
              variant="outlined"
            >
              Importar e-SUS
            </Button>
          }
          sx={{ borderRadius: 2, alignItems: 'center' }}
        >
          <Typography variant="body2">
            Importe o CSV do <strong>e-SUS</strong> para popular famílias e habitantes por logradouro.
          </Typography>
        </Alert>
      )}

      {!ready && coverage >= coverageGoal && streets > 0 && (
        <Alert
          severity="info"
          icon={<CheckCircle />}
          action={
            <Button component={RouterLink} to="/mapa" color="inherit" size="small" variant="outlined" startIcon={<PictureAsPdf />}>
              Ver mapa / PDF
            </Button>
          }
          sx={{ borderRadius: 2, alignItems: 'center' }}
        >
          <Typography variant="body2">
            Cobertura OK. Conclua os itens críticos do checklist (ACS, microáreas, UBS) para liberar a homologação.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}
