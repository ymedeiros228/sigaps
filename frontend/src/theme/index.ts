import { alpha, createTheme } from '@mui/material/styles';

/**
 * Cores do SIGAPS no estilo Apple (pedido do Yuri, 18/10): os cinzas do iOS/macOS e o
 * verde do sistema. O verde claro da Apple (#34C759) não serve para texto branco
 * (2:1); botões e textos usam o verde "acessível" da Apple (#248A3D, ~4,6:1).
 */
export const brand = {
  green: '#34C759',
  greenDeep: '#248A3D',
  greenInk: '#1B6E31',
  blue: '#007AFF',
  ink: '#1D1D1F',
};

const light = {
  bg: '#F2F2F7',
  paper: '#FFFFFF',
  sunken: '#F5F5F7',
  text: '#1D1D1F',
  textMuted: '#6E6E73',
  line: alpha('#3C3C43', 0.13),
  lineStrong: alpha('#3C3C43', 0.24),
};

const dark = {
  bg: '#000000',
  paper: '#1C1C1E',
  sunken: '#2C2C2E',
  text: '#F5F5F7',
  textMuted: '#98989D',
  line: alpha('#FFFFFF', 0.1),
  lineStrong: alpha('#FFFFFF', 0.18),
};

/** Sombras com deslocamento e desfoque, na cor da tinta (nunca preto puro). */
const shadow = {
  sm: `0 1px 2px ${alpha(brand.ink, 0.06)}, 0 1px 1px ${alpha(brand.ink, 0.04)}`,
  md: `0 6px 16px -4px ${alpha(brand.ink, 0.12)}, 0 2px 4px ${alpha(brand.ink, 0.06)}`,
  lg: `0 18px 40px -12px ${alpha(brand.ink, 0.22)}, 0 4px 10px ${alpha(brand.ink, 0.08)}`,
};

export const createAppTheme = (darkMode: boolean) => {
  const c = darkMode ? dark : light;
  const primaryMain = darkMode ? '#30D158' : brand.greenDeep;

  return createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: primaryMain,
        dark: darkMode ? '#28B04B' : brand.greenInk,
        light: darkMode ? '#5CE07D' : brand.green,
        contrastText: darkMode ? '#00210A' : '#FFFFFF',
      },
      // Azul, laranja e vermelho do sistema da Apple (no claro, a versão de alto contraste).
      secondary: {
        main: darkMode ? '#0A84FF' : '#0066CC',
        contrastText: '#FFFFFF',
      },
      success: { main: darkMode ? '#30D158' : '#248A3D' },
      warning: { main: darkMode ? '#FF9F0A' : '#C93400' },
      error: { main: darkMode ? '#FF453A' : '#D70015' },
      info: { main: darkMode ? '#0A84FF' : '#0066CC' },
      background: { default: c.bg, paper: c.paper },
      divider: c.line,
      text: { primary: c.text, secondary: c.textMuted },
      action: {
        hover: alpha(c.text, 0.05),
        selected: alpha(primaryMain, darkMode ? 0.16 : 0.1),
      },
    },
    typography: {
      // "Inter Variable" vem do @fontsource-variable/inter (importado no main.tsx).
      fontFamily: '"Inter Variable", "Inter", "Segoe UI", system-ui, sans-serif',
      h1: { fontWeight: 750, letterSpacing: '-0.03em' },
      h2: { fontWeight: 750, letterSpacing: '-0.03em' },
      h3: { fontWeight: 700, letterSpacing: '-0.025em' },
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.015em' },
      h6: { fontWeight: 650, letterSpacing: '-0.01em', fontSize: '1.0625rem' },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      body2: { lineHeight: 1.5 },
      button: { fontWeight: 600, letterSpacing: 0 },
      caption: { lineHeight: 1.45 },
      overline: { fontWeight: 650, letterSpacing: '0.06em' },
    },
    shape: { borderRadius: 12 },
    shadows: [
      'none',
      shadow.sm,
      shadow.sm,
      shadow.md,
      shadow.md,
      shadow.md,
      shadow.md,
      shadow.md,
      shadow.lg,
      ...Array(16).fill(shadow.lg),
    ] as never,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            backgroundColor: c.bg,
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 10,
            transition: 'background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease',
            '&:active': { transform: 'translateY(1px)' },
          },
          sizeLarge: { minHeight: 48, fontSize: '0.975rem' },
          outlined: {
            borderColor: c.lineStrong,
            '&:hover': { borderColor: alpha(primaryMain, 0.5), backgroundColor: alpha(primaryMain, 0.05) },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { transition: 'background-color 0.15s ease, color 0.15s ease' },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${c.line}`,
            boxShadow: darkMode ? 'none' : shadow.sm,
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: { padding: 20, '&:last-child': { paddingBottom: 20 } },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: c.line },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: c.paper,
            color: c.text,
            borderBottom: `1px solid ${c.line}`,
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            backgroundColor: c.paper,
            borderRight: `1px solid ${c.line}`,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            '&.Mui-selected': {
              backgroundColor: alpha(primaryMain, darkMode ? 0.16 : 0.1),
              color: darkMode ? primaryMain : brand.greenInk,
              '&:hover': {
                backgroundColor: alpha(primaryMain, darkMode ? 0.22 : 0.14),
              },
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: { height: 3, borderRadius: '3px 3px 0 0' },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, minHeight: 48, letterSpacing: 0 },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: darkMode ? alpha('#fff', 0.02) : c.paper,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: c.lineStrong },
            '&:hover:not(.Mui-focused):not(.Mui-error) .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(c.text, 0.36),
            },
            // Verde só sem erro: campo inválido continua vermelho mesmo com foco
            '&.Mui-focused:not(.Mui-error) .MuiOutlinedInput-notchedOutline': {
              borderColor: primaryMain,
              borderWidth: 2,
            },
            '&.Mui-focused.Mui-error .MuiOutlinedInput-notchedOutline': {
              borderWidth: 2,
            },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 16, boxShadow: shadow.lg },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { fontWeight: 700, letterSpacing: '-0.01em' },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { borderRadius: 12, border: `1px solid ${c.line}`, boxShadow: shadow.lg },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: { borderRadius: 12 },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            padding: '6px 10px',
            backgroundColor: darkMode ? '#F5F5F7' : '#1D1D1F',
            color: darkMode ? '#1D1D1F' : '#F5F5F7',
          },
          arrow: { color: darkMode ? '#F5F5F7' : '#1D1D1F' },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600, borderRadius: 8 },
          outlined: { borderColor: c.lineStrong },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            alignItems: 'flex-start',
            // Celular: o botão do aviso desce para baixo do texto em vez de espremer as palavras.
            '@media (max-width: 599.95px)': {
              flexWrap: 'wrap',
              '& .MuiAlert-action': { width: '100%', margin: 0, padding: '0 0 4px 34px' },
            },
          },
          message: { paddingTop: 9 },
          icon: { paddingTop: 9 },
          action: { paddingTop: 4 },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: c.line },
          head: {
            fontWeight: 650,
            fontSize: '0.78rem',
            color: c.textMuted,
            backgroundColor: darkMode ? alpha('#fff', 0.03) : c.sunken,
            whiteSpace: 'nowrap',
          },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 999, backgroundColor: alpha(primaryMain, 0.14) },
          bar: { borderRadius: 999 },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: { backgroundColor: alpha(c.text, darkMode ? 0.08 : 0.07) },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: { borderColor: c.line },
        },
      },
    },
  });
};
