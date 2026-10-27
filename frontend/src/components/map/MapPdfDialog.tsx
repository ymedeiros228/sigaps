import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Typography,
  Box,
  IconButton,
  FormControlLabel,
  Checkbox,
  Chip,
} from '@mui/material';
import { Close, Download, PictureAsPdf, Print } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import type { RefObject } from 'react';
import {
  municipalitiesApi,
  neighborhoodsApi,
  streetsApi,
  ubsApi,
  type Microarea,
  type Street,
} from '../../services/api';
import { useAppStore, useMapStore } from '../../store';
import { assetUrl } from '../../utils/assetUrl';
import { CACHE, queryKeys } from '../../utils/queryKeys';
import { countPaintedStreets } from '../../utils/streetPaintStats';
import {
  captureLeafletMapImage,
  readLeafletMetersPerPixel,
  waitForMapFlyComplete,
  waitForMapReady,
} from '../../utils/mapPdfCapture';
import {
  countMicroareasOnMap,
  generateOfficialMapPdf,
  downloadPdfBlob,
  officialMapBoxRatio,
  openPdfBlob,
  type PdfFormat,
} from '../../utils/mapPdfExport';

/**
 * Caixa em volta das ruas pintadas, alargada até a proporção da janela do mapa no PDF.
 * Assim o enquadramento do mapa coincide com o recorte da folha e nenhuma rua fica de fora.
 */
function boundsForBox(lines: GeoJSON.LineString[], boxRatio: number): GeoJSON.LineString {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const line of lines) {
    for (const [lng, lat] of line.coordinates) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  const midLat = (minLat + maxLat) / 2;
  const cos = Math.cos((midLat * Math.PI) / 180);
  const w = Math.max((maxLng - minLng) * cos, 1e-6);
  const h = Math.max(maxLat - minLat, 1e-6);
  if (w / h < boxRatio) {
    const extra = (h * boxRatio - w) / cos / 2;
    minLng -= extra;
    maxLng += extra;
  } else {
    const extra = (w / boxRatio - h) / 2;
    minLat -= extra;
    maxLat += extra;
  }
  return { type: 'LineString', coordinates: [[minLng, minLat], [maxLng, maxLat]] };
}

interface MapPdfDialogProps {
  open: boolean;
  onClose: () => void;
  mapContainerRef: RefObject<HTMLElement | null>;
  microareas: Microarea[];
  homologReview?: boolean;
}

export function MapPdfDialog({
  open,
  onClose,
  mapContainerRef,
  microareas,
  homologReview = false,
}: MapPdfDialogProps) {
  const municipalityId = useAppStore((s) => s.municipalityId);
  const [format, setFormat] = useState<PdfFormat>('a4');
  const [neighborhoodId, setNeighborhoodId] = useState<string>('');
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState('sigaps-mapa.pdf');

  useEffect(() => {
    if (open) return;
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setError(null);
  }, [open]);

  const { data: municipality } = useQuery({
    queryKey: ['municipality', municipalityId],
    queryFn: () => municipalitiesApi.get(municipalityId!).then((r) => r.data),
    enabled: open && !!municipalityId,
  });

  const { data: neighborhoods = [] } = useQuery({
    queryKey: ['neighborhoods', municipalityId],
    queryFn: () => neighborhoodsApi.list(municipalityId!).then((r) => r.data),
    enabled: open && !!municipalityId,
  });

  const { data: streetsData } = useQuery({
    queryKey: queryKeys.streetsFull(municipalityId!),
    queryFn: () => streetsApi.list(municipalityId!, { limit: 2000 }).then((r) => r.data),
    enabled: open && !!municipalityId,
    staleTime: CACHE.streets,
  });

  const { data: ubsList = [] } = useQuery({
    queryKey: ['ubs', municipalityId],
    queryFn: () => ubsApi.list(municipalityId!).then((r) => r.data),
    enabled: open && !!municipalityId,
  });

  const streets = (streetsData?.items ?? []) as Street[];
  const paintedCount = countPaintedStreets(streets);
  const neighborhoodName = neighborhoods.find((n) => n.id === neighborhoodId)?.name;

  const handleGenerate = async () => {
    if (!municipality || !municipalityId) return;
    setGenerating(true);
    setError(null);

    const mapState = useMapStore.getState();
    const prevView = {
      baseLayer: mapState.baseLayer,
      showEnvelopes: mapState.showEnvelopes,
      showHeatmap: mapState.showHeatmap,
      showUbsMarkers: mapState.showUbsMarkers,
    };

    try {
      const container = mapContainerRef.current;
      if (!container) throw new Error('Mapa não encontrado');

      const leaflet = container.querySelector('.leaflet-container') as HTMLElement;
      if (!leaflet) throw new Error('Mapa não carregado');

      const filteredStreets = neighborhoodId
        ? streets.filter((s) => s.neighborhood?.id === neighborhoodId)
        : streets;

      // Mapa de ruas (não satélite) e sem os contornos/rótulos das microáreas por cima:
      // a cor de cada rua já mostra a microárea, e a legenda fica fora do mapa.
      mapState.setBaseLayer('map');
      mapState.setShowEnvelopes(false);
      mapState.setShowHeatmap(false);
      mapState.setShowUbsMarkers(true);

      const paintedGeojsons = filteredStreets
        .filter((s) => (s.microareaId || (s.paintSegments?.length ?? 0) > 0) && s.geojson)
        .map((s) => s.geojson!);
      if (paintedGeojsons.length > 0) {
        const boxRatio = officialMapBoxRatio(
          format,
          countMicroareasOnMap(microareas, filteredStreets),
          includeSignatures,
        );
        mapState.focusOnLines([boundsForBox(paintedGeojsons, boxRatio)], 16, { even: true });
        await waitForMapFlyComplete();
      }

      container.classList.add('sigaps-pdf-capture');
      await waitForMapReady(1800);

      const metersPerCssPx = readLeafletMetersPerPixel(leaflet);
      const { dataUrl, width, height } = await captureLeafletMapImage(leaflet, { scale: 3 });
      container.classList.remove('sigaps-pdf-capture');
      const mapMetersPerPixel = metersPerCssPx && width > 0 ? (metersPerCssPx * leaflet.clientWidth) / width : null;

      const homologation =
        municipality.mapHomologatedAt && municipality.mapHomologatedBy
          ? {
              at: municipality.mapHomologatedAt,
              by: municipality.mapHomologatedBy,
              notes: municipality.mapHomologationNotes,
            }
          : undefined;

      const blob = await generateOfficialMapPdf({
        format,
        mapImageDataUrl: dataUrl,
        mapImageWidth: width,
        mapImageHeight: height,
        mapMetersPerPixel,
        municipality: {
          name: municipality.name,
          state: municipality.state,
          prefecture: municipality.prefecture,
          secretariat: municipality.secretariat,
          logoUrl: assetUrl(municipality.logoUrl),
        },
        microareas,
        streets: filteredStreets,
        neighborhoodName: neighborhoodName ?? undefined,
        ubsList: ubsList.map((u) => ({ name: u.name, address: u.address })),
        includeSignatures,
        homologation,
      });

      const suffix = neighborhoodName
        ? neighborhoodName.replace(/\s+/g, '-').toLowerCase()
        : 'municipio';
      const filename = `sigaps-mapa-microareas-${suffix}-${format}.pdf`;
      setPreviewFilename(filename);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(openPdfBlob(blob));
    } catch (e) {
      mapContainerRef.current?.classList.remove('sigaps-pdf-capture');
      setError(e instanceof Error ? e.message : 'Erro ao gerar PDF. Tente novamente.');
    } finally {
      mapState.setBaseLayer(prevView.baseLayer);
      mapState.setShowEnvelopes(prevView.showEnvelopes);
      mapState.setShowHeatmap(prevView.showHeatmap);
      mapState.setShowUbsMarkers(prevView.showUbsMarkers);
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!previewUrl) return;
    const res = await fetch(previewUrl);
    downloadPdfBlob(await res.blob(), previewFilename);
  };

  const handlePrint = () => {
    if (!previewUrl) return;
    const w = window.open(previewUrl, '_blank');
    w?.focus();
    w?.print();
  };

  if (previewUrl) {
    return (
      <Dialog open={open} onClose={onClose} fullScreen>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PictureAsPdf color="primary" />
            Pré-visualização do PDF
          </Box>
          <IconButton onClick={onClose} aria-label="Fechar">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, bgcolor: '#525659' }}>
          <Box
            component="iframe"
            src={previewUrl}
            title="Pré-visualização PDF"
            sx={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 130px)', border: 0 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={() => { setPreviewUrl(null); }}>Voltar às opções</Button>
          <Button startIcon={<Print />} onClick={handlePrint}>Imprimir</Button>
          <Button variant="contained" startIcon={<Download />} onClick={handleDownload}>
            Baixar PDF
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PictureAsPdf color="primary" />
        Mapa oficial em PDF
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Mapa das ruas com as cores das microáreas, legenda, escala e norte na primeira folha;
          quadro das microáreas e lista completa de ruas nas folhas seguintes. Pronto para A4/A3.
        </Typography>

        {homologReview && (
          <Alert severity="info" data-testid="pdf-homolog-review-hint">
            <strong>Revisão para homologação SMS:</strong> confira cores, limites e nomes antes de
            imprimir em A3. Depois registre o aceite em Admin → Homologação.
          </Alert>
        )}

        {paintedCount === 0 && (
          <Alert severity="warning">
            Nenhuma rua foi pintada ainda. O PDF será gerado, mas ficará vazio até você
            vincular ruas às microáreas.
          </Alert>
        )}

        <FormControl fullWidth>
          <InputLabel>Tamanho do papel</InputLabel>
          <Select
            value={format}
            label="Tamanho do papel"
            onChange={(e) => setFormat(e.target.value as PdfFormat)}
          >
            <MenuItem value="a4">A4 horizontal (padrão)</MenuItem>
            <MenuItem value="a3">A3 horizontal (mapa grande)</MenuItem>
          </Select>
        </FormControl>

        {municipality?.mapHomologatedAt && (
          <Chip
            color="success"
            label={`Homologado SMS — ${new Date(municipality.mapHomologatedAt).toLocaleDateString('pt-BR')}`}
            sx={{ alignSelf: 'flex-start' }}
          />
        )}

        <FormControlLabel
          control={
            <Checkbox
              checked={includeSignatures}
              onChange={(e) => setIncludeSignatures(e.target.checked)}
            />
          }
          label="Incluir campos para assinatura (Enfermeiro, Coordenador APS, Secretário)"
        />

        <FormControl fullWidth>
          <InputLabel>Filtrar por bairro</InputLabel>
          <Select
            value={neighborhoodId}
            label="Filtrar por bairro"
            onChange={(e) => setNeighborhoodId(e.target.value)}
          >
            <MenuItem value="">Todo o município (visão atual)</MenuItem>
            {neighborhoods.map((n) => (
              <MenuItem key={n.id} value={n.id}>
                {n.name} ({n._count?.streets ?? 0} ruas)
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            O sistema enquadra sozinho as ruas pintadas e gera o PDF em alta resolução.
            Para um bairro só, escolha o filtro antes de gerar.
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={generating}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={generating || !municipality}
          startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdf />}
        >
          {generating ? 'Gerando PDF...' : 'Gerar e visualizar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
