import { lazy, Suspense, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Alert,
  IconButton,
  Tooltip as MuiTooltip,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useMediaQuery,
  type Theme,
} from '@mui/material';
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
  Download,
} from '@mui/icons-material';
import { municipalitiesApi } from '../services/api';
import { useMunicipalityId } from '../hooks/useMunicipalityId';
import { CACHE, queryKeys } from '../utils/queryKeys';
import { DashboardNextSteps } from '../components/dashboard/DashboardNextSteps';
import { DashboardChartsSkeleton, DashboardSkeleton } from '../components/dashboard/DashboardSkeleton';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { formatAuditAction } from '../utils/permissions';
import { dashboardApi, type AcsCoverageRow } from '../services/api';
import { shouldRetryCloudQuery, cloudQueryRetryDelay } from '../utils/queryRetry';
import { getApiErrorMessage } from '../utils/apiError';

const DashboardCharts = lazy(() =>
  import('../components/dashboard/DashboardCharts').then((m) => ({ default: m.DashboardCharts })),
);

function dashboardErrorMessage(error: unknown) {
  const status = (error as AxiosError)?.response?.status;
  if (status === 403) return 'Você não tem permissão para ver estes indicadores.';
  if (status === 404) return 'Município não encontrado. Faça login novamente.';
  if (status === 500) return 'Erro no servidor ao buscar indicadores. Tente novamente em instantes.';
  // Rede e servidor fora do ar: a mensagem comum diz "sem internet" só quando o
  // aparelho está mesmo offline; senão, que o servidor não respondeu.
  return getApiErrorMessage(error, 'Não foi possível carregar os indicadores. Tente novamente.');
}

export function DashboardPage() {
  const municipalityId = useMunicipalityId();
  const [csvLoading, setCsvLoading] = useState(false);
  const [showAllAcs, setShowAllAcs] = useState(false);
  const isPhone = useMediaQuery((t: Theme) => t.breakpoints.down('sm'));

  const { data: municipality } = useQuery({
    queryKey: queryKeys.municipality(municipalityId!),
    queryFn: () => municipalitiesApi.get(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: CACHE.default,
    retry: 2,
  });

  const { data, isLoading, isError, error, refetch, isFetching, failureCount, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.dashboard(municipalityId!),
    queryFn: () => dashboardApi.indicators(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: CACHE.dashboard,
    retry: (count, err) => shouldRetryCloudQuery(count, err),
    retryDelay: cloudQueryRetryDelay,
  });

  const { data: acsCoverage = [], isLoading: acsCoverageLoading } = useQuery({
    queryKey: queryKeys.acsCoverage(municipalityId!),
    queryFn: () => dashboardApi.acsCoverage(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId && !!data,
    staleTime: CACHE.dashboard,
    retry: (count, err) => shouldRetryCloudQuery(count, err),
    retryDelay: cloudQueryRetryDelay,
  });

  const downloadAcsCoverageCsv = async () => {
    if (!municipalityId) return;
    setCsvLoading(true);
    try {
      const { data: blob } = await dashboardApi.acsCoverageCsv(municipalityId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sigaps-cobertura-acs.csv';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setCsvLoading(false);
    }
  };

  if (!municipalityId) {
    return <DashboardSkeleton status="Carregando dados do município…" />;
  }

  if (isLoading && !data) {
    return (
      <DashboardSkeleton
        status={
          failureCount > 0
            ? `Carregando indicadores… (tentativa ${failureCount + 1})`
            : 'Carregando indicadores…'
        }
      />
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

  const muniLabel = municipality ? `${municipality.name}/${municipality.state}` : 'Passagem Franca/MA';
  const isEmpty = data.streets === 0 && data.microareas === 0;

  const stats = [
    { title: 'UBS', value: data.ubs, icon: <LocalHospital /> },
    { title: 'ACS', value: data.acs, icon: <People /> },
    { title: 'Microáreas', value: data.microareas, icon: <GridView /> },
    { title: 'Ruas', value: data.streets, icon: <Signpost /> },
    { title: 'Famílias', value: data.families, icon: <FamilyRestroom /> },
    { title: 'Habitantes', value: data.inhabitants, icon: <Groups /> },
  ];

  // ACS com microárea primeiro (na ordem da microárea), depois os demais por nome.
  const acsSorted = [...acsCoverage].sort((a: AcsCoverageRow, b: AcsCoverageRow) => {
    const an = a.microareaNumber;
    const bn = b.microareaNumber;
    if (an !== null && bn !== null) return an - bn;
    if (an !== null) return -1;
    if (bn !== null) return 1;
    return a.acsName.localeCompare(b.acsName, 'pt-BR');
  });
  const ACS_PREVIEW = 10;
  const acsRows = showAllAcs ? acsSorted : acsSorted.slice(0, ACS_PREVIEW);
  const acsWithMicroarea = acsSorted.filter((r: AcsCoverageRow) => r.microareaName).length;

  const microareasChart = data.microareasChart ?? [];
  const hasPaintedMicroareas = microareasChart.some((m: { streets: number }) => m.streets > 0);

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

      <DashboardNextSteps
        municipalityId={municipalityId}
        coverage={data.coverage}
        families={data.families}
        streets={data.streets}
        microareas={data.microareas}
        mapHomologatedAt={municipality?.mapHomologatedAt}
      />

      {isEmpty && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button component={RouterLink} to="/mapa" color="inherit" size="small" startIcon={<Map />}>
              Ir ao mapa
            </Button>
          }
        >
          Comece cadastrando microáreas e carregando as ruas do município para ver os indicadores.
        </Alert>
      )}

      {!isEmpty && (data.streetsWithoutNeighborhood ?? 0) > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button
              component={RouterLink}
              to="/cadastros?secao=bairros"
              color="inherit"
              size="small"
            >
              Vincular bairros
            </Button>
          }
        >
          {data.streetsWithoutNeighborhood} rua(s) ainda sem bairro — vincule para usar busca, pintar bairro e
          centralizar microáreas no mapa.
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))',
            lg: 'repeat(6, minmax(0, 1fr))',
          },
          gap: { xs: 1.5, sm: 2 },
        }}
      >
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </Box>

      <Suspense fallback={<DashboardChartsSkeleton />}>
        <DashboardCharts
          coverage={data.coverage}
          assignedStreets={data.assignedStreets}
          streets={data.streets}
          microareasChart={microareasChart}
          hasPaintedMicroareas={hasPaintedMicroareas}
        />
      </Suspense>

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1.5,
              mb: 2,
            }}
          >
            <Box>
              <Typography variant="h6" component="h2">
                Cobertura por ACS
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {acsCoverage.length > 0
                  ? `${acsCoverage.length} agentes ativos · ${acsWithMicroarea} com microárea`
                  : 'Ruas pintadas, famílias e participação no município por agente ativo'}
              </Typography>
            </Box>
            {acsCoverage.length > 0 && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Download />}
                onClick={() => void downloadAcsCoverageCsv()}
                disabled={csvLoading}
              >
                {csvLoading ? 'Exportando…' : 'Baixar CSV'}
              </Button>
            )}
          </Box>

          {acsCoverageLoading ? (
            <Box aria-busy="true" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} variant="rounded" height={i === 0 ? 48 : 52} />
              ))}
            </Box>
          ) : acsCoverage.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
              Cadastre ACS ativos e vincule microáreas para ver a cobertura territorial.
            </Typography>
          ) : isPhone ? (
            // Celular: lista compacta no lugar da tabela de 8 colunas.
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', border: 1, borderColor: 'divider', borderRadius: '10px' }}>
              {acsRows.map((row: AcsCoverageRow) => (
                <Box
                  component="li"
                  key={row.acsId}
                  sx={{
                    px: 1.75,
                    py: 1.25,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    '& + li': { borderTop: 1, borderColor: 'divider' },
                  }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                      {row.acsName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="p">
                      {row.microareaName ? `Microárea ${row.microareaNumber}` : 'Sem microárea'}
                      {' · '}
                      {row.streetCount} {row.streetCount === 1 ? 'rua' : 'ruas'}
                    </Typography>
                  </Box>
                  <Chip
                    label={`${row.streetCoveragePct}%`}
                    size="small"
                    color={row.streetCoveragePct >= 80 ? 'success' : row.streetCoveragePct >= 40 ? 'warning' : 'default'}
                    variant="outlined"
                  />
                </Box>
              ))}
            </Box>
          ) : (
            <TableContainer
              sx={{
                borderRadius: '10px',
                border: 1,
                borderColor: 'divider',
                overflow: 'auto',
              }}
            >
              <Table size="medium">
                <TableHead>
                  <TableRow>
                    {[
                      'ACS',
                      'Microárea',
                      'UBS',
                      'Ruas',
                      'Cobertura',
                      'Município',
                      'Famílias',
                      'Habitantes',
                    ].map((label) => (
                      <TableCell
                        key={label}
                        align={label === 'ACS' || label === 'Microárea' || label === 'UBS' ? 'left' : 'right'}
                        sx={{ whiteSpace: 'nowrap' }}
                      >
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {acsRows.map((row: AcsCoverageRow) => (
                    <TableRow key={row.acsId} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{row.acsName}</TableCell>
                      <TableCell>
                        {row.microareaName
                          ? `${row.microareaNumber} — ${row.microareaName}`
                          : '—'}
                      </TableCell>
                      <TableCell>{row.ubsName ?? '—'}</TableCell>
                      <TableCell align="right">
                        {row.streetCount}
                        {row.microareaStreetTotal > 0 && (
                          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                            / {row.microareaStreetTotal}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${row.streetCoveragePct}%`}
                          size="small"
                          color={row.streetCoveragePct >= 80 ? 'success' : row.streetCoveragePct >= 40 ? 'warning' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">{row.municipalitySharePct}%</TableCell>
                      <TableCell align="right">{row.familyCount}</TableCell>
                      <TableCell align="right">{row.inhabitantCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {acsSorted.length > ACS_PREVIEW && (
            <Button
              onClick={() => setShowAllAcs((v) => !v)}
              sx={{ mt: 1.5 }}
              aria-expanded={showAllAcs}
            >
              {showAllAcs ? 'Mostrar menos' : `Mostrar todos os ${acsSorted.length} agentes`}
            </Button>
          )}
        </CardContent>
      </Card>

      {data.recentChanges?.length > 0 && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
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
                  gap: 2,
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
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(log.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
