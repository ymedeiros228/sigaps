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
} from '../../services/api';
import { useAppStore } from '../../store';
import { assetUrl } from '../../utils/assetUrl';
import {
  generateOfficialMapPdf,
  downloadPdfBlob,
  openPdfBlob,
  type PdfFormat,
} from '../../utils/mapPdfExport';

interface MapPdfDialogProps {
  open: boolean;
  onClose: () => void;
  mapContainerRef: RefObject<HTMLElement | null>;
  microareas: Microarea[];
}

export function MapPdfDialog({ open, onClose, mapContainerRef, microareas }: MapPdfDialogProps) {
  const municipalityId = useAppStore((s) => s.municipalityId);
  const [format, setFormat] = useState<PdfFormat>('a4');
  const [neighborhoodId, setNeighborhoodId] = useState<string>('');
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
    queryKey: ['streets', municipalityId],
    queryFn: () => streetsApi.list(municipalityId!, { limit: 2000 }).then((r) => r.data),
    enabled: open && !!municipalityId,
  });

  const { data: ubsList = [] } = useQuery({
    queryKey: ['ubs', municipalityId],
    queryFn: () => ubsApi.list(municipalityId!).then((r) => r.data),
    enabled: open && !!municipalityId,
  });

  const streets = streetsData?.items ?? [];
  const paintedCount = streets.filter((s) => s.microareaId).length;
  const neighborhoodName = neighborhoods.find((n) => n.id === neighborhoodId)?.name;

  const handleGenerate = async () => {
    if (!municipality || !municipalityId) return;
    setGenerating(true);
    setError(null);

    try {
      const container = mapContainerRef.current;
      if (!container) throw new Error('Mapa não encontrado');

      const leaflet = container.querySelector('.leaflet-container') as HTMLElement;
      if (!leaflet) throw new Error('Mapa não carregado');

      container.classList.add('sigaps-pdf-capture');
      await new Promise((r) => setTimeout(r, 900));

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(leaflet, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: 2,
        backgroundColor: '#0B0F14',
      });
      const mapImageDataUrl = canvas.toDataURL('image/png');

      container.classList.remove('sigaps-pdf-capture');

      const filteredStreets = neighborhoodId
        ? streets.filter((s) => s.neighborhood?.id === neighborhoodId)
        : streets;

      const blob = await generateOfficialMapPdf({
        format,
        mapImageDataUrl,
        mapImageWidth: canvas.width,
        mapImageHeight: canvas.height,
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
        ubsName: ubsList[0]?.name,
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
          Gera um mapa profissional com imagem do satélite, legenda lateral, detalhes
          por microárea, escala e QR Code — pronto para impressão.
        </Typography>

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

        <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Centralize o mapa na área desejada, ative Microáreas + satélite, depois gere
            e confira na pré-visualização antes de baixar.
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
