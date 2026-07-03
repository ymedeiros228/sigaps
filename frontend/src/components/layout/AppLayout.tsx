import {
  AppBar,
  Avatar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Map as MapIcon,
  Dashboard as DashboardIcon,
  Logout,
  DarkMode,
  LightMode,
  Menu as MenuIcon,
  ListAlt,
  HelpOutlined,
  AdminPanelSettings,
} from '@mui/icons-material';
import { BuildVersion } from '../common/BuildVersion';
import { HostingNotice } from '../common/HostingNotice';
import { useAppDataPrefetch } from '../../hooks/useAppDataPrefetch';
import { useMemo, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore, useAppStore } from '../../store';
import { MUNICIPALITY_NAME } from '../../constants/branding';
import { MunicipalityLogo } from '../common/MunicipalityLogo';
import { InstallPrompt } from '../common/InstallPrompt';
import { useMunicipalityId } from '../../hooks/useMunicipalityId';
import { canAccessAdmin, formatRoleLabel, isAcsUser } from '../../utils/permissions';
import { municipalitiesApi } from '../../services/api';
import { queryKeys } from '../../utils/queryKeys';
import { prefetchCadastrosData } from '../../utils/prefetchAppData';

const DRAWER_WIDTH = 260;

const baseNavItems = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { label: 'Pintar Mapa', path: '/mapa', icon: <MapIcon /> },
  { label: 'Cadastros', path: '/cadastros', icon: <ListAlt /> },
  { label: 'Ajuda', path: '/ajuda', icon: <HelpOutlined /> },
];

export function AppLayout() {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const darkMode = useAppStore((s) => s.darkMode);
  const toggleDarkMode = useAppStore((s) => s.toggleDarkMode);
  const [mobileOpen, setMobileOpen] = useState(false);
  const municipalityId = useMunicipalityId();
  const isAdmin = canAccessAdmin(user?.role);
  const isAcs = isAcsUser(user?.role);

  const { data: municipality } = useQuery({
    queryKey: queryKeys.municipality(municipalityId!),
    queryFn: () => municipalitiesApi.get(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
    staleTime: 5 * 60_000,
  });

  const navItems = useMemo(() => {
    if (isAcs) {
      return [
        { label: 'Minha microárea', path: '/mapa', icon: <MapIcon /> },
        { label: 'Ajuda', path: '/ajuda', icon: <HelpOutlined /> },
      ];
    }
    const items = [...baseNavItems];
    if (isAdmin) {
      items.push({
        label: 'Administração',
        path: '/admin',
        icon: <AdminPanelSettings />,
      });
    }
    return items;
  }, [isAdmin, isAcs]);

  const displayName = municipality?.name ?? MUNICIPALITY_NAME;
  const displayState = municipality?.state ? `${municipality.state}` : 'MA';

  useAppDataPrefetch();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2.5, py: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <MunicipalityLogo
            logoUrl={municipality?.logoUrl}
            alt={`Prefeitura de ${displayName}`}
            boxProps={{
              sx: {
                width: 40,
                height: 40,
                objectFit: 'contain',
                bgcolor: '#fff',
                borderRadius: 1.5,
                p: 0.5,
              },
            }}
          />
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              SIGAPS
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {displayName}/{displayState}
            </Typography>
          </Box>
        </Box>
      </Box>

      <List sx={{ px: 1, flex: 1 }}>
        {navItems.map((item) => {
          const selected =
            item.path === '/'
              ? location.pathname === '/' || location.pathname === '/dashboard'
              : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return (
            <ListItemButton
              key={item.path}
              selected={selected}
              onMouseEnter={() => {
                if (item.path === '/cadastros' && municipalityId) {
                  prefetchCadastrosData(queryClient, municipalityId);
                }
              }}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              sx={{
                py: 1.25,
                ...(item.path === '/admin'
                  ? {
                      '&.Mui-selected': {
                        bgcolor: 'warning.main',
                        color: 'warning.contrastText',
                        '&:hover': { bgcolor: 'warning.dark' },
                        '& .MuiListItemIcon-root': { color: 'inherit' },
                      },
                    }
                  : {}),
                '& .MuiListItemIcon-root': {
                  color: selected ? 'primary.main' : 'text.secondary',
                  minWidth: 40,
                },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{ primary: { sx: { fontWeight: selected ? 700 : 500 } } }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Box
        sx={{
          p: 2,
          m: 1.5,
          borderRadius: 2,
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              fontSize: 14,
              fontWeight: 700,
              bgcolor: 'primary.main',
            }}
          >
            {initials}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {user?.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {formatRoleLabel(user?.role)}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" color="default" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            edge="start"
            sx={{ display: { sm: 'none' } }}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, fontSize: '1rem' }}>
            Gestão Territorial da APS
          </Typography>
          <Tooltip title={darkMode ? 'Modo claro' : 'Modo escuro'}>
            <IconButton onClick={toggleDarkMode} size="small">
              {darkMode ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Sair">
            <IconButton onClick={handleLogout} size="small" color="error">
              <Logout fontSize="small" />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        {drawer}
      </Drawer>

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        {drawer}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <HostingNotice />
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 1 }}>
          <InstallPrompt />
        </Box>
        <Box className="page-enter" sx={{ minHeight: 'calc(100vh - 64px)' }}>
          <Outlet />
        </Box>
        <BuildVersion />
      </Box>
    </Box>
  );
}
