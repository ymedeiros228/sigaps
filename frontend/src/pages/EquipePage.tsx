import { useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Skeleton,
  Snackbar,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { Add, Edit, Map as MapIcon } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/ui/PageHeader';
import { UserFormDialog, type UserFormValues } from '../components/admin/UserFormDialog';
import { useMunicipalityId } from '../hooks/useMunicipalityId';
import { teamApi, type AdminUser } from '../services/api';
import { useAuthStore } from '../store';
import {
  accessRole,
  assignableRoles,
  canGrantAdmin,
  canManageAccount,
  formatRoleLabel,
} from '../utils/permissions';
import { getApiErrorMessage } from '../utils/apiError';

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

/**
 * Equipe: quem gerencia (enfermeiro, coordenação, secretaria, administrador) cria as
 * contas da equipe, redefine senha e desativa quem saiu. Só aparecem para edição as
 * contas de perfil abaixo do seu ou a própria (a API confere a mesma regra). Quem tem
 * acesso de administrador também dá e tira a função de administrador. Cada conta criada
 * ganha o próprio mapa (cópia das ruas, sem pintura); conta antiga que ainda divide o mapa
 * com você pode ganhar o dela em "Dar mapa próprio".
 */
export function EquipePage() {
  const theme = useTheme();
  const municipalityId = useMunicipalityId();
  const me = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [ownMapFor, setOwnMapFor] = useState<AdminUser | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const allowedRoles = useMemo(() => assignableRoles(accessRole(me)), [me]);
  const grantAdmin = canGrantAdmin(me);

  const queryKey = ['team', municipalityId];
  const { data: users = [], isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => teamApi.list(municipalityId!).then((r) => r.data),
    enabled: !!municipalityId,
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
  };

  const saveMutation = useMutation({
    mutationFn: (values: UserFormValues) => {
      // Só quem tem acesso de administrador manda a função; o ACS nunca a recebe.
      const adminField = grantAdmin
        ? { isAdmin: values.role !== 'ACS' && !!values.isAdmin }
        : {};
      if (editing) {
        return teamApi
          .update(municipalityId!, editing.id, {
            name: values.name,
            email: values.email,
            role: values.role,
            isActive: String(values.isActive) === 'true',
            ...adminField,
          })
          .then((r) => r.data);
      }
      return teamApi
        .create(municipalityId!, {
          name: values.name,
          email: values.email.trim().toLowerCase(),
          role: values.role,
          password: values.password,
          ...adminField,
        })
        .then((r) => r.data);
    },
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'overview', municipalityId] });
      closeDialog();
      setMessage({
        type: 'success',
        text: editing
          ? 'Conta atualizada.'
          : `Conta criada com mapa próprio. ${user.name} já pode entrar com o e-mail ${user.email} e a senha que você definiu.`,
      });
    },
    onError: (e) => setMessage({ type: 'error', text: getApiErrorMessage(e) }),
  });

  const resetMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      teamApi.resetPassword(municipalityId!, userId, password),
    onSuccess: () => setMessage({ type: 'success', text: 'Senha redefinida. Avise a pessoa da senha nova.' }),
    onError: (e) => setMessage({ type: 'error', text: getApiErrorMessage(e) }),
  });

  const ownMapMutation = useMutation({
    mutationFn: (userId: string) => teamApi.giveOwnMap(municipalityId!, userId).then((r) => r.data),
    onSuccess: (user) => {
      void queryClient.invalidateQueries({ queryKey });
      setOwnMapFor(null);
      setMessage({
        type: 'success',
        text: `${user.name} agora tem mapa próprio. A pintura deste mapa continua aqui, com você.`,
      });
    },
    onError: (e) => {
      setOwnMapFor(null);
      setMessage({ type: 'error', text: getApiErrorMessage(e) });
    },
  });

  const active = users.filter((u) => u.isActive).length;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 960, mx: 'auto' }}>
      <PageHeader
        title="Equipe"
        subtitle={
          users.length > 0
            ? `${active} ${active === 1 ? 'conta ativa' : 'contas ativas'} com acesso ao SIGAPS`
            : 'Contas de acesso ao SIGAPS'
        }
        action={
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            disabled={!municipalityId || allowedRoles.length === 0}
          >
            Nova conta
          </Button>
        }
      />

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 640 }}>
        Crie a conta de cada pessoa da equipe com o e-mail e uma senha inicial e passe esses dados
        para ela. Cada conta tem o próprio mapa: começa com as ruas, sem pintura, e o que ela pintar
        não aparece no seu. Quem sair da equipe pode ser desativado: a conta deixa de entrar, e o
        histórico fica.
      </Typography>

      {isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              Tentar de novo
            </Button>
          }
        >
          Não foi possível carregar a equipe.
        </Alert>
      ) : (
        <Card>
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
            {isLoading
              ? Array.from({ length: 3 }, (_, i) => (
                  <Box component="li" key={i} sx={{ display: 'flex', gap: 2, alignItems: 'center', px: 2.5, py: 2 }}>
                    <Skeleton variant="circular" width={40} height={40} />
                    <Box sx={{ flex: 1 }}>
                      <Skeleton width="40%" />
                      <Skeleton width="60%" />
                    </Box>
                  </Box>
                ))
              : users.map((u) => {
                  const editable = canManageAccount(me, u);
                  const isMe = u.id === me?.id;
                  // Conta antiga, de antes do mapa por conta: ainda pinta no mesmo mapa que você.
                  const sharesMap = !isMe && !!u.municipalityId && u.municipalityId === municipalityId;
                  return (
                    <Box
                      component="li"
                      key={u.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: { xs: 1.5, sm: 2 },
                        px: { xs: 2, sm: 2.5 },
                        py: 1.75,
                        opacity: u.isActive ? 1 : 0.6,
                        '& + li': { borderTop: 1, borderColor: 'divider' },
                      }}
                    >
                      <Avatar
                        sx={{
                          width: 40,
                          height: 40,
                          fontSize: 14,
                          fontWeight: 700,
                          bgcolor: alpha(theme.palette.primary.main, 0.12),
                          color: 'primary.main',
                        }}
                      >
                        {initialsOf(u.name)}
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>
                          {u.name}
                          {isMe && (
                            <Typography component="span" variant="body2" color="text.secondary">
                              {' '}
                              (você)
                            </Typography>
                          )}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {u.email}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
                          <Chip size="small" variant="outlined" label={formatRoleLabel(u.role)} />
                          {u.isAdmin && u.role !== 'ADMINISTRADOR' && u.role !== 'ACS' && (
                            <Chip size="small" color="primary" variant="outlined" label="Administrador" />
                          )}
                          {!u.isActive && <Chip size="small" label="Desativada" />}
                          {!isMe && u.municipalityId && (
                            <Chip
                              size="small"
                              variant="outlined"
                              color={sharesMap ? 'warning' : 'success'}
                              label={sharesMap ? 'Mesmo mapa que você' : 'Mapa próprio'}
                            />
                          )}
                        </Box>
                      </Box>
                      {editable && sharesMap && (
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          startIcon={<MapIcon fontSize="small" />}
                          onClick={() => setOwnMapFor(u)}
                          aria-label={`Dar mapa próprio para ${u.name}`}
                          sx={{ flexShrink: 0, minWidth: 0, px: { xs: 1, sm: 1.5 }, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 0.75 } } }}
                        >
                          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                            Dar mapa próprio
                          </Box>
                        </Button>
                      )}
                      {editable && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Edit fontSize="small" />}
                          onClick={() => {
                            setEditing(u);
                            setDialogOpen(true);
                          }}
                          aria-label={`Editar a conta de ${u.name}`}
                          sx={{ flexShrink: 0, minWidth: 0, px: { xs: 1, sm: 1.5 }, '& .MuiButton-startIcon': { mr: { xs: 0, sm: 0.75 } } }}
                        >
                          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                            Editar
                          </Box>
                        </Button>
                      )}
                    </Box>
                  );
                })}
          </Box>
        </Card>
      )}

      <UserFormDialog
        open={dialogOpen}
        editing={editing}
        loading={saveMutation.isPending}
        resetLoading={resetMutation.isPending}
        allowedRoles={allowedRoles}
        canGrantAdmin={grantAdmin}
        currentUserId={me?.id}
        onClose={closeDialog}
        onSave={(values) => saveMutation.mutate(values)}
        onResetPassword={
          editing ? (password) => resetMutation.mutate({ userId: editing.id, password }) : undefined
        }
      />

      <Dialog
        open={!!ownMapFor}
        onClose={() => !ownMapMutation.isPending && setOwnMapFor(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Dar mapa próprio?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {ownMapFor?.name} passa a ter um mapa só da conta, com as ruas, os bairros e as UBS e sem
            pintura. A pintura deste mapa continua aqui, com você, e não muda nada nela.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOwnMapFor(null)} disabled={ownMapMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => ownMapFor && ownMapMutation.mutate(ownMapFor.id)}
            disabled={ownMapMutation.isPending}
          >
            {ownMapMutation.isPending ? 'Criando o mapa…' : 'Dar mapa próprio'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!message}
        autoHideDuration={6000}
        onClose={() => setMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {message ? (
          <Alert severity={message.type} onClose={() => setMessage(null)} sx={{ width: '100%' }}>
            {message.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
