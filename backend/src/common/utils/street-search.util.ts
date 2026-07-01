const TYPE_PREFIX = /^(rua|avenida|av\.?|travessa|tv\.?|rodovia)\s+/i;

export function tokenizeStreetQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(TYPE_PREFIX, '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

export function buildStreetSearchWhere(municipalityId: string, query: string) {
  const tokens = tokenizeStreetQuery(query);
  if (tokens.length === 0) {
    return {
      municipalityId,
      name: { contains: query.trim(), mode: 'insensitive' as const },
    };
  }
  return {
    municipalityId,
    AND: tokens.map((token) => ({
      name: { contains: token, mode: 'insensitive' as const },
    })),
  };
}
