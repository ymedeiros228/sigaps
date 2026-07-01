import { useMemo, useState } from 'react';
import { Chip, IconButton, MenuItem, TextField, Tooltip } from '@mui/material';
import { Add, Delete, Edit, People } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { acsApi, type Acs } from '../../../services/api';
import { useCadastros } from '../CadastrosContext';
import { CadastrosSectionHeader } from '../CadastrosSectionHeader';
import { CadastrosDataTable } from '../CadastrosDataTable';
import { CadastrosEmptyState, CadastrosEmptyAction } from '../CadastrosEmptyState';
import { CadastrosFormDialog } from '../CadastrosFormDialog';

type AcsForm = { name: string; cpf: string; phone?: string; status: string };

function maskCpf(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '***.$2.$3-**');
}

export function AcsTab({ municipalityId }: { municipalityId: string }) {
  const { canManage, reportError, reportSuccess, confirmDelete } = useCadastros();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Acs | null>(null);
  const [search, setSearch] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AcsForm>();

  const { data = [], isLoading } = useQuery({
    queryKey: ['acs', municipalityId],
    queryFn: () => acsApi.list(municipalityId).then((r) => r.data),
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data;
    return data.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        row.cpf.includes(query) ||
        (row.phone ?? '').includes(query) ||
        (row.microarea?.name ?? '').toLowerCase().includes(query),
    );
  }, [data, search]);

  const saveMutation = useMutation({
    mutationFn: (values: AcsForm) =>
      editing ? acsApi.update(editing.id, values) : acsApi.create({ ...values, municipalityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acs'] });
      setOpen(false);
      reset();
      reportSuccess(editing ? 'ACS atualizado.' : 'ACS cadastrado.');
    },
    onError: reportError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => acsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acs'] });
      reportSuccess('ACS removido.');
    },
    onError: reportError,
  });

  const openForm = (item?: Acs) => {
    setEditing(item ?? null);
    reset(item ?? { name: '', cpf: '', phone: '', status: 'ATIVO' });
    setOpen(true);
  };

  return (
    <>
      <CadastrosSectionHeader
        title="Agentes Comunitários de Saúde"
        description="Profissionais que podem ser vinculados às microáreas no mapa."
        count={data.length}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome, CPF ou microárea..."
        onAdd={() => openForm()}
        addLabel="Novo ACS"
        canManage={canManage}
      />

      <CadastrosDataTable
        loading={isLoading}
        rows={filtered}
        rowKey={(row) => row.id}
        columns={[
          { id: 'name', label: 'Nome', render: (row) => row.name },
          {
            id: 'cpf',
            label: 'CPF',
            hideOnMobile: true,
            render: (row) => maskCpf(row.cpf),
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
            title={search ? 'Nenhum ACS encontrado' : 'Nenhum ACS cadastrado'}
            description={
              search
                ? 'Tente outro termo de busca ou limpe o filtro.'
                : 'Cadastre os agentes comunitários para vinculá-los às microáreas.'
            }
            action={
              canManage && !search ? (
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
                  <Tooltip title="Remover">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => confirmDelete(row.name, () => deleteMutation.mutate(row.id))}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </>
              )
            : undefined
        }
      />

      <CadastrosFormDialog
        open={open}
        title={editing ? 'Editar ACS' : 'Novo ACS'}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        loading={saveMutation.isPending}
      >
        <TextField
          label="Nome completo"
          {...register('name', { required: 'Informe o nome' })}
          error={!!errors.name}
          helperText={errors.name?.message}
          fullWidth
        />
        <TextField
          label="CPF (11 dígitos)"
          {...register('cpf', {
            required: 'Informe o CPF',
            minLength: { value: 11, message: 'CPF deve ter 11 dígitos' },
            maxLength: { value: 11, message: 'CPF deve ter 11 dígitos' },
          })}
          error={!!errors.cpf}
          helperText={errors.cpf?.message}
          fullWidth
          disabled={!!editing}
        />
        <TextField label="Telefone" {...register('phone')} fullWidth />
        <TextField label="Status" select {...register('status')} fullWidth defaultValue="ATIVO">
          <MenuItem value="ATIVO">Ativo</MenuItem>
          <MenuItem value="INATIVO">Inativo</MenuItem>
        </TextField>
      </CadastrosFormDialog>
    </>
  );
}
