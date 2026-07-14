import { Box, Card, CardContent, Typography, useTheme } from '@mui/material';
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

type PieSlice = { name: string; value: number; color: string };
type MicroareaBar = { name: string; streets: number; color: string };

type DashboardChartsProps = {
  coverage: number;
  assignedStreets: number;
  streets: number;
  pieData: PieSlice[];
  microareasChart: MicroareaBar[];
  hasPaintedMicroareas: boolean;
};

export function DashboardCharts({
  coverage,
  assignedStreets,
  streets,
  pieData,
  microareasChart,
  hasPaintedMicroareas,
}: DashboardChartsProps) {
  const theme = useTheme();

  return (
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
            {coverage}%
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
            {assignedStreets} de {streets} ruas vinculadas a microáreas
          </Typography>
          <Box sx={{ height: 200 }}>
            {streets === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                Nenhuma rua cadastrada ainda. Importe ruas no mapa para ver a cobertura.
              </Typography>
            ) : (
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
            )}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Ruas por microárea
          </Typography>
          {microareasChart.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              Cadastre microáreas para ver a distribuição territorial.
            </Typography>
          ) : (
            <>
              {!hasPaintedMicroareas && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Nenhuma rua pintada ainda — use o mapa para vincular ruas às microáreas.
                </Typography>
              )}
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={microareasChart} barCategoryGap="20%">
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 8,
                        border: 'none',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                        background: theme.palette.background.paper,
                      }}
                    />
                    <Bar dataKey="streets" name="Ruas" radius={[6, 6, 0, 0]}>
                      {microareasChart.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
