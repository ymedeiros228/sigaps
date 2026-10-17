import { Box } from '@mui/material';

/**
 * Bolinha com a cor da microárea. Substitui o chip com fundo colorido e texto branco,
 * que ficava ilegível nas cores claras da paleta (amarelo, ciano).
 */
export function MicroareaDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        bgcolor: color,
        flexShrink: 0,
        display: 'inline-block',
        // Contorno discreto para a cor não sumir em fundo parecido (amarelo no claro, azul-marinho no escuro).
        boxShadow: (theme) => `0 0 0 1px ${theme.palette.divider}`,
      }}
    />
  );
}
