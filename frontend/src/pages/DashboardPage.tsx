import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, CircularProgress, Chip, Button, Alert, IconButton, Tooltip as MuiTooltip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { Link as RouterLink } from 'react-router-dom';
import {
  LocalHospital,
  People,
  GridView,
  Signpost,
  FamilyRestroom,
  Groups,
  TrendingUp,
  Map,
  Refresh,
} from '@mui/icons-material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import { dashboardApi, municipalitiesApi } from '../services/api';
import { useMunicipalityId } from '../hooks/useMunicipalityId';
import { CACHE, queryKeys } from '../utils/queryKeys';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { formatAuditAction } from '../utils/permissions';
import { waitForApiReady } from '../utils/waitForApi';
import { isRetryableQueryError } from '../utils/queryRetry';

function dashboardErrorMessage(error: unknown) {
  if (isRetryableQueryError(error)) {
    return 'O servidor está acordando (hospedagem gratuita). Aguarde cerca de 1 minuto e tente novamente.';
  }
  const status = (error as AxiosError)?.response?.status;
  if (status === 403) return 'Você não tem permissão para ver estes indicadores.';
  if (status === 404) return 'Município não encontrado. Faça login novamente.';
  return 'Não foi possível carregar os indicadores. Verifique sua conexão e tente novamente.';
}

export function DashboardPage() {
  const municipalityId = useMunicipalityId();
  const [wakingServer, setWakingServer] = useState(false);
  const [apiReady, setApiReady] = useState(() => !import.meta.env.PROD);

  useEffect(() => {
    if (apiReady) return;
    let cancelled = false;
    setWakingServer(true);
    void waitForApiReady().then((ready) => {
      if (!cancelled) {
        setApiReady(ready);
        setWakingServer(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiReady]);

  const { data: municipality } = useQuery({
    queryKey: queryKeys.municipality(municipalityId!),
    queryFn: () => municipalitiesApi.get(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: CACHE.default,
  });

  const { data, isLoading, isError, error, refetch, isFetching, failureCount, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.dashboard(municipalityId!),
    queryFn: () => dashboardApi.indicators(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId && apiReady,
    staleTime: CACHE.dashboard,
  });

  if (!municipalityId) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: 8, gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Carregando dados do município…
        </Typography>
      </Box>
    );
  }

  if (wakingServer || (!apiReady && municipalityId)) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: 8, gap: 2 }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          Acordando o servidor…
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420, textAlign: 'center' }}>
          Na hospedagem gratuita, o primeiro acesso do dia pode levar até 1 minuto. Depois fica rápido.
        </Typography>
      </Box>
    );
  }

  if (isLoading || (isFetching && !data)) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', p: 8, gap: 1.5 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          {failureCount > 0 ? `Carregando indicadores… (tentativa ${failureCount + 1})` : 'Carregando indicadores…'}
        </Typography>
      </Box>
    );
  }

  if (isError || !data) {
    return (
      <Box sx={{ p: 3, maxWidth: 520, mx: 'auto', textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
          {dashboardErrorMessage(error)}
        </Alert>
        <Button variant="contained" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Tentando…' : 'Tentar novamente'}
        </Button>
      </Box>
    );
  }

  const muniLabel = municipality ? `${municipality.name}/${municipality.state}` : 'Município';
  const isEmpty = data.streets === 0 && data.microareas === 0;

  const stats = [
    { title: 'UBS', value: data.ubs, icon: <LocalHospital />, color: '#2196F3' },
    { title: 'ACS', value: data.acs, icon: <People />, color: '#4CAF50' },
    { title: 'Microáreas', value: data.microareas, icon: <GridView />, color: '#FF9800' },
    { title: 'Ruas', value: data.streets, icon: <Signpost />, color: '#9C27B0' },
    { title: 'Famílias', value: data.families, icon: <FamilyRestroom />, color: '#F44336' },
    { title: 'Habitantes', value: data.inhabitants, icon: <Groups />, color: '#00BCD4' },
  ];

  const pieData = [
    { name: 'Vinculadas', value: data.assignedStreets, color: '#4CAF50' },
    { name: 'Pendentes', value: Math.max(0, data.streets - data.assignedStreets), color: '#9E9E9E' },
  ];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
      <PageHeader
        title="Dashboard"
        subtitle={`Indicadores em tempo real — ${muniLabel}`}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              icon={<TrendingUp />}
              label={`${data.coverage}% cobertura`}
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
            <MuiTooltip title={dataUpdatedAt ? `Atualizado ${new Date(dataUpdatedAt).toLocaleTimeString('pt-BR')}` : 'Atualizar'}>
              <span>
                <IconButton
                  size="small"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  aria-label="Atualizar indicadores"
                >
                  <Refresh fontSize="small" sx={isFetching ? { animation: 'spin 1s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } } : undefined} />
                </IconButton>
              </span>
            </MuiTooltip>
          </Box>
        }
      />

      {isEmpty && (
        <Alert
          severity="info"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button component={RouterLink} to="/mapa" color="inherit" size="small" startIcon={<Map />}>
              Ir ao mapa
            </Button>
          }
        >
          Comece cadastrando microáreas e carregando as ruas do município para ver os indicadores.
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(6, 1fr)',
          },
          gap: 2,
        }}
      >
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 2fr' },
          gap: 2,
          mt: 3,
        }}
      >
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Cobertura territorial
            </Typography>
            <Typography variant="h2" color="primary" sx={{ fontWeight: 800, lineHeight: 1 }}>
              {data.coverage}%
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              {data.assignedStreets} de {data.streets} ruas vinculadas a microáreas
            </Typography>
            <Box sx={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Ruas por microárea
            </Typography>
            {(data.microareasChart ?? []).length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                Pinte ruas no mapa para ver a distribuição por microárea.
              </Typography>
            ) : (
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.microareasChart ?? []} barCategoryGap="20%">
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                    />
                    <Bar dataKey="streets" name="Ruas" radius={[6, 6, 0, 0]}>
                      {(data.microareasChart ?? []).map((entry: { color: string }, i: number) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>

      {data.recentChanges?.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Últimas alterações
            </Typography>
            {data.recentChanges.map((log: {
              id: string;
              action: string;
              entityType: string;
              createdAt: string;
              user: { name: string; role: string };
            }) => (
              <Box
                key={log.id}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  py: 1.25,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 0 },
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {log.user.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatAuditAction(log.action, log.entityType)}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {new Date(log.createdAt).toLocaleString('pt-BR')}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
