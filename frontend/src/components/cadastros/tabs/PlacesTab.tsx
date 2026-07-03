import { useMemo, useState } from 'react';
import {
  Box,
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
import { Add, Delete, Edit, HomeWork, Map, Search, CloudDownload, Upload } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  municipalitiesApi,
  placesApi,
  ubsApi,
  type Place,
  type PlaceKind,
  type NominatimResult,
} from '../../../services/api';
import { useCadastros } from '../CadastrosContext';
import { CadastrosSectionHeader } from '../CadastrosSectionHeader';
import { CadastrosDataTable } from '../CadastrosDataTable';
import { CadastrosEmptyState, CadastrosEmptyAction } from '../CadastrosEmptyState';
import { CadastrosFormDialog } from '../CadastrosFormDialog';
import { PlaceCoordinatePicker } from '../PlaceCoordinatePicker';
import { PlacesBulkImportDialog } from './PlacesBulkImportDialog';
import { cadastrosQueryDefaults } from '../../../utils/cadastrosQuery';
import { CACHE, queryKeys } from '../../../utils/queryKeys';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { parseCoordinatePair } from '../../../utils/parseCoordinates';
import { mergePlaceNotes, splitPlaceNotes } from '../../../utils/parsePlacesSpreadsheet';

type PlaceForm = {
  name: string;
  kind: PlaceKind;
  latitude: string;
  longitude: string;
  ubsRef: string;
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
  const { canManagePlaces, canDeletePlaces, reportError, reportSuccess, confirmDelete } = useCadastros();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [nominatimOpen, setNominatimOpen] = useState(false);
  const [nominatimQuery, setNominatimQuery] = useState('');
  const debouncedNominatim = useDebouncedValue(nominatimQuery, 400);
  const [editing, setEditing] = useState<Place | null>(null);
  const [search, setSearch] = useState('');
  const [coordsPaste, setCoordsPaste] = useState('');
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PlaceForm>({
    defaultValues: { kind: 'POVOADO', notes: '', ubsRef: '' },
  });

  const latitudeValue = watch('latitude');
  const longitudeValue = watch('longitude');

  const { data: municipality } = useQuery({
    queryKey: queryKeys.municipality(municipalityId),
    queryFn: () => municipalitiesApi.get(municipalityId).then((r) => r.data),
    enabled: !!municipalityId,
    ...cadastrosQueryDefaults,
  });

  const mapCenter = useMemo(
    () => ({
      lat: municipality?.latitude ?? -6.1828,
      lng: municipality?.longitude ?? -43.7869,
    }),
    [municipality?.latitude, municipality?.longitude],
  );

  const pickerLatitude = useMemo(() => {
    const n = Number(latitudeValue);
    return latitudeValue && Number.isFinite(n) ? n : null;
  }, [latitudeValue]);

  const pickerLongitude = useMemo(() => {
    const n = Number(longitudeValue);
    return longitudeValue && Number.isFinite(n) ? n : null;
  }, [longitudeValue]);

  const { data = [], isPending: isLoading } = useQuery({
    queryKey: queryKeys.places(municipalityId),
    queryFn: () => placesApi.list(municipalityId).then((r) => r.data),
    enabled: !!municipalityId,
    ...cadastrosQueryDefaults,
    staleTime: CACHE.places,
  });

  const { data: ubsList = [] } = useQuery({
    queryKey: queryKeys.ubs(municipalityId),
    queryFn: () => ubsApi.list(municipalityId).then((r) => r.data),
    enabled: !!municipalityId,
    ...cadastrosQueryDefaults,
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
      const mergedNotes = mergePlaceNotes(values.ubsRef, values.notes);
      const payload = {
        name: values.name.trim(),
        kind: values.kind,
        latitude: Number(values.latitude),
        longitude: Number(values.longitude),
        notes: mergedNotes || undefined,
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

  const openForm = (item?: Place, preset?: { name?: string }) => {
    setEditing(item ?? null);
    setCoordsPaste('');
    const split = item ? splitPlaceNotes(item.notes) : { ubsRef: '', notes: '' };
    reset(
      item
        ? {
            name: item.name,
            kind: item.kind,
            latitude: String(item.latitude),
            longitude: String(item.longitude),
            ubsRef: split.ubsRef,
            notes: split.notes,
          }
        : {
            name: preset?.name ?? '',
            kind: 'POVOADO',
            latitude: '',
            longitude: '',
            ubsRef: '',
            notes: '',
          },
    );
    setOpen(true);
  };

  const openManualFromSearch = () => {
    const name = nominatimQuery.trim();
    setNominatimOpen(false);
    openForm(undefined, { name });
  };

  const applyPastedCoordinates = () => {
    const parsed = parseCoordinatePair(coordsPaste);
    if (!parsed) {
      reportError('Coordenadas inválidas. Use o formato: latitude, longitude (ex.: -6.18280, -43.78690).');
      return;
    }
    setValue('latitude', String(parsed.latitude), { shouldValidate: true });
    setValue('longitude', String(parsed.longitude), { shouldValidate: true });
    setCoordsPaste('');
    reportSuccess('Coordenadas aplicadas.');
  };

  const handleMapPick = (lat: number, lng: number) => {
    setValue('latitude', lat.toFixed(6), { shouldValidate: true });
    setValue('longitude', lng.toFixed(6), { shouldValidate: true });
  };

  return (
    <>
      <CadastrosSectionHeader
        title="Povoados e localidades"
        description="Cadastre povoados por planilha (nome + UBS + coordenadas), mapa satélite ou busca automática. O sistema marca cada local no mapa."
        count={data.length}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar povoado..."
        onAdd={() => openForm()}
        addLabel="Novo povoado"
        canManage={canManagePlaces}
        extra={
          canManagePlaces ? (
            <>
              <Button
                size="small"
                variant="outlined"
                startIcon={<Upload />}
                onClick={() => setImportOpen(true)}
              >
                Importar planilha
              </Button>
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
            id: 'ubs',
            label: 'UBS',
            hideOnMobile: true,
            render: (row) => splitPlaceNotes(row.notes).ubsRef || '—',
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
                : 'Importe planilha Excel com povoado, UBS e coordenadas — o sistema marca cada local no mapa.'
            }
            action={
              canManagePlaces && !search ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                  <CadastrosEmptyAction
                    label="Importar planilha"
                    onClick={() => setImportOpen(true)}
                    icon={<Upload />}
                  />
                  <CadastrosEmptyAction
                    label="Cadastrar com coordenadas"
                    onClick={() => openForm()}
                    icon={<Add />}
                  />
                  <CadastrosEmptyAction
                    label="Importar do OpenStreetMap"
                    onClick={() => importOsmMutation.mutate()}
                    icon={<CloudDownload />}
                  />
                </Box>
              ) : undefined
            }
          />
        }
        actions={
          canManagePlaces || canDeletePlaces
            ? (row) => (
                <>
                  {canManagePlaces && (
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
        maxWidth="md"
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
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1, fontWeight: 600 }}>
          Coordenadas geográficas
        </Typography>
        <PlaceCoordinatePicker
          latitude={pickerLatitude}
          longitude={pickerLongitude}
          center={mapCenter}
          onChange={handleMapPick}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, mb: 1 }}>
          Ou copie do Google Maps (botão direito no mapa → copiar coordenadas):
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            label="Colar coordenadas (Google Maps)"
            value={coordsPaste}
            onChange={(e) => setCoordsPaste(e.target.value)}
            placeholder="Ex.: -6.18280, -43.78690"
            fullWidth
            size="small"
          />
          <Button
            variant="outlined"
            onClick={applyPastedCoordinates}
            disabled={!coordsPaste.trim()}
            sx={{ mt: 0.25, whiteSpace: 'nowrap' }}
          >
            Aplicar
          </Button>
        </Box>
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
          select
          label="UBS de referência"
          {...register('ubsRef')}
          fullWidth
          sx={{ mt: 2 }}
          helperText="Opcional — vincula o povoado à UBS que atende a comunidade"
        >
          <MenuItem value="">Nenhuma</MenuItem>
          {ubsList.map((ubs) => (
            <MenuItem key={ubs.id} value={ubs.name}>
              {ubs.name}
            </MenuItem>
          ))}
        </TextField>
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
            Encontre povoados automaticamente ou cadastre manualmente no mapa satélite quando não aparecer na busca.
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
                secondary={`${item.displayName} · ${item.latitude.toFixed(5)}, ${item.longitude.toFixed(5)}`}
                slotProps={{ primary: { sx: { fontWeight: 600 } } }}
              />
                <Map fontSize="small" color="action" />
              </ListItemButton>
            ))}
          </List>
          {debouncedNominatim.trim().length >= 3 &&
            !nominatimLoading &&
            nominatimResults.length === 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Nenhum resultado na busca automática. Cadastre manualmente com as coordenadas do Google Maps.
                </Typography>
                {canManagePlaces && (
                  <Button
                    variant="contained"
                    startIcon={<Map />}
                    onClick={openManualFromSearch}
                    sx={{ mt: 1.5 }}
                  >
                    Cadastrar com coordenadas
                  </Button>
                )}
              </Box>
            )}
          <Button onClick={() => setNominatimOpen(false)} sx={{ mt: 2 }}>
            Fechar
          </Button>
        </DialogContent>
      </Dialog>

      <PlacesBulkImportDialog
        open={importOpen}
        municipalityId={municipalityId}
        onClose={() => setImportOpen(false)}
        onSuccess={(message) => {
          invalidatePlaces();
          reportSuccess(message);
        }}
        onError={reportError}
      />
    </>
  );
}
