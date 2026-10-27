import { useEffect } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import type { AdminUser } from '../../services/api';
import { ALL_ROLES, formatRoleLabel } from '../../utils/permissions';

export type UserFormValues = {
  name: string;
  email: string;
  role: string;
  password: string;
  isActive: boolean;
  isAdmin: boolean;
};

interface UserFormDialogProps {
  open: boolean;
  editing: AdminUser | null;
  loading: boolean;
  onClose: () => void;
  onSave: (values: UserFormValues) => void;
  onResetPassword?: (password: string) => void;
  resetLoading?: boolean;
  /** Perfis que quem está criando pode dar (padrão: todos, para o administrador). */
  allowedRoles?: readonly string[];
  /** Mostra a chave "Função de administrador" (só para quem já tem acesso de administrador). */
  canGrantAdmin?: boolean;
  /** Conta de quem está usando: a própria função de administrador não pode ser tirada. */
  currentUserId?: string;
}

const emptyValues: UserFormValues = {
  name: '',
  email: '',
  role: 'ENFERMEIRO',
  password: '',
  isActive: true,
  isAdmin: false,
};

export function UserFormDialog({
  open,
  editing,
  loading,
  onClose,
  onSave,
  onResetPassword,
  resetLoading,
  allowedRoles = ALL_ROLES,
  canGrantAdmin = false,
  currentUserId,
}: UserFormDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UserFormValues>();

  const resetPassword = watch('password');
  // Select do MUI com register não mostra o valor vindo do reset: fica controlado pelo watch.
  const roleValue = watch('role') ?? '';
  const activeValue = String(watch('isActive') ?? 'true');
  const adminValue = !!watch('isAdmin');
  // O ACS nunca tem a função, e o perfil Administrador já tem acesso total.
  const showAdminSwitch = canGrantAdmin && roleValue !== 'ACS' && roleValue !== 'ADMINISTRADOR';
  const ownAdminLocked = !!editing?.isAdmin && editing.id === currentUserId;

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
            isAdmin: editing.isAdmin,
          }
        : { ...emptyValues, role: allowedRoles.includes('ACS') ? 'ACS' : allowedRoles[0] },
    );
  }, [open, editing, reset, allowedRoles]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {editing ? 'Editar conta' : 'Nova conta'}
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
            value={roleValue}
            fullWidth
          >
            {allowedRoles.map((role) => (
              <MenuItem key={role} value={role}>
                {formatRoleLabel(role)}
              </MenuItem>
            ))}
          </TextField>

          {showAdminSwitch && (
            <Box
              sx={{
                border: 1,
                borderColor: adminValue ? 'primary.main' : 'divider',
                borderRadius: 2,
                px: 2,
                py: 1.25,
                transition: 'border-color 0.15s',
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={adminValue}
                    onChange={(e) => setValue('isAdmin', e.target.checked, { shouldDirty: true })}
                    disabled={ownAdminLocked}
                  />
                }
                label={<Typography sx={{ fontWeight: 600 }}>Função de administrador</Typography>}
                sx={{ mr: 0 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {ownAdminLocked
                  ? 'Você tem a função de administrador. Outra pessoa com a função pode tirá-la; você mesmo não.'
                  : 'Acesso total, igual ao administrador: Administração, backup, auditoria, documentos e todas as contas. O perfil continua o mesmo.'}
              </Typography>
            </Box>
          )}

          {editing ? (
            <>
              <TextField
                label="Status"
                select
                {...register('isActive')}
                value={activeValue}
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
            {loading ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar conta'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
