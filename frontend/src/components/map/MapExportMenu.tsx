import type { RefObject } from 'react';
import { useRef, useState } from 'react';
import {
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Upload,
  Download,
  Image,
  Map as MapIcon,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { geoApi } from '../../services/api';
import { useAppStore } from '../../store';

interface MapExportMenuProps {
  mapContainerRef: RefObject<HTMLElement | null>;
}

export function MapExportMenu({ mapContainerRef }: MapExportMenuProps) {
  const municipalityId = useAppStore((s) => s.municipalityId);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [updateByName, setUpdateByName] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [pendingGeoJson, setPendingGeoJson] = useState<object | null>(null);

  const importMutation = useMutation({
    mutationFn: (geojson: object) =>
      geoApi.import(municipalityId!, { geojson, updateByName }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['streets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setImportResult(
        `Importação concluída: ${res.data.imported} novas, ${res.data.updated} atualizadas, ${res.data.skipped} ignoradas`,
      );
    },
    onError: () => setImportResult('Erro ao importar GeoJSON. Verifique o formato do arquivo.'),
  });

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportStreets = async () => {
    if (!municipalityId) return;
    const res = await geoApi.exportStreets(municipalityId);
    downloadBlob(
      new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/geo+json' }),
      `sigaps-ruas.geojson`,
    );
    setAnchorEl(null);
  };

  const handleExportMicroareas = async () => {
    if (!municipalityId) return;
    const res = await geoApi.exportMicroareas(municipalityId);
    downloadBlob(
      new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/geo+json' }),
      `sigaps-microareas.geojson`,
    );
    setAnchorEl(null);
  };

  const handleExportPng = async () => {
    const container = mapContainerRef.current?.querySelector('.leaflet-container') as HTMLElement;
    if (!container) return;

    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(container, {
      useCORS: true,
      allowTaint: true,
      logging: false,
    });
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `sigaps-mapa-${Date.now()}.png`);
    });
    setAnchorEl(null);
  };

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        setPendingGeoJson(parsed);
        setImportResult(null);
        setImportOpen(true);
      } catch {
        setImportResult('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        Importar / Exportar
      </Button>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => { fileInputRef.current?.click(); setAnchorEl(null); }}>
          <ListItemIcon><Upload fontSize="small" /></ListItemIcon>
          <ListItemText>Importar GeoJSON</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleExportStreets}>
          <ListItemIcon><Download fontSize="small" /></ListItemIcon>
          <ListItemText>Exportar ruas (GeoJSON)</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleExportMicroareas}>
          <ListItemIcon><MapIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Exportar microáreas (GeoJSON)</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleExportPng}>
          <ListItemIcon><Image fontSize="small" /></ListItemIcon>
          <ListItemText>Exportar mapa (PNG)</ListItemText>
        </MenuItem>
      </Menu>

      <input
        ref={fileInputRef}
        type="file"
        accept=".geojson,.json,application/geo+json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
          e.target.value = '';
        }}
      />

      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Importar GeoJSON</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Alert severity="info">
            Aceita FeatureCollection ou Feature com geometrias LineString. Propriedades suportadas:
            name, microareaId, microareaName, microareaNumber.
          </Alert>
          <FormControlLabel
            control={
              <Switch checked={updateByName} onChange={(e) => setUpdateByName(e.target.checked)} />
            }
            label="Atualizar ruas existentes com o mesmo nome"
          />
          {importResult && (
            <Alert severity={importResult.startsWith('Erro') ? 'error' : 'success'}>
              {importResult}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!pendingGeoJson || importMutation.isPending}
            onClick={() => pendingGeoJson && importMutation.mutate(pendingGeoJson)}
            startIcon={importMutation.isPending ? <CircularProgress size={16} /> : undefined}
          >
            Importar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
