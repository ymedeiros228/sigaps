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
  IconButton,
  Pagination,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AdminPanelSettings,
  Backup,
  CloudDownload,
  CloudUpload,
  History,
  People,
  Refresh,
  Signpost,
  Storage,
  Warning,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { useMunicipalityId } from '../hooks/useMunicipalityId';
import { useAuthStore } from '../store';
import { adminApi } from '../services/api';
import { getApiErrorMessage } from '../utils/apiError';
import { canAccessAdmin, formatAuditAction, formatRoleLabel } from '../utils/permissions';

type AdminTab = 'resumo' | 'backup' | 'usuarios' | 'auditoria';

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

  const [tab, setTab] = useState<AdminTab>('resumo');
  const [auditPage, setAuditPage] = useState(1);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!canAccessAdmin(user?.role)) {
    return <Navigate to="/" replace />;
  }

  if (!municipalityId) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const { data: overview, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'overview', municipalityId],
    queryFn: () => adminApi.overview(municipalityId).then((r) => r.data),
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['admin', 'audit', municipalityId, auditPage],
    queryFn: () => adminApi.audit(municipalityId, auditPage, 30).then((r) => r.data),
    enabled: tab === 'auditoria',
  });

  const exportMutation = useMutation({
    mutationFn: () => adminApi.exportBackup(municipalityId).then((r) => r.data),
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
      adminApi.importBackup(municipalityId, payload).then((r) => r.data),
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
      )}

      {tab === 'usuarios' && overview && (
        <Card variant="outlined" sx={{ borderRadius: 3 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>E-mail</TableCell>
                  <TableCell>Perfil</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Cadastro</TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {tab === 'auditoria' && (
        <Box>
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
                        </TableRow>
                      ))}
                      {(auditData?.items ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                            <Typography color="text.secondary">Nenhum registro de auditoria.</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
              {(auditData?.pages ?? 0) > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Pagination
                    count={auditData?.pages}
                    page={auditPage}
                    onChange={(_, p) => setAuditPage(p)}
                    color="primary"
                  />
                </Box>
              )}
            </>
          )}
        </Box>
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
    </Box>
  );
}
