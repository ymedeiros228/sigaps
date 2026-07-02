import { useMemo, useState } from 'react';
import { Button, IconButton, TextField, Tooltip } from '@mui/material';
import { Add, Delete, Edit, LocationCity, Upload } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { neighborhoodsApi, type Neighborhood } from '../../../services/api';
import { useCadastros } from '../CadastrosContext';
import { CadastrosSectionHeader } from '../CadastrosSectionHeader';
import { CadastrosDataTable } from '../CadastrosDataTable';
import { CadastrosEmptyState, CadastrosEmptyAction } from '../CadastrosEmptyState';
import { CadastrosFormDialog } from '../CadastrosFormDialog';
import { NeighborhoodBulkAssignDialog } from '../NeighborhoodBulkAssignDialog';

type NeighborhoodForm = { name: string };

export function NeighborhoodsTab({ municipalityId }: { municipalityId: string }) {
  const { canManage, reportError, reportSuccess, confirmDelete } = useCadastros();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Neighborhood | null>(null);
  const [search, setSearch] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<NeighborhoodForm>();

  const { data = [], isLoading } = useQuery({
    queryKey: ['neighborhoods', municipalityId],
    queryFn: () => neighborhoodsApi.list(municipalityId).then((r) => r.data),
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data;
    return data.filter((row) => row.name.toLowerCase().includes(query));
  }, [data, search]);

  const saveMutation = useMutation({
    mutationFn: (values: NeighborhoodForm) =>
      editing
        ? neighborhoodsApi.update(editing.id, values)
        : neighborhoodsApi.create({ ...values, municipalityId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['neighborhoods'] });
      setOpen(false);
      reset();
      reportSuccess(editing ? 'Bairro atualizado.' : 'Bairro cadastrado.');
    },
    onError: reportError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => neighborhoodsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['neighborhoods'] });
      reportSuccess('Bairro removido.');
    },
    onError: reportError,
  });

  const openForm = (item?: Neighborhood) => {
    setEditing(item ?? null);
    reset(item ?? { name: '' });
    setOpen(true);
  };

  return (
    <>
      <CadastrosSectionHeader
        title="Bairros"
        description="Organize a divisão territorial. Depois vincule as ruas aos bairros via planilha ou no mapa."
        count={data.length}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar bairro..."
        onAdd={() => openForm()}
        addLabel="Novo Bairro"
        canManage={canManage}
        extra={
          canManage && data.length > 0 ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Upload />}
              onClick={() => setImportOpen(true)}
            >
              Vincular ruas (CSV)
            </Button>
          ) : undefined
        }
      />

      <CadastrosDataTable
        loading={isLoading}
        rows={filtered}
        rowKey={(row) => row.id}
        columns={[
          { id: 'name', label: 'Nome', render: (row) => row.name },
          {
            id: 'streets',
            label: 'Ruas vinculadas',
            align: 'center',
            render: (row) => row._count?.streets ?? 0,
          },
        ]}
        emptyState={
          <CadastrosEmptyState
            icon={<LocationCity sx={{ fontSize: 32 }} />}
            title={search ? 'Nenhum bairro encontrado' : 'Nenhum bairro cadastrado'}
            description={
              search
                ? 'Tente outro termo de busca ou limpe o filtro.'
                : 'Cadastre os bairros do município para organizar as ruas importadas.'
            }
            action={
              canManage && !search ? (
                <CadastrosEmptyAction label="Cadastrar bairro" onClick={() => openForm()} icon={<Add />} />
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
        title={editing ? 'Editar Bairro' : 'Novo Bairro'}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        loading={saveMutation.isPending}
        maxWidth="xs"
      >
        <TextField
          label="Nome do bairro"
          {...register('name', { required: 'Informe o nome do bairro' })}
          error={!!errors.name}
          helperText={errors.name?.message}
          fullWidth
          autoFocus
        />
      </CadastrosFormDialog>

      <NeighborhoodBulkAssignDialog
        open={importOpen}
        municipalityId={municipalityId}
        onClose={() => setImportOpen(false)}
        onSuccess={(msg) => {
          queryClient.invalidateQueries({ queryKey: ['neighborhoods'] });
          queryClient.invalidateQueries({ queryKey: ['streets'] });
          reportSuccess(msg);
        }}
        onError={reportError}
      />
    </>
  );
}
