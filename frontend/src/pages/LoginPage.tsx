import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Alert,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import { Email, Lock, Map } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../services/api';
import { useAuthStore, ACTIVE_MUNICIPALITY_KEY } from '../store';
import { getApiErrorMessage } from '../utils/apiError';
import { prefetchCadastrosData, prefetchMapData } from '../utils/prefetchAppData';
import { waitForApiReady } from '../utils/waitForApi';
import { MUNICIPALITY_LOGO, MUNICIPALITY_NAME, MUNICIPALITY_STATE } from '../constants/branding';
import {
  ensureDevAdminAuth,
  getDevLoginDefaults,
  isDevAutoLoginEnabled,
} from '../constants/devAuth';

interface LoginForm {
  email: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const logout = useAuthStore((s) => s.logout);
  const token = useAuthStore((s) => s.token);
  const devDefaults = getDevLoginDefaults();
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [wakeStatus, setWakeStatus] = useState<string | null>(null);
  const [autoLogging, setAutoLogging] = useState(false);
  const autoLoginTried = useRef(false);
  const { register, handleSubmit, formState, reset } = useForm<LoginForm>({
    defaultValues: devDefaults,
  });

  useEffect(() => {
    if (import.meta.env.DEV) {
      reset(getDevLoginDefaults());
    }
  }, [reset]);

  const doLogin = async (data: LoginForm) => {
    setError('');
    setConnecting(true);
    setWakeStatus('Conectando ao servidor…');
    try {
      await waitForApiReady(12, 5000, (attempt, max) => {
        if (attempt > 1) {
          setWakeStatus(`Servidor acordando… tentativa ${attempt} de ${max}`);
        }
      });
      setWakeStatus(null);
      const res = await authApi.login(data.email, data.password);
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      navigate('/', { replace: true });
      const muniId =
        res.data.user.municipalityId ?? localStorage.getItem(ACTIVE_MUNICIPALITY_KEY);
      if (muniId) {
        prefetchCadastrosData(queryClient, muniId);
        void prefetchMapData(queryClient, muniId);
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Email ou senha inválidos. Verifique suas credenciais.'));
      setAutoLogging(false);
    } finally {
      setConnecting(false);
      setWakeStatus(null);
    }
  };

  const onSubmit = async (data: LoginForm) => {
    await doLogin(data);
  };

  useEffect(() => {
    if (token) {
      navigate('/', { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    if (token || autoLoginTried.current || !isDevAutoLoginEnabled()) return;
    autoLoginTried.current = true;
    setAutoLogging(true);
    void ensureDevAdminAuth(
      () => useAuthStore.getState(),
      setAuth,
      logout,
    ).then((ok) => {
      if (ok) {
        const user = useAuthStore.getState().user;
        const muniId =
          user?.municipalityId ?? localStorage.getItem(ACTIVE_MUNICIPALITY_KEY);
        if (muniId) {
          prefetchCadastrosData(queryClient, muniId);
          void prefetchMapData(queryClient, muniId);
        }
        navigate('/', { replace: true });
      } else {
        setAutoLogging(false);
      }
    });
  }, [token, setAuth, logout, navigate, queryClient]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
      }}
    >
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'center',
          p: 6,
          background: 'linear-gradient(145deg, #0B1220 0%, #0F3D2E 45%, #00A86B 120%)',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -80,
            right: -80,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -60,
            left: -60,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 1, maxWidth: 440 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
            <Box
              component="img"
              src={MUNICIPALITY_LOGO}
              alt={`Prefeitura de ${MUNICIPALITY_NAME}`}
              sx={{
                height: 72,
                width: 'auto',
                maxWidth: 200,
                objectFit: 'contain',
                bgcolor: '#fff',
                borderRadius: 2,
                p: 1,
              }}
            />
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                SIGAPS
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                {MUNICIPALITY_NAME} — {MUNICIPALITY_STATE}
              </Typography>
            </Box>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, lineHeight: 1.3 }}>
            Gestão inteligente das microáreas da Atenção Primária à Saúde
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.9, lineHeight: 1.7, mb: 4 }}>
            Organize o território dos ACS sobre o mapa real do município. Vincule ruas às
            microáreas, visualize a cobertura e gere relatórios profissionais.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {['Mapa GIS', 'Microáreas', 'OpenStreetMap'].map((tag) => (
              <Box
                key={tag}
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                <Map sx={{ fontSize: 16 }} />
                {tag}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: { xs: 2, sm: 4 },
          bgcolor: 'background.default',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            width: '100%',
            maxWidth: 420,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', alignItems: 'center', gap: 1, mb: 3 }}>
            <Box
              component="img"
              src={MUNICIPALITY_LOGO}
              alt={`Prefeitura de ${MUNICIPALITY_NAME}`}
              sx={{ height: 56, width: 'auto', maxWidth: 180, objectFit: 'contain' }}
            />
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              SIGAPS
            </Typography>
          </Box>

          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Bem-vindo
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Acesse sua conta para continuar
          </Typography>

          {import.meta.env.DEV && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              Modo desenvolvimento: entrada automática como administrador
              {isDevAutoLoginEnabled() ? ' (admin@passagemfranca.ma.gov.br).' : ' desativada.'}
            </Alert>
          )}

          {autoLogging && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
              Entrando automaticamente...
            </Alert>
          )}

          {import.meta.env.PROD && !connecting && !autoLogging && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              Na hospedagem gratuita, o primeiro acesso do dia pode levar até 1 minuto enquanto o
              servidor acorda. Depois disso, o acesso fica rápido.
            </Alert>
          )}

          {connecting && !autoLogging && (
            <Alert severity="info" icon={<CircularProgress size={16} />} sx={{ mb: 2, borderRadius: 2 }}>
              {wakeStatus ?? 'Conectando ao servidor…'}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit(onSubmit)}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              margin="normal"
              placeholder="seu.email@municipio.ma.gov.br"
              autoComplete="email"
              slotProps={{
                htmlInput: { 'data-testid': 'login-email' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Email fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              fullWidth
              label="Senha"
              type="password"
              margin="normal"
              placeholder="Digite sua senha"
              autoComplete="current-password"
              {...register('password', { required: true })}
              slotProps={{
                htmlInput: { 'data-testid': 'login-password' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              data-testid="login-submit"
              sx={{ mt: 3, py: 1.4 }}
              disabled={formState.isSubmitting || autoLogging || connecting}
            >
              {formState.isSubmitting || autoLogging || connecting ? (
                <CircularProgress size={22} color="inherit" />
              ) : (
                'Entrar no sistema'
              )}
            </Button>
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mt: 3, display: 'block', textAlign: 'center' }}
          >
            Secretaria Municipal de Saúde — {MUNICIPALITY_NAME}/{MUNICIPALITY_STATE}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
