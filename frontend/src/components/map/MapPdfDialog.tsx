import { useEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';
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
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
  Divider,
  Stack,
} from '@mui/material';
import { Close, Download, PictureAsPdf, Print, RestartAlt } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import {
  municipalitiesApi,
  neighborhoodsApi,
  placesApi,
  streetsApi,
  ubsApi,
  type Microarea,
  type Street,
} from '../../services/api';
import { useAppStore, useMapStore } from '../../store';
import { assetUrl } from '../../utils/assetUrl';
import { CACHE, queryKeys } from '../../utils/queryKeys';
import { countPaintedStreets } from '../../utils/streetPaintStats';
import { captureMapForPdf } from '../../utils/mapPdfCapture';
import { fetchReferencePoints, type ReferencePoint } from '../../utils/osmReferencePoints';
import {
  DEFAULT_PDF_SETTINGS,
  DEFAULT_TITLE,
  LABEL_SCALE,
  MARGIN_PX,
  REFERENCE_CATEGORIES,
  detectAreaKind,
  isStreetPainted,
  loadPdfSettings,
  microareaIdsOfStreets,
  savePdfSettings,
  streetInMicroareas,
  type PdfMapSettings,
  type ReferenceCategory,
} from '../../utils/pdfMapSettings';
import {
  countMicroareasOnMap,
  generateOfficialMapPdf,
  downloadPdfBlob,
  officialMapBoxRatio,
  openPdfBlob,
  type LegendSymbol,
} from '../../utils/mapPdfExport';
import { getCurrentLeafletMap } from '../../utils/mapInstance';

/** Largura (px de tela) do mapa fotografado: define o tamanho dos nomes na folha impressa. */
const CAPTURE_CSS_WIDTH = { a4: 1300, a3: 1700 } as const;

/** Limite de pontos de referência: acima disso o mapa vira uma sopa de nomes. */
const MAX_REFERENCE_POINTS = 70;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: 0.8, lineHeight: 2 }}>
        {title}
      </Typography>
      <Stack spacing={1.5}>{children}</Stack>
    </Box>
  );
}

function Toggle<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  label?: string;
}) {
  return (
    <Box>
      {label && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
          {label}
        </Typography>
      )}
      <ToggleButtonGroup
        size="small"
        exclusive
        value={value}
        onChange={(_, v) => v && onChange(v as T)}
        sx={{ flexWrap: 'wrap' }}
      >
        {options.map((o) => (
          <ToggleButton key={o.value} value={o.value} sx={{ textTransform: 'none', px: 1.5 }}>
            {o.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
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
  const [settings, setSettings] = useState<PdfMapSettings>(loadPdfSettings);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState('sigaps-mapa.pdf');

  const set = <K extends keyof PdfMapSettings>(key: K, value: PdfMapSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

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
    queryKey: queryKeys.ubs(municipalityId!),
    queryFn: () => ubsApi.list(municipalityId!).then((r) => r.data),
    enabled: open && !!municipalityId,
    staleTime: CACHE.default,
  });

  const { data: places = [] } = useQuery({
    queryKey: queryKeys.places(municipalityId!),
    queryFn: () => placesApi.list(municipalityId!).then((r) => r.data),
    enabled: open && !!municipalityId,
    staleTime: CACHE.places,
  });

  const streets = useMemo(() => (streetsData?.items ?? []) as Street[], [streetsData]);
  const paintedCount = countPaintedStreets(streets);
  const neighborhoodName = neighborhoods.find((n) => n.id === settings.neighborhoodId)?.name;

  // Recorte: quais ruas e microáreas entram nesta folha.
  const scope = useMemo(() => {
    let scopedStreets = streets;
    let ids: Set<string>;
    if (settings.scope === 'bairro' && settings.neighborhoodId) {
      scopedStreets = streets.filter((s) => s.neighborhood?.id === settings.neighborhoodId);
      ids = microareaIdsOfStreets(scopedStreets);
    } else if (settings.scope === 'microareas' && settings.microareaIds.length > 0) {
      ids = new Set(settings.microareaIds);
      scopedStreets = streets.filter((s) => streetInMicroareas(s, ids));
    } else {
      ids = microareaIdsOfStreets(streets);
    }
    const painted = scopedStreets.filter((s) => isStreetPainted(s) && s.geojson);
    const scopedPlaces = places.filter((p) => p.microareaId && ids.has(p.microareaId));
    const detected = detectAreaKind(painted, places, ids);
    return { scopedStreets, ids, painted, scopedPlaces, detected };
  }, [streets, places, settings.scope, settings.neighborhoodId, settings.microareaIds]);

  const areaKind = settings.areaKind === 'auto' ? scope.detected : settings.areaKind;
  const showReferences =
    settings.references === 'sim' || (settings.references === 'auto' && areaKind === 'urbana');

  const handleGenerate = async () => {
    if (!municipality || !municipalityId) return;
    const map = getCurrentLeafletMap();
    const container = mapContainerRef.current;
    if (!map || !container) {
      setError('Mapa não carregado. Abra o mapa e tente de novo.');
      return;
    }
    setGenerating(true);
    setError(null);
    setNotice(null);
    savePdfSettings(settings);

    const mapState = useMapStore.getState();
    const prevView = {
      baseLayer: mapState.baseLayer,
      showEnvelopes: mapState.showEnvelopes,
      showHeatmap: mapState.showHeatmap,
    };

    try {
      const pdfMicroareas =
        settings.scope === 'municipio' ? microareas : microareas.filter((m) => scope.ids.has(m.id));
      const pdfStreets = scope.scopedStreets;

      // Legenda extra: povoados, UBS e as categorias de referência escolhidas.
      const categoryLegend = showReferences
        ? REFERENCE_CATEGORIES.filter((c) => settings.referenceCategories.includes(c.id))
        : [];
      const baseLegend: LegendSymbol[] = [];
      if (places.length > 0 && (settings.placeLabels !== 'nenhum' || areaKind === 'rural')) {
        baseLegend.push({ color: '#6D4C41', glyph: '⌂', text: 'Povoado (na cor da microárea)' });
      }
      if (ubsList.length > 0) baseLegend.push({ color: '#1565C0', glyph: '+', text: 'UBS' });
      const rowCount = countMicroareasOnMap(pdfMicroareas, pdfStreets);
      const layoutLegendCount = rowCount + 1 + baseLegend.length + categoryLegend.length;
      const boxRatio = officialMapBoxRatio(
        settings.format,
        rowCount,
        settings.includeSignatures,
        baseLegend.length + categoryLegend.length,
      );

      // O que precisa caber: ruas pintadas do recorte e, na zona rural, os povoados delas.
      let bounds: L.LatLngBounds | null = null;
      if (settings.framing === 'auto') {
        const pts: L.LatLngExpression[] = [];
        for (const s of scope.painted) for (const [lng, lat] of s.geojson!.coordinates) pts.push([lat, lng]);
        for (const p of scope.scopedPlaces) pts.push([p.latitude, p.longitude]);
        if (pts.length > 0) bounds = L.latLngBounds(pts);
        else setNotice('Nada pintado neste recorte: usei o enquadramento que está na tela.');
      }

      mapState.setBaseLayer('map');
      mapState.setShowEnvelopes(false);
      mapState.setShowHeatmap(false);
      container.classList.add('sigaps-pdf-capture');
      setProgress('Enquadrando o mapa…');

      let refs: ReferencePoint[] = [];
      const capture = await captureMapForPdf(map, {
        boxRatio,
        cssWidth: CAPTURE_CSS_WIDTH[settings.format],
        bounds,
        marginPx: MARGIN_PX[settings.margin],
        scale: 2,
        beforeCapture: async (visible) => {
          if (showReferences && settings.referenceCategories.length > 0) {
            setProgress('Buscando pontos de referência…');
            const all = await fetchReferencePoints(
              [visible.getSouth(), visible.getWest(), visible.getNorth(), visible.getEast()],
              settings.referenceCategories,
            );
            // Ordem das categorias = prioridade quando há pontos demais.
            const order = REFERENCE_CATEGORIES.map((c) => c.id);
            refs = all
              .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))
              .slice(0, MAX_REFERENCE_POINTS);
          }
          useMapStore.getState().setPdfCapture({
            microareaIds: [...scope.ids],
            placeLabels: settings.placeLabels,
            otherPlaces: settings.otherPlaces,
            labelScale: LABEL_SCALE[settings.labelSize],
            referencePoints: refs,
          });
          setProgress('Carregando o mapa em alta resolução…');
          await new Promise((r) => setTimeout(r, 400));
        },
      });
      container.classList.remove('sigaps-pdf-capture');
      useMapStore.getState().setPdfCapture(null);

      const presentCats = new Set<ReferenceCategory>(refs.map((r) => r.category));
      const extraLegend: LegendSymbol[] = [
        ...baseLegend,
        ...categoryLegend
          .filter((c) => presentCats.has(c.id))
          .map((c) => ({ color: c.color, glyph: c.glyph, text: c.short })),
      ];
      if (showReferences && settings.referenceCategories.length > 0 && refs.length === 0) {
        setNotice('O OpenStreetMap não tem pontos de referência com nome nesta área (ou não respondeu).');
      }

      setProgress('Montando o PDF…');
      const homologation =
        municipality.mapHomologatedAt && municipality.mapHomologatedBy
          ? {
              at: municipality.mapHomologatedAt,
              by: municipality.mapHomologatedBy,
              notes: municipality.mapHomologationNotes,
            }
          : undefined;

      const blob = await generateOfficialMapPdf({
        format: settings.format,
        mapImageDataUrl: capture.dataUrl,
        mapImageWidth: capture.width,
        mapImageHeight: capture.height,
        mapMetersPerPixel: capture.metersPerPixel,
        municipality: {
          name: municipality.name,
          state: municipality.state,
          prefecture: municipality.prefecture,
          secretariat: municipality.secretariat,
          logoUrl: assetUrl(municipality.logoUrl),
        },
        microareas: pdfMicroareas,
        streets: pdfStreets,
        neighborhoodName: settings.scope === 'bairro' ? neighborhoodName : undefined,
        ubsList: ubsList.map((u) => ({ name: u.name, address: u.address })),
        includeSignatures: settings.includeSignatures,
        includeAnnex: settings.includeAnnex,
        title: settings.title,
        subtitle: settings.subtitle,
        extraLegend,
        layoutLegendCount,
        homologation,
      });

      const suffix =
        settings.scope === 'bairro' && neighborhoodName
          ? neighborhoodName
          : settings.scope === 'microareas' && pdfMicroareas.length > 0
            ? pdfMicroareas.map((m) => m.name).join('-')
            : 'municipio';
      const slug = suffix
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .slice(0, 60);
      setPreviewFilename(`sigaps-mapa-${slug}-${settings.format}.pdf`);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(openPdfBlob(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar PDF. Tente novamente.');
    } finally {
      mapContainerRef.current?.classList.remove('sigaps-pdf-capture');
      useMapStore.getState().setPdfCapture(null);
      mapState.setBaseLayer(prevView.baseLayer);
      mapState.setShowEnvelopes(prevView.showEnvelopes);
      mapState.setShowHeatmap(prevView.showHeatmap);
      setGenerating(false);
      setProgress('');
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
        {notice && (
          <Alert severity="info" sx={{ mx: 2, mb: 1 }}>
            {notice}
          </Alert>
        )}
        <DialogContent sx={{ p: 0, bgcolor: '#525659' }}>
          <Box
            component="iframe"
            src={previewUrl}
            title="Pré-visualização PDF"
            sx={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 130px)', border: 0 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={() => setPreviewUrl(null)}>Ajustar opções</Button>
          <Button startIcon={<Print />} onClick={handlePrint}>
            Imprimir
          </Button>
          <Button variant="contained" startIcon={<Download />} onClick={handleDownload}>
            Baixar PDF
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  const selectedMicroareas = microareas.filter((m) => settings.microareaIds.includes(m.id));

  return (
    <Dialog open={open} onClose={generating ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PictureAsPdf color="primary" />
        Mapa oficial em PDF
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<RestartAlt />}
          onClick={() => setSettings(DEFAULT_PDF_SETTINGS)}
          disabled={generating}
        >
          Restaurar padrão
        </Button>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
        {homologReview && (
          <Alert severity="info" data-testid="pdf-homolog-review-hint">
            <strong>Revisão para homologação SMS:</strong> confira cores, limites e nomes antes de
            imprimir em A3. Depois registre o aceite em Admin → Homologação.
          </Alert>
        )}

        {paintedCount === 0 && (
          <Alert severity="warning">
            Nenhuma rua foi pintada ainda. O PDF será gerado, mas ficará vazio até você vincular ruas
            às microáreas.
          </Alert>
        )}

        <Section title="O que imprimir">
          <Toggle
            value={settings.scope}
            onChange={(v) => set('scope', v)}
            options={[
              { value: 'municipio', label: 'Município inteiro' },
              { value: 'bairro', label: 'Um bairro' },
              { value: 'microareas', label: 'Microáreas escolhidas' },
            ]}
          />
          {settings.scope === 'bairro' && (
            <FormControl fullWidth size="small">
              <InputLabel>Bairro</InputLabel>
              <Select
                value={settings.neighborhoodId}
                label="Bairro"
                onChange={(e) => set('neighborhoodId', e.target.value)}
              >
                {neighborhoods.map((n) => (
                  <MenuItem key={n.id} value={n.id}>
                    {n.name} ({n._count?.streets ?? 0} ruas)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {settings.scope === 'microareas' && (
            <Autocomplete
              multiple
              size="small"
              options={microareas}
              value={selectedMicroareas}
              getOptionLabel={(m) => (m.acs?.name ? `${m.name} · ${m.acs.name}` : m.name)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, v) => set('microareaIds', v.map((m) => m.id))}
              renderValue={(value, getItemProps) =>
                value.map((m, i) => {
                  const { key, ...rest } = getItemProps({ index: i });
                  return (
                    <Chip
                      key={key}
                      {...rest}
                      size="small"
                      label={m.name}
                      sx={{ bgcolor: m.color, color: '#fff', fontWeight: 700, '& .MuiChip-deleteIcon': { color: '#fff' } }}
                    />
                  );
                })
              }
              renderInput={(params) => <TextField {...params} label="Microáreas" placeholder="Escolha uma ou mais" />}
            />
          )}
        </Section>

        <Divider />

        <Section title="Tipo de área">
          <Toggle
            value={settings.areaKind}
            onChange={(v) => set('areaKind', v)}
            options={[
              { value: 'auto', label: `Automático (${scope.detected === 'rural' ? 'detectei: rural' : 'detectei: urbana'})` },
              { value: 'rural', label: 'Zona rural' },
              { value: 'urbana', label: 'Zona urbana' },
            ]}
          />
          <Typography variant="caption" color="text.secondary">
            {areaKind === 'rural'
              ? 'Zona rural: o mapa aproxima nas estradas e povoados da área e mostra o nome de cada povoado.'
              : 'Zona urbana: o mapa aproxima nas ruas e mostra pontos de referência (escolas, igrejas, praças…).'}
          </Typography>
        </Section>

        <Divider />

        <Section title="O que aparece no mapa">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Nomes dos povoados</InputLabel>
              <Select
                value={settings.placeLabels}
                label="Nomes dos povoados"
                onChange={(e) => set('placeLabels', e.target.value as PdfMapSettings['placeLabels'])}
              >
                <MenuItem value="area">Só os povoados da área</MenuItem>
                <MenuItem value="todos">Todos os povoados</MenuItem>
                <MenuItem value="nenhum">Nenhum nome</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Povoados de fora da área</InputLabel>
              <Select
                value={settings.otherPlaces}
                label="Povoados de fora da área"
                onChange={(e) => set('otherPlaces', e.target.value as PdfMapSettings['otherPlaces'])}
              >
                <MenuItem value="apagados">Apagados (cinza, sem destaque)</MenuItem>
                <MenuItem value="normal">Normais</MenuItem>
                <MenuItem value="esconder">Esconder</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
              <InputLabel>Pontos de referência</InputLabel>
              <Select
                value={settings.references}
                label="Pontos de referência"
                onChange={(e) => set('references', e.target.value as PdfMapSettings['references'])}
              >
                <MenuItem value="auto">Automático (só na zona urbana)</MenuItem>
                <MenuItem value="sim">Mostrar sempre</MenuItem>
                <MenuItem value="nao">Não mostrar</MenuItem>
              </Select>
            </FormControl>
            <Toggle
              label="Tamanho dos nomes"
              value={settings.labelSize}
              onChange={(v) => set('labelSize', v)}
              options={[
                { value: 'p', label: 'Pequeno' },
                { value: 'm', label: 'Médio' },
                { value: 'g', label: 'Grande' },
              ]}
            />
          </Box>
          {showReferences && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, columnGap: 1 }}>
              {REFERENCE_CATEGORIES.map((c) => (
                <FormControlLabel
                  key={c.id}
                  control={
                    <Checkbox
                      size="small"
                      checked={settings.referenceCategories.includes(c.id)}
                      onChange={(e) =>
                        set(
                          'referenceCategories',
                          e.target.checked
                            ? [...settings.referenceCategories, c.id]
                            : settings.referenceCategories.filter((x) => x !== c.id),
                        )
                      }
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          bgcolor: c.color,
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 800,
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        {c.glyph}
                      </Box>
                      <Typography variant="body2">{c.label}</Typography>
                    </Box>
                  }
                />
              ))}
              <Typography variant="caption" color="text.secondary" sx={{ gridColumn: '1 / -1' }}>
                Os pontos vêm do OpenStreetMap. As UBS cadastradas no SIGAPS sempre aparecem com o nome.
              </Typography>
            </Box>
          )}
        </Section>

        <Divider />

        <Section title="Enquadramento">
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Toggle
              label="O que cabe na folha"
              value={settings.framing}
              onChange={(v) => set('framing', v)}
              options={[
                { value: 'auto', label: 'Automático (a área escolhida)' },
                { value: 'tela', label: 'O que está na tela agora' },
              ]}
            />
            <Toggle
              label="Margem em volta"
              value={settings.margin}
              onChange={(v) => set('margin', v)}
              options={[
                { value: 'justo', label: 'Justa' },
                { value: 'normal', label: 'Normal' },
                { value: 'folgado', label: 'Folgada' },
              ]}
            />
          </Box>
          {settings.framing === 'tela' && (
            <Typography variant="caption" color="text.secondary">
              Feche esta janela, arraste e dê zoom no mapa até ficar do jeito que você quer, e abra de
              novo. O PDF mostra exatamente essa área, ajustada ao formato da folha.
            </Typography>
          )}
        </Section>

        <Divider />

        <Section title="Folha">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' }, gap: 1.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Papel</InputLabel>
              <Select
                value={settings.format}
                label="Papel"
                onChange={(e) => set('format', e.target.value as PdfMapSettings['format'])}
              >
                <MenuItem value="a4">A4 horizontal</MenuItem>
                <MenuItem value="a3">A3 horizontal (grande)</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Título"
              placeholder={neighborhoodName && settings.scope === 'bairro' ? `Mapa de microáreas — ${neighborhoodName}` : DEFAULT_TITLE}
              value={settings.title}
              onChange={(e) => set('title', e.target.value)}
              slotProps={{ htmlInput: { maxLength: 90 } }}
            />
          </Box>
          <TextField
            size="small"
            label="Subtítulo (opcional)"
            placeholder="Ex.: Zona rural — UBS Faveira"
            value={settings.subtitle}
            onChange={(e) => set('subtitle', e.target.value)}
            slotProps={{ htmlInput: { maxLength: 90 } }}
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={settings.includeSignatures}
                  onChange={(e) => set('includeSignatures', e.target.checked)}
                />
              }
              label="Campos de assinatura"
            />
            <FormControlLabel
              control={
                <Checkbox checked={settings.includeAnnex} onChange={(e) => set('includeAnnex', e.target.checked)} />
              }
              label="Quadro de microáreas e lista de ruas (folhas seguintes)"
            />
          </Box>
          {municipality?.mapHomologatedAt && (
            <Chip
              color="success"
              label={`Homologado SMS — ${new Date(municipality.mapHomologatedAt).toLocaleDateString('pt-BR')}`}
              sx={{ alignSelf: 'flex-start' }}
            />
          )}
        </Section>

        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        {generating && (
          <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>
            {progress}
          </Typography>
        )}
        <Button onClick={onClose} disabled={generating}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleGenerate}
          disabled={
            generating ||
            !municipality ||
            (settings.scope === 'bairro' && !settings.neighborhoodId) ||
            (settings.scope === 'microareas' && settings.microareaIds.length === 0)
          }
          startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdf />}
        >
          {generating ? 'Gerando PDF...' : 'Gerar e visualizar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
