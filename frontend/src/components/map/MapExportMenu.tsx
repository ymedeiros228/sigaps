import { lazy, Suspense, useEffect, useRef, useState, type RefObject } from 'react';
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
  Tooltip,
  Box,
} from '@mui/material';
import {
  FolderOpen,
  Upload,
  Download,
  Image,
  Map as MapIcon,
  TableChart,
  PictureAsPdf,
} from '@mui/icons-material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { geoApi, type Microarea } from '../../services/api';
import {
  downloadBlob,
  downloadMicroareasGeoJson,
  downloadStreetsGeoJson,
  downloadStreetsKml,
  downloadStreetsSvg,
} from '../../utils/mapFileExports';
import { getApiErrorMessage } from '../../utils/apiError';
import { accessRole, canImportStreets } from '../../utils/permissions';
import { useAppStore, useAuthStore, useMapStore } from '../../store';
import { queryKeys } from '../../utils/queryKeys';
const MapPdfDialog = lazy(() =>
  import('./MapPdfDialog').then((m) => ({ default: m.MapPdfDialog })),
);

type ImportFormat = 'geojson' | 'kml' | 'csv' | 'shapefile';

interface MapExportMenuProps {
  mapContainerRef: RefObject<HTMLElement | null>;
  microareas: Microarea[];
  onImportFamilies?: () => void;
  /** No modo pintura só o botão do PDF aparece (o menu Arquivos volta ao guardar). */
  paintMode?: boolean;
}

export function MapExportMenu({ mapContainerRef, microareas, onImportFamilies, paintMode = false }: MapExportMenuProps) {
  const municipalityId = useAppStore((s) => s.municipalityId);
  const user = useAuthStore((s) => s.user);
  // A API só aceita importação desses perfis (IMPORT_ROLES no geo.controller).
  const canImport = canImportStreets(accessRole(user));
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
  const [homologReview, setHomologReview] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // O PDF fotografa o mapa: sai do modo pintura antes (a pintura já está salva).
  const openPdf = () => {
    const map = useMapStore.getState();
    if (map.paintMode) {
      map.setPaintMode(false);
      map.setPaintGuideCollapsed(true);
    }
    setAnchorEl(null);
    setPdfOpen(true);
  };

  // /mapa?pdf=1 (botão da página Documentos) abre o PDF direto.
  useEffect(() => {
    if (searchParams.get('pdf') !== '1') return;
    openPdf();
    setHomologReview(searchParams.get('homolog') === '1');
    const next = new URLSearchParams(searchParams);
    next.delete('pdf');
    next.delete('homolog');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

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

  const runExport = async (download: (municipalityId: string) => Promise<void>, fallback: string) => {
    if (!municipalityId) return;
    try {
      await download(municipalityId);
      setExportError(null);
      setAnchorEl(null);
    } catch (err) {
      setExportError(getApiErrorMessage(err, fallback));
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
      {/* O PDF fica à vista (antes estava no fim do menu Arquivos e ninguém achava). */}
      <Tooltip title="Gerar o mapa oficial em PDF (A4/A3) para imprimir">
        <Button
          size="small"
          variant="contained"
          color="primary"
          aria-label="Gerar PDF"
          data-testid="map-generate-pdf"
          onClick={openPdf}
          startIcon={<PictureAsPdf fontSize="small" />}
          sx={{ minWidth: 0, px: 1.25, whiteSpace: 'nowrap', fontWeight: 700 }}
        >
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>PDF</Box>
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Gerar PDF</Box>
        </Button>
      </Tooltip>
      {!paintMode && (
        <Tooltip title="Imagens, arquivos do mapa e importação">
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            aria-label="Arquivos"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            startIcon={<FolderOpen fontSize="small" />}
            sx={{ minWidth: 0, px: 1.25, borderColor: 'divider', '& .MuiButton-startIcon': { mr: { xs: 0, md: 0.75 } } }}
          >
            <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
              Arquivos
            </Box>
          </Button>
        </Tooltip>
      )}
      {exportError && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setExportError(null)}>
          {exportError}
        </Alert>
      )}
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
        <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, display: 'block' }}>
          Exportar / salvar
        </Typography>
        <MenuItem onClick={openPdf}>
          <ListItemIcon><PictureAsPdf fontSize="small" color="primary" /></ListItemIcon>
          <ListItemText
            primary="Mapa oficial (PDF)"
            secondary="A4/A3 com legenda, escala e QR Code"
          />
        </MenuItem>
        <MenuItem onClick={handleExportPng}>
          <ListItemIcon><Image fontSize="small" /></ListItemIcon>
          <ListItemText primary="Imagem PNG" secondary="Alta qualidade para impressão" />
        </MenuItem>
        <MenuItem onClick={handleExportJpeg}>
          <ListItemIcon><Image fontSize="small" /></ListItemIcon>
          <ListItemText primary="Imagem JPEG" secondary="Arquivo menor para compartilhar" />
        </MenuItem>
        <MenuItem onClick={() => void runExport(downloadStreetsGeoJson, 'Não foi possível exportar as ruas.')}>
          <ListItemIcon><Download fontSize="small" /></ListItemIcon>
          <ListItemText primary="Lista de ruas" secondary="Arquivo GeoJSON" />
        </MenuItem>
        <MenuItem onClick={() => void runExport(downloadStreetsKml, 'Não foi possível exportar o KML.')}>
          <ListItemIcon><MapIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Ruas (KML)" secondary="Google Earth / QGIS" />
        </MenuItem>
        <MenuItem onClick={() => void runExport(downloadStreetsSvg, 'Não foi possível exportar o SVG.')}>
          <ListItemIcon><Image fontSize="small" /></ListItemIcon>
          <ListItemText primary="Ruas (SVG)" secondary="Vetorial leve para impressão" />
        </MenuItem>
        <MenuItem onClick={() => void runExport(downloadMicroareasGeoJson, 'Não foi possível exportar as microáreas.')}>
          <ListItemIcon><MapIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Microáreas" secondary="Arquivo GeoJSON" />
        </MenuItem>
        {canImport && [
          <Divider key="import-divider" />,
          <Typography key="import-title" variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, display: 'block' }}>
            Importar
          </Typography>,
          <MenuItem key="import-geojson" onClick={() => openImport('geojson')}>
            <ListItemIcon><Upload fontSize="small" /></ListItemIcon>
            <ListItemText primary="Ruas de outro sistema" secondary="Formato GeoJSON" />
          </MenuItem>,
          <MenuItem key="import-kml" onClick={() => openImport('kml')}>
            <ListItemIcon><Upload fontSize="small" /></ListItemIcon>
            <ListItemText primary="Mapa do Google Earth / QGIS" secondary="Formato KML" />
          </MenuItem>,
          <MenuItem key="import-csv" onClick={() => openImport('csv')}>
            <ListItemIcon><TableChart fontSize="small" /></ListItemIcon>
            <ListItemText primary="Planilha de ruas" secondary="Formato CSV" />
          </MenuItem>,
          <MenuItem key="import-shapefile" onClick={() => openImport('shapefile')}>
            <ListItemIcon><Upload fontSize="small" /></ListItemIcon>
            <ListItemText primary="Shapefile (.zip)" secondary="QGIS / ArcGIS (.shp/.dbf/.shx)" />
          </MenuItem>,
          onImportFamilies && (
            <MenuItem
              key="import-families"
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
          ),
        ]}
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
            homologReview={homologReview}
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
