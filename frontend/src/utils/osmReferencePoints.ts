import type { ReferenceCategory } from './pdfMapSettings';
import bundled from '../data/referencePoints.json';

export interface ReferencePoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: ReferenceCategory;
}

/** [sul, oeste, norte, leste] */
export type Bbox = [number, number, number, number];

export type ReferenceSource = 'sistema' | 'navegador' | 'openstreetmap' | 'nenhum';

/** Filtros do Overpass por categoria (só pontos com nome: sem nome não ajuda o ACS a se localizar). */
const FILTERS: Record<ReferenceCategory, string[]> = {
  saude: ['["amenity"~"^(hospital|clinic|doctors|pharmacy|health_post|dentist)$"]', '["healthcare"]'],
  escola: ['["amenity"~"^(school|kindergarten|college|university)$"]'],
  igreja: ['["amenity"="place_of_worship"]'],
  praca: ['["leisure"~"^(park|pitch|stadium|sports_centre|playground)$"]', '["place"="square"]'],
  publico: [
    '["amenity"~"^(townhall|police|fire_station|post_office|courthouse|community_centre|social_facility|bank|marketplace)$"]',
    '["office"="government"]',
  ],
  comercio: ['["shop"~"^(supermarket|convenience|general|bakery)$"]'],
};

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const LIVE_TIMEOUT_MS = 20_000;
const CACHE_PREFIX = 'sigaps_refpoints_v1:';
const CACHE_DAYS = 30;

function categoryOf(tags: Record<string, string>): ReferenceCategory | null {
  const a = tags.amenity;
  if (tags.healthcare || ['hospital', 'clinic', 'doctors', 'pharmacy', 'health_post', 'dentist'].includes(a)) return 'saude';
  if (['school', 'kindergarten', 'college', 'university'].includes(a)) return 'escola';
  if (a === 'place_of_worship') return 'igreja';
  if (tags.leisure || tags.place === 'square') return 'praca';
  if (tags.shop) return 'comercio';
  if (a || tags.office) return 'publico';
  return null;
}

const inside = (p: { lat: number; lng: number }, [s, w, n, e]: Bbox) =>
  p.lat >= s && p.lat <= n && p.lng >= w && p.lng <= e;

const contains = (outer: Bbox, [s, w, n, e]: Bbox) =>
  s >= outer[0] && w >= outer[1] && n <= outer[2] && e <= outer[3];

/** Pontos guardados no próprio sistema (scripts/fetch-reference-points.mjs). */
const BUNDLED = bundled as unknown as { bbox: Bbox | null; generatedAt?: string; points: ReferencePoint[] };

function cacheKey(bbox: Bbox) {
  return CACHE_PREFIX + bbox.map((n) => n.toFixed(3)).join(',');
}

function readCache(bbox: Bbox): ReferencePoint[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(bbox));
    if (!raw) return null;
    const { at, points } = JSON.parse(raw) as { at: number; points: ReferencePoint[] };
    if (Date.now() - at > CACHE_DAYS * 86_400_000) return null;
    return points;
  } catch {
    return null;
  }
}

function writeCache(bbox: Bbox, points: ReferencePoint[]) {
  try {
    localStorage.setItem(cacheKey(bbox), JSON.stringify({ at: Date.now(), points }));
  } catch {
    /* storage cheio ou bloqueado: segue sem guardar */
  }
}

/** Pede a todos os servidores ao mesmo tempo e fica com o primeiro que responder. */
async function fetchLive(bbox: Bbox): Promise<ReferencePoint[] | null> {
  const box = bbox.map((n) => n.toFixed(6)).join(',');
  const all = Object.values(FILTERS).flat();
  const query = `[out:json][timeout:25];(${all.map((f) => `nwr${f}["name"](${box});`).join('')});out center tags 600;`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS);
  try {
    const json = await Promise.any(
      ENDPOINTS.map(async (url) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
          body: `data=${encodeURIComponent(query)}`,
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as {
          elements: Array<{
            type: string;
            id: number;
            lat?: number;
            lon?: number;
            center?: { lat: number; lon: number };
            tags?: Record<string, string>;
          }>;
        };
      }),
    );
    controller.abort(); // cancela os servidores mais lentos
    const seen = new Set<string>();
    const points: ReferencePoint[] = [];
    for (const el of json.elements ?? []) {
      const tags = el.tags ?? {};
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      const category = categoryOf(tags);
      if (!tags.name || lat == null || lng == null || !category) continue;
      // O mesmo lugar às vezes vem como ponto e como contorno: fica um só.
      const key = `${tags.name.toLowerCase()}|${lat.toFixed(3)}|${lng.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      points.push({ id: `${el.type}/${el.id}`, name: tags.name.trim(), lat, lng, category });
    }
    return points;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pontos de referência dentro da caixa, nesta ordem de preferência:
 * 1. os guardados no sistema (na hora, sem internet);
 * 2. os que este navegador já buscou (30 dias);
 * 3. o OpenStreetMap ao vivo (até 20 s).
 * Falha de rede não derruba o PDF: devolve lista vazia.
 */
export async function getReferencePoints(
  bbox: Bbox,
  categories: ReferenceCategory[],
): Promise<{ points: ReferencePoint[]; source: ReferenceSource }> {
  if (categories.length === 0) return { points: [], source: 'nenhum' };
  const pick = (list: ReferencePoint[]) => list.filter((p) => categories.includes(p.category) && inside(p, bbox));

  if (BUNDLED.bbox && contains(BUNDLED.bbox, bbox)) {
    return { points: pick(BUNDLED.points), source: 'sistema' };
  }
  const cached = readCache(bbox);
  if (cached) return { points: pick(cached), source: 'navegador' };

  const live = await fetchLive(bbox);
  if (live) {
    writeCache(bbox, live);
    return { points: pick(live), source: 'openstreetmap' };
  }
  // Sem internet: pelo menos o que o sistema tem dentro da caixa.
  const fallback = pick(BUNDLED.points);
  return { points: fallback, source: fallback.length > 0 ? 'sistema' : 'nenhum' };
}

/** Contagem rápida (só os guardados no sistema) para o resumo da janela do PDF. */
export function countBundledReferencePoints(bbox: Bbox, categories: ReferenceCategory[]): number | null {
  if (!BUNDLED.bbox || !contains(BUNDLED.bbox, bbox)) return null;
  return BUNDLED.points.filter((p) => categories.includes(p.category) && inside(p, bbox)).length;
}
