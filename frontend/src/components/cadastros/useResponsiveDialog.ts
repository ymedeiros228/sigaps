import { useMediaQuery, useTheme } from '@mui/material';

/**
 * Diálogos de cadastro: tela cheia no celular (xs), janela normal no computador.
 * Em tela cheia o papel perde o raio de 16 px do tema, e os botões do rodapé
 * ficam sempre visíveis porque só o conteúdo rola.
 *
 * Uso: `<Dialog {...useResponsiveDialog()} open={...}>`
 */
export function useResponsiveDialog() {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  return {
    fullScreen,
    slotProps: { paper: { sx: fullScreen ? { borderRadius: 0 } : undefined } },
  };
}

/**
 * Rodapé dos formulários: separado do conteúdo por uma linha e, no toque,
 * botões com 44 px de altura.
 */
export const dialogFormActionsSx = {
  px: 3,
  py: 2,
  gap: 1,
  borderTop: 1,
  borderColor: 'divider',
  '@media (pointer: coarse)': { '& .MuiButton-root': { minHeight: 44 } },
} as const;

/**
 * Quando um <form> envolve conteúdo e rodapé, ele precisa ser flexível para só o
 * conteúdo rolar e os botões principais continuarem à vista no celular.
 */
export const dialogFormSx = {
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 auto',
  minHeight: 0,
} as const;
