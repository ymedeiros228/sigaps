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

export function prepareStreetsForMap(streets: Street[]): Street[] {
  return streets
    .filter(isMappableStreet)
    .map((s) => ({
      ...s,
      geojson: fixLineString(s.geojson),
    }));
}
