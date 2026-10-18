import { Box, Card, CardContent, Typography, alpha, useTheme } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts';

type MicroareaBar = { name: string; streets: number; color: string };

type DashboardChartsProps = {
  coverage: number;
  assignedStreets: number;
  streets: number;
  microareasChart: MicroareaBar[];
  hasPaintedMicroareas: boolean;
};

export function DashboardCharts({
  coverage,
  assignedStreets,
  streets,
  microareasChart,
  hasPaintedMicroareas,
}: DashboardChartsProps) {
  const theme = useTheme();
  const pending = Math.max(0, streets - assignedStreets);
  const pct = Math.min(100, Math.max(0, coverage));
  const axisColor = theme.palette.text.secondary;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(300px, 1fr) minmax(0, 2fr)' },
        gap: 2,
        mt: 2,
      }}
    >
      <Card>
        <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" component="h2">
            Cobertura territorial
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            Ruas vinculadas a uma microárea
          </Typography>

          {streets === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
              Nenhuma rua cadastrada ainda. Importe ruas no mapa para ver a cobertura.
            </Typography>
          ) : (
            <Box sx={{ pt: 3 }}>
              <Typography
                component="p"
                sx={{
                  fontSize: { xs: '3rem', sm: '3.5rem' },
                  fontWeight: 750,
                  lineHeight: 1,
                  letterSpacing: '-0.04em',
                  color: 'primary.main',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {coverage}%
              </Typography>
              <Box
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Cobertura territorial"
                sx={{
                  mt: 2,
                  height: 12,
                  borderRadius: 999,
                  overflow: 'hidden',
                  bgcolor: alpha(theme.palette.text.primary, 0.08),
                }}
              >
                <Box
                  sx={{
                    width: `${pct}%`,
                    height: '100%',
                    borderRadius: 999,
                    bgcolor: 'primary.main',
                    transition: 'width 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              </Box>
              <Box
                component="dl"
                sx={{
                  m: 0,
                  mt: 2,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 1.5,
                  '& dt': { fontSize: 13, color: 'text.secondary' },
                  '& dd': { m: 0, fontWeight: 650, fontVariantNumeric: 'tabular-nums' },
                }}
              >
                <Box>
                  <Box component="dt" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box component="span" aria-hidden sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: 'primary.main' }} />
                    Vinculadas
                  </Box>
                  <dd>{assignedStreets.toLocaleString('pt-BR')} ruas</dd>
                </Box>
                <Box>
                  <Box component="dt" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box
                      component="span"
                      aria-hidden
                      sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: alpha(theme.palette.text.primary, 0.16) }}
                    />
                    Pendentes
                  </Box>
                  <dd>{pending.toLocaleString('pt-BR')} ruas</dd>
                </Box>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" component="h2">
            Ruas por microárea
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, mb: 2 }}>
            Cada barra na cor da microárea no mapa
          </Typography>
          {microareasChart.length === 0 || !hasPaintedMicroareas ? (
            <Box
              sx={{
                height: 220,
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                borderRadius: 1,
                border: 1,
                borderStyle: 'dashed',
                borderColor: 'divider',
                px: 3,
              }}
            >
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.75, mb: 1.5 }} aria-hidden>
                  {microareasChart.slice(0, 8).map((m) => (
                    <Box key={m.name} sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: m.color }} />
                  ))}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
                  {microareasChart.length === 0
                    ? 'Cadastre microáreas para ver a distribuição territorial.'
                    : `${microareasChart.length} microáreas prontas. As barras aparecem aqui conforme as ruas forem pintadas no mapa.`}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={microareasChart} barCategoryGap="22%" margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={theme.palette.divider} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: axisColor }}
                    tickLine={false}
                    axisLine={{ stroke: theme.palette.divider }}
                    interval={0}
                    angle={microareasChart.length > 8 ? -35 : 0}
                    textAnchor={microareasChart.length > 8 ? 'end' : 'middle'}
                    height={microareasChart.length > 8 ? 56 : 30}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: axisColor }} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: alpha(theme.palette.text.primary, 0.05) }}
                    contentStyle={{
                      borderRadius: 10,
                      border: `1px solid ${theme.palette.divider}`,
                      boxShadow: theme.shadows[8],
                      background: theme.palette.background.paper,
                      color: theme.palette.text.primary,
                      fontSize: 13,
                    }}
                    labelStyle={{ fontWeight: 650, marginBottom: 2 }}
                  />
                  <Bar dataKey="streets" name="Ruas" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {microareasChart.map((entry, i) => (
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
  );
}
