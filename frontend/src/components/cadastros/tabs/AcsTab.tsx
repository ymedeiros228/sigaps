import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  People,
  Upload,
  ViewModule,
  TableRows,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { acsApi, type Acs } from '../../../services/api';
import { useCadastros } from '../CadastrosContext';
import { useCadastrosData } from '../CadastrosDataContext';
import { CadastrosSectionHeader } from '../CadastrosSectionHeader';
import { CadastrosDataTable } from '../CadastrosDataTable';
import { CadastrosEmptyState, CadastrosEmptyAction } from '../CadastrosEmptyState';
import { AcsFormDialog, type AcsFormValues } from './AcsFormDialog';
import { AcsBulkImportDialog } from './AcsBulkImportDialog';
import { AcsCardsView } from './AcsCardsView';
import { useAuthStore } from '../../../store';
import { canDeleteAcs } from '../../../utils/permissions';
import { maskCpfDisplay, isMaskedCpf } from '../../../utils/inputMasks';
import { invalidateCadastrosCache } from '../../../utils/hydrateCadastrosCache';

type ViewMode = 'cards' | 'table';
type AcsFilter = 'all' | 'sem-micro';

interface AcsTabProps {
  municipalityId: string;
  pendingAction?: string | null;
  onActionConsumed?: () => void;
  onGoToMicroareas?: () => void;
}

export function AcsTab({
  municipalityId,
  pendingAction,
  onActionConsumed,
  onGoToMicroareas,
}: AcsTabProps) {
  const { canManageAcs, reportError, reportSuccess, confirmDelete } = useCadastros();
  const user = useAuthStore((s) => s.user);
  const canManage = canManageAcs;
  const canDelete = canDeleteAcs(user?.role);
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Acs | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AcsFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [formSession, setFormSession] = useState(0);

  useEffect(() => {
    if (!pendingAction) return;
    if (pendingAction === 'novo') {
      setEditing(null);
      setOpen(true);
    } else if (pendingAction === 'importar') {
      setImportOpen(true);
    }
    onActionConsumed?.();
  }, [pendingAction, onActionConsumed]);

  const { bundle, isLoading } = useCadastrosData();
  const data = (bundle?.acs ?? []) as Acs[];
  const microareas = bundle?.microareas ?? [];

  const filtered = useMemo(() => {
    let rows = data;
    if (filter === 'sem-micro') {
      rows = rows.filter((row) => !row.microarea);
    }
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        row.cpf.includes(query) ||
        (row.phone ?? '').includes(query) ||
        (row.microarea?.name ?? '').toLowerCase().includes(query) ||
        String(row.microarea?.number ?? '').includes(query),
    );
  }, [data, search, filter]);

  const stats = useMemo(() => {
    const ativos = data.filter((a) => a.status === 'ATIVO').length;
    const comMicro = data.filter((a) => a.microarea).length;
    return { ativos, comMicro, semMicro: data.length - comMicro };
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: { values: AcsFormValues; andAnother: boolean }) => {
      const { values } = payload;
      const body = {
        name: values.name,
        ...(editing && isMaskedCpf(editing.cpf) ? {} : { cpf: values.cpf }),
        phone: values.phone || undefined,
        status: values.status,
        microareaId: values.microareaId || undefined,
      };
      return editing
        ? acsApi.update(editing.id, {
            ...body,
            microareaId: values.microareaId || null,
          })
        : acsApi.create({ ...body, cpf: values.cpf, municipalityId });
    },
    onSuccess: (_data, variables) => {
      invalidateCadastrosCache(queryClient, municipalityId);
      if (variables.andAnother) {
        setEditing(null);
        setFormSession((n) => n + 1);
        reportSuccess('ACS cadastrado. Preencha o próximo.');
      } else {
        setOpen(false);
        setEditing(null);
        reportSuccess(editing ? 'ACS atualizado.' : 'ACS cadastrado.');
      }
    },
    onError: reportError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => acsApi.remove(id),
    onSuccess: () => {
      invalidateCadastrosCache(queryClient, municipalityId);
      reportSuccess('ACS removido.');
    },
    onError: reportError,
  });

  const photoMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => acsApi.uploadPhoto(id, file),
    onSuccess: (res) => {
      invalidateCadastrosCache(queryClient, municipalityId);
      if (editing) setEditing(res.data);
      reportSuccess('Foto do ACS atualizada.');
    },
    onError: reportError,
  });

  const openForm = (item?: Acs) => {
    setEditing(item ?? null);
    setOpen(true);
  };

  const handleDelete = (row: Acs) => {
    confirmDelete(row.name, () => deleteMutation.mutate(row.id));
  };

  const toggleSemMicroFilter = () => {
    setFilter((f) => (f === 'sem-micro' ? 'all' : 'sem-micro'));
  };

  return (
    <>
      <CadastrosSectionHeader
        title="Agentes Comunitários de Saúde"
        description="Cadastre manualmente ou importe da planilha. Vincule cada ACS à microárea correspondente."
        count={data.length}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome, CPF, telefone ou microárea..."
        onAdd={() => openForm()}
        addLabel="Novo ACS"
        canManage={canManage}
        extra={
          <>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={viewMode}
              onChange={(_, v) => v && setViewMode(v)}
              aria-label="Modo de visualização"
            >
              <ToggleButton value="cards" aria-label="Cartões">
                <ViewModule fontSize="small" />
              </ToggleButton>
              <ToggleButton value="table" aria-label="Tabela">
                <TableRows fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
            {canManage && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Upload />}
                onClick={() => setImportOpen(true)}
              >
                Importar planilha
              </Button>
            )}
          </>
        }
      />

      {data.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          <Chip label={`${stats.ativos} ativo(s)`} size="small" color="success" variant="outlined" />
          <Chip label={`${stats.comMicro} com microárea`} size="small" variant="outlined" />
          {stats.semMicro > 0 && (
            <Chip
              label={`${stats.semMicro} sem microárea`}
              size="small"
              color={filter === 'sem-micro' ? 'warning' : 'default'}
              variant={filter === 'sem-micro' ? 'filled' : 'outlined'}
              onClick={toggleSemMicroFilter}
              sx={{ cursor: 'pointer' }}
            />
          )}
          {filter === 'sem-micro' && (
            <Button size="small" onClick={() => setFilter('all')}>
              Limpar filtro
            </Button>
          )}
        </Box>
      )}

      {viewMode === 'cards' ? (
        isLoading ? (
          <Typography color="text.secondary">Carregando…</Typography>
        ) : filtered.length === 0 ? (
          <CadastrosEmptyState
            icon={<People sx={{ fontSize: 32 }} />}
            title={
              filter === 'sem-micro'
                ? 'Nenhum ACS sem microárea'
                : search
                  ? 'Nenhum ACS encontrado'
                  : 'Nenhum ACS cadastrado'
            }
            description={
              filter === 'sem-micro'
                ? 'Todos os agentes já estão vinculados a uma microárea.'
                : search
                  ? 'Tente outro termo de busca ou limpe o filtro.'
                  : 'Cadastre os agentes um a um ou importe os dados que você já tem em planilha.'
            }
            action={
              canManage && !search && filter === 'all' ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                  <CadastrosEmptyAction label="Cadastrar ACS" onClick={() => openForm()} icon={<Add />} />
                  <CadastrosEmptyAction
                    label="Importar planilha"
                    onClick={() => setImportOpen(true)}
                    icon={<Upload />}
                  />
                </Box>
              ) : filter === 'sem-micro' ? (
                <Button size="small" onClick={() => setFilter('all')}>
                  Ver todos os ACS
                </Button>
              ) : undefined
            }
          />
        ) : (
          <AcsCardsView
            rows={filtered}
            canManage={canManage}
            canDelete={canDelete}
            onEdit={openForm}
            onDelete={handleDelete}
            onGoToMicroareas={onGoToMicroareas}
          />
        )
      ) : (
        <CadastrosDataTable
          loading={isLoading && data.length === 0}
          rows={filtered}
          rowKey={(row) => row.id}
          columns={[
            { id: 'name', label: 'Nome', render: (row) => row.name },
            {
              id: 'cpf',
              label: 'CPF',
              hideOnMobile: true,
              render: (row) => maskCpfDisplay(row.cpf),
            },
            {
              id: 'phone',
              label: 'Telefone',
              hideOnMobile: true,
              render: (row) => row.phone ?? '—',
            },
            {
              id: 'microarea',
              label: 'Microárea',
              render: (row) =>
                row.microarea ? (
                  <Chip
                    label={row.microarea.name}
                    size="small"
                    sx={{ bgcolor: row.microarea.color, color: '#fff' }}
                  />
                ) : (
                  '—'
                ),
            },
            {
              id: 'status',
              label: 'Status',
              render: (row) => (
                <Chip
                  label={row.status === 'ATIVO' ? 'Ativo' : 'Inativo'}
                  size="small"
                  color={row.status === 'ATIVO' ? 'success' : 'default'}
                  variant="outlined"
                />
              ),
            },
          ]}
          emptyState={
            <CadastrosEmptyState
              icon={<People sx={{ fontSize: 32 }} />}
              title={search || filter === 'sem-micro' ? 'Nenhum ACS encontrado' : 'Nenhum ACS cadastrado'}
              description={
                search
                  ? 'Tente outro termo de busca ou limpe o filtro.'
                  : filter === 'sem-micro'
                    ? 'Todos os agentes já estão vinculados.'
                    : 'Cadastre os agentes comunitários para vinculá-los às microáreas.'
              }
              action={
                canManage && !search && filter === 'all' ? (
                  <CadastrosEmptyAction label="Cadastrar ACS" onClick={() => openForm()} icon={<Add />} />
                ) : undefined
              }
            />
          }
          actions={
            canManage
              ? (row) => (
                  <>
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => openForm(row)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canDelete && (
                      <Tooltip title="Remover">
                        <IconButton size="small" color="error" onClick={() => handleDelete(row)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </>
                )
              : undefined
          }
        />
      )}

      <AcsFormDialog
        key={formSession}
        open={open}
        editing={editing}
        microareas={microareas}
        loading={saveMutation.isPending}
        photoLoading={photoMutation.isPending}
        onClose={() => setOpen(false)}
        onSave={(values, andAnother) => saveMutation.mutate({ values, andAnother })}
        onPhotoUpload={
          editing
            ? (file) => photoMutation.mutate({ id: editing.id, file })
            : undefined
        }
      />

      <AcsBulkImportDialog
        open={importOpen}
        municipalityId={municipalityId}
        onClose={() => setImportOpen(false)}
        onSuccess={(msg) => {
          invalidateCadastrosCache(queryClient, municipalityId);
          reportSuccess(msg);
        }}
        onError={reportError}
      />
    </>
  );
}
