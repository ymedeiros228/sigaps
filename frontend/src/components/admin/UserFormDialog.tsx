import { useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import type { AdminUser } from '../../services/api';
import { formatRoleLabel } from '../../utils/permissions';

const ROLES = [
  'ADMINISTRADOR',
  'SECRETARIO_SAUDE',
  'COORDENADOR_APS',
  'ENFERMEIRO',
  'ACS',
] as const;

export type UserFormValues = {
  name: string;
  email: string;
  role: string;
  password: string;
  isActive: boolean;
};

interface UserFormDialogProps {
  open: boolean;
  editing: AdminUser | null;
  loading: boolean;
  onClose: () => void;
  onSave: (values: UserFormValues) => void;
  onResetPassword?: (password: string) => void;
  resetLoading?: boolean;
}

const emptyValues: UserFormValues = {
  name: '',
  email: '',
  role: 'ENFERMEIRO',
  password: '',
  isActive: true,
};

export function UserFormDialog({
  open,
  editing,
  loading,
  onClose,
  onSave,
  onResetPassword,
  resetLoading,
}: UserFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<UserFormValues>();

  const resetPassword = watch('password');

  useEffect(() => {
    if (!open) return;
    reset(
      editing
        ? {
            name: editing.name,
            email: editing.email,
            role: editing.role,
            password: '',
            isActive: editing.isActive ? ('true' as unknown as boolean) : ('false' as unknown as boolean),
          }
        : emptyValues,
    );
  }, [open, editing, reset]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {editing ? 'Editar usuário' : 'Novo usuário'}
      </DialogTitle>
      <form onSubmit={handleSubmit(onSave)}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          {!editing && (
            <Typography variant="body2" color="text.secondary">
              Crie uma conta para um membro da equipe. O usuário poderá acessar o sistema com o
              e-mail e senha definidos aqui.
            </Typography>
          )}

          <TextField
            label="Nome completo"
            autoFocus
            {...register('name', { required: 'Informe o nome' })}
            error={!!errors.name}
            helperText={errors.name?.message}
            fullWidth
          />

          <TextField
            label="E-mail"
            type="email"
            {...register('email', {
              required: 'Informe o e-mail',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'E-mail inválido' },
            })}
            error={!!errors.email}
            helperText={errors.email?.message}
            fullWidth
          />

          <TextField
            label="Perfil"
            select
            {...register('role', { required: true })}
            fullWidth
          >
            {ROLES.map((role) => (
              <MenuItem key={role} value={role}>
                {formatRoleLabel(role)}
              </MenuItem>
            ))}
          </TextField>

          {editing ? (
            <>
              <TextField
                label="Status"
                select
                {...register('isActive')}
                fullWidth
              >
                <MenuItem value="true">Ativo</MenuItem>
                <MenuItem value="false">Inativo</MenuItem>
              </TextField>

              {onResetPassword && (
                <Box sx={{ pt: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                    Redefinir senha
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                      label="Nova senha"
                      type="password"
                      {...register('password', {
                        minLength: { value: 6, message: 'Mínimo 6 caracteres' },
                      })}
                      error={!!errors.password}
                      helperText={errors.password?.message || 'Deixe em branco para não alterar'}
                      fullWidth
                    />
                    <Button
                      variant="outlined"
                      disabled={!resetPassword || resetPassword.length < 6 || resetLoading}
                      onClick={() => onResetPassword(resetPassword)}
                      sx={{ mt: 0.5, whiteSpace: 'nowrap' }}
                    >
                      {resetLoading ? <CircularProgress size={18} /> : 'Redefinir'}
                    </Button>
                  </Box>
                </Box>
              )}
            </>
          ) : (
            <TextField
              label="Senha inicial"
              type="password"
              {...register('password', {
                required: 'Informe a senha',
                minLength: { value: 6, message: 'Mínimo 6 caracteres' },
              })}
              error={!!errors.password}
              helperText={errors.password?.message}
              fullWidth
            />
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {loading ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar usuário'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
