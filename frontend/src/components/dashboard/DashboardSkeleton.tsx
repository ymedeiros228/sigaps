import { Box, Card, CardContent, Skeleton, Typography } from '@mui/material';
import { PageHeader } from '../ui/PageHeader';

/*
 * Esboço do dashboard enquanto os dados chegam. Copia as mesmas medidas do
 * DashboardPage, do StatCard e do DashboardCharts (grade, paddings, alturas),
 * para a tela não "pular" quando o conteúdo de verdade aparece.
 * A Skeleton dentro da Typography herda a altura da linha daquela variante.
 */

/** Mesma grade dos 6 cartões do DashboardPage. */
const STATS_GRID = {
  xs: '1fr',
  sm: 'repeat(2, 1fr)',
  md: 'repeat(3, 1fr)',
  lg: 'repeat(6, 1fr)',
} as const;

/** Igual ao StatCard: ícone de 44 px (24 + padding) e duas linhas de texto. */
function StatCardSkeleton() {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ pt: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: 2.5, flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2">
              <Skeleton width="55%" />
            </Typography>
            <Typography variant="h5" sx={{ lineHeight: 1.2 }}>
              <Skeleton width={48} />
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

/** Esboço dos dois gráficos (cobertura + ruas por microárea), mesma grade e alturas. */
export function DashboardChartsSkeleton() {
  return (
    <Box
      aria-hidden
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: '1fr 2fr' },
        gap: 2,
        mt: 3,
      }}
    >
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            <Skeleton width="60%" />
          </Typography>
          <Typography variant="h2" sx={{ lineHeight: 1 }}>
            <Skeleton width={110} />
          </Typography>
          <Typography variant="body2" sx={{ mt: 1, mb: 2 }}>
            <Skeleton width="75%" />
          </Typography>
          <Box sx={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Skeleton variant="circular" width={150} height={150} />
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>
            <Skeleton width="35%" />
          </Typography>
          <Skeleton variant="rounded" height={280} />
        </CardContent>
      </Card>
    </Box>
  );
}

/**
 * Esboço da tela inteira do dashboard. O título "Dashboard" já aparece; no
 * lugar do subtítulo vai o texto de carregamento (mesma altura de linha), que
 * o leitor de tela anuncia (role="status").
 */
export function DashboardSkeleton({ status = 'Carregando indicadores…' }: { status?: string }) {
  return (
    <Box role="status" aria-busy="true" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
      <PageHeader
        title="Dashboard"
        subtitle={status}
        action={<Skeleton variant="rounded" width={140} height={32} sx={{ borderRadius: 4 }} aria-hidden />}
      />

      <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: STATS_GRID, gap: 2 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </Box>

      <DashboardChartsSkeleton />
    </Box>
  );
}
