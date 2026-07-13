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

export type StreetRefCatalogEntry = {
  id: string;
  name: string;
  streetType?: string | null;
  microareaId?: string | null;
  searchKeys: string[];
};

export type StreetRefMatchResult =
  | { status: 'matched'; street: StreetRefCatalogEntry }
  | { status: 'ambiguous' }
  | { status: 'unmatched' };

export function buildStreetRefCatalog(
  streets: Array<{ id: string; name: string; streetType?: string | null; microareaId?: string | null }>,
): StreetRefCatalogEntry[] {
  return streets.map((street) => ({
    ...street,
    searchKeys: buildStreetSearchKeys(street),
  }));
}

/** Casa referência de logradouro (e-SUS, CSV) com ruas do município. */
export function matchStreetRef(ref: string, catalog: StreetRefCatalogEntry[]): StreetRefMatchResult {
  const refVariants = buildStreetCoverageVariants(ref);
  const exact = new Map<string, StreetRefCatalogEntry>();
  for (const entry of catalog) {
    if (refVariants.some((variant) => entry.searchKeys.includes(variant))) {
      exact.set(entry.id, entry);
    }
  }
  if (exact.size === 1) {
    return { status: 'matched', street: [...exact.values()][0] };
  }
  if (exact.size > 1) {
    return { status: 'ambiguous' };
  }

  const partial = new Map<string, StreetRefCatalogEntry>();
  for (const entry of catalog) {
    if (
      refVariants.some(
        (variant) =>
          variant.length >= 4 &&
          entry.searchKeys.some((key) => key.includes(variant) || variant.includes(key)),
      )
    ) {
      partial.set(entry.id, entry);
    }
  }
  if (partial.size === 1) {
    return { status: 'matched', street: [...partial.values()][0] };
  }
  if (partial.size > 1) {
    return { status: 'ambiguous' };
  }
  return { status: 'unmatched' };
}
