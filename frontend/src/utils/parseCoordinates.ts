/** Converte célula da planilha em número (aceita vírgula decimal). */
export function parseCoordNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const normalized = raw.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Aceita "lat, lng", "lat lng" ou coordenadas copiadas do Google Maps. */
export function parseCoordinatePair(
  raw: string,
): { latitude: number; longitude: number } | null {
  const cleaned = raw.trim().replace(/[;|]/g, ',');
  const parts = cleaned
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const latitude = parseCoordNumber(parts[0]);
  const longitude = parseCoordNumber(parts[1]);
  if (latitude == null || longitude == null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}
