import { Box, ButtonBase, Grid, Skeleton, Typography } from '@mui/material';
import { LocalHospital, People, LocationCity, GridView } from '@mui/icons-material';
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
};

/** Esqueleto com o mesmo desenho do StatCard (ícone à esquerda, rótulo e número). */
function StatCardSkeleton() {
  return (
    <Box sx={{ p: 2.5, borderRadius: 1, border: 1, borderColor: 'divider', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Skeleton variant="rounded" width={48} height={48} sx={{ flexShrink: 0, borderRadius: '10px' }} />
        <Box sx={{ flex: 1 }}>
          <Skeleton width="50%" height={18} />
          <Skeleton width="30%" height={32} sx={{ mt: 0.5 }} />
        </Box>
      </Box>
    </Box>
  );
}

export function CadastrosOverview({ municipalityId, section, onSectionChange }: CadastrosOverviewProps) {
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
    },
    {
      title: 'Bairros',
      section: 'bairros' as const,
      value: neighborhoods,
      subtitle: undefined,
      icon: <LocationCity />,
    },
    {
      title: 'Microáreas',
      section: 'microareas' as const,
      value: microareas,
      subtitle: undefined,
      icon: <GridView />,
    },
  ];

  // Dica de status dos ACS. Os botões "Novo ACS" e "Importar planilha" ficam só
  // no cabeçalho da seção ACS (antes apareciam repetidos aqui).
  const acsHint =
    acs === 0
      ? 'Comece cadastrando os ACS manualmente ou importando uma planilha.'
      : acsSemMicro > 0
        ? `${acsSemMicro} agente(s) ainda sem microárea — vincule na aba ACS ou em Microáreas.`
        : 'Todos os ACS estão vinculados a microáreas.';

  return (
    <Box sx={{ mb: 3 }}>
      {isError && (
        <CadastrosLoadError
          title="Erro ao carregar resumo"
          message={error instanceof Error ? error.message : 'Tente novamente.'}
          onRetry={() => void refetch()}
        />
      )}

      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        {showSkeleton
          ? Array.from({ length: 4 }).map((_, i) => (
              <Grid key={i} size={{ xs: 6, md: 3 }}>
                <StatCardSkeleton />
              </Grid>
            ))
          : stats.map((stat) => {
              const selected = section === stat.section;
              return (
                <Grid key={stat.title} size={{ xs: 6, md: 3 }} sx={{ minWidth: 0 }}>
                  <ButtonBase
                    onClick={() => onSectionChange(stat.section)}
                    aria-current={selected ? 'true' : undefined}
                    focusRipple
                    sx={{
                      display: 'block',
                      width: '100%',
                      height: '100%',
                      textAlign: 'left',
                      borderRadius: 1,
                      outline: selected ? 2 : 0,
                      outlineStyle: 'solid',
                      outlineColor: 'primary.main',
                      outlineOffset: 2,
                      fontVariantNumeric: 'tabular-nums',
                      '&.Mui-focusVisible': { outline: 2, outlineStyle: 'solid', outlineColor: 'primary.main' },
                    }}
                  >
                    <StatCard
                      title={stat.title}
                      value={stat.value}
                      icon={stat.icon}
                      subtitle={stat.subtitle}
                    />
                  </ButtonBase>
                </Grid>
              );
            })}
      </Grid>

      {section === 'acs' && canManageAcs && !showSkeleton && (
        <Typography
          variant="body2"
          color="text.secondary"
          role="status"
          sx={{ mt: 1.5, textWrap: 'pretty' }}
        >
          {acsHint}
        </Typography>
      )}
    </Box>
  );
}
