import { useState } from 'react';
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
} from '@mui/material';
import { PictureAsPdf } from '@mui/icons-material';
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

      await new Promise((r) => setTimeout(r, 400));

      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(leaflet, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: 2,
      });
      const mapImageDataUrl = canvas.toDataURL('image/png');

      container.classList.remove('sigaps-pdf-capture');

      const filteredStreets = neighborhoodId
        ? streets.filter((s) => s.neighborhood?.id === neighborhoodId)
        : streets;

      const blob = await generateOfficialMapPdf({
        format,
        mapImageDataUrl,
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
      downloadPdfBlob(blob, `sigaps-mapa-microareas-${suffix}-${format}.pdf`);
      onClose();
    } catch (e) {
      mapContainerRef.current?.classList.remove('sigaps-pdf-capture');
      setError(e instanceof Error ? e.message : 'Erro ao gerar PDF. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PictureAsPdf color="primary" />
        Mapa oficial em PDF
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Gera um mapa profissional com imagem de satélite, microáreas coloridas, legenda,
          escala, rosa dos ventos e QR Code — pronto para impressão na Secretaria de Saúde.
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
            Dica: centralize o mapa na área desejada e use visão satélite com
            microáreas ativadas antes de gerar.
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
          {generating ? 'Gerando PDF...' : 'Baixar PDF oficial'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
