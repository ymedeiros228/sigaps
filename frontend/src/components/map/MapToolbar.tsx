import { useMemo, useState } from 'react';
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
import { searchApi } from '../../services/api';
import { useAppStore, useMapStore } from '../../store';
import { MapExportMenu } from './MapExportMenu';
import type { RefObject } from 'react';

interface MapToolbarProps {
  onImport: () => void;
  importing: boolean;
  conflictMsg: string | null;
  onForceTransfer: () => void;
  selectedCount?: number;
  mapContainerRef: RefObject<HTMLElement | null>;
}

type SearchOption = {
  id: string;
  label: string;
  group: string;
  kind: 'street' | 'neighborhood' | 'ubs' | 'acs' | 'microarea';
  lat?: number;
  lng?: number;
};

export function MapToolbar({
  onImport,
  importing,
  conflictMsg,
  onForceTransfer,
  selectedCount = 0,
  mapContainerRef,
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
  const flyTo = useMapStore((s) => s.flyTo);
  const [searchText, setSearchText] = useState('');

  const { data: searchData, isFetching: searching } = useQuery({
    queryKey: ['unified-search', municipalityId, searchText],
    queryFn: () => searchApi.query(municipalityId!, searchText).then((r) => r.data),
    enabled: !!municipalityId && searchText.length >= 2,
  });

  const searchOptions = useMemo<SearchOption[]>(() => {
    if (!searchData) return [];
    const opts: SearchOption[] = [];
    searchData.streets.forEach((s) =>
      opts.push({ id: s.id, label: `${s.streetType ?? 'Rua'} ${s.name}`, group: 'Ruas', kind: 'street' }),
    );
    searchData.neighborhoods.forEach((n) =>
      opts.push({ id: n.id, label: n.name, group: 'Bairros', kind: 'neighborhood' }),
    );
    searchData.ubs.forEach((u) =>
      opts.push({ id: u.id, label: u.name, group: 'UBS', kind: 'ubs', lat: u.latitude, lng: u.longitude }),
    );
    searchData.acs.forEach((a) =>
      opts.push({ id: a.id, label: a.name, group: 'ACS', kind: 'acs' }),
    );
    searchData.microareas.forEach((m) =>
      opts.push({ id: m.id, label: m.name, group: 'Microáreas', kind: 'microarea' }),
    );
    return opts;
  }, [searchData]);

  const handleSearchSelect = (option: SearchOption | null) => {
    if (!option) return;
    if (option.kind === 'street') setHighlightedStreet(option.id);
    if (option.kind === 'microarea') setSelectedMicroarea(option.id);
    if (option.kind === 'ubs' && option.lat && option.lng) flyTo(option.lat, option.lng);
    setSearchText('');
  };

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
        sx={{ minWidth: 300, flex: 1 }}
        freeSolo
        inputValue={searchText}
        onInputChange={(_, v) => setSearchText(v)}
        options={searchOptions}
        groupBy={(o) => o.group}
        getOptionLabel={(o) => (typeof o === 'string' ? o : o.label)}
        loading={searching}
        onChange={(_, value) => {
          if (value && typeof value !== 'string') handleSearchSelect(value);
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Buscar rua, bairro, UBS, ACS, microárea..."
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

      <MapExportMenu mapContainerRef={mapContainerRef} />

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

      <Tooltip title="Centralizar município">
        <IconButton size="small" onClick={() => flyTo(-6.1828, -43.7869, 14)}>
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
