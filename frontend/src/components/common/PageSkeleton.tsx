import { Box, Card, CardContent, Skeleton, Typography } from '@mui/material';

/*
 * Esboços usados enquanto o código de uma tela (lazy) é baixado, no lugar da
 * rodinha solta no meio da tela. Seguem o layout das telas reais.
 */

/** Telas de lista (Cadastros, Administração): título, subtítulo, cartões e um bloco grande. */
export function PageSkeleton() {
  return (
    <Box role="status" aria-busy="true" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1280, mx: 'auto' }}>
      <Box component="span" sx={visuallyHidden}>
        Carregando…
      </Box>
      <Box aria-hidden>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h5">
            <Skeleton width={220} />
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            <Skeleton width="min(360px, 80%)" />
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 2,
            mb: 3,
          }}
        >
          {Array.from({ length: 3 }, (_, i) => (
            <Card key={i}>
              <CardContent>
                <Typography variant="body2">
                  <Skeleton width="50%" />
                </Typography>
                <Typography variant="h5">
                  <Skeleton width={56} />
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Card>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="h6">
              <Skeleton width="30%" />
            </Typography>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} variant="rounded" height={44} />
            ))}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

/** Mapa: um bloco do tamanho da área do mapa (altura da tela menos a barra do topo). */
export function MapSkeleton() {
  return (
    <Box role="status" aria-busy="true" sx={{ height: 'calc(100vh - 64px)', width: '100%' }}>
      <Box component="span" sx={visuallyHidden}>
        Carregando o mapa…
      </Box>
      <Skeleton variant="rectangular" width="100%" height="100%" aria-hidden />
    </Box>
  );
}

/** Texto só para leitor de tela (mesmo padrão do visuallyHidden do MUI). */
const visuallyHidden = {
  border: 0,
  clip: 'rect(0 0 0 0)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  position: 'absolute',
  whiteSpace: 'nowrap',
  width: '1px',
} as const;
