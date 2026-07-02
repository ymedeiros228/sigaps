import { useMemo, useState } from 'react';
import {
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Delete, Edit, HomeWork, Map, Search, CloudDownload } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  placesApi,
  type Place,
  type PlaceKind,
  type NominatimResult,
} from '../../../services/api';
import { useCadastros } from '../CadastrosContext';
import { CadastrosSectionHeader } from '../CadastrosSectionHeader';
import { CadastrosDataTable } from '../CadastrosDataTable';
import { CadastrosEmptyState, CadastrosEmptyAction } from '../CadastrosEmptyState';
import { CadastrosFormDialog } from '../CadastrosFormDialog';
import { cadastrosQueryDefaults } from '../../../utils/cadastrosQuery';
import { CACHE, queryKeys } from '../../../utils/queryKeys';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

type PlaceForm = {
  name: string;
  kind: PlaceKind;
  latitude: string;
  longitude: string;
  notes: string;
};

const KIND_OPTIONS: Array<{ value: PlaceKind; label: string }> = [
  { value: 'POVOADO', label: 'Povoado' },
  { value: 'LOCALIDADE', label: 'Localidade' },
  { value: 'DISTRITO', label: 'Distrito' },
];

function kindLabel(kind: PlaceKind) {
  return KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
}

export function PlacesTab({ municipalityId }: { municipalityId: string }) {
  const { canManage, canDeletePlaces, reportError, reportSuccess, confirmDelete } = useCadastros();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nominatimOpen, setNominatimOpen] = useState(false);
  const [nominatimQuery, setNominatimQuery] = useState('');
  const debouncedNominatim = useDebouncedValue(nominatimQuery, 400);
  const [editing, setEditing] = useState<Place | null>(null);
  const [search, setSearch] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlaceForm>({
    defaultValues: { kind: 'POVOADO', notes: '' },
  });

  const { data = [], isPending: isLoading } = useQuery({
    queryKey: queryKeys.places(municipalityId),
    queryFn: () => placesApi.list(municipalityId).then((r) => r.data),
    enabled: !!municipalityId,
    ...cadastrosQueryDefaults,
    staleTime: CACHE.places,
  });

  const { data: nominatimResults = [], isFetching: nominatimLoading } = useQuery({
    queryKey: ['places-nominatim', municipalityId, debouncedNominatim],
    queryFn: () => placesApi.searchNominatim(municipalityId, debouncedNominatim).then((r) => r.data),
    enabled: nominatimOpen && debouncedNominatim.trim().length >= 3,
    staleTime: 60_000,
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return data;
    return data.filter((row) => row.name.toLowerCase().includes(query));
  }, [data, search]);

  const invalidatePlaces = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.places(municipalityId) });
  };

  const saveMutation = useMutation({
    mutationFn: (values: PlaceForm) => {
      const payload = {
        name: values.name.trim(),
        kind: values.kind,
        latitude: Number(values.latitude),
        longitude: Number(values.longitude),
        notes: values.notes.trim() || undefined,
      };
      return editing
        ? placesApi.update(editing.id, payload)
        : placesApi.create({ ...payload, municipalityId });
    },
    onSuccess: () => {
      invalidatePlaces();
      setOpen(false);
      reset();
      reportSuccess(editing ? 'Localidade atualizada.' : 'Localidade cadastrada.');
    },
    onError: reportError,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => placesApi.remove(id),
    onSuccess: () => {
      invalidatePlaces();
      reportSuccess('Localidade removida.');
    },
    onError: reportError,
  });

  const importOsmMutation = useMutation({
    mutationFn: () => placesApi.importFromOsm(municipalityId),
    onSuccess: (res) => {
      invalidatePlaces();
      const { imported, updated } = res.data;
      reportSuccess(
        `OpenStreetMap: ${imported} novo(s), ${updated} atualizado(s). Complementa o mapa sem remover ruas.`,
      );
    },
    onError: reportError,
  });

  const addFromNominatimMutation = useMutation({
    mutationFn: (item: NominatimResult) =>
      placesApi.create({
        municipalityId,
        name: item.name,
        latitude: item.latitude,
        longitude: item.longitude,
        kind: 'POVOADO',
        notes: item.displayName,
      }),
    onSuccess: () => {
      invalidatePlaces();
      reportSuccess('Localidade adicionada a partir da busca.');
    },
    onError: reportError,
  });

  const openForm = (item?: Place) => {
    setEditing(item ?? null);
    reset(
      item
        ? {
            name: item.name,
            kind: item.kind,
            latitude: String(item.latitude),
            longitude: String(item.longitude),
            notes: item.notes ?? '',
          }
        : { name: '', kind: 'POVOADO', latitude: '', longitude: '', notes: '' },
    );
    setOpen(true);
  };

  return (
    <>
      <CadastrosSectionHeader
        title="Povoados e localidades"
        description="Complementa o mapa com povoados que não aparecem nas ruas do OpenStreetMap. O mapeamento de ruas continua igual."
        count={data.length}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar povoado..."
        onAdd={() => openForm()}
        addLabel="Novo povoado"
        canManage={canManage}
        extra={
          canManage ? (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CloudDownload />}
                onClick={() => importOsmMutation.mutate()}
                disabled={importOsmMutation.isPending}
              >
                Importar OSM
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Search />}
                onClick={() => {
                  setNominatimQuery('');
                  setNominatimOpen(true);
                }}
              >
                Buscar no mapa
              </Button>
            </>
          ) : undefined
        }
      />

      <CadastrosDataTable
        loading={isLoading && data.length === 0}
        rows={filtered}
        rowKey={(row) => row.id}
        columns={[
          { id: 'name', label: 'Nome', render: (row) => row.name },
          {
            id: 'kind',
            label: 'Tipo',
            render: (row) => kindLabel(row.kind),
          },
          {
            id: 'coords',
            label: 'Coordenadas',
            render: (row) => `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`,
          },
          {
            id: 'source',
            label: 'Origem',
            align: 'center',
            render: (row) =>
              row.osmNodeId ? (
                <Chip size="small" label="OSM" color="default" variant="outlined" />
              ) : (
                <Chip size="small" label="Manual" color="primary" variant="outlined" />
              ),
          },
        ]}
        emptyState={
          <CadastrosEmptyState
            icon={<HomeWork sx={{ fontSize: 32 }} />}
            title={search ? 'Nenhum povoado encontrado' : 'Nenhum povoado cadastrado'}
            description={
              search
                ? 'Tente outro termo ou importe do OpenStreetMap.'
                : 'Importe do OSM ou cadastre manualmente lugares como Bacabinha que aparecem no Google mas não nas ruas.'
            }
            action={
              canManage && !search ? (
                <CadastrosEmptyAction
                  label="Importar do OpenStreetMap"
                  onClick={() => importOsmMutation.mutate()}
                  icon={<CloudDownload />}
                />
              ) : undefined
            }
          />
        }
        actions={
          canManage || canDeletePlaces
            ? (row) => (
                <>
                  {canManage && (
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => openForm(row)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canDeletePlaces && (
                    <Tooltip title="Remover">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => confirmDelete(row.name, () => deleteMutation.mutate(row.id))}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </>
              )
            : undefined
        }
      />

      <CadastrosFormDialog
        open={open}
        title={editing ? 'Editar localidade' : 'Nova localidade'}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        loading={saveMutation.isPending}
        maxWidth="sm"
      >
        <TextField
          label="Nome"
          {...register('name', { required: 'Informe o nome' })}
          error={!!errors.name}
          helperText={errors.name?.message}
          fullWidth
          autoFocus
        />
        <TextField
          select
          label="Tipo"
          {...register('kind', { required: true })}
          fullWidth
          sx={{ mt: 2 }}
        >
          {KIND_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Latitude"
          {...register('latitude', {
            required: 'Informe a latitude',
            validate: (v) => {
              const n = Number(v);
              return (n >= -90 && n <= 90) || 'Latitude inválida';
            },
          })}
          error={!!errors.latitude}
          helperText={errors.latitude?.message ?? 'Ex.: -6.1828'}
          fullWidth
          sx={{ mt: 2 }}
        />
        <TextField
          label="Longitude"
          {...register('longitude', {
            required: 'Informe a longitude',
            validate: (v) => {
              const n = Number(v);
              return (n >= -180 && n <= 180) || 'Longitude inválida';
            },
          })}
          error={!!errors.longitude}
          helperText={errors.longitude?.message ?? 'Ex.: -43.7869'}
          fullWidth
          sx={{ mt: 2 }}
        />
        <TextField
          label="Observações (opcional)"
          {...register('notes')}
          fullWidth
          multiline
          minRows={2}
          sx={{ mt: 2 }}
        />
      </CadastrosFormDialog>

      <Dialog open={nominatimOpen} onClose={() => setNominatimOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Buscar no mapa mundial</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Encontre povoados e localidades (como no Google Maps) e adicione ao SIGAPS.
          </Typography>
          <TextField
            label="Nome do lugar"
            value={nominatimQuery}
            onChange={(e) => setNominatimQuery(e.target.value)}
            fullWidth
            autoFocus
            placeholder="Ex.: Povoado Bacabinha"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" color="action" />
                  </InputAdornment>
                ),
              },
            }}
          />
          {nominatimLoading && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Buscando…
            </Typography>
          )}
          <List dense sx={{ mt: 1, maxHeight: 280, overflow: 'auto' }}>
            {nominatimResults.map((item) => (
              <ListItemButton
                key={item.placeId}
                onClick={() => addFromNominatimMutation.mutate(item)}
                disabled={addFromNominatimMutation.isPending}
              >
              <ListItemText
                primary={item.name}
                secondary={item.displayName}
                slotProps={{ primary: { sx: { fontWeight: 600 } } }}
              />
                <Map fontSize="small" color="action" />
              </ListItemButton>
            ))}
          </List>
          {debouncedNominatim.trim().length >= 3 &&
            !nominatimLoading &&
            nominatimResults.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Nenhum resultado. Tente incluir o nome do município.
              </Typography>
            )}
          <Button onClick={() => setNominatimOpen(false)} sx={{ mt: 2 }}>
            Fechar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
