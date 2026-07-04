const STREET_TYPE_PREFIXES = [
  'rua',
  'r',
  'avenida',
  'av',
  'travessa',
  'trav',
  'tv',
  'estrada',
  'est',
  'rodovia',
  'rod',
  'alameda',
  'beco',
  'viela',
  'ladeira',
  'praca',
  'praça',
];

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeStreetCoverageText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripStreetTypePrefix(value: string) {
  const normalized = normalizeStreetCoverageText(value);
  const prefixRegex = new RegExp(`^(?:${STREET_TYPE_PREFIXES.join('|')})\\s+`, 'i');
  return normalized.replace(prefixRegex, '').trim();
}

export function splitStreetCoverageText(value?: string | null) {
  if (!value?.trim()) return [];
  const prepared = value
    .replace(/\r/g, '\n')
    .replace(/[•●▪◦]/g, '\n')
    .replace(/\t/g, '\n');
  const pieces = /[;\n|]+/.test(prepared)
    ? prepared.split(/[;\n|]+/)
    : prepared.split(/\s*,\s*/);
  return unique(
    pieces
      .map((piece) => piece.trim().replace(/^[-–—]+\s*/, '').trim())
      .filter((piece) => piece.length > 1),
  );
}

export function buildStreetCoverageVariants(value: string) {
  const normalized = normalizeStreetCoverageText(value);
  const stripped = stripStreetTypePrefix(value);
  return unique([normalized, stripped]).filter((item) => item.length >= 3);
}

export function buildStreetSearchKeys(street: { name: string; streetType?: string | null }) {
  return unique([
    ...buildStreetCoverageVariants(street.name),
    ...buildStreetCoverageVariants(`${street.streetType ?? ''} ${street.name}`),
  ]);
}
