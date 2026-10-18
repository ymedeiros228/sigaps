import { Box, Card, Typography, alpha, useTheme } from '@mui/material';
import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  /** Cor do ícone; sem cor, o ícone fica no verde do sistema. */
  color?: string;
  subtitle?: string;
}

/** Número em destaque com rótulo. Inteiros saem com separador de milhar (1.234). */
export function StatCard({ title, value, icon, color, subtitle }: StatCardProps) {
  const theme = useTheme();
  const tone = color ?? theme.palette.primary.main;
  const shown = typeof value === 'number' ? value.toLocaleString('pt-BR') : value;

  return (
    <Card sx={{ height: '100%', px: 2.25, py: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 550 }}>
          {title}
        </Typography>
        <Box
          aria-hidden
          sx={{
            width: 32,
            height: 32,
            borderRadius: '9px',
            display: 'grid',
            placeItems: 'center',
            color: tone,
            bgcolor: alpha(tone, theme.palette.mode === 'dark' ? 0.16 : 0.1),
            '& svg': { fontSize: 18 },
          }}
        >
          {icon}
        </Box>
      </Box>
      <Typography
        component="p"
        sx={{
          fontSize: '1.75rem',
          fontWeight: 700,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {shown}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: -0.5 }}>
          {subtitle}
        </Typography>
      )}
    </Card>
  );
}
