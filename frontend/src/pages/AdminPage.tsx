import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  AdminPanelSettings,
  Backup,
  CloudDownload,
  Download,
  CloudUpload,
  Edit,
  History,
  People,
  Refresh,
  Signpost,
  Storage,
  Visibility,
  Warning,
  Verified,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { UserFormDialog, type UserFormValues } from '../components/admin/UserFormDialog';
import { AdminHomologationTab } from '../components/admin/AdminHomologationTab';
import { useMunicipalityId } from '../hooks/useMunicipalityId';
import { useAuthStore } from '../store';
import { adminApi, type AdminUser, type AuditFilters, type AuditLogEntry } from '../services/api';
import { getApiErrorMessage } from '../utils/apiError';
import { canAccessAdmin, formatAuditAction, formatRoleLabel } from '../utils/permissions';

type AdminTab = 'resumo' | 'backup' | 'usuarios' | 'auditoria' | 'homologacao';

const ENTITY_FILTER_OPTIONS = [
  { value: '', label: 'Todas entidades' },
  { value: 'acs', label: 'ACS' },
  { value: 'ubs', label: 'UBS' },
  { value: 'microarea', label: 'Microárea' },
  { value: 'neighborhood', label: 'Bairro' },
  { value: 'street', label: 'Rua' },
  { value: 'user', label: 'Usuário' },
];

const ACTION_FILTER_OPTIONS = [
  { value: '', label: 'Todas ações' },
  { value: 'CREATE', label: 'Cadastro' },
  { value: 'UPDATE', label: 'Atualização' },
  { value: 'DELETE', label: 'Remoção' },
  { value: 'RESET_PASSWORD', label: 'Redefinição de senha' },
  { value: 'ASSIGN_MICROAREA', label: 'Pintura de rua' },
  { value: 'ASSIGN_NEIGHBORHOOD', label: 'Vínculo bairro' },
];

function formatAuditData(data?: Record<string, unknown> | null) {
  if (!data || Object.keys(data).length === 0) return '—';
  return Object.entries(data)
    .map(([k, v]) => `${k}: ${v === null ? '—' : String(v)}`)
    .join(' · ');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const municipalityId = useMunicipalityId();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();

  const initialTab = searchParams.get('tab');
  const validTabs: AdminTab[] = ['resumo', 'backup', 'usuarios', 'auditoria', 'homologacao'];
  const [tab, setTab] = useState<AdminTab>(
    validTabs.includes(initialTab as AdminTab) ? (initialTab as AdminTab) : 'resumo',
  );
  const [auditPage, setAuditPage] = useState(1);
  const [auditFilters, setAuditFilters] = useState<AuditFilters>({});
  const [auditDetail, setAuditDetail] = useState<AuditLogEntry | null>(null);
  const [userOpen, setUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [auditExportLoading, setAuditExportLoading] = useState(false);

  const canAccess = canAccessAdmin(user?.role);
  const ready = canAccess && !!municipalityId;

  const { data: overview, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'overview', municipalityId],
    queryFn: () => adminApi.overview(municipalityId!).then((r) => r.data),
    enabled: ready,
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['admin', 'audit', municipalityId, auditPage, auditFilters],
    queryFn: () => adminApi.audit(municipalityId!, auditPage, 30, auditFilters).then((r) => r.data),
    enabled: ready && tab === 'auditoria',
  });

  const { data: autoBackupInfo, refetch: refetchAutoBackups } = useQuery({
    queryKey: ['admin', 'auto-backups', municipalityId],
    queryFn: () => adminApi.listAutoBackups(municipalityId!).then((r) => r.data),
    enabled: ready && tab === 'backup',
  });
  const autoBackups = autoBackupInfo?.items ?? [];

  const exportMutation = useMutation({
    mutationFn: () => adminApi.exportBackup(municipalityId!).then((r) => r.data),
    onSuccess: (data) => {
      const name = overview?.municipality.name.replace(/\s+/g, '-').toLowerCase() ?? 'municipio';
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(data, `sigaps-backup-${name}-${date}.json`);
      setMessage({ type: 'success', text: 'Backup baixado com sucesso.' });
    },
    onError: (e) => setMessage({ type: 'error', text: getApiErrorMessage(e) }),
  });

  const importMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      adminApi.importBackup(municipalityId!, payload).then((r) => r.data),
    onSuccess: (res) => {
      const parts = Object.entries(res.restored)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ');
      setMessage({ type: 'success', text: `Backup restaurado: ${parts}.` });
      setImportOpen(false);
      setPendingBackup(null);
      void queryClient.invalidateQueries();
    },
    onError: (e) => setMessage({ type: 'error', text: getApiErrorMessage(e) }),
  });

  const runAutoBackupMutation = useMutation({
    mutationFn: () => adminApi.runAutoBackup(municipalityId!).then((r) => r.data),
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Backup automático gerado no servidor.' });
      void refetchAutoBackups();
    },
    onError: (e) => setMessage({ type: 'error', text: getApiErrorMessage(e) }),
  });

  const downloadAutoBackupMutation = useMutation({
    mutationFn: (filename: string) =>
      adminApi.downloadAutoBackup(municipalityId!, filename).then((r) => r.data),
    onSuccess: (data, filename) => {
      downloadJson(data, filename);
      setMessage({ type: 'success', text: 'Backup automático baixado.' });
    },
    onError: (e) => setMessage({ type: 'error', text: getApiErrorMessage(e) }),
  });

  const saveUserMutation = useMutation({
    mutationFn: (values: UserFormValues) => {
      if (editingUser) {
        return adminApi
          .updateUser(municipalityId!, editingUser.id, {
            name: values.name,
            email: values.email,
            role: values.role,
            isActive: String(values.isActive) === 'true',
          })
          .then((r) => r.data);
      }
      return adminApi
        .createUser(municipalityId!, {
          name: values.name,
          email: values.email,
          role: values.role,
          password: values.password,
        })
        .then((r) => r.data);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'overview', municipalityId] });
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      setUserOpen(false);
      setEditingUser(null);
      setMessage({
        type: 'success',
        text: editingUser ? 'Usuário atualizado.' : 'Usuário criado com sucesso.',
      });
    },
    onError: (e) => setMessage({ type: 'error', text: getApiErrorMessage(e) }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      adminApi.resetPassword(municipalityId!, userId, password),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
      setMessage({ type: 'success', text: 'Senha redefinida com sucesso.' });
    },
    onError: (e) => setMessage({ type: 'error', text: getApiErrorMessage(e) }),
  });

  const loadBackupFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? '')) as Record<string, unknown>;
        setPendingBackup(parsed);
        setImportOpen(true);
      } catch {
        setMessage({ type: 'error', text: 'Arquivo JSON inválido.' });
      }
    };
    reader.readAsText(file);
  };

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  if (!municipalityId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1280, mx: 'auto' }}>
      <PageHeader
        title="Administração"
        subtitle="Painel exclusivo do administrador — backup, usuários e auditoria do sistema"
        action={
          <Tooltip title="Atualizar dados">
            <IconButton onClick={() => refetch()} disabled={isFetching}>
              <Refresh />
            </IconButton>
          </Tooltip>
        }
      />

      <Alert severity="info" icon={<AdminPanelSettings />} sx={{ mb: 3, borderRadius: 2 }}>
        Área restrita. Somente usuários com perfil <strong>Administrador</strong> têm acesso a
        esta página.
      </Alert>

      {message && (
        <Alert
          severity={message.type}
          sx={{ mb: 2, borderRadius: 2 }}
          onClose={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="resumo" label="Resumo" icon={<Storage />} iconPosition="start" />
        <Tab value="backup" label="Backup" icon={<Backup />} iconPosition="start" />
        <Tab value="usuarios" label="Usuários" icon={<People />} iconPosition="start" />
        <Tab value="auditoria" label="Auditoria" icon={<History />} iconPosition="start" />
        <Tab value="homologacao" label="Homologação" icon={<Verified />} iconPosition="start" />
      </Tabs>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && overview && tab === 'resumo' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
              gap: 2,
            }}
          >
            <StatCard title="Ruas" value={overview.counts.streets} icon={<Signpost />} color="#9C27B0" />
            <StatCard
              title="Cobertura"
              value={`${overview.counts.coverage}%`}
              subtitle={`${overview.counts.assignedStreets} ruas pintadas`}
              icon={<Storage />}
              color="#4CAF50"
            />
            <StatCard
              title="ACS"
              value={overview.counts.acs}
              subtitle={`${overview.counts.acsSemMicro} sem microárea`}
              icon={<People />}
              color="#2196F3"
            />
            <StatCard
              title="Usuários"
              value={overview.counts.activeUsers}
              subtitle={`${overview.counts.users} cadastrados`}
              icon={<AdminPanelSettings />}
              color="#FF9800"
            />
          </Box>

          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
                Sistema
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                <Chip label={overview.municipality.name} />
                <Chip label={`${overview.municipality.state}`} variant="outlined" />
                <Chip label={`${overview.counts.microareas} microáreas`} variant="outlined" />
                <Chip label={`${overview.counts.ubs} UBS`} variant="outlined" />
                <Chip label={`${overview.counts.paintZones} zonas de pintura`} variant="outlined" />
                <Chip label={`${overview.counts.auditLogs} registros de auditoria`} variant="outlined" />
                {overview.system.commit && (
                  <Chip
                    label={`Deploy ${overview.system.commit.slice(0, 7)}`}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                )}
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}

      {tab === 'backup' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CloudDownload color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Exportar backup
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Gera um arquivo JSON com bairros, UBS, ACS, microáreas, ruas, zonas de pintura e
                lista de usuários (sem senhas). Guarde em local seguro.
              </Typography>
              <Button
                variant="contained"
                startIcon={exportMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <CloudDownload />}
                disabled={exportMutation.isPending}
                onClick={() => exportMutation.mutate()}
              >
                Baixar backup completo
              </Button>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ borderRadius: 3, borderColor: 'warning.main' }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CloudUpload color="warning" />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Restaurar backup
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Importa um backup SIGAPS e mescla os dados pelo ID. Não altera senhas de usuários.
                Use com cuidado em produção.
              </Typography>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<CloudUpload />}
                onClick={() => fileRef.current?.click()}
              >
                Escolher arquivo JSON
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) loadBackupFile(file);
                  e.target.value = '';
                }}
              />
            </CardContent>
          </Card>
          </Box>

          <Card variant="outlined" sx={{ borderRadius: 3 }}>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Storage color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Backups automáticos
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={runAutoBackupMutation.isPending ? <CircularProgress size={16} /> : <Refresh />}
                  disabled={runAutoBackupMutation.isPending}
                  onClick={() => runAutoBackupMutation.mutate()}
                >
                  Gerar agora
                </Button>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {autoBackupInfo?.retentionNote ??
                  'Backup semanal (domingo, 03h). Baixe periodicamente — disco efêmero no Render free.'}
              </Typography>
              {autoBackupInfo?.lastAutoBackupAt && (
                <Chip
                  size="small"
                  label={`Último backup: ${new Date(autoBackupInfo.lastAutoBackupAt).toLocaleString('pt-BR')}`}
                  color="success"
                  variant="outlined"
                />
              )}
              {autoBackups.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum backup automático ainda. Use &quot;Gerar agora&quot; ou aguarde o agendamento semanal.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Arquivo</TableCell>
                        <TableCell>Data</TableCell>
                        <TableCell>Tamanho</TableCell>
                        <TableCell align="right">Ação</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {autoBackups.map((b) => (
                        <TableRow key={b.filename} hover>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{b.filename}</TableCell>
                          <TableCell>
                            {new Date(b.createdAt).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell>{(b.sizeBytes / 1024).toFixed(0)} KB</TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              startIcon={<CloudDownload />}
                              disabled={downloadAutoBackupMutation.isPending}
                              onClick={() => downloadAutoBackupMutation.mutate(b.filename)}
                            >
                              Baixar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {tab === 'usuarios' && overview && (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2, pb: 0 }}>
            <Button
              variant="contained"
              size="small"
              startIcon={<Add />}
              onClick={() => {
                setEditingUser(null);
                setUserOpen(true);
              }}
            >
              Novo usuário
            </Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>E-mail</TableCell>
                  <TableCell>Perfil</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Cadastro</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {overview.users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Chip label={formatRoleLabel(u.role)} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={u.isActive ? 'Ativo' : 'Inativo'}
                        size="small"
                        color={u.isActive ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditingUser(u);
                            setUserOpen(true);
                          }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {tab === 'auditoria' && (
        <Box>
          <Card variant="outlined" sx={{ borderRadius: 3, mb: 2, p: 2 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(5, 1fr)' },
                gap: 2,
              }}
            >
              <FormControl size="small" fullWidth>
                <InputLabel>Entidade</InputLabel>
                <Select
                  label="Entidade"
                  value={auditFilters.entityType ?? ''}
                  onChange={(e) => {
                    setAuditPage(1);
                    setAuditFilters((f) => ({ ...f, entityType: e.target.value || undefined }));
                  }}
                >
                  {ENTITY_FILTER_OPTIONS.map((o) => (
                    <MenuItem key={o.value || 'all'} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Ação</InputLabel>
                <Select
                  label="Ação"
                  value={auditFilters.action ?? ''}
                  onChange={(e) => {
                    setAuditPage(1);
                    setAuditFilters((f) => ({ ...f, action: e.target.value || undefined }));
                  }}
                >
                  {ACTION_FILTER_OPTIONS.map((o) => (
                    <MenuItem key={o.value || 'all'} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Usuário</InputLabel>
                <Select
                  label="Usuário"
                  value={auditFilters.userId ?? ''}
                  onChange={(e) => {
                    setAuditPage(1);
                    setAuditFilters((f) => ({ ...f, userId: e.target.value || undefined }));
                  }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {(overview?.users ?? []).map((u) => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="De"
                type="date"
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                value={auditFilters.from ?? ''}
                onChange={(e) => {
                  setAuditPage(1);
                  setAuditFilters((f) => ({ ...f, from: e.target.value || undefined }));
                }}
                fullWidth
              />
              <TextField
                label="Até"
                type="date"
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                value={auditFilters.to ?? ''}
                onChange={(e) => {
                  setAuditPage(1);
                  setAuditFilters((f) => ({ ...f, to: e.target.value || undefined }));
                }}
                fullWidth
              />
            </Box>
            {(auditFilters.entityType ||
              auditFilters.action ||
              auditFilters.userId ||
              auditFilters.from ||
              auditFilters.to) && (
              <Box sx={{ mt: 1.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  size="small"
                  onClick={() => {
                    setAuditFilters({});
                    setAuditPage(1);
                  }}
                >
                  Limpar filtros
                </Button>
              </Box>
            )}
            <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Download />}
                disabled={auditExportLoading}
                onClick={async () => {
                  setAuditExportLoading(true);
                  try {
                    const { data: blob } = await adminApi.exportAuditCsv(municipalityId, auditFilters);
                    downloadBlob(blob as Blob, 'sigaps-auditoria.csv');
                  } catch {
                    setMessage({ type: 'error', text: 'Não foi possível exportar a auditoria.' });
                  } finally {
                    setAuditExportLoading(false);
                  }
                }}
              >
                {auditExportLoading ? 'Exportando…' : 'Exportar CSV'}
              </Button>
            </Box>
          </Card>

          {auditLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Card variant="outlined" sx={{ borderRadius: 3, mb: 2 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Data</TableCell>
                        <TableCell>Usuário</TableCell>
                        <TableCell>Ação</TableCell>
                        <TableCell>Entidade</TableCell>
                        <TableCell align="right">Detalhes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(auditData?.items ?? []).map((log) => (
                        <TableRow key={log.id} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            <Typography variant="caption">
                              {new Date(log.createdAt).toLocaleString('pt-BR')}
                            </Typography>
                          </TableCell>
                          <TableCell>{log.user.name}</TableCell>
                          <TableCell>
                            {formatAuditAction(log.action, log.entityType)}
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {log.entityId.slice(0, 8)}…
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Ver alterações">
                              <IconButton size="small" onClick={() => setAuditDetail(log)}>
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(auditData?.items ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                            <Typography color="text.secondary">
                              Nenhum registro de auditoria.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  {auditData?.total ?? 0} registro(s)
                </Typography>
                {(auditData?.pages ?? 0) > 1 && (
                  <Pagination
                    count={auditData?.pages}
                    page={auditPage}
                    onChange={(_, p) => setAuditPage(p)}
                    color="primary"
                  />
                )}
              </Box>
            </>
          )}
        </Box>
      )}

      {tab === 'homologacao' && municipalityId && (
        <AdminHomologationTab municipalityId={municipalityId} />
      )}

      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" />
          Confirmar restauração
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Os dados do backup serão mesclados no município atual. Esta operação pode sobrescrever
            cadastros existentes com os mesmos IDs.
          </Typography>
          {pendingBackup && (
            <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Backup de{' '}
                {String((pendingBackup as { exportedAt?: string }).exportedAt ?? 'data desconhecida')}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {(pendingBackup as { counts?: Record<string, number> }).counts
                  ? Object.entries((pendingBackup as { counts: Record<string, number> }).counts)
                      .map(([k, v]) => `${v} ${k}`)
                      .join(' · ')
                  : 'Conteúdo do backup'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setImportOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={!pendingBackup || importMutation.isPending}
            onClick={() => pendingBackup && importMutation.mutate(pendingBackup)}
          >
            {importMutation.isPending ? 'Restaurando…' : 'Restaurar backup'}
          </Button>
        </DialogActions>
      </Dialog>

      <UserFormDialog
        open={userOpen}
        editing={editingUser}
        loading={saveUserMutation.isPending}
        resetLoading={resetPasswordMutation.isPending}
        onClose={() => {
          setUserOpen(false);
          setEditingUser(null);
        }}
        onSave={(values) => saveUserMutation.mutate(values)}
        onResetPassword={
          editingUser
            ? (password) =>
                resetPasswordMutation.mutate({ userId: editingUser.id, password })
            : undefined
        }
      />

      <Dialog
        open={!!auditDetail}
        onClose={() => setAuditDetail(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Detalhes da auditoria</DialogTitle>
        <DialogContent>
          {auditDetail && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="body2">
                <strong>Ação:</strong>{' '}
                {formatAuditAction(auditDetail.action, auditDetail.entityType)}
              </Typography>
              <Typography variant="body2">
                <strong>Usuário:</strong> {auditDetail.user.name}
              </Typography>
              <Typography variant="body2">
                <strong>Data:</strong>{' '}
                {new Date(auditDetail.createdAt).toLocaleString('pt-BR')}
              </Typography>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Antes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatAuditData(auditDetail.beforeData)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Depois
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatAuditData(auditDetail.afterData)}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAuditDetail(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
