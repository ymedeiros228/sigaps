import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Collapse,
  Slider,
  TextField,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
  alpha,
  useTheme,
  Chip,
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  GridView,
  Delete,
  MyLocation,
  Save,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paintZonesApi, type Microarea, type Street } from '../../services/api';
import { useMapStore } from '../../store';
import { streetsInsideCircle } from '../../utils/paintZone';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface MapDivisionsPanelProps {
  municipalityId: string;
  microareas: Microarea[];
  streets: Street[];
  onAssignStreets: (streetIds: string[], microareaId: string) => void;
  onMessage: (message: string) => void;
}

export function MapDivisionsPanel({
  municipalityId,
  microareas,
  streets,
  onAssignStreets,
  onMessage,
}: MapDivisionsPanelProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [panelOpen, setPanelOpen] = useState(true);
  const [deleteZoneId, setDeleteZoneId] = useState<string | null>(null);
  const divisionMode = useMapStore((s) => s.divisionMode);
  const setDivisionMode = useMapStore((s) => s.setDivisionMode);
  const draft = useMapStore((s) => s.divisionDraft);
  const setDivisionDraft = useMapStore((s) => s.setDivisionDraft);
  const selectedMicroareaId = useMapStore((s) => s.selectedMicroareaId);
  const setSelectedMicroarea = useMapStore((s) => s.setSelectedMicroarea);
  const flyTo = useMapStore((s) => s.flyTo);

  const { data: zones = [] } = useQuery({
    queryKey: ['paint-zones', municipalityId],
    queryFn: () => paintZonesApi.list(municipalityId).then((r) => r.data),
    enabled: !!municipalityId,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!draft || !selectedMicroareaId) throw new Error('Dados incompletos');
      return paintZonesApi.createCircle(municipalityId, {
        microareaId: selectedMicroareaId,
        centerLat: draft.lat,
        centerLng: draft.lng,
        radiusMeters: draft.radiusMeters,
        name: draft.name.trim() || undefined,
      });
    },
    onSuccess: () => {
      if (draft && selectedMicroareaId) {
        const inside = streetsInsideCircle(streets, draft.lat, draft.lng, draft.radiusMeters);
        if (inside.length > 0) {
          onAssignStreets(
            inside.map((s) => s.id),
            selectedMicroareaId,
          );
        }
        onMessage(
          `Divisão "${draft.name || 'nova'}" criada — ${inside.length} rua(s) vinculada(s).`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ['paint-zones'] });
      setDivisionDraft(null);
      setDivisionMode(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => paintZonesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paint-zones'] });
      onMessage('Divisão removida.');
    },
  });

  const glassBg = theme.palette.mode === 'dark'
    ? alpha(theme.palette.background.paper, 0.94)
    : alpha('#fff', 0.96);

  const previewCount =
    draft && selectedMicroareaId
      ? streetsInsideCircle(streets, draft.lat, draft.lng, draft.radiusMeters).length
      : 0;

  return (
    <>
    <Paper
      className="map-float-panel"
      elevation={0}
      sx={{
        position: 'absolute',
        top: { xs: 88, sm: 96 },
        right: { xs: 8, sm: 16 },
        zIndex: 1000,
        width: { xs: 'calc(100% - 16px)', sm: 300 },
        maxWidth: 320,
        bgcolor: glassBg,
        borderRadius: 3,
        overflow: 'hidden',
        border: divisionMode ? `2px solid ${theme.palette.info.main}` : undefined,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          bgcolor: alpha(theme.palette.info.main, 0.08),
          cursor: 'pointer',
        }}
        onClick={() => setPanelOpen(!panelOpen)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <GridView color="info" fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Divisões de mapa
          </Typography>
          {zones.length > 0 && (
            <Chip size="small" label={zones.length} color="info" variant="outlined" />
          )}
        </Box>
        <IconButton size="small">{panelOpen ? <ExpandLess /> : <ExpandMore />}</IconButton>
      </Box>

      <Collapse in={panelOpen}>
        <Box sx={{ p: 1.5, pt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Crie áreas circulares no mapa e vincule ruas à microárea escolhida.
          </Typography>

          {!divisionMode ? (
            <Button
              fullWidth
              variant="outlined"
              size="small"
              onClick={() => {
                setDivisionMode(true);
                if (!selectedMicroareaId && microareas[0]) {
                  setSelectedMicroarea(microareas[0].id);
                }
                setDivisionDraft({
                  lat: -6.1828,
                  lng: -43.7869,
                  radiusMeters: 400,
                  name: `Divisão ${zones.length + 1}`,
                });
              }}
              disabled={microareas.length === 0}
            >
              Nova divisão
            </Button>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <Alert severity="info" sx={{ py: 0.25, borderRadius: 2 }}>
                Clique no mapa para posicionar o centro da divisão.
              </Alert>
              <TextField
                size="small"
                label="Nome da divisão"
                value={draft?.name ?? ''}
                onChange={(e) =>
                  draft && setDivisionDraft({ ...draft, name: e.target.value })
                }
              />
              <TextField
                select
                size="small"
                label="Microárea"
                value={selectedMicroareaId ?? ''}
                onChange={(e) => setSelectedMicroarea(e.target.value || null)}
              >
                {microareas.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.name}
                  </MenuItem>
                ))}
              </TextField>
              <Typography variant="caption" color="text.secondary">
                Raio: {draft?.radiusMeters ?? 400} m
              </Typography>
              <Slider
                size="small"
                min={100}
                max={2000}
                step={50}
                value={draft?.radiusMeters ?? 400}
                onChange={(_, v) =>
                  draft && setDivisionDraft({ ...draft, radiusMeters: v as number })
                }
              />
              {draft && (
                <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                  ~{previewCount} rua(s) serão vinculadas
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  fullWidth
                  onClick={() => {
                    setDivisionMode(false);
                    setDivisionDraft(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  size="small"
                  fullWidth
                  variant="contained"
                  startIcon={<Save />}
                  disabled={!draft || !selectedMicroareaId || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  Salvar
                </Button>
              </Box>
            </Box>
          )}

          {zones.length > 0 && (
            <List dense sx={{ mt: 1.5, maxHeight: 200, overflow: 'auto' }}>
              {zones.map((zone) => (
                <ListItem key={zone.id} sx={{ px: 0 }}>
                  <Box
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      bgcolor: zone.microarea.color,
                      mr: 1,
                      flexShrink: 0,
                    }}
                  />
                  <ListItemText
                    primary={zone.name ?? zone.microarea.name}
                    secondary={`${Math.round(zone.radiusMeters)} m · ${zone.microarea.name}`}
                    slotProps={{
                      primary: { variant: 'body2', sx: { fontWeight: 600 } },
                      secondary: { variant: 'caption' },
                    }}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      size="small"
                      onClick={() => flyTo(zone.centerLat, zone.centerLng, 16)}
                    >
                      <MyLocation fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setDeleteZoneId(zone.id)}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </Collapse>
    </Paper>

    <ConfirmDialog
      open={!!deleteZoneId}
      title="Remover divisão?"
      message="Esta área circular será removida do mapa. As ruas já pintadas não serão alteradas."
      confirmLabel="Remover"
      confirmColor="error"
      loading={deleteMutation.isPending}
      onClose={() => setDeleteZoneId(null)}
      onConfirm={() => {
        if (deleteZoneId) deleteMutation.mutate(deleteZoneId);
        setDeleteZoneId(null);
      }}
    />
  </>
  );
}
