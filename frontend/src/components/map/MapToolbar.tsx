import {
  Box,
  Paper,
  IconButton,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
  TextField,
  Button,
  Alert,
  FormControlLabel,
  Switch,
} from '@mui/material';
import {
  Fullscreen,
  MyLocation,
  Brush,
  Layers,
  Search,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { streetsApi } from '../../services/api';
import { useAppStore, useMapStore } from '../../store';

interface MapToolbarProps {
  onImport: () => void;
  importing: boolean;
  conflictMsg: string | null;
  onForceTransfer: () => void;
  selectedCount?: number;
}

export function MapToolbar({
  onImport,
  importing,
  conflictMsg,
  onForceTransfer,
  selectedCount = 0,
}: MapToolbarProps) {
  const municipalityId = useAppStore((s) => s.municipalityId);
  const microareas = useAppStore((s) => s.microareas);
  const paintMode = useMapStore((s) => s.paintMode);
  const setPaintMode = useMapStore((s) => s.setPaintMode);
  const selectedMicroareaId = useMapStore((s) => s.selectedMicroareaId);
  const setSelectedMicroarea = useMapStore((s) => s.setSelectedMicroarea);
  const baseLayer = useMapStore((s) => s.baseLayer);
  const setBaseLayer = useMapStore((s) => s.setBaseLayer);
  const showEnvelopes = useMapStore((s) => s.showEnvelopes);
  const setShowEnvelopes = useMapStore((s) => s.setShowEnvelopes);
  const setHighlightedStreet = useMapStore((s) => s.setHighlightedStreet);

  const { data: searchResults } = useQuery({
    queryKey: ['street-search', municipalityId],
    queryFn: () =>
      streetsApi.list(municipalityId!, { limit: 500 }).then((r) => r.data.items),
    enabled: !!municipalityId,
  });

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        zIndex: 1000,
        p: 1.5,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1,
        alignItems: 'center',
      }}
      elevation={4}
    >
      <Autocomplete
        size="small"
        sx={{ minWidth: 280, flex: 1 }}
        options={searchResults ?? []}
        getOptionLabel={(o) => `${o.streetType ?? 'Rua'} ${o.name}`}
        onChange={(_, value) => {
          if (value) setHighlightedStreet(value.id);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Pesquisar rua, avenida, travessa..."
            slotProps={{
              input: {
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
              },
            }}
          />
        )}
      />

      <ToggleButtonGroup size="small" exclusive value={baseLayer} onChange={(_, v) => v && setBaseLayer(v)}>
        <ToggleButton value="map">
          <Tooltip title="Mapa"><Layers fontSize="small" /></Tooltip>
        </ToggleButton>
        <ToggleButton value="satellite">Sat</ToggleButton>
        <ToggleButton value="terrain">Rel</ToggleButton>
      </ToggleButtonGroup>

      <ToggleButton
        size="small"
        value="paint"
        selected={paintMode}
        onChange={() => setPaintMode(!paintMode)}
        color="primary"
      >
        <Brush sx={{ mr: 0.5 }} fontSize="small" />
        Pintar Microárea
      </ToggleButton>

      {paintMode && (
        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={microareas}
          getOptionLabel={(m) => m.name}
          value={microareas.find((m) => m.id === selectedMicroareaId) ?? null}
          onChange={(_, v) => setSelectedMicroarea(v?.id ?? null)}
          renderInput={(params) => (
            <TextField {...params} placeholder="Selecione a microárea" />
          )}
        />
      )}

      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={showEnvelopes}
            onChange={(e) => setShowEnvelopes(e.target.checked)}
          />
        }
        label="Polígonos"
      />

      <Button size="small" variant="outlined" onClick={onImport} disabled={importing}>
        {importing ? 'Importando OSM...' : 'Importar Ruas OSM'}
      </Button>

      {selectedCount > 0 && (
        <Alert severity="info" sx={{ py: 0 }}>
          {selectedCount} rua(s) selecionada(s) — Ctrl+clique para multi-seleção
        </Alert>
      )}

      <Tooltip title="Tela cheia">
        <IconButton size="small" onClick={() => document.documentElement.requestFullscreen()}>
          <Fullscreen />
        </IconButton>
      </Tooltip>

      <Tooltip title="Centralizar">
        <IconButton size="small">
          <MyLocation />
        </IconButton>
      </Tooltip>

      {conflictMsg && (
        <Box sx={{ width: '100%' }}>
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={onForceTransfer}>
                Transferir
              </Button>
            }
          >
            {conflictMsg}
          </Alert>
        </Box>
      )}
    </Paper>
  );
}
