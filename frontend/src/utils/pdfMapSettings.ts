import type { Place, Street } from '../services/api';
import type { PdfFormat } from './mapPdfExport';

/** Categorias de pontos de referência que podem ir no mapa do PDF. */
export type ReferenceCategory = 'saude' | 'escola' | 'igreja' | 'praca' | 'publico' | 'comercio';

export const REFERENCE_CATEGORIES: Array<{
  id: ReferenceCategory;
  label: string;
  short: string;
  glyph: string;
  color: string;
}> = [
  { id: 'saude', label: 'Saúde (hospital, posto, farmácia)', short: 'Saúde', glyph: '+', color: '#0277BD' },
  { id: 'escola', label: 'Escolas e creches', short: 'Escola', glyph: 'E', color: '#EF6C00' },
  { id: 'igreja', label: 'Igrejas', short: 'Igreja', glyph: '✝', color: '#6A1B9A' },
  { id: 'praca', label: 'Praças, campos e lazer', short: 'Praça / lazer', glyph: '♣', color: '#2E7D32' },
  { id: 'publico', label: 'Órgãos públicos (prefeitura, CRAS, delegacia…)', short: 'Órgão público', glyph: '■', color: '#455A64' },
  { id: 'comercio', label: 'Mercados e comércio', short: 'Comércio', glyph: '$', color: '#AD1457' },
];

export type AreaKind = 'auto' | 'rural' | 'urbana';
export type PlaceLabelMode = 'area' | 'todos' | 'nenhum';
export type OtherPlacesMode = 'apagados' | 'normal' | 'esconder';
export type LabelSize = 'p' | 'm' | 'g';
export type FramingMode = 'auto' | 'tela';
export type FramingMargin = 'justo' | 'normal' | 'folgado';
export type ScopeMode = 'municipio' | 'bairro' | 'microareas';
export type ReferenceMode = 'auto' | 'sim' | 'nao';

/** Tudo o que a pessoa escolhe na janela do PDF. Fica salvo no navegador para a próxima vez. */
export interface PdfMapSettings {
  format: PdfFormat;
  scope: ScopeMode;
  neighborhoodId: string;
  microareaIds: string[];
  areaKind: AreaKind;
  placeLabels: PlaceLabelMode;
  otherPlaces: OtherPlacesMode;
  /** Pontos de referência: automático = só na zona urbana. */
  references: ReferenceMode;
  referenceCategories: ReferenceCategory[];
  labelSize: LabelSize;
  framing: FramingMode;
  margin: FramingMargin;
  title: string;
  subtitle: string;
  includeSignatures: boolean;
  includeAnnex: boolean;
}

export const DEFAULT_TITLE = 'Mapa oficial de microáreas — APS';

export const DEFAULT_PDF_SETTINGS: PdfMapSettings = {
  format: 'a4',
  scope: 'municipio',
  neighborhoodId: '',
  microareaIds: [],
  areaKind: 'auto',
  placeLabels: 'area',
  otherPlaces: 'apagados',
  references: 'auto',
  referenceCategories: ['saude', 'escola', 'igreja', 'praca', 'publico'],
  labelSize: 'm',
  framing: 'auto',
  margin: 'normal',
  title: '',
  subtitle: '',
  includeSignatures: true,
  includeAnnex: true,
};

const STORAGE_KEY = 'sigaps_pdf_settings_v1';

export function loadPdfSettings(): PdfMapSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PDF_SETTINGS;
    return { ...DEFAULT_PDF_SETTINGS, ...(JSON.parse(raw) as Partial<PdfMapSettings>) };
  } catch {
    return DEFAULT_PDF_SETTINGS;
  }
}

export function savePdfSettings(settings: PdfMapSettings) {
  try {
    // Recorte (bairro/microáreas) é de cada impressão; o resto vira a preferência da pessoa.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, neighborhoodId: '', microareaIds: [] }));
  } catch {
    /* storage indisponível */
  }
}

/** Margem em pixels da janela de captura (de cada lado). */
export const MARGIN_PX: Record<FramingMargin, number> = { justo: 18, normal: 48, folgado: 110 };

/** Fator de tamanho dos nomes no mapa. */
export const LABEL_SCALE: Record<LabelSize, number> = { p: 0.85, m: 1.05, g: 1.3 };

export function isStreetPainted(s: Street): boolean {
  return !!s.microareaId || (s.paintSegments?.length ?? 0) > 0;
}

export function streetInMicroareas(s: Street, ids: Set<string>): boolean {
  if (s.microareaId && ids.has(s.microareaId)) return true;
  return s.paintSegments?.some((seg) => !!seg.microareaId && ids.has(seg.microareaId)) ?? false;
}

/**
 * Só o que está pintado da rua nas microáreas do recorte. Uma estrada de 9 km com um
 * trecho pintado conta pelo trecho: a estrada inteira esticaria o enquadramento do PDF.
 */
export function paintedLinesOfStreet(s: Street, ids: Set<string>): GeoJSON.LineString[] {
  if (s.microareaId && ids.has(s.microareaId) && s.geojson) return [s.geojson];
  return (s.paintSegments ?? [])
    .filter((seg) => ids.has(seg.microareaId) && seg.geojson)
    .map((seg) => seg.geojson);
}

/** Microáreas que aparecem nas ruas do recorte. */
export function microareaIdsOfStreets(streets: Street[]): Set<string> {
  const ids = new Set<string>();
  for (const s of streets) {
    if (s.microareaId) ids.add(s.microareaId);
    s.paintSegments?.forEach((seg) => seg.microareaId && ids.add(seg.microareaId));
  }
  return ids;
}

function diagonalKm(lines: GeoJSON.LineString[]): number {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const line of lines) {
    for (const [lng, lat] of line.coordinates) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  if (!Number.isFinite(minLng)) return 0;
  const cos = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const dx = (maxLng - minLng) * 111.32 * cos;
  const dy = (maxLat - minLat) * 110.57;
  return Math.hypot(dx, dy);
}

/**
 * Zona rural ou urbana, decidida pelos dados: microárea com povoado ligado a ela,
 * ou ruas espalhadas por mais de 4 km, é rural. O resto é urbano.
 */
export function detectAreaKind(
  streets: Street[],
  places: Place[],
  microareaIds: Set<string>,
): 'rural' | 'urbana' {
  if (places.some((p) => p.microareaId && microareaIds.has(p.microareaId))) return 'rural';
  const lines = streets.flatMap((s) => paintedLinesOfStreet(s, microareaIds));
  return diagonalKm(lines) > 4 ? 'rural' : 'urbana';
}
