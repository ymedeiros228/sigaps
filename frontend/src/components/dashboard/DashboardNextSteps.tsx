import { Alert, Box, Button, LinearProgress, Typography } from '@mui/material';
import {
  CheckCircle,
  FamilyRestroom,
  LocalFireDepartment,
  MapOutlined,
  PictureAsPdf,
  Storage,
  Sync,
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
  const readyForPainting = checklist?.readyForPainting ?? false;
  const familiesItem = checklist?.items.find((item) => item.id === 'families');
  const esusSyncItem = checklist?.items.find((item) => item.id === 'esus-sync');
  const familiesPending = familiesItem ? !familiesItem.done : families === 0;
  const esusSyncPending = esusSyncItem ? !esusSyncItem.done : false;
  const coverageGoal = 80;
  const coverageGap = Math.max(0, coverageGoal - coverage);

  const criticalDataItems =
    checklist?.items.filter(
      (item) => item.priority === 'critical' && item.id !== 'coverage',
    ) ?? [];
  const pendingData = criticalDataItems.filter((item) => !item.done);

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
              Guia de homologação
            </Button>
          }
          sx={{ borderRadius: 2, alignItems: 'flex-start' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Pronto para homologação pela SMS
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }} color="text.secondary">
            1) Gere o PDF A3 no mapa · 2) Leve à reunião da SMS · 3) Registre o aceite em
            Administração → Homologação.
          </Typography>
        </Alert>
      )}

      {pendingData.length > 0 && (
        <Alert
          severity="warning"
          icon={<Storage />}
          action={
            <Button
              component={RouterLink}
              to="/cadastros"
              color="inherit"
              size="small"
              variant="outlined"
            >
              Ver cadastros
            </Button>
          }
          sx={{ borderRadius: 2, alignItems: 'flex-start' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Preparar dados antes da pintura
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            {pendingData.map((item) => (
              <span key={item.id} style={{ display: 'block' }}>
                • {item.label}: {item.detail}
              </span>
            ))}
          </Typography>
        </Alert>
      )}

      {readyForPainting && coverage === 0 && (
        <Alert
          severity="success"
          icon={<MapOutlined />}
          action={
            <Button component={RouterLink} to="/mapa" color="inherit" size="small" variant="outlined">
              Abrir mapa
            </Button>
          }
          sx={{ borderRadius: 2, alignItems: 'center' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Cadastros prontos — mapa zerado para você pintar
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Ruas, microáreas e ACS já estão no sistema. A decisão territorial (quem pinta o quê) é
            sua — comece quando quiser no mapa.
          </Typography>
        </Alert>
      )}

      {streets > 0 && coverage > 0 && coverage < coverageGoal && (
        <Alert
          severity="info"
          icon={<MapOutlined />}
          action={
            <Button component={RouterLink} to="/mapa" color="inherit" size="small" variant="outlined">
              Ver mapa
            </Button>
          }
          sx={{ borderRadius: 2, alignItems: 'flex-start' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
            Seu progresso de pintura: {coverage}% (meta {coverageGoal}% para homologação)
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, coverage)}
            sx={{ mb: 0.75, height: 6, borderRadius: 3, maxWidth: 320 }}
          />
          <Typography variant="caption" color="text.secondary">
            {coverageGap > 0
              ? `Faltam cerca de ${coverageGap} pontos percentuais para a homologação do mapa oficial.`
              : 'Continue no seu ritmo até atingir a meta.'}
          </Typography>
        </Alert>
      )}

      {streets > 0 && families > 0 && coverage > 0 && (
        <Alert
          severity="info"
          icon={<LocalFireDepartment />}
          action={
            <Button
              component={RouterLink}
              to="/mapa?heatmap=1"
              color="inherit"
              size="small"
              variant="outlined"
            >
              Ver mapa de calor
            </Button>
          }
          sx={{ borderRadius: 2, alignItems: 'center' }}
        >
          <Typography variant="body2">
            <strong>{families.toLocaleString('pt-BR')} famílias</strong> importadas — ative a camada
            de calor no mapa para ver a densidade sobre a pintura das microáreas.
          </Typography>
        </Alert>
      )}

      {streets > 0 && familiesPending && (
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
            Importe o CSV do <strong>e-SUS</strong> para popular famílias e habitantes por logradouro
            (opcional para pintar; ative <strong>Famílias</strong> no mapa depois do import).
          </Typography>
        </Alert>
      )}

      {streets > 0 && !familiesPending && esusSyncPending && (
        <Alert
          severity="info"
          icon={<Sync />}
          action={
            <Button
              component={RouterLink}
              to="/cadastros?secao=municipio"
              color="inherit"
              size="small"
              variant="outlined"
            >
              Sincronizar e-SUS
            </Button>
          }
          sx={{ borderRadius: 2, alignItems: 'center' }}
        >
          <Typography variant="body2">
            Há importação e-SUS salva, mas ainda sem sincronização registrada. Use{' '}
            <strong>Sincronizar e-SUS</strong> em Cadastros → Município para atualizar os dados.
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
