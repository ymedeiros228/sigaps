import { useMemo, useState, type ChangeEvent } from 'react';
import { Box, Button, Chip, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { Add, Edit, GridView, Map } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  acsApi,
  microareasApi,
  neighborhoodsApi,
  ubsApi,
  type Microarea,
} from '../../../services/api';
import { useCadastros } from '../CadastrosContext';
import { CadastrosSectionHeader } from '../CadastrosSectionHeader';
import { CadastrosDataTable } from '../CadastrosDataTable';
import { CadastrosEmptyState, CadastrosEmptyAction } from '../CadastrosEmptyState';
import { CadastrosFormDialog } from '../CadastrosFormDialog';
import { MicroareaLinkFields } from '../MicroareaLinkFields';
import { MICROAREA_COLORS } from '../cadastrosConfig';

type MicroareaForm = {
  number: number;
  name: string;
  color: string;
  description?: string;
  ubsId?: string;
  acsId?: string;
  neighborhoodId?: string;
};

function sanitizeLinks(values: MicroareaForm): MicroareaForm {
  return {
    ...values,
    ubsId: values.ubsId || undefined,
    acsId: values.acsId || undefined,
    neighborhoodId: values.neighborhoodId || undefined,
  };
}

export function MicroareasTab({ municipalityId }: { municipalityId: string }) {
  const { canManage, reportError, reportSuccess } = useCadastros();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Microarea | null>(null);
  const [search, setSearch] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MicroareaForm>();

  const selectedColor = watch('color') || MICROAREA_COLORS[0];

  const { data: ubsList = [] } = useQuery({
    queryKey: ['ubs', municipalityId],
    queryFn: () => ubsApi.list(municipalityId).then((r) => r.data),
  });

  const { data: acsList = [] } = useQuery({
    queryKey: ['acs', municipalityId],
    queryFn: () => acsApi.list(municipalityId).then((r) => r.data),
  });

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ['neighborhoods', municipalityId],
    queryFn: () => neighborhoodsApi.list(municipalityId).then((r) => r.data),
  });

  const { data = [], isLoading } = useQuery({
    queryKey: ['microareas', municipalityId],
    queryFn: () => microareasApi.list(municipalityId).then((r) => r.data),
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data;
    return data.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        String(row.number).includes(query) ||
        (row.ubs?.name ?? '').toLowerCase().includes(query) ||
        (row.acs?.name ?? '').toLowerCase().includes(query) ||
        (row.neighborhood?.name ?? '').toLowerCase().includes(query),
    );
  }, [data, search]);

  const saveMutation = useMutation({
    mutationFn: (values: MicroareaForm) => {
      const body = sanitizeLinks(values);
      return editing
        ? microareasApi.update(editing.id, body)
        : microareasApi.create({ ...body, municipalityId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['microareas'] });
      queryClient.invalidateQueries({ queryKey: ['acs'] });
      setOpen(false);
      reset();
      reportSuccess(editing ? 'Microárea atualizada.' : 'Microárea cadastrada.');
    },
    onError: reportError,
  });

  const openForm = (item?: Microarea) => {
    setEditing(item ?? null);
    reset(
      item
        ? {
            number: item.number,
            name: item.name,
            color: item.color,
            description: item.description,
            ubsId: item.ubsId ?? '',
            acsId: item.acsId ?? '',
            neighborhoodId: item.neighborhoodId ?? '',
          }
        : {
            number: data.length + 1,
            name: `Microárea ${String(data.length + 1).padStart(2, '0')}`,
            color: MICROAREA_COLORS[data.length % MICROAREA_COLORS.length],
            ubsId: '',
            acsId: '',
            neighborhoodId: '',
          },
    );
    setOpen(true);
  };

  return (
    <>
      <CadastrosSectionHeader
        title="Microáreas"
        description="Defina território, cor e vínculos com ACS, UBS e bairro. Depois pinte as ruas no mapa."
        count={data.length}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome, número, UBS, ACS ou bairro..."
        onAdd={() => openForm()}
        addLabel="Nova Microárea"
        canManage={canManage}
        extra={
          <Button
            component={RouterLink}
            to="/mapa"
            size="small"
            variant="outlined"
            startIcon={<Map />}
          >
            Ir para o mapa
          </Button>
        }
      />

      {(ubsList.length === 0 || acsList.length === 0 || neighborhoods.length === 0) && canManage && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {acsList.length === 0 && (
            <Chip
              component={RouterLink}
              to="/cadastros?secao=acs"
              clickable
              label="Cadastre ACS antes de vincular"
              size="small"
              color="warning"
              variant="outlined"
            />
          )}
          {ubsList.length === 0 && (
            <Chip
              component={RouterLink}
              to="/cadastros?secao=ubs"
              clickable
              label="Cadastre UBS"
              size="small"
              variant="outlined"
            />
          )}
          {neighborhoods.length === 0 && (
            <Chip
              component={RouterLink}
              to="/cadastros?secao=bairros"
              clickable
              label="Cadastre bairros para centralizar o mapa"
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      )}

      <CadastrosDataTable
        loading={isLoading}
        rows={filtered}
        rowKey={(row) => row.id}
        columns={[
          { id: 'number', label: 'Nº', width: 56, render: (row) => row.number },
          { id: 'name', label: 'Nome', render: (row) => row.name },
          {
            id: 'color',
            label: 'Cor',
            render: (row) => (
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 1.5,
                  bgcolor: row.color,
                  border: '2px solid',
                  borderColor: 'divider',
                }}
              />
            ),
          },
          {
            id: 'acs',
            label: 'ACS',
            render: (row) =>
              row.acs ? (
                <Chip label={row.acs.name} size="small" variant="outlined" color="primary" />
              ) : (
                <Typography variant="caption" color="text.secondary">
                  —
                </Typography>
              ),
          },
          {
            id: 'ubs',
            label: 'UBS',
            hideOnMobile: true,
            render: (row) => row.ubs?.name ?? '—',
          },
          {
            id: 'neighborhood',
            label: 'Bairro',
            hideOnMobile: true,
            render: (row) => row.neighborhood?.name ?? '—',
          },
          {
            id: 'streets',
            label: 'Ruas',
            align: 'center',
            render: (row) => row._count?.streets ?? 0,
          },
        ]}
        emptyState={
          <CadastrosEmptyState
            icon={<GridView sx={{ fontSize: 32 }} />}
            title={search ? 'Nenhuma microárea encontrada' : 'Nenhuma microárea cadastrada'}
            description={
              search
                ? 'Tente outro termo de busca ou limpe o filtro.'
                : 'Crie microáreas com cores distintas, vincule ACS/UBS/bairro e pinte as ruas no mapa.'
            }
            action={
              canManage && !search ? (
                <CadastrosEmptyAction label="Criar microárea" onClick={() => openForm()} icon={<Add />} />
              ) : undefined
            }
          />
        }
        actions={
          canManage
            ? (row) => (
                <Tooltip title="Editar vínculos e dados">
                  <IconButton size="small" onClick={() => openForm(row)}>
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
              )
            : undefined
        }
      />

      <CadastrosFormDialog
        open={open}
        title={editing ? 'Editar Microárea' : 'Nova Microárea'}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        loading={saveMutation.isPending}
        maxWidth="sm"
      >
        <TextField
          label="Número"
          type="number"
          {...register('number', { valueAsNumber: true, required: 'Informe o número' })}
          error={!!errors.number}
          helperText={errors.number?.message}
          fullWidth
        />
        <TextField
          label="Nome"
          {...register('name', { required: 'Informe o nome' })}
          error={!!errors.name}
          helperText={errors.name?.message}
          fullWidth
        />
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Cor da microárea
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
            {MICROAREA_COLORS.map((color) => (
              <Box
                key={color}
                onClick={() => setValue('color', color)}
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: color,
                  cursor: 'pointer',
                  border: selectedColor === color ? '3px solid' : '2px solid transparent',
                  borderColor: selectedColor === color ? 'text.primary' : 'transparent',
                  boxShadow: selectedColor === color ? 2 : 0,
                }}
              />
            ))}
            <Box
              component="input"
              type="color"
              value={selectedColor}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setValue('color', e.target.value)}
              sx={{
                width: 36,
                height: 36,
                border: 'none',
                borderRadius: 2,
                cursor: 'pointer',
                p: 0,
              }}
            />
          </Box>
          <input type="hidden" {...register('color', { required: true })} />
        </Box>
        <TextField label="Descrição" {...register('description')} fullWidth multiline rows={2} />
        <MicroareaLinkFields
          register={register}
          ubsList={ubsList}
          acsList={acsList}
          neighborhoods={neighborhoods}
          editingMicroareaId={editing?.id}
          microareas={data}
        />
      </CadastrosFormDialog>
    </>
  );
}
