/** Tipos de via incluídos no mapa (pavimentadas + rurais + acessos). */
export const HIGHWAY_FILTER =
  '^(primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|trunk|trunk_link|residential|unclassified|living_street|track|path|service|road|bridleway)$';

const DIRT_HIGHWAYS = new Set(['track', 'path']);

const UNNAMED_HIGHWAY_LABEL: Record<string, string> = {
  primary: 'Via principal',
  primary_link: 'Acesso via principal',
  secondary: 'Via secundária',
  secondary_link: 'Acesso via secundária',
  tertiary: 'Via terciária',
  tertiary_link: 'Acesso via terciária',
  trunk: 'Rodovia',
  trunk_link: 'Acesso rodovia',
  residential: 'Rua sem nome',
  unclassified: 'Via sem nome',
  living_street: 'Rua residencial',
  track: 'Estrada de terra',
  path: 'Caminho',
  service: 'Via de acesso',
  road: 'Via',
  bridleway: 'Trilha',
};

function pickTaggedName(tags: Record<string, string> | undefined): string | null {
  if (!tags) return null;
  const candidates = [
    tags.name,
    tags['name:pt'],
    tags.alt_name,
    tags.loc_name,
    tags.official_name,
    tags.ref,
  ];
  for (const raw of candidates) {
    const value = raw?.trim();
    if (value) return value;
  }
  return null;
}

export function resolveOsmStreetName(
  tags: Record<string, string> | undefined,
  osmId: number | string,
): string | null {
  const highway = tags?.highway ?? '';
  if (!highway) return null;

  const tagged = pickTaggedName(tags);
  if (tagged) {
    if (tags?.ref?.trim() && tagged === tags.ref.trim() && !tagged.toLowerCase().startsWith('estrada')) {
      return `Estrada ${tagged}`;
    }
    return tagged;
  }

  const label = UNNAMED_HIGHWAY_LABEL[highway];
  if (!label) return null;

  return `${label} #${osmId}`;
}

export function inferStreetType(name: string, tags?: Record<string, string>) {
  const highway = tags?.highway ?? '';
  if (DIRT_HIGHWAYS.has(highway)) return 'Estrada de terra';
  if (highway === 'service') return 'Via de acesso';
  if (highway === 'primary' || highway === 'primary_link') return 'Via Principal';
  if (highway === 'secondary' || highway === 'secondary_link') return 'Via Secundária';
  if (highway === 'tertiary' || highway === 'tertiary_link') return 'Via Terciária';
  if (highway === 'trunk' || highway === 'trunk_link') return 'Rodovia';

  const lower = name.toLowerCase();
  if (lower.includes('avenida') || lower.startsWith('av ')) return 'Avenida';
  if (lower.includes('travessa') || lower.startsWith('tv ')) return 'Travessa';
  if (lower.includes('rodovia')) return 'Rodovia';
  if (lower.includes('estrada de terra') || lower.includes('caminho #')) return 'Estrada de terra';
  if (lower.includes('via de acesso')) return 'Via de acesso';
  if (lower.includes('rua sem nome') || lower.includes('rua residencial')) return 'Rua';
  if (lower.includes('via sem nome') || lower.includes('via principal') || lower.includes('via secundária')) {
    return 'Via';
  }
  return 'Rua';
}
