const CACHE_TTL_MS = 30_000;

const indicatorsCache = new Map<string, { expiresAt: number; data: unknown }>();
const checklistCache = new Map<string, { expiresAt: number; data: unknown }>();

export function getCachedDashboardIndicators<T>(municipalityId: string): T | null {
  const entry = indicatorsCache.get(municipalityId);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.data as T;
}

export function setCachedDashboardIndicators(municipalityId: string, data: unknown) {
  indicatorsCache.set(municipalityId, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function getCachedOperationalChecklist<T>(municipalityId: string): T | null {
  const entry = checklistCache.get(municipalityId);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.data as T;
}

export function setCachedOperationalChecklist(municipalityId: string, data: unknown) {
  checklistCache.set(municipalityId, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function invalidateDashboardIndicators(municipalityId: string) {
  indicatorsCache.delete(municipalityId);
  checklistCache.delete(municipalityId);
}
