/** Tipos de via incluídos no mapa (pavimentadas + rurais). */
export const HIGHWAY_FILTER =
  '^(primary|secondary|tertiary|residential|unclassified|living_street|track|path|service)$';

const DIRT_HIGHWAYS = new Set(['track', 'path']);

export function resolveOsmStreetName(
  tags: Record<string, string> | undefined,
  osmId: number | string,
): string | null {
  const name = tags?.name?.trim();
  if (name) return name;

  const highway = tags?.highway ?? '';
  if (!DIRT_HIGHWAYS.has(highway) && highway !== 'service') return null;

  const ref = tags?.ref?.trim();
  if (ref) return `Estrada ${ref}`;

  if (highway === 'service') return `Via de acesso #${osmId}`;
  return `Estrada de terra #${osmId}`;
}

export function inferStreetType(name: string, tags?: Record<string, string>) {
  const highway = tags?.highway ?? '';
  if (DIRT_HIGHWAYS.has(highway)) return 'Estrada de terra';
  if (highway === 'service') return 'Via de acesso';

  const lower = name.toLowerCase();
  if (lower.includes('avenida') || lower.startsWith('av ')) return 'Avenida';
  if (lower.includes('travessa') || lower.startsWith('tv ')) return 'Travessa';
  if (lower.includes('rodovia')) return 'Rodovia';
  if (lower.includes('estrada de terra')) return 'Estrada de terra';
  if (highway === 'primary') return 'Via Principal';
  return 'Rua';
}
