import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { authApi } from '../services/api';
import { useAuthStore } from '../store';

interface LoginForm {
  email: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState } = useForm<LoginForm>({
    defaultValues: {
      email: 'jonas@passagemfranca.ma.gov.br',
      password: 'Sigaps@2026',
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    try {
      const res = await authApi.login(data.email, data.password);
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
      navigate('/');
    } catch {
      setError('Email ou senha inválidos');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0D1117 0%, #1a2332 50%, #0D1117 100%)',
        p: 2,
      }}
    >
      <Paper sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <Typography variant="h4" gutterBottom color="primary">
          SIGAPS
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Sistema Inteligente de Gestão das Microáreas da APS
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          <TextField
            fullWidth
            label="Email"
            margin="normal"
            {...register('email', { required: true })}
          />
          <TextField
            fullWidth
            label="Senha"
            type="password"
            margin="normal"
            {...register('password', { required: true })}
          />
          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            sx={{ mt: 2 }}
            disabled={formState.isSubmitting}
          >
            Entrar
          </Button>
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Passagem Franca - Maranhão
        </Typography>
      </Paper>
    </Box>
  );
}
