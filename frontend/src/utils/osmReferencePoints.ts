import type { ReferenceCategory } from './pdfMapSettings';

export interface ReferencePoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: ReferenceCategory;
}

/** Filtros do Overpass por categoria (só pontos com nome: sem nome não ajuda o ACS a se localizar). */
const FILTERS: Record<ReferenceCategory, string[]> = {
  saude: ['["amenity"~"^(hospital|clinic|doctors|pharmacy|health_post)$"]', '["healthcare"]'],
  escola: ['["amenity"~"^(school|kindergarten|college|university)$"]'],
  igreja: ['["amenity"="place_of_worship"]'],
  praca: ['["leisure"~"^(park|pitch|stadium|sports_centre|playground)$"]', '["place"="square"]'],
  publico: [
    '["amenity"~"^(townhall|police|fire_station|post_office|courthouse|community_centre|social_facility|bank|marketplace)$"]',
    '["office"="government"]',
  ],
  comercio: ['["shop"~"^(supermarket|convenience|general|bakery)$"]'],
};

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

function categoryOf(tags: Record<string, string>): ReferenceCategory | null {
  const a = tags.amenity;
  if (tags.healthcare || ['hospital', 'clinic', 'doctors', 'pharmacy', 'health_post'].includes(a)) return 'saude';
  if (['school', 'kindergarten', 'college', 'university'].includes(a)) return 'escola';
  if (a === 'place_of_worship') return 'igreja';
  if (tags.leisure || tags.place === 'square') return 'praca';
  if (tags.shop) return 'comercio';
  if (a || tags.office) return 'publico';
  return null;
}

/**
 * Pontos de referência do OpenStreetMap dentro da caixa [sul, oeste, norte, leste].
 * Falha de rede não derruba o PDF: devolve lista vazia.
 */
export async function fetchReferencePoints(
  bbox: [number, number, number, number],
  categories: ReferenceCategory[],
): Promise<ReferencePoint[]> {
  if (categories.length === 0) return [];
  const box = bbox.map((n) => n.toFixed(6)).join(',');
  const parts = categories.flatMap((c) => FILTERS[c].map((f) => `nwr${f}["name"](${box});`));
  const query = `[out:json][timeout:25];(${parts.join('')});out center tags 400;`;

  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        elements: Array<{
          type: string;
          id: number;
          lat?: number;
          lon?: number;
          center?: { lat: number; lon: number };
          tags?: Record<string, string>;
        }>;
      };
      const seen = new Set<string>();
      const points: ReferencePoint[] = [];
      for (const el of json.elements ?? []) {
        const tags = el.tags ?? {};
        const lat = el.lat ?? el.center?.lat;
        const lng = el.lon ?? el.center?.lon;
        const category = categoryOf(tags);
        if (!tags.name || lat == null || lng == null || !category || !categories.includes(category)) continue;
        // O mesmo lugar às vezes vem como ponto e como contorno: fica um só.
        const key = `${tags.name.toLowerCase()}|${lat.toFixed(3)}|${lng.toFixed(3)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        points.push({ id: `${el.type}/${el.id}`, name: tags.name, lat, lng, category });
      }
      return points;
    } catch {
      /* tenta o próximo servidor */
    }
  }
  return [];
}
