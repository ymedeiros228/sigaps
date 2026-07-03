import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add, Delete, Edit, LocalHospital, Map, Search, Upload } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { integrationsApi, municipalitiesApi, ubsApi, type Ubs } from '../../../services/api';
import { useCadastros } from '../CadastrosContext';
import { CadastrosSectionHeader } from '../CadastrosSectionHeader';
import { CadastrosDataTable } from '../CadastrosDataTable';
import { CadastrosEmptyState, CadastrosEmptyAction } from '../CadastrosEmptyState';
import { CadastrosFormDialog } from '../CadastrosFormDialog';
import { PlaceCoordinatePicker } from '../PlaceCoordinatePicker';
import { UbsBulkImportDialog } from './UbsBulkImportDialog';
import { getApiErrorMessage } from '../../../utils/apiError';
import { cadastrosQueryDefaults } from '../../../utils/cadastrosQuery';
import { invalidateCadastrosCache } from '../../../utils/hydrateCadastrosCache';
import { queryKeys } from '../../../utils/queryKeys';
import { parseCoordinatePair } from '../../../utils/parseCoordinates';

type UbsForm = Omit<Ubs, 'id' | '_count'>;

/** Monta o payload apenas com campos aceitos pela API (evita enviar id/createdAt/_count). */
function sanitizeUbsForm(values: UbsForm): UbsForm {
  const cnes = (values.cnesCode ?? '').replace(/\D/g, '').slice(0, 7);
  const lat = Number(values.latitude);
  const lng = Number(values.longitude);
  const address =
    values.address?.trim() ||
    (Number.isFinite(lat) && Number.isFinite(lng)
      ? `Localização: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
      : 'Localização não informada');
  return {
    name: values.name.trim(),
    address,
    latitude: lat,
    longitude: lng,
    cnesCode: cnes.length === 7 ? cnes : undefined,
    phone: values.phone?.trim() || undefined,
    coordinator: values.coordinator?.trim() || undefined,
  };
}

export function UbsTab({ municipalityId }: { municipalityId: string }) {
  const { canManage, canDelete, reportError, reportSuccess, confirmDelete } = useCadastros();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Ubs | null>(null);
  const [search, setSearch] = useState('');
  const [coordsPaste, setCoordsPaste] = useState('');
  const [validatingCnes, setValidatingCnes] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<UbsForm>();

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
    return Number.isFinite(n) ? n : null;
  }, [latitudeValue]);

  const pickerLongitude = useMemo(() => {
    const n = Number(longitudeValue);
    return Number.isFinite(n) ? n : null;
  }, [longitudeValue]);

  const { data = [], isPending: isLoading } = useQuery({
    queryKey: queryKeys.ubs(municipalityId),
    queryFn: () => ubsApi.list(municipalityId).then((r) => r.data),
    enabled: !!municipalityId,
    ...cadastrosQueryDefaults,
  });

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
    mutationFn: (values: UbsForm) => {
      const payload = sanitizeUbsForm(values);
      return editing
        ? ubsApi.update(editing.id, payload)
        : ubsApi.create({ ...payload, municipalityId });
    },
    onSuccess: () => {
      invalidateCadastrosCache(queryClient, municipalityId);
      setOpen(false);
      setEditing(null);
      reset();
      setCoordsPaste('');
      reportSuccess(
        editing
          ? 'UBS atualizada — marcador no mapa nas coordenadas informadas.'
          : 'UBS cadastrada — marcada automaticamente no mapa.',
      );
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
    setCoordsPaste('');
    reset(
      item
        ? {
            name: item.name,
            address: item.address ?? '',
            phone: item.phone ?? '',
            coordinator: item.coordinator ?? '',
            cnesCode: item.cnesCode ?? '',
            latitude: item.latitude,
            longitude: item.longitude,
          }
        : {
            name: '',
            address: '',
            phone: '',
            coordinator: '',
            cnesCode: '',
            latitude: mapCenter.lat,
            longitude: mapCenter.lng,
          },
    );
    setOpen(true);
  };

  const handleMapPick = (lat: number, lng: number) => {
    setValue('latitude', Number(lat.toFixed(6)), { shouldValidate: true });
    setValue('longitude', Number(lng.toFixed(6)), { shouldValidate: true });
  };

  const applyPastedCoordinates = () => {
    const parsed = parseCoordinatePair(coordsPaste);
    if (!parsed) {
      reportError('Coordenadas inválidas. Use: latitude, longitude (ex.: -6.18280, -43.78690).');
      return;
    }
    setValue('latitude', parsed.latitude, { shouldValidate: true });
    setValue('longitude', parsed.longitude, { shouldValidate: true });
    setCoordsPaste('');
    reportSuccess('Coordenadas aplicadas.');
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
        description="Informe o nome e as coordenadas — o sistema marca a UBS no mapa automaticamente."
        count={data.length}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome, CNES, endereço ou telefone..."
        onAdd={() => openForm()}
        addLabel="Nova UBS"
        canManage={canManage}
        extra={
          canManage ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Upload />}
              onClick={() => setImportOpen(true)}
            >
              Importar planilha
            </Button>
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
            id: 'coords',
            label: 'Coordenadas',
            hideOnMobile: true,
            render: (row) => `${row.latitude.toFixed(5)}, ${row.longitude.toFixed(5)}`,
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
                : 'Cadastre o nome da UBS e marque no mapa (clique no satélite ou cole coordenadas do Google).'
            }
            action={
              canManage && !search ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                  <CadastrosEmptyAction
                    label="Importar planilha"
                    onClick={() => setImportOpen(true)}
                    icon={<Upload />}
                  />
                  <CadastrosEmptyAction label="Cadastrar UBS" onClick={() => openForm()} icon={<Add />} />
                </Box>
              ) : undefined
            }
          />
        }
        actions={(row) => (
                <>
                  <Tooltip title="Ver no mapa">
                    <IconButton
                      size="small"
                      component={RouterLink}
                      to={`/mapa?lat=${row.latitude}&lng=${row.longitude}&zoom=17&tipo=ubs`}
                    >
                      <Map fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {canManage && (
                    <Tooltip title="Editar">
                      <IconButton size="small" onClick={() => openForm(row)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {canDelete && (
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
              )}
      />

      <CadastrosFormDialog
        open={open}
        title={editing ? 'Editar UBS' : 'Nova UBS'}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        loading={saveMutation.isPending}
        maxWidth="md"
        submitLabel={editing ? 'Salvar' : 'Cadastrar e marcar no mapa'}
      >
        <Alert severity="info" sx={{ mb: 0 }}>
          Informe o <strong>nome</strong> e a <strong>localização</strong>. Ao salvar, a UBS aparece no mapa
          exatamente nas coordenadas escolhidas.
        </Alert>

        <TextField
          label="Nome da UBS"
          {...register('name', { required: 'Informe o nome da UBS' })}
          error={!!errors.name}
          helperText={errors.name?.message}
          fullWidth
          autoFocus
        />

        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          Onde fica no mapa?
        </Typography>
        <PlaceCoordinatePicker
          latitude={pickerLatitude}
          longitude={pickerLongitude}
          center={mapCenter}
          onChange={handleMapPick}
          pickHint="Clique no mapa satélite onde fica a UBS. Arraste o pino para ajustar."
        />
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
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Latitude"
            type="number"
            slotProps={{ htmlInput: { step: 0.000001 } }}
            {...register('latitude', { valueAsNumber: true, required: 'Informe a latitude' })}
            error={!!errors.latitude}
            fullWidth
          />
          <TextField
            label="Longitude"
            type="number"
            slotProps={{ htmlInput: { step: 0.000001 } }}
            {...register('longitude', { valueAsNumber: true, required: 'Informe a longitude' })}
            error={!!errors.longitude}
            fullWidth
          />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Dados complementares (opcional)
        </Typography>
        <TextField label="Endereço" {...register('address')} fullWidth placeholder="Opcional" />
        <TextField label="Telefone" {...register('phone')} fullWidth />
        <TextField label="Coordenador" {...register('coordinator')} fullWidth />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            label="Código CNES"
            {...register('cnesCode')}
            placeholder="7 dígitos (opcional)"
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
      </CadastrosFormDialog>

      <UbsBulkImportDialog
        open={importOpen}
        municipalityId={municipalityId}
        onClose={() => setImportOpen(false)}
        onSuccess={(message) => {
          invalidateCadastrosCache(queryClient, municipalityId);
          reportSuccess(message);
        }}
        onError={reportError}
      />
    </>
  );
}
