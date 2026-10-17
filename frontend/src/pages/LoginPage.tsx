import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Alert,
  InputAdornment,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Email,
  Groups,
  KeyboardCapslock,
  Lock,
  Map,
  PhoneAndroid,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '../services/api';
import { useAuthStore, ACTIVE_MUNICIPALITY_KEY } from '../store';
import { getApiErrorMessage } from '../utils/apiError';
import { prefetchCadastrosData, prefetchMapData } from '../utils/prefetchAppData';
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
  const [autoLogging, setAutoLogging] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const autoLoginTried = useRef(false);
  const { register, handleSubmit, formState, reset } = useForm<LoginForm>({
    mode: 'onSubmit',
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
    try {
      // Vai direto ao login: no Vercel a API acorda em ~2 s, sem "ping" antes.
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
            {[
              { label: 'Mapa real do município', Icon: Map },
              { label: 'Microáreas por ACS', Icon: Groups },
              { label: 'Funciona no celular', Icon: PhoneAndroid },
            ].map(({ label, Icon }) => (
              <Box
                key={label}
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
                <Icon sx={{ fontSize: 16 }} aria-hidden />
                {label}
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
          p: { xs: 0, sm: 4 },
          bgcolor: 'background.default',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            px: { xs: 2.5, sm: 4 },
            py: { xs: 4, sm: 4 },
            width: '100%',
            maxWidth: 420,
            border: { xs: 'none', sm: '1px solid' },
            borderColor: { sm: 'divider' },
            bgcolor: { xs: 'transparent', sm: 'background.paper' },
          }}
        >
          <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', alignItems: 'center', gap: 1, mb: 3 }}>
            <Box
              component="img"
              src={MUNICIPALITY_LOGO}
              alt={`Prefeitura de ${MUNICIPALITY_NAME}`}
              sx={{ height: 56, width: 'auto', maxWidth: 180, objectFit: 'contain' }}
            />
            <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
              SIGAPS
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {MUNICIPALITY_NAME} — {MUNICIPALITY_STATE}
            </Typography>
          </Box>

          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>
            Boas-vindas
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
              inputMode="email"
              error={!!formState.errors.email}
              helperText={formState.errors.email ? 'Informe seu e-mail.' : undefined}
              {...register('email', { required: true })}
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
              type={showPassword ? 'text' : 'password'}
              margin="normal"
              placeholder="Digite sua senha"
              autoComplete="current-password"
              error={!!formState.errors.password}
              helperText={
                formState.errors.password ? (
                  'Informe sua senha.'
                ) : capsLockOn ? (
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                    <KeyboardCapslock sx={{ fontSize: 14 }} aria-hidden />
                    Caps Lock ligado
                  </Box>
                ) : undefined
              }
              onKeyUp={(e) => setCapsLockOn(e.getModifierState?.('CapsLock') ?? false)}
              {...register('password', { required: true })}
              slotProps={{
                htmlInput: { 'data-testid': 'login-password' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock fontSize="small" color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        edge="end"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        aria-pressed={showPassword}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
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
                <>
                  <CircularProgress size={18} color="inherit" sx={{ mr: 1 }} aria-hidden />
                  Entrando…
                </>
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
            Secretaria Municipal de Saúde · {MUNICIPALITY_NAME}/{MUNICIPALITY_STATE}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
