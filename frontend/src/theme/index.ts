import { alpha, createTheme } from '@mui/material/styles';

/**
 * Cores do SIGAPS. O verde da marca (#00A86B) é claro demais para texto branco
 * (3:1); botões e textos usam o verde mais fundo (~5:1), e o verde da marca fica
 * para destaques sobre fundo escuro.
 */
export const brand = {
  green: '#00A86B',
  greenDeep: '#08774F',
  greenInk: '#065C3D',
  blue: '#1E6FD9',
  ink: '#13201A',
};

const light = {
  bg: '#F3F6F4',
  paper: '#FFFFFF',
  sunken: '#EBF0ED',
  text: '#13201A',
  textMuted: '#52615A',
  line: alpha('#13201A', 0.1),
  lineStrong: alpha('#13201A', 0.18),
};

const dark = {
  bg: '#0C1210',
  paper: '#131B18',
  sunken: '#0F1714',
  text: '#E9F0EC',
  textMuted: '#A2B1AA',
  line: alpha('#E9F0EC', 0.09),
  lineStrong: alpha('#E9F0EC', 0.16),
};

/** Sombras com deslocamento e desfoque, na cor da tinta (nunca preto puro). */
const shadow = {
  sm: `0 1px 2px ${alpha(brand.ink, 0.06)}, 0 1px 1px ${alpha(brand.ink, 0.04)}`,
  md: `0 6px 16px -4px ${alpha(brand.ink, 0.12)}, 0 2px 4px ${alpha(brand.ink, 0.06)}`,
  lg: `0 18px 40px -12px ${alpha(brand.ink, 0.22)}, 0 4px 10px ${alpha(brand.ink, 0.08)}`,
};

export const createAppTheme = (darkMode: boolean) => {
  const c = darkMode ? dark : light;
  const primaryMain = darkMode ? '#2FC48C' : brand.greenDeep;

  return createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: primaryMain,
        dark: darkMode ? '#22A574' : brand.greenInk,
        light: darkMode ? '#5BD6A7' : brand.green,
        contrastText: darkMode ? '#04140D' : '#FFFFFF',
      },
      secondary: {
        main: darkMode ? '#6AA6F2' : brand.blue,
        contrastText: darkMode ? '#06172E' : '#FFFFFF',
      },
      success: { main: darkMode ? '#3CCB8F' : '#0A7D50' },
      warning: { main: darkMode ? '#F2B246' : '#B5600A' },
      error: { main: darkMode ? '#F2716B' : '#C62828' },
      info: { main: darkMode ? '#6AA6F2' : '#1C64C4' },
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
            backgroundColor: darkMode ? '#E9F0EC' : '#1B2A23',
            color: darkMode ? '#13201A' : '#F3F6F4',
          },
          arrow: { color: darkMode ? '#E9F0EC' : '#1B2A23' },
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
          root: { borderRadius: 12, alignItems: 'flex-start' },
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
