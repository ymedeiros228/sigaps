import type { Street } from '../services/api';

const TYPE_PREFIX = /^(rua|avenida|av\.?|travessa|tv\.?|rodovia)\s+/i;

export function tokenizeStreetQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(TYPE_PREFIX, '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

export function streetMatchesQuery(
  street: { name: string; streetType?: string },
  query: string,
): boolean {
  const tokens = tokenizeStreetQuery(query);
  if (tokens.length === 0) return false;
  const name = street.name.toLowerCase();
  const label = `${street.streetType ?? 'rua'} ${street.name}`.toLowerCase();
  return tokens.every((t) => name.includes(t) || label.includes(t));
}

export function formatStreetLabel(street: { name: string; streetType?: string }) {
  const type = (street.streetType ?? 'Rua').trim();
  const name = street.name.trim();
  const nameLower = name.toLowerCase();
  const typeLower = type.toLowerCase();
  if (nameLower.startsWith(`${typeLower} `) || nameLower === typeLower) return name;
  if (/^(rua|avenida|av\.?|travessa|tv\.?|rodovia|estrada)\s/i.test(name)) return name;
  return `${type} ${name}`;
}

/** Ruas com geometria válida e origem OSM para exibir no mapa */
export function isMappableStreet(street: Street): boolean {
  if (!street.name?.trim()) return false;
  if (street.name.startsWith('Via OSM')) return false;
  if (street.osmId === null || street.osmId === undefined) return false;
  const coords = street.geojson?.coordinates;
  if (!coords || coords.length < 2) return false;
  const [lng, lat] = fixCoordPair(coords[0] as [number, number]);
  if (lat < -35 || lat > 10 || lng > -28 || lng < -75) return false;
  return true;
}

/** Corrige coordenadas invertidas [lat,lng] → [lng,lat] */
export function fixCoordPair(pair: [number, number]): [number, number] {
  const [a, b] = pair;
  if (Math.abs(a) <= 20 && Math.abs(b) >= 28) return [b, a];
  return [a, b];
}

export function fixLineString(geojson: GeoJSON.LineString): GeoJSON.LineString {
  const coords = geojson?.coordinates;
  if (!Array.isArray(coords)) {
    return { type: 'LineString', coordinates: [] };
  }
  return {
    type: 'LineString',
    coordinates: coords.map((c) => fixCoordPair(c as [number, number])),
  };
}

type StreetLocal = Street & { _localRev?: number };

/** Cache por identidade do objeto — prepare + StreetsLayer não recalculam a string. */
const paintKeyByStreet = new WeakMap<Street, string>();

/**
 * Assinatura da geometria pintada (sem id de segmento / _localRev).
 * Assim o onSuccess com UUIDs novos não invalida o cache do Leaflet.
 */
export function streetPaintCacheKey(street: Street): string {
  const cached = paintKeyByStreet.get(street);
  if (cached) return cached;
  const local = street as StreetLocal;
  const segs = local.paintSegments ?? [];
  let segSig = `${segs.length}`;
  for (const seg of segs) {
    segSig += `|${seg.microareaId}:${seg.startIndex}:${seg.endIndex}:${seg.side}`;
  }
  const key = `${local.id}|${local.microareaId ?? ''}|${segSig}`;
  paintKeyByStreet.set(street, key);
  return key;
}

/** Compara só a geometria da pintura (ignora ids de segmento). */
export function paintGeometryEqual(a: Street, b: Street): boolean {
  if ((a.microareaId ?? null) !== (b.microareaId ?? null)) return false;
  const as = [...(a.paintSegments ?? [])].sort(
    (x, y) => x.startIndex - y.startIndex || String(x.side).localeCompare(String(y.side)),
  );
  const bs = [...(b.paintSegments ?? [])].sort(
    (x, y) => x.startIndex - y.startIndex || String(x.side).localeCompare(String(y.side)),
  );
  if (as.length !== bs.length) return false;
  for (let i = 0; i < as.length; i++) {
    if (
      as[i].startIndex !== bs[i].startIndex ||
      as[i].endIndex !== bs[i].endIndex ||
      as[i].side !== bs[i].side ||
      as[i].microareaId !== bs[i].microareaId
    ) {
      return false;
    }
  }
  return true;
}

/** Reusa ruas já preparadas — um paint não reprocessa as ~700 geometrias. */
const preparedStreetCache = new Map<string, Street>();
let lastPreparedOut: Street[] | null = null;

export function prepareStreetsForMap(streets: Street[]): Street[] {
  const keep = new Set<string>();
  const out: Street[] = [];

  for (const street of streets) {
    if (!isMappableStreet(street)) continue;
    const key = streetPaintCacheKey(street);
    keep.add(key);
    let prepared = preparedStreetCache.get(key);
    if (!prepared) {
      prepared = {
        ...street,
        geojson: fixLineString(street.geojson),
      };
      preparedStreetCache.set(key, prepared);
    }
    out.push(prepared);
  }

  if (preparedStreetCache.size > keep.size + 64) {
    for (const key of preparedStreetCache.keys()) {
      if (!keep.has(key)) preparedStreetCache.delete(key);
    }
  }

  // Mesma identidade de ruas → devolve o array anterior (evita useMemo em cascata).
  if (
    lastPreparedOut &&
    lastPreparedOut.length === out.length &&
    lastPreparedOut.every((s, i) => s === out[i])
  ) {
    return lastPreparedOut;
  }
  lastPreparedOut = out;
  return out;
}
