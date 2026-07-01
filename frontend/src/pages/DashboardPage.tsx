import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  LocalHospital,
  People,
  GridView,
  Signpost,
  FamilyRestroom,
  Groups,
} from '@mui/icons-material';
import { dashboardApi } from '../services/api';
import { useAppStore } from '../store';
import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: `${color}22`,
              color,
              display: 'flex',
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {value}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const municipalityId = useAppStore((s) => s.municipalityId);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', municipalityId],
    queryFn: () => dashboardApi.indicators(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
  });

  if (isLoading || !data) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const stats = [
    { title: 'UBS', value: data.ubs, icon: <LocalHospital />, color: '#2196F3' },
    { title: 'ACS', value: data.acs, icon: <People />, color: '#4CAF50' },
    { title: 'Microáreas', value: data.microareas, icon: <GridView />, color: '#FF9800' },
    { title: 'Ruas', value: data.streets, icon: <Signpost />, color: '#9C27B0' },
    { title: 'Famílias', value: data.families, icon: <FamilyRestroom />, color: '#F44336' },
    { title: 'Habitantes', value: data.inhabitants, icon: <Groups />, color: '#00BCD4' },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Indicadores em tempo real — Passagem Franca/MA
      </Typography>

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

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6">Cobertura territorial</Typography>
          <Typography variant="h3" color="primary" sx={{ fontWeight: 700 }}>
            {data.coverage}%
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {data.assignedStreets} de {data.streets} ruas vinculadas a microáreas
          </Typography>
        </CardContent>
      </Card>

      {data.recentChanges?.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
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
                  py: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 0 },
                }}
              >
                <Typography variant="body2">
                  <strong>{log.user.name}</strong> — {log.action} ({log.entityType})
                </Typography>
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
