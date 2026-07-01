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
  TableChart,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { geoApi } from '../../services/api';
import { useAppStore } from '../../store';

type ImportFormat = 'geojson' | 'kml' | 'csv';

interface MapExportMenuProps {
  mapContainerRef: RefObject<HTMLElement | null>;
}

export function MapExportMenu({ mapContainerRef }: MapExportMenuProps) {
  const municipalityId = useAppStore((s) => s.municipalityId);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFormat, setImportFormat] = useState<ImportFormat>('geojson');
  const [updateByName, setUpdateByName] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [pendingGeoJson, setPendingGeoJson] = useState<object | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const onImportSuccess = (res: { imported: number; updated: number; skipped: number }) => {
    queryClient.invalidateQueries({ queryKey: ['streets'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    setImportResult(
      `Importação concluída: ${res.imported} novas, ${res.updated} atualizadas, ${res.skipped} ignoradas`,
    );
  };

  const geoJsonMutation = useMutation({
    mutationFn: (geojson: object) =>
      geoApi.import(municipalityId!, { geojson, updateByName }),
    onSuccess: (res) => onImportSuccess(res.data),
    onError: () => setImportResult('Erro ao importar GeoJSON. Verifique o formato.'),
  });

  const fileMutation = useMutation({
    mutationFn: ({ file, format }: { file: File; format: 'kml' | 'csv' }) =>
      format === 'kml'
        ? geoApi.importKml(municipalityId!, file, updateByName)
        : geoApi.importCsv(municipalityId!, file, updateByName),
    onSuccess: (res) => onImportSuccess(res.data),
    onError: () => setImportResult(`Erro ao importar ${importFormat.toUpperCase()}.`),
  });

  const isPending = geoJsonMutation.isPending || fileMutation.isPending;

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
      'sigaps-ruas.geojson',
    );
    setAnchorEl(null);
  };

  const handleExportMicroareas = async () => {
    if (!municipalityId) return;
    const res = await geoApi.exportMicroareas(municipalityId);
    downloadBlob(
      new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/geo+json' }),
      'sigaps-microareas.geojson',
    );
    setAnchorEl(null);
  };

  const handleExportPng = async () => {
    const container = mapContainerRef.current?.querySelector('.leaflet-container') as HTMLElement;
    if (!container) return;
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(container, { useCORS: true, allowTaint: true, logging: false });
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `sigaps-mapa-${Date.now()}.png`);
    });
    setAnchorEl(null);
  };

  const openImport = (format: ImportFormat) => {
    setImportFormat(format);
    setImportResult(null);
    setPendingGeoJson(null);
    setPendingFile(null);
    if (format === 'geojson') {
      fileInputRef.current?.click();
    } else {
      kmlCsvInputRef.current?.click();
    }
    setAnchorEl(null);
  };

  const kmlCsvInputRef = useRef<HTMLInputElement>(null);

  const handleGeoJsonFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setPendingGeoJson(JSON.parse(reader.result as string));
        setImportOpen(true);
      } catch {
        setImportResult('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
  };

  const handleKmlCsvFile = (file: File) => {
    setPendingFile(file);
    setImportOpen(true);
  };

  const handleConfirmImport = () => {
    if (importFormat === 'geojson' && pendingGeoJson) {
      geoJsonMutation.mutate(pendingGeoJson);
    } else if (pendingFile && (importFormat === 'kml' || importFormat === 'csv')) {
      fileMutation.mutate({ file: pendingFile, format: importFormat });
    }
  };

  const formatLabels: Record<ImportFormat, string> = {
    geojson: 'GeoJSON',
    kml: 'KML',
    csv: 'CSV',
  };

  return (
    <>
      <Button size="small" variant="outlined" onClick={(e) => setAnchorEl(e.currentTarget)}>
        Importar / Exportar
      </Button>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => openImport('geojson')}>
          <ListItemIcon><Upload fontSize="small" /></ListItemIcon>
          <ListItemText>Importar GeoJSON</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => openImport('kml')}>
          <ListItemIcon><Upload fontSize="small" /></ListItemIcon>
          <ListItemText>Importar KML</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => openImport('csv')}>
          <ListItemIcon><TableChart fontSize="small" /></ListItemIcon>
          <ListItemText>Importar CSV</ListItemText>
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
          if (file) handleGeoJsonFile(file);
          e.target.value = '';
        }}
      />
      <input
        ref={kmlCsvInputRef}
        type="file"
        accept=".kml,.kmz,.csv,.txt"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleKmlCsvFile(file);
          e.target.value = '';
        }}
      />

      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Importar {formatLabels[importFormat]}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Alert severity="info">
            {importFormat === 'geojson' && 'FeatureCollection com LineString. Propriedades: name, microareaName.'}
            {importFormat === 'kml' && 'Arquivo KML com linhas (LineString) exportado do QGIS ou Google Earth.'}
            {importFormat === 'csv' && 'Colunas: name, lon1, lat1, lon2, lat2, microarea_name. Ou coordinates como JSON.'}
          </Alert>
          {pendingFile && (
            <Alert severity="success">Arquivo: {pendingFile.name}</Alert>
          )}
          <FormControlLabel
            control={<Switch checked={updateByName} onChange={(e) => setUpdateByName(e.target.checked)} />}
            label="Atualizar ruas existentes com o mesmo nome"
          />
          {importResult && (
            <Alert severity={importResult.startsWith('Erro') ? 'error' : 'success'}>
              {importResult}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>Fechar</Button>
          <Button
            variant="contained"
            disabled={isPending || (importFormat === 'geojson' ? !pendingGeoJson : !pendingFile)}
            onClick={handleConfirmImport}
            startIcon={isPending ? <CircularProgress size={16} /> : undefined}
          >
            Importar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
