import { alpha, createTheme } from '@mui/material/styles';

const brand = {
  green: '#00A86B',
  greenDark: '#008F5A',
  blue: '#1E6FD9',
  navy: '#0B1220',
  slate: '#1A2332',
};

export const createAppTheme = (darkMode: boolean) =>
  createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: brand.green,
        dark: brand.greenDark,
        light: '#33C48A',
        contrastText: '#fff',
      },
      secondary: {
        main: brand.blue,
        light: '#4A8FE7',
        contrastText: '#fff',
      },
      background: darkMode
        ? { default: '#0B0F14', paper: '#141B24' }
        : { default: '#F0F4F8', paper: '#FFFFFF' },
      divider: darkMode ? alpha('#fff', 0.08) : alpha('#000', 0.08),
      text: darkMode
        ? { primary: '#F0F4F8', secondary: alpha('#F0F4F8', 0.65) }
        : { primary: '#1A2332', secondary: '#5A6B7D' },
    },
    typography: {
      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
      h4: { fontWeight: 800, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      button: { fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 10,
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
          contained: {
            background: `linear-gradient(135deg, ${brand.green} 0%, ${brand.greenDark} 100%)`,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${darkMode ? alpha('#fff', 0.06) : alpha('#000', 0.06)}`,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backdropFilter: 'blur(12px)',
            backgroundColor: darkMode ? alpha('#141B24', 0.85) : alpha('#fff', 0.9),
            borderBottom: `1px solid ${darkMode ? alpha('#fff', 0.06) : alpha('#000', 0.06)}`,
            boxShadow: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundImage: 'none',
            borderRight: `1px solid ${darkMode ? alpha('#fff', 0.06) : alpha('#000', 0.06)}`,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            mx: 1,
            mb: 0.5,
            '&.Mui-selected': {
              backgroundColor: darkMode ? alpha(brand.green, 0.15) : alpha(brand.green, 0.1),
              '&:hover': {
                backgroundColor: darkMode ? alpha(brand.green, 0.2) : alpha(brand.green, 0.14),
              },
            },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, minHeight: 48 },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': { borderRadius: 10 },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 600 },
        },
      },
    },
  });
