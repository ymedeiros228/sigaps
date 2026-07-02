import { useMemo, useState } from 'react';
import { Box, Button, CircularProgress, IconButton, TextField, Tooltip } from '@mui/material';
import { Add, Delete, Edit, LocalHospital, Search } from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { integrationsApi, ubsApi, type Ubs } from '../../../services/api';
import { useCadastros } from '../CadastrosContext';
import { useCadastrosData } from '../CadastrosDataContext';
import { CadastrosSectionHeader } from '../CadastrosSectionHeader';
import { CadastrosDataTable } from '../CadastrosDataTable';
import { CadastrosEmptyState, CadastrosEmptyAction } from '../CadastrosEmptyState';
import { CadastrosFormDialog } from '../CadastrosFormDialog';
import { getApiErrorMessage } from '../../../utils/apiError';
import { invalidateCadastrosCache } from '../../../utils/hydrateCadastrosCache';

type UbsForm = Omit<Ubs, 'id' | '_count'>;

export function UbsTab({ municipalityId }: { municipalityId: string }) {
  const { canManage, reportError, reportSuccess, confirmDelete } = useCadastros();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ubs | null>(null);
  const [search, setSearch] = useState('');
  const [validatingCnes, setValidatingCnes] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<UbsForm>();

  const { bundle, isLoading } = useCadastrosData();
  const data = (bundle?.ubs ?? []) as Ubs[];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data;
    return data.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        row.address.toLowerCase().includes(query) ||
        (row.phone ?? '').includes(query) ||
        (row.cnesCode ?? '').includes(query),
    );
  }, [data, search]);

  const saveMutation = useMutation({
    mutationFn: (values: UbsForm) =>
      editing ? ubsApi.update(editing.id, values) : ubsApi.create({ ...values, municipalityId }),
    onSuccess: () => {
      invalidateCadastrosCache(queryClient, municipalityId);
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
      invalidateCadastrosCache(queryClient, municipalityId);
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
        cnesCode: '',
        latitude: -6.1828,
        longitude: -43.7869,
      },
    );
    setOpen(true);
  };

  const handleValidateCnes = async () => {
    const code = (getValues('cnesCode') ?? '').trim();
    if (!code) {
      reportError(new Error('Informe o código CNES antes de validar.'));
      return;
    }
    setValidatingCnes(true);
    try {
      const { data: result } = await integrationsApi.lookupCnes(code);
      setValue('cnesCode', result.cnesCode);
      if (!getValues('name')?.trim() && result.name) setValue('name', result.name);
      if (!getValues('address')?.trim() && result.address) setValue('address', result.address);
      if (!getValues('phone')?.trim() && result.phone) setValue('phone', result.phone);
      reportSuccess(
        result.source === 'api'
          ? 'CNES validado — dados preenchidos a partir do Ministério da Saúde.'
          : 'Código CNES aceito (consulta online indisponível).',
      );
    } catch (err) {
      reportError(err instanceof Error ? err : new Error(getApiErrorMessage(err, 'Falha ao validar CNES.')));
    } finally {
      setValidatingCnes(false);
    }
  };

  return (
    <>
      <CadastrosSectionHeader
        title="Unidades Básicas de Saúde"
        description="Cadastre as UBS de referência para vincular às microáreas."
        count={data.length}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome, CNES, endereço ou telefone..."
        onAdd={() => openForm()}
        addLabel="Nova UBS"
        canManage={canManage}
      />

      <CadastrosDataTable
        loading={isLoading && data.length === 0}
        rows={filtered}
        rowKey={(row) => row.id}
        columns={[
          { id: 'name', label: 'Nome', render: (row) => row.name },
          {
            id: 'cnes',
            label: 'CNES',
            hideOnMobile: true,
            render: (row) => row.cnesCode ?? '—',
          },
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
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            label="Código CNES"
            {...register('cnesCode')}
            placeholder="7 dígitos"
            fullWidth
            slotProps={{ htmlInput: { maxLength: 7 } }}
          />
          <Button
            variant="outlined"
            startIcon={validatingCnes ? <CircularProgress size={16} /> : <Search />}
            onClick={() => void handleValidateCnes()}
            disabled={validatingCnes}
            sx={{ mt: 0.5, whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Validar CNES
          </Button>
        </Box>
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
