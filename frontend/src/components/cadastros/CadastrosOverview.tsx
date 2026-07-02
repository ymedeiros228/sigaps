import { Box, Button, Grid, Skeleton, Typography } from '@mui/material';
import { Add, LocalHospital, People, LocationCity, GridView, Upload } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from '../ui/StatCard';
import { useCadastros } from './CadastrosContext';
import type { CadastrosSectionId } from './cadastrosConfig';
import { queryKeys } from '../../utils/queryKeys';
import { cadastrosQueryDefaults } from '../../utils/cadastrosQuery';
import { fetchCadastrosSummary } from '../../utils/fetchCadastrosData';
import { CadastrosLoadError } from './CadastrosLoadError';

type CadastrosOverviewProps = {
  municipalityId: string;
  section: CadastrosSectionId;
  onSectionChange: (section: CadastrosSectionId) => void;
  onAcsAction?: (action: 'new' | 'import') => void;
};

function StatCardSkeleton() {
  return (
    <Box sx={{ p: 2.5, borderRadius: 2, border: 1, borderColor: 'divider', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Skeleton variant="rounded" width={48} height={48} />
        <Box sx={{ flex: 1 }}>
          <Skeleton width="40%" height={18} />
          <Skeleton width="25%" height={32} sx={{ mt: 0.5 }} />
        </Box>
      </Box>
    </Box>
  );
}

export function CadastrosOverview({
  municipalityId,
  section,
  onSectionChange,
  onAcsAction,
}: CadastrosOverviewProps) {
  const { canManageAcs } = useCadastros();

  const {
    data: summary,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.cadastrosSummary(municipalityId),
    queryFn: () => fetchCadastrosSummary(municipalityId),
    enabled: !!municipalityId,
    ...cadastrosQueryDefaults,
  });

  const ubs = summary?.ubs ?? 0;
  const acs = summary?.acs ?? 0;
  const neighborhoods = summary?.neighborhoods ?? 0;
  const microareas = summary?.microareas ?? 0;
  const acsSemMicro = summary?.acsSemMicro ?? 0;
  const acsAtivos = summary?.acsAtivos ?? 0;
  const showSkeleton = isPending && !summary;

  const stats = [
    {
      title: 'UBS',
      section: 'ubs' as const,
      value: ubs,
      subtitle: undefined,
      icon: <LocalHospital />,
      color: '#2196F3',
    },
    {
      title: 'ACS',
      section: 'acs' as const,
      value: acs,
      subtitle:
        acs > 0
          ? `${acsAtivos} ativo(s)${acsSemMicro > 0 ? ` · ${acsSemMicro} sem microárea` : ''}`
          : 'Cadastre os agentes da equipe',
      icon: <People />,
      color: '#4CAF50',
    },
    {
      title: 'Bairros',
      section: 'bairros' as const,
      value: neighborhoods,
      subtitle: undefined,
      icon: <LocationCity />,
      color: '#FF9800',
    },
    {
      title: 'Microáreas',
      section: 'microareas' as const,
      value: microareas,
      subtitle: undefined,
      icon: <GridView />,
      color: '#9C27B0',
    },
  ];

  return (
    <Box sx={{ mb: 3 }}>
      {isError && (
        <CadastrosLoadError
          title="Erro ao carregar resumo"
          message={error instanceof Error ? error.message : 'Tente novamente.'}
          onRetry={() => void refetch()}
        />
      )}

      <Grid container spacing={2}>
        {showSkeleton
          ? Array.from({ length: 4 }).map((_, i) => (
              <Grid key={i} size={{ xs: 6, md: 3 }}>
                <StatCardSkeleton />
              </Grid>
            ))
          : stats.map((stat) => (
              <Grid key={stat.title} size={{ xs: 6, md: 3 }}>
                <Box
                  onClick={() => onSectionChange(stat.section)}
                  sx={{
                    cursor: 'pointer',
                    height: '100%',
                    outline: section === stat.section ? 2 : 0,
                    outlineColor: stat.color,
                    outlineOffset: 2,
                    borderRadius: 2,
                  }}
                >
                  <StatCard
                    title={stat.title}
                    value={stat.value}
                    icon={stat.icon}
                    color={stat.color}
                    subtitle={stat.subtitle}
                  />
                </Box>
              </Grid>
            ))}
      </Grid>

      {section === 'acs' && canManageAcs && onAcsAction && !showSkeleton && (
        <Box
          sx={{
            mt: 2,
            p: 2,
            borderRadius: 2,
            bgcolor: 'action.hover',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 200 }}>
            {acs === 0
              ? 'Comece cadastrando os ACS manualmente ou importando uma planilha.'
              : acsSemMicro > 0
                ? `${acsSemMicro} agente(s) ainda sem microárea — vincule na aba ACS ou em Microáreas.`
                : 'Todos os ACS estão vinculados a microáreas.'}
          </Typography>
          <Button size="small" variant="contained" startIcon={<Add />} onClick={() => onAcsAction('new')}>
            Novo ACS
          </Button>
          <Button size="small" variant="outlined" startIcon={<Upload />} onClick={() => onAcsAction('import')}>
            Importar planilha
          </Button>
        </Box>
      )}
    </Box>
  );
}
