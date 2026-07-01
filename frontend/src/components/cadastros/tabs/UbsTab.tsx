import { useMemo, useState } from 'react';
import { IconButton, TextField, Tooltip } from '@mui/material';
import { Add, Delete, Edit, LocalHospital } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ubsApi, type Ubs } from '../../../services/api';
import { useCadastros } from '../CadastrosContext';
import { CadastrosSectionHeader } from '../CadastrosSectionHeader';
import { CadastrosDataTable } from '../CadastrosDataTable';
import { CadastrosEmptyState, CadastrosEmptyAction } from '../CadastrosEmptyState';
import { CadastrosFormDialog } from '../CadastrosFormDialog';

type UbsForm = Omit<Ubs, 'id' | '_count'>;

export function UbsTab({ municipalityId }: { municipalityId: string }) {
  const { canManage, reportError, reportSuccess, confirmDelete } = useCadastros();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ubs | null>(null);
  const [search, setSearch] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UbsForm>();

  const { data = [], isLoading } = useQuery({
    queryKey: ['ubs', municipalityId],
    queryFn: () => ubsApi.list(municipalityId).then((r) => r.data),
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data;
    return data.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        row.address.toLowerCase().includes(query) ||
        (row.phone ?? '').includes(query),
    );
  }, [data, search]);

  const saveMutation = useMutation({
    mutationFn: (values: UbsForm) =>
      editing ? ubsApi.update(editing.id, values) : ubsApi.create({ ...values, municipalityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ubs'] });
      setOpen(false);
      setEditing(null);
      reset();
      reportSuccess(editing ? 'UBS atualizada.' : 'UBS cadastrada.');
    },
    onError: reportError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ubsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ubs'] });
      reportSuccess('UBS removida.');
    },
    onError: reportError,
  });

  const openForm = (item?: Ubs) => {
    setEditing(item ?? null);
    reset(
      item ?? {
        name: '',
        address: '',
        phone: '',
        coordinator: '',
        latitude: -6.1828,
        longitude: -43.7869,
      },
    );
    setOpen(true);
  };

  return (
    <>
      <CadastrosSectionHeader
        title="Unidades Básicas de Saúde"
        description="Cadastre as UBS de referência para vincular às microáreas."
        count={data.length}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome, endereço ou telefone..."
        onAdd={() => openForm()}
        addLabel="Nova UBS"
        canManage={canManage}
      />

      <CadastrosDataTable
        loading={isLoading}
        rows={filtered}
        rowKey={(row) => row.id}
        columns={[
          { id: 'name', label: 'Nome', render: (row) => row.name },
          {
            id: 'address',
            label: 'Endereço',
            hideOnMobile: true,
            render: (row) => row.address,
          },
          {
            id: 'phone',
            label: 'Telefone',
            hideOnMobile: true,
            render: (row) => row.phone ?? '—',
          },
          {
            id: 'microareas',
            label: 'Microáreas',
            align: 'center',
            render: (row) => row._count?.microareas ?? 0,
          },
        ]}
        emptyState={
          <CadastrosEmptyState
            icon={<LocalHospital sx={{ fontSize: 32 }} />}
            title={search ? 'Nenhuma UBS encontrada' : 'Nenhuma UBS cadastrada'}
            description={
              search
                ? 'Tente outro termo de busca ou limpe o filtro.'
                : 'Comece cadastrando as unidades básicas de saúde do município.'
            }
            action={
              canManage && !search ? (
                <CadastrosEmptyAction label="Cadastrar UBS" onClick={() => openForm()} icon={<Add />} />
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
        title={editing ? 'Editar UBS' : 'Nova UBS'}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        loading={saveMutation.isPending}
      >
        <TextField
          label="Nome"
          {...register('name', { required: 'Informe o nome da UBS' })}
          error={!!errors.name}
          helperText={errors.name?.message}
          fullWidth
        />
        <TextField
          label="Endereço"
          {...register('address', { required: 'Informe o endereço' })}
          error={!!errors.address}
          helperText={errors.address?.message}
          fullWidth
        />
        <TextField label="Telefone" {...register('phone')} fullWidth />
        <TextField label="Coordenador" {...register('coordinator')} fullWidth />
        <TextField
          label="Latitude"
          type="number"
          slotProps={{ htmlInput: { step: 0.0001 } }}
          {...register('latitude', { valueAsNumber: true, required: true })}
          fullWidth
        />
        <TextField
          label="Longitude"
          type="number"
          slotProps={{ htmlInput: { step: 0.0001 } }}
          {...register('longitude', { valueAsNumber: true, required: true })}
          fullWidth
        />
      </CadastrosFormDialog>
    </>
  );
}
