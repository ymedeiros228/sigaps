import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  InputAdornment,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  Email,
  KeyboardCapslock,
  Lock,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { authApi } from '../services/api';
import { useAuthStore } from '../store';
import { getApiErrorMessage } from '../utils/apiError';
import { MUNICIPALITY_LOGO, MUNICIPALITY_NAME, MUNICIPALITY_STATE } from '../constants/branding';
import territorioSvg from '../assets/territorio-passagem-franca.svg';
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
      // A pré-carga dos dados (conforme o perfil) fica no AppLayout.
      navigate('/', { replace: true });
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
        navigate('/', { replace: true });
      } else {
        setAutoLogging(false);
      }
    });
  }, [token, setAuth, logout, navigate]);

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.15fr) minmax(420px, 1fr)' },
        gridTemplateRows: { xs: 'auto 1fr', md: '1fr' },
        bgcolor: 'background.default',
      }}
    >
      {/* Painel do território: as ruas reais da sede, parte delas pintada por microárea. */}
      <Box
        component="section"
        aria-label={`SIGAPS — ${MUNICIPALITY_NAME}`}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          color: '#F2F7F4',
          bgcolor: '#0B1F17',
          minHeight: { xs: 208, md: '100dvh' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: { xs: 'flex-end', md: 'space-between' },
          p: { xs: 2.5, sm: 4, md: 6 },
        }}
      >
        <Box
          component="img"
          src={territorioSvg}
          alt=""
          aria-hidden
          sx={{
            position: 'absolute',
            pointerEvents: 'none',
            userSelect: 'none',
            width: { xs: 640, sm: 900, md: '128%' },
            maxWidth: 'none',
            // Celular: o centro da cidade fica no meio da faixa; computador: à direita do texto.
            left: { xs: 'calc(50% - 300px)', sm: 'calc(50% - 470px)', md: 'auto' },
            right: { md: '-30%' },
            top: { xs: -150, sm: -215, md: '50%' },
            transform: { md: 'translateY(-46%)' },
            opacity: { xs: 0.7, md: 0.95 },
          }}
        />
        {/* Véu para o texto ler bem sobre as ruas (não é enfeite). */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            background: {
              xs: 'linear-gradient(180deg, rgba(11,31,23,0.15) 0%, rgba(11,31,23,0.92) 78%)',
              md: 'linear-gradient(90deg, rgba(11,31,23,0.96) 0%, rgba(11,31,23,0.78) 38%, rgba(11,31,23,0) 72%)',
            },
          }}
        />

        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1.75 }}>
          <Box
            component="img"
            src={MUNICIPALITY_LOGO}
            alt={`Prefeitura de ${MUNICIPALITY_NAME}`}
            sx={{
              height: { xs: 48, md: 56 },
              width: { xs: 48, md: 56 },
              objectFit: 'contain',
              bgcolor: '#fff',
              borderRadius: '14px',
              p: 0.75,
              boxShadow: '0 6px 18px -6px rgba(0,0,0,0.5)',
            }}
          />
          <Box>
            <Typography
              component="p"
              sx={{
                fontWeight: 750,
                fontSize: { xs: '1.375rem', md: '1.5rem' },
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              SIGAPS
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(242,247,244,0.78)' }}>
              {MUNICIPALITY_NAME} — {MUNICIPALITY_STATE}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ position: 'relative', maxWidth: 460, display: { xs: 'none', md: 'block' } }}>
          <Typography
            component="p"
            sx={{
              fontWeight: 700,
              fontSize: 'clamp(1.75rem, 2.6vw, 2.375rem)',
              lineHeight: 1.15,
              letterSpacing: '-0.025em',
              textWrap: 'balance',
              mb: 2,
            }}
          >
            Gestão das microáreas da Atenção Primária, rua por rua.
          </Typography>
          <Typography sx={{ color: 'rgba(242,247,244,0.82)', lineHeight: 1.65, maxWidth: 420 }}>
            Organize o território dos ACS sobre o mapa real do município. Vincule ruas às
            microáreas, visualize a cobertura e gere relatórios profissionais.
          </Typography>
        </Box>

        <Box
          sx={{
            position: 'relative',
            display: { xs: 'none', md: 'flex' },
            alignItems: 'center',
            gap: 1.25,
            color: 'rgba(242,247,244,0.72)',
            fontSize: 13,
          }}
        >
          <Box component="span" aria-hidden sx={{ display: 'inline-flex', gap: 0.5 }}>
            {['#E6194B', '#4363D8', '#FFE119', '#911EB4', '#F032E6'].map((color) => (
              <Box key={color} component="span" sx={{ width: 14, height: 4, borderRadius: 2, bgcolor: color }} />
            ))}
          </Box>
          Ruas da sede de {MUNICIPALITY_NAME}. Cada cor é uma microárea.
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'center',
          px: { xs: 2.5, sm: 4 },
          py: { xs: 3.5, md: 6 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 400 }}>
          <Typography variant="h4" component="h1" sx={{ fontSize: { xs: '1.625rem', md: '1.875rem' }, mb: 0.75 }}>
            Boas-vindas
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Entre com o e-mail e a senha da sua conta.
          </Typography>

          {import.meta.env.DEV && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Modo desenvolvimento: entrada automática como administrador
              {isDevAutoLoginEnabled() ? ' (admin@passagemfranca.ma.gov.br).' : ' desativada.'}
            </Alert>
          )}

          {autoLogging && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Entrando automaticamente...
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
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
              sx={{ mt: 3, py: 1.5 }}
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
            sx={{ mt: 4, pt: 2.5, display: 'block', borderTop: 1, borderColor: 'divider' }}
          >
            Esqueceu a senha? Peça ao administrador do sistema para redefinir.
            <br />
            Secretaria Municipal de Saúde · {MUNICIPALITY_NAME}/{MUNICIPALITY_STATE}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
