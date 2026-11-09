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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ButtonBase,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Agriculture,
  AutoAwesome,
  Category,
  CheckCircle,
  Close,
  CropLandscape,
  Download,
  ExpandMore,
  LocationCity,
  PictureAsPdf,
  Print,
  Public,
  RestartAlt,
  Tune,
} from '@mui/icons-material';
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
import {
  countBundledReferencePoints,
  getReferencePoints,
  type Bbox,
  type ReferencePoint,
} from '../../utils/osmReferencePoints';
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

/** Passo numerado da janela: o número guia a leitura de cima para baixo. */
function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '32px 1fr', columnGap: 1.5 }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          display: 'grid',
          placeItems: 'center',
          fontWeight: 800,
          fontSize: 14,
          mt: 0.25,
        }}
      >
        {n}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 16, lineHeight: 1.3 }}>{title}</Typography>
        {hint && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
            {hint}
          </Typography>
        )}
        <Stack spacing={1.5} sx={{ mt: hint ? 0 : 1.25 }}>
          {children}
        </Stack>
      </Box>
    </Box>
  );
}

/** Cartão de escolha: ícone, nome e uma frase do que acontece. Um clique escolhe. */
function ChoiceCards<T extends string>({
  value,
  onChange,
  options,
  name,
}: {
  value: T;
  onChange: (v: T) => void;
  name: string;
  options: Array<{ value: T; title: string; text: string; icon: ReactNode; badge?: string }>;
}) {
  return (
    <Box
      role="radiogroup"
      aria-label={name}
      sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${options.length}, 1fr)` }, gap: 1 }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <ButtonBase
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            sx={(t) => ({
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'flex-start',
              textAlign: 'left',
              gap: 1.25,
              p: 1.5,
              borderRadius: 2,
              border: '2px solid',
              borderColor: active ? t.palette.primary.main : t.palette.divider,
              bgcolor: active ? alpha(t.palette.primary.main, 0.1) : 'transparent',
              transition: 'border-color .15s, background-color .15s',
              '&:hover': { borderColor: active ? t.palette.primary.main : t.palette.text.secondary },
              '&.Mui-focusVisible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
            })}
          >
            <Box sx={{ color: active ? 'primary.main' : 'text.secondary', mt: 0.25, display: 'flex' }}>{o.icon}</Box>
            <Box sx={{ minWidth: 0, pr: active ? 2.5 : 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.3 }}>{o.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5, lineHeight: 1.35, mt: 0.25 }}>
                {o.text}
              </Typography>
              {o.badge && (
                <Chip size="small" label={o.badge} color="primary" variant="outlined" sx={{ mt: 0.75, height: 20, fontSize: 11 }} />
              )}
            </Box>
            {active && (
              <CheckCircle color="primary" sx={{ position: 'absolute', top: 8, right: 8, fontSize: 18 }} />
            )}
          </ButtonBase>
        );
      })}
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

  // Resumo em palavras do que vai sair na folha (atualiza a cada escolha).
  const summary = useMemo(() => {
    const items: string[] = [settings.format === 'a3' ? 'A3 horizontal' : 'A4 horizontal'];
    if (settings.scope === 'municipio') items.push('Município inteiro');
    else if (settings.scope === 'bairro' && neighborhoodName) items.push(`Bairro ${neighborhoodName}`);
    const nMicro = scope.ids.size;
    items.push(
      `${nMicro} ${nMicro === 1 ? 'microárea' : 'microáreas'} · ${scope.painted.length} ${scope.painted.length === 1 ? 'rua pintada' : 'ruas pintadas'}`,
    );
    items.push(areaKind === 'rural' ? 'Zona rural' : 'Zona urbana');
    const namedPlaces =
      settings.placeLabels === 'nenhum' ? 0 : settings.placeLabels === 'todos' ? places.length : scope.scopedPlaces.length;
    if (namedPlaces > 0) items.push(`${namedPlaces} ${namedPlaces === 1 ? 'povoado' : 'povoados'} com nome`);
    if (showReferences && settings.referenceCategories.length > 0) {
      let s = 90, w = 180, n = -90, e = -180;
      for (const st of scope.painted)
        for (const [lng, lat] of st.geojson!.coordinates) {
          s = Math.min(s, lat); n = Math.max(n, lat); w = Math.min(w, lng); e = Math.max(e, lng);
        }
      for (const p of scope.scopedPlaces) {
        s = Math.min(s, p.latitude); n = Math.max(n, p.latitude); w = Math.min(w, p.longitude); e = Math.max(e, p.longitude);
      }
      const count = s <= n ? countBundledReferencePoints([s, w, n, e] as Bbox, settings.referenceCategories) : null;
      if (s <= n) items.push(
        count == null
          ? 'Pontos de referência (OpenStreetMap)'
          : count === 0
            ? 'Sem pontos de referência cadastrados aqui'
            : `~${Math.min(count, MAX_REFERENCE_POINTS)} pontos de referência`,
      );
    }
    if (ubsList.length > 0) items.push('UBS com nome');
    if (settings.scope !== 'municipio') items.push('Outras microáreas em cinza');
    if (settings.includeSignatures) items.push('Assinaturas');
    if (settings.includeAnnex) items.push('Lista de ruas anexa');
    return items;
  }, [settings, scope, areaKind, showReferences, neighborhoodName, places, ubsList.length]);

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
      // Povoado na legenda só quando aparece algum na folha (no mapa urbano não costuma ter).
      const placesOnSheet =
        settings.otherPlaces !== 'esconder' && settings.scope === 'municipio'
          ? places.length
          : scope.scopedPlaces.length + (settings.placeLabels === 'todos' && areaKind === 'rural' ? places.length : 0);
      if (placesOnSheet > 0) {
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
      let refSource = '';
      // Recorte: só as microáreas escolhidas ficam coloridas; as outras saem em cinza.
      const focusColors =
        settings.scope === 'municipio'
          ? null
          : pdfMicroareas.map((m) => m.color.toLowerCase());
      const capture = await captureMapForPdf(map, {
        boxRatio,
        cssWidth: CAPTURE_CSS_WIDTH[settings.format],
        bounds,
        marginPx: MARGIN_PX[settings.margin],
        scale: 2,
        beforeCapture: async (visible) => {
          if (showReferences && settings.referenceCategories.length > 0) {
            setProgress('Buscando pontos de referência…');
            const found = await getReferencePoints(
              [visible.getSouth(), visible.getWest(), visible.getNorth(), visible.getEast()],
              settings.referenceCategories,
            );
            refSource = found.source;
            // Ordem das categorias = prioridade quando há pontos demais.
            const order = REFERENCE_CATEGORIES.map((c) => c.id);
            refs = found.points
              .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))
              .slice(0, MAX_REFERENCE_POINTS);
          }
          useMapStore.getState().setPdfCapture({
            microareaIds: [...scope.ids],
            placeLabels: settings.placeLabels,
            otherPlaces: settings.otherPlaces,
            labelScale: LABEL_SCALE[settings.labelSize],
            referencePoints: refs,
            focusColors,
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
        setNotice(
          refSource === 'nenhum'
            ? 'Não consegui buscar os pontos de referência agora (OpenStreetMap fora do ar). O PDF saiu sem eles; tente de novo mais tarde.'
            : 'Não há pontos de referência com nome cadastrados no OpenStreetMap nesta área.',
        );
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
  const missingChoice =
    (settings.scope === 'bairro' && !settings.neighborhoodId) ||
    (settings.scope === 'microareas' && settings.microareaIds.length === 0);
  const autoLabel = scope.detected === 'rural' ? 'rural' : 'urbana';
  const toggleCategory = (id: ReferenceCategory, on: boolean) =>
    set(
      'referenceCategories',
      on ? [...settings.referenceCategories, id] : settings.referenceCategories.filter((x) => x !== id),
    );

  return (
    <Dialog open={open} onClose={generating ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 0.5 }}>
        <PictureAsPdf color="primary" />
        <Box sx={{ minWidth: 0 }}>
          <Typography component="span" sx={{ fontWeight: 800, fontSize: 19, display: 'block' }}>
            Mapa oficial em PDF
          </Typography>
          <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block' }}>
            Três escolhas e pronto. O resto já vem no ponto; mude em «Mais opções» se quiser.
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          startIcon={<RestartAlt />}
          onClick={() => setSettings(DEFAULT_PDF_SETTINGS)}
          disabled={generating}
          sx={{ flexShrink: 0 }}
        >
          Restaurar padrão
        </Button>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: '16px !important' }}>
        {homologReview && (
          <Alert severity="info" data-testid="pdf-homolog-review-hint">
            <strong>Revisão para homologação SMS:</strong> confira cores, limites e nomes antes de
            imprimir em A3. Depois registre o aceite em Admin → Homologação.
          </Alert>
        )}

        {paintedCount === 0 && (
          <Alert severity="warning">
            Nenhuma rua foi pintada ainda. O PDF sai só com o mapa de ruas e as UBS; as cores das
            microáreas aparecem depois que você pintar as ruas.
          </Alert>
        )}

        <Step n={1} title="O que vai na folha?" hint="Escolha a área que o mapa vai mostrar.">
          <ChoiceCards
            name="O que vai na folha"
            value={settings.scope}
            onChange={(v) => set('scope', v)}
            options={[
              { value: 'municipio', title: 'Município inteiro', text: 'Todas as microáreas numa folha só.', icon: <Public /> },
              { value: 'bairro', title: 'Um bairro', text: 'Só as ruas e microáreas do bairro.', icon: <LocationCity /> },
              {
                value: 'microareas',
                title: 'Microáreas escolhidas',
                text: 'Uma ou mais microáreas, ex.: as da UBS Faveira.',
                icon: <Category />,
              },
            ]}
          />
          {settings.scope === 'bairro' && (
            <FormControl fullWidth size="small" error={!settings.neighborhoodId}>
              <InputLabel id="pdf-bairro-label">Qual bairro?</InputLabel>
              <Select
                labelId="pdf-bairro-label"
                value={settings.neighborhoodId}
                label="Qual bairro?"
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
          {settings.scope === 'bairro' && settings.neighborhoodId && scope.scopedStreets.length === 0 && (
            <Alert severity="warning">
              Nenhuma rua está ligada a este bairro ainda, então a folha sairia vazia. Ligue as ruas ao
              bairro em Cadastros ou escolha «Microáreas escolhidas».
            </Alert>
          )}
          {settings.scope === 'microareas' && (
            <Autocomplete
              multiple
              size="small"
              disableCloseOnSelect
              options={microareas}
              value={selectedMicroareas}
              noOptionsText="Nenhuma microárea cadastrada"
              getOptionLabel={(m) => (m.acs?.name ? `${m.name} · ${m.acs.name}` : m.name)}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_, v) => set('microareaIds', v.map((m) => m.id))}
              renderOption={(props, m, { selected }) => {
                const { key, ...rest } = props as typeof props & { key: string };
                return (
                  <Box component="li" key={key} {...rest} sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                    <Checkbox size="small" checked={selected} sx={{ p: 0.25 }} />
                    <Box sx={{ width: 14, height: 14, borderRadius: 0.5, bgcolor: m.color, flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {m.name}
                      </Typography>
                      {(m.acs?.name || m.ubs?.name) && (
                        <Typography variant="caption" color="text.secondary">
                          {[m.acs?.name, m.ubs?.name].filter(Boolean).join(' · ')}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                );
              }}
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
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Quais microáreas?"
                  placeholder={selectedMicroareas.length ? '' : 'Clique e marque uma ou mais'}
                  error={selectedMicroareas.length === 0}
                />
              )}
            />
          )}
        </Step>

        <Step
          n={2}
          title="Que tipo de área é?"
          hint="Muda o que aparece no mapa. No automático o sistema olha as ruas e os povoados da área."
        >
          <ChoiceCards
            name="Tipo de área"
            value={settings.areaKind}
            onChange={(v) => set('areaKind', v)}
            options={[
              {
                value: 'auto',
                title: 'Automático',
                text: 'O sistema decide pela área escolhida.',
                icon: <AutoAwesome />,
                badge: `zona ${autoLabel}`,
              },
              {
                value: 'rural',
                title: 'Zona rural',
                text: 'Aproxima nas estradas e mostra o nome de cada povoado.',
                icon: <Agriculture />,
              },
              {
                value: 'urbana',
                title: 'Zona urbana',
                text: 'Aproxima nas ruas e mostra escolas, praças, igrejas…',
                icon: <LocationCity />,
              },
            ]}
          />
        </Step>

        <Step n={3} title="Papel e título">
          <ChoiceCards
            name="Papel"
            value={settings.format}
            onChange={(v) => set('format', v)}
            options={[
              { value: 'a4', title: 'A4 horizontal', text: 'Folha comum, impressora de escritório.', icon: <CropLandscape /> },
              {
                value: 'a3',
                title: 'A3 horizontal',
                text: 'O dobro do tamanho. Melhor para a parede da UBS.',
                icon: <CropLandscape sx={{ fontSize: 30 }} />,
              },
            ]}
          />
          <TextField
            size="small"
            label="Título"
            placeholder={
              neighborhoodName && settings.scope === 'bairro' ? `Mapa de microáreas — ${neighborhoodName}` : DEFAULT_TITLE
            }
            helperText="Deixe vazio para usar o título padrão."
            value={settings.title}
            onChange={(e) => set('title', e.target.value)}
            slotProps={{ htmlInput: { maxLength: 90 }, inputLabel: { shrink: true } }}
          />
          <TextField
            size="small"
            label="Subtítulo (opcional)"
            placeholder="Ex.: Zona rural — UBS Faveira"
            value={settings.subtitle}
            onChange={(e) => set('subtitle', e.target.value)}
            slotProps={{ htmlInput: { maxLength: 90 }, inputLabel: { shrink: true } }}
          />
        </Step>

        <Accordion
          disableGutters
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px !important', '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tune color="action" />
              <Box>
                <Typography sx={{ fontWeight: 700 }}>Mais opções</Typography>
                <Typography variant="caption" color="text.secondary">
                  Nomes, pontos de referência, enquadramento e assinaturas
                </Typography>
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 0 }}>
            <Section title="Nomes no mapa">
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="pdf-nomes-label">Nomes dos povoados</InputLabel>
                  <Select
                    labelId="pdf-nomes-label"
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
                  <InputLabel id="pdf-fora-label">Povoados de fora da área</InputLabel>
                  <Select
                    labelId="pdf-fora-label"
                    value={settings.otherPlaces}
                    label="Povoados de fora da área"
                    onChange={(e) => set('otherPlaces', e.target.value as PdfMapSettings['otherPlaces'])}
                  >
                    <MenuItem value="apagados">Apagados (cinza, sem destaque)</MenuItem>
                    <MenuItem value="normal">Normais</MenuItem>
                    <MenuItem value="esconder">Esconder</MenuItem>
                  </Select>
                </FormControl>
              </Box>
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
            </Section>

            <Divider />

            <Section title="Pontos de referência">
              <Toggle
                value={settings.references}
                onChange={(v) => set('references', v)}
                options={[
                  { value: 'auto', label: 'Automático (só na zona urbana)' },
                  { value: 'sim', label: 'Mostrar sempre' },
                  { value: 'nao', label: 'Não mostrar' },
                ]}
              />
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  columnGap: 1,
                  opacity: showReferences ? 1 : 0.45,
                }}
              >
                {REFERENCE_CATEGORIES.map((c) => (
                  <FormControlLabel
                    key={c.id}
                    disabled={!showReferences}
                    control={
                      <Checkbox
                        size="small"
                        checked={settings.referenceCategories.includes(c.id)}
                        onChange={(e) => toggleCategory(c.id, e.target.checked)}
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
              </Box>
              <Typography variant="caption" color="text.secondary">
                {showReferences
                  ? 'Os pontos vêm do OpenStreetMap (já guardados no sistema). As UBS do SIGAPS sempre aparecem com o nome.'
                  : 'Desligados nesta folha. Para ligar, escolha «Mostrar sempre» ou a zona urbana no passo 2.'}
              </Typography>
            </Section>

            <Divider />

            <Section title="Enquadramento">
              <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                <Toggle
                  label="O que cabe na folha"
                  value={settings.framing}
                  onChange={(v) => set('framing', v)}
                  options={[
                    { value: 'auto', label: 'A área escolhida (automático)' },
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
              <Typography variant="caption" color="text.secondary">
                {settings.framing === 'tela'
                  ? 'Feche esta janela, arraste e dê zoom no mapa até ficar do jeito que você quer, e abra de novo. O PDF mostra exatamente essa área, ajustada ao formato da folha.'
                  : 'O mapa aproxima sozinho até a área escolhida encher a folha. Margem justa = mais zoom.'}
              </Typography>
            </Section>

            <Divider />

            <Section title="Folhas e assinaturas">
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
          </AccordionDetails>
        </Accordion>

        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions
        sx={{ px: 3, py: 1.5, gap: 1.5, flexDirection: 'column', alignItems: 'stretch', borderTop: '1px solid', borderColor: 'divider' }}
      >
        <Box data-testid="pdf-summary" sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.75 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center', gap: 0.5, mr: 0.5 }}>
            <CheckCircle color="success" sx={{ fontSize: 17 }} />
            Como vai sair:
          </Typography>
          {missingChoice && (
            <Typography variant="body2" color="text.secondary">
              aparece aqui depois da escolha do passo 1.
            </Typography>
          )}
          {!missingChoice && summary.map((s) => (
            <Chip key={s} size="small" label={s} variant="outlined" sx={{ height: 22, fontSize: 12 }} />
          ))}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, m: '0 !important' }}>
          <Typography
            variant="body2"
            color={missingChoice && !generating ? 'error' : 'text.secondary'}
            sx={{ mr: 'auto', fontWeight: missingChoice ? 700 : 400 }}
          >
            {generating
              ? progress
              : missingChoice
                ? settings.scope === 'bairro'
                  ? 'Escolha o bairro no passo 1.'
                  : 'Escolha pelo menos uma microárea no passo 1.'
                : ''}
          </Typography>
          <Button onClick={onClose} disabled={generating}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            size="large"
            onClick={handleGenerate}
            disabled={generating || !municipality || missingChoice}
            startIcon={generating ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdf />}
          >
            {generating ? 'Gerando PDF…' : 'Gerar e visualizar'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
