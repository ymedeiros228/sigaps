/** Chaves estáveis do React Query — evita colisão de cache e refetch desnecessário. */
export const queryKeys = {
  microareas: (municipalityId: string) => ['microareas', municipalityId] as const,
  paintZones: (municipalityId: string) => ['paint-zones', municipalityId] as const,
  neighborhoods: (municipalityId: string) => ['neighborhoods', municipalityId] as const,
  ubs: (municipalityId: string) => ['ubs', municipalityId] as const,
  streetsMap: (municipalityId: string) => ['streets', municipalityId, 'map'] as const,
  streetsFull: (municipalityId: string) => ['streets', municipalityId, 'full'] as const,
  dashboard: (municipalityId: string) => ['dashboard', municipalityId] as const,
  acsCoverage: (municipalityId: string) => ['dashboard', municipalityId, 'acs-coverage'] as const,
  municipality: (municipalityId: string) => ['municipality', municipalityId] as const,
};

export const CACHE = {
  /** Ruas mudam só ao pintar/importar — cache longo */
  streets: 10 * 60_000,
  microareas: 10 * 60_000,
  neighborhoods: 10 * 60_000,
  paintZones: 5 * 60_000,
  dashboard: 2 * 60_000,
  default: 5 * 60_000,
} as const;
