import { Box, Grid } from '@mui/material';
import { LocalHospital, People, LocationCity, GridView } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { StatCard } from '../ui/StatCard';
import { acsApi, microareasApi, neighborhoodsApi, ubsApi } from '../../services/api';

type CadastrosOverviewProps = {
  municipalityId: string;
};

export function CadastrosOverview({ municipalityId }: CadastrosOverviewProps) {
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

  const stats = [
    { title: 'UBS', value: ubs.length, icon: <LocalHospital />, color: '#2196F3' },
    { title: 'ACS', value: acs.length, icon: <People />, color: '#4CAF50' },
    { title: 'Bairros', value: neighborhoods.length, icon: <LocationCity />, color: '#FF9800' },
    { title: 'Microáreas', value: microareas.length, icon: <GridView />, color: '#9C27B0' },
  ];

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2}>
        {stats.map((stat) => (
          <Grid key={stat.title} size={{ xs: 6, md: 3 }}>
            <StatCard {...stat} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
