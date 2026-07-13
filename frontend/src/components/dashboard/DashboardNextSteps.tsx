import { Alert, Box, Button, LinearProgress, Typography } from '@mui/material';
import { LocalFireDepartment, MapOutlined, Storage } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { Link as RouterLink } from 'react-router-dom';
import { dashboardApi } from '../../services/api';
import { CACHE, queryKeys } from '../../utils/queryKeys';

type DashboardNextStepsProps = {
  municipalityId: string;
  coverage: number;
  families: number;
  streets: number;
  microareas: number;
  mapHomologatedAt?: string | null;
};

export function DashboardNextSteps({
  municipalityId,
  coverage,
  families,
  streets,
  microareas,
  mapHomologatedAt,
}: DashboardNextStepsProps) {
  const { data: checklist } = useQuery({
    queryKey: queryKeys.operationalChecklist(municipalityId),
    queryFn: () => dashboardApi.checklist(municipalityId).then((r) => r.data),
    staleTime: CACHE.dashboard,
  });

  if (mapHomologatedAt) return null;

  const readyForPainting =
    checklist?.readyForPainting ?? (streets > 0 && microareas > 0);
  const canOpenMap = streets > 0 && microareas > 0;

  const pendingData =
    checklist?.items.filter(
      (item) =>
        !item.done &&
        !item.optional &&
        !item.postDelivery &&
        (item.priority === 'critical' || item.id === 'cadastros-base'),
    ) ?? [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
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
            Antes de pintar no mapa
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

      {canOpenMap && coverage === 0 && (
        <Alert
          severity="success"
          icon={<MapOutlined />}
          action={
            <Button component={RouterLink} to="/mapa" color="inherit" size="small" variant="contained">
              Pintar no mapa
            </Button>
          }
          sx={{ borderRadius: 2, alignItems: 'center' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {readyForPainting
              ? 'Tudo pronto — comece a pintar quando quiser'
              : 'Mapa disponível — escolha a cor e pinte rua por rua'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {streets.toLocaleString('pt-BR')} ruas no município · modo arrastar no painel inferior ·
            atalhos P / E / S
          </Typography>
        </Alert>
      )}

      {streets > 0 && coverage > 0 && (
        <Alert
          severity="info"
          icon={<MapOutlined />}
          action={
            <Button component={RouterLink} to="/mapa" color="inherit" size="small" variant="outlined">
              Continuar pintando
            </Button>
          }
          sx={{ borderRadius: 2, alignItems: 'flex-start' }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
            Cobertura territorial: {coverage}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, coverage)}
            sx={{ mb: 0.75, height: 6, borderRadius: 3, maxWidth: 320 }}
          />
          <Typography variant="caption" color="text.secondary">
            Continue no seu ritmo. Use Guardar no painel quando quiser conferir o mapa.
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
              Ver calor
            </Button>
          }
          sx={{ borderRadius: 2, alignItems: 'center' }}
        >
          <Typography variant="body2">
            <strong>{families.toLocaleString('pt-BR')} famílias</strong> no mapa — toggle Famílias na
            barra superior (opcional).
          </Typography>
        </Alert>
      )}
    </Box>
  );
}
