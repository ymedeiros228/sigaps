import { lazy, Suspense, useRef, useState, type RefObject } from 'react';
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
  Divider,
  Typography,
} from '@mui/material';
import {
  Upload,
  Download,
  Image,
  Map as MapIcon,
  TableChart,
  PictureAsPdf,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { geoApi, type Microarea } from '../../services/api';
import { streetsToSvg } from '../../utils/mapSvgExport';
import { getApiErrorMessage } from '../../utils/apiError';
import { useAppStore } from '../../store';
import { queryKeys } from '../../utils/queryKeys';
const MapPdfDialog = lazy(() =>
  import('./MapPdfDialog').then((m) => ({ default: m.MapPdfDialog })),
);

type ImportFormat = 'geojson' | 'kml' | 'csv' | 'shapefile';

interface MapExportMenuProps {
  mapContainerRef: RefObject<HTMLElement | null>;
  microareas: Microarea[];
  onImportFamilies?: () => void;
}

export function MapExportMenu({ mapContainerRef, microareas, onImportFamilies }: MapExportMenuProps) {
  const municipalityId = useAppStore((s) => s.municipalityId);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kmlCsvInputRef = useRef<HTMLInputElement>(null);
  const shapefileInputRef = useRef<HTMLInputElement>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFormat, setImportFormat] = useState<ImportFormat>('geojson');
  const [updateByName, setUpdateByName] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [pendingGeoJson, setPendingGeoJson] = useState<object | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const onImportSuccess = (res: { imported: number; updated: number; skipped: number }) => {
    if (municipalityId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.streetsMap(municipalityId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(municipalityId) });
    }
    setImportResult(
      `Pronto! ${res.imported} ruas novas, ${res.updated} atualizadas, ${res.skipped} ignoradas.`,
    );
  };

  const geoJsonMutation = useMutation({
    mutationFn: (geojson: object) =>
      geoApi.import(municipalityId!, { geojson, updateByName }),
    onSuccess: (res) => onImportSuccess(res.data),
    onError: () => setImportResult('Não foi possível importar o arquivo. Verifique se o formato está correto.'),
  });

  const fileMutation = useMutation({
    mutationFn: ({ file, format }: { file: File; format: 'kml' | 'csv' | 'shapefile' }) => {
      if (format === 'kml') return geoApi.importKml(municipalityId!, file, updateByName);
      if (format === 'shapefile') return geoApi.importShapefile(municipalityId!, file, updateByName);
      return geoApi.importCsv(municipalityId!, file, updateByName);
    },
    onSuccess: (res) => onImportSuccess(res.data),
    onError: () => setImportResult('Não foi possível importar o arquivo. Tente outro formato.'),
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
    try {
      const res = await geoApi.exportStreets(municipalityId);
      downloadBlob(
        new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/geo+json' }),
        'sigaps-ruas.geojson',
      );
      setExportError(null);
      setAnchorEl(null);
    } catch (err) {
      setExportError(getApiErrorMessage(err, 'Não foi possível exportar as ruas.'));
    }
  };

  const handleExportKml = async () => {
    if (!municipalityId) return;
    try {
      const res = await geoApi.exportStreetsKml(municipalityId);
      downloadBlob(new Blob([res.data], { type: 'application/vnd.google-earth.kml+xml' }), 'sigaps-ruas.kml');
      setExportError(null);
      setAnchorEl(null);
    } catch (err) {
      setExportError(getApiErrorMessage(err, 'Não foi possível exportar o KML.'));
    }
  };

  const handleExportSvg = async () => {
    if (!municipalityId) return;
    try {
      const res = await geoApi.exportStreets(municipalityId);
      const fc = res.data as GeoJSON.FeatureCollection;
      const features = (fc.features ?? [])
        .filter((f) => f.geometry?.type === 'LineString')
        .map((f) => ({
          name: String((f.properties as { name?: string })?.name ?? 'Rua'),
          color: String((f.properties as { microareaColor?: string })?.microareaColor ?? '#888888'),
          coordinates: (f.geometry as GeoJSON.LineString).coordinates as [number, number][],
        }));
      const title = String((fc as { metadata?: { name?: string } }).metadata?.name ?? 'SIGAPS');
      const svg = streetsToSvg(features, title);
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'sigaps-ruas.svg');
      setExportError(null);
      setAnchorEl(null);
    } catch (err) {
      setExportError(getApiErrorMessage(err, 'Não foi possível exportar o SVG.'));
    }
  };

  const handleExportMicroareas = async () => {
    if (!municipalityId) return;
    try {
      const res = await geoApi.exportMicroareas(municipalityId);
      downloadBlob(
        new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/geo+json' }),
        'sigaps-microareas.geojson',
      );
      setExportError(null);
      setAnchorEl(null);
    } catch (err) {
      setExportError(getApiErrorMessage(err, 'Não foi possível exportar as microáreas.'));
    }
  };

  const handleExportPng = async () => {
    const container = mapContainerRef.current?.querySelector('.leaflet-container') as HTMLElement;
    if (!container) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(container, { useCORS: true, allowTaint: true, logging: false });
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `sigaps-mapa-${Date.now()}.png`);
      });
      setExportError(null);
      setAnchorEl(null);
    } catch (err) {
      setExportError(getApiErrorMessage(err, 'Não foi possível exportar a imagem PNG.'));
    }
  };

  const handleExportJpeg = async () => {
    const container = mapContainerRef.current?.querySelector('.leaflet-container') as HTMLElement;
    if (!container) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(container, { useCORS: true, allowTaint: true, logging: false });
      canvas.toBlob(
        (blob) => {
          if (blob) downloadBlob(blob, `sigaps-mapa-${Date.now()}.jpg`);
        },
        'image/jpeg',
        0.92,
      );
      setExportError(null);
      setAnchorEl(null);
    } catch (err) {
      setExportError(getApiErrorMessage(err, 'Não foi possível exportar a imagem JPEG.'));
    }
  };

  const openImport = (format: ImportFormat) => {
    setImportFormat(format);
    setImportResult(null);
    setPendingGeoJson(null);
    setPendingFile(null);
    if (format === 'geojson') {
      fileInputRef.current?.click();
    } else if (format === 'shapefile') {
      shapefileInputRef.current?.click();
    } else {
      kmlCsvInputRef.current?.click();
    }
    setAnchorEl(null);
  };

  const handleGeoJsonFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setPendingGeoJson(JSON.parse(reader.result as string));
        setImportOpen(true);
      } catch {
        setImportResult('Arquivo inválido. Envie um arquivo .geojson ou .json.');
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
    } else if (pendingFile && (importFormat === 'kml' || importFormat === 'csv' || importFormat === 'shapefile')) {
      fileMutation.mutate({ file: pendingFile, format: importFormat });
    }
  };

  const formatLabels: Record<ImportFormat, string> = {
    geojson: 'arquivo de mapa (GeoJSON)',
    kml: 'arquivo KML',
    csv: 'planilha CSV',
    shapefile: 'Shapefile (.zip)',
  };

  return (
    <>
      <Button size="small" variant="outlined" onClick={(e) => setAnchorEl(e.currentTarget)}>
        Arquivos
      </Button>
      {exportError && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setExportError(null)}>
          {exportError}
        </Alert>
      )}
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, display: 'block' }}>
          Importar
        </Typography>
        <MenuItem onClick={() => openImport('geojson')}>
          <ListItemIcon><Upload fontSize="small" /></ListItemIcon>
          <ListItemText primary="Ruas de outro sistema" secondary="Formato GeoJSON" />
        </MenuItem>
        <MenuItem onClick={() => openImport('kml')}>
          <ListItemIcon><Upload fontSize="small" /></ListItemIcon>
          <ListItemText primary="Mapa do Google Earth / QGIS" secondary="Formato KML" />
        </MenuItem>
        <MenuItem onClick={() => openImport('csv')}>
          <ListItemIcon><TableChart fontSize="small" /></ListItemIcon>
          <ListItemText primary="Planilha de ruas" secondary="Formato CSV" />
        </MenuItem>
        <MenuItem onClick={() => openImport('shapefile')}>
          <ListItemIcon><Upload fontSize="small" /></ListItemIcon>
          <ListItemText primary="Shapefile (.zip)" secondary="QGIS / ArcGIS (.shp/.dbf/.shx)" />
        </MenuItem>
        {onImportFamilies && (
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              onImportFamilies();
            }}
          >
            <ListItemIcon><TableChart fontSize="small" /></ListItemIcon>
            <ListItemText
              primary="Famílias e habitantes"
              secondary="CSV: rua;familias;habitantes"
            />
          </MenuItem>
        )}
        <Divider />
        <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, display: 'block' }}>
          Exportar / salvar
        </Typography>
        <MenuItem onClick={handleExportStreets}>
          <ListItemIcon><Download fontSize="small" /></ListItemIcon>
          <ListItemText primary="Lista de ruas" secondary="Arquivo GeoJSON" />
        </MenuItem>
        <MenuItem onClick={handleExportKml}>
          <ListItemIcon><MapIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Ruas (KML)" secondary="Google Earth / QGIS" />
        </MenuItem>
        <MenuItem onClick={handleExportSvg}>
          <ListItemIcon><Image fontSize="small" /></ListItemIcon>
          <ListItemText primary="Ruas (SVG)" secondary="Vetorial leve para impressão" />
        </MenuItem>
        <MenuItem onClick={handleExportMicroareas}>
          <ListItemIcon><MapIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Microáreas" secondary="Arquivo GeoJSON" />
        </MenuItem>
        <MenuItem onClick={handleExportPng}>
          <ListItemIcon><Image fontSize="small" /></ListItemIcon>
          <ListItemText primary="Imagem PNG" secondary="Alta qualidade para impressão" />
        </MenuItem>
        <MenuItem onClick={handleExportJpeg}>
          <ListItemIcon><Image fontSize="small" /></ListItemIcon>
          <ListItemText primary="Imagem JPEG" secondary="Arquivo menor para compartilhar" />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            setPdfOpen(true);
          }}
        >
          <ListItemIcon><PictureAsPdf fontSize="small" /></ListItemIcon>
          <ListItemText
            primary="Mapa oficial (PDF)"
            secondary="A4/A3 com legenda, escala e QR Code"
          />
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
        ref={shapefileInputRef}
        type="file"
        accept=".zip,.shp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleKmlCsvFile(file);
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

      {pdfOpen && (
        <Suspense fallback={null}>
          <MapPdfDialog
            open={pdfOpen}
            onClose={() => setPdfOpen(false)}
            mapContainerRef={mapContainerRef}
            microareas={microareas}
          />
        </Suspense>
      )}

      <Dialog open={importOpen} onClose={() => setImportOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Importar {formatLabels[importFormat]}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Alert severity="info">
            {importFormat === 'geojson' && 'Arquivo com linhas de ruas. Cada rua deve ter um nome.'}
            {importFormat === 'kml' && 'Arquivo exportado do Google Earth ou QGIS com as ruas em linhas.'}
            {importFormat === 'csv' && 'Planilha com colunas: nome da rua e coordenadas.'}
            {importFormat === 'shapefile' && 'Arquivo .zip com .shp, .dbf e .shx (ou .shp solto). Linhas serão importadas como ruas.'}
          </Alert>
          {pendingFile && (
            <Alert severity="success">Arquivo selecionado: {pendingFile.name}</Alert>
          )}
          <FormControlLabel
            control={<Switch checked={updateByName} onChange={(e) => setUpdateByName(e.target.checked)} />}
            label="Atualizar ruas que já existem com o mesmo nome"
          />
          {importResult && (
            <Alert severity={importResult.startsWith('Não') ? 'error' : 'success'}>
              {importResult}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={isPending || (importFormat === 'geojson' ? !pendingGeoJson : !pendingFile)}
            onClick={handleConfirmImport}
            startIcon={isPending ? <CircularProgress size={16} /> : undefined}
          >
            Importar agora
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
