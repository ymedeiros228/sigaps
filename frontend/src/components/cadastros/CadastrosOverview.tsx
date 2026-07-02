import { Box, Button, Grid, Typography } from '@mui/material';
import { Add, LocalHospital, People, LocationCity, GridView, Upload } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from '../ui/StatCard';
import { acsApi, microareasApi, neighborhoodsApi, ubsApi } from '../../services/api';
import { useCadastros } from './CadastrosContext';
import type { CadastrosSectionId } from './cadastrosConfig';

type CadastrosOverviewProps = {
  municipalityId: string;
  section: CadastrosSectionId;
  onSectionChange: (section: CadastrosSectionId) => void;
  onAcsAction?: (action: 'new' | 'import') => void;
};

export function CadastrosOverview({
  municipalityId,
  section,
  onSectionChange,
  onAcsAction,
}: CadastrosOverviewProps) {
  const { canManageAcs } = useCadastros();

  const { data: ubs = [] } = useQuery({
    queryKey: ['ubs', municipalityId],
    queryFn: () => ubsApi.list(municipalityId).then((r) => r.data),
  });

  const { data: acs = [] } = useQuery({
    queryKey: ['acs', municipalityId],
    queryFn: () => acsApi.list(municipalityId).then((r) => r.data),
  });

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ['neighborhoods', municipalityId],
    queryFn: () => neighborhoodsApi.list(municipalityId).then((r) => r.data),
  });

  const { data: microareas = [] } = useQuery({
    queryKey: ['microareas', municipalityId],
    queryFn: () => microareasApi.list(municipalityId).then((r) => r.data),
  });

  const acsSemMicro = acs.filter((a) => !a.microarea).length;
  const acsAtivos = acs.filter((a) => a.status === 'ATIVO').length;

  const stats = [
    {
      title: 'UBS',
      section: 'ubs' as const,
      value: ubs.length,
      subtitle: undefined,
      icon: <LocalHospital />,
      color: '#2196F3',
    },
    {
      title: 'ACS',
      section: 'acs' as const,
      value: acs.length,
      subtitle:
        acs.length > 0
          ? `${acsAtivos} ativo(s)${acsSemMicro > 0 ? ` · ${acsSemMicro} sem microárea` : ''}`
          : 'Cadastre os agentes da equipe',
      icon: <People />,
      color: '#4CAF50',
    },
    {
      title: 'Bairros',
      section: 'bairros' as const,
      value: neighborhoods.length,
      subtitle: undefined,
      icon: <LocationCity />,
      color: '#FF9800',
    },
    {
      title: 'Microáreas',
      section: 'microareas' as const,
      value: microareas.length,
      subtitle: undefined,
      icon: <GridView />,
      color: '#9C27B0',
    },
  ];

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2}>
        {stats.map((stat) => (
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

      {section === 'acs' && canManageAcs && onAcsAction && (
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
            {acs.length === 0
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
